# AGENTS.md

## Contexte projet

LocalMind est une application front-end Vite/TypeScript qui propose une interface RAG locale autour de l’API `LanguageModel` de Chrome/Gemini Nano. L’application reste côté navigateur : les sources du corpus sont importées localement ou depuis une URL, stockées en `sessionStorage`, puis injectées dans les prompts envoyés au modèle local.

Le projet est écrit en français côté interface, messages d’erreur, prompts système et libellés utilisateur. Toute évolution fonctionnelle visible par l’utilisateur doit conserver ce ton et cette langue.

## Stack et commandes

- Runtime/build : Vite avec TypeScript en modules ES.
- Code principal : `src/main.ts`, `src/functions.ts`, `src/constants.ts`, `src/global.d.ts`.
- Styles : `src/style.css`.
- Page HTML : `index.html`.
- Dépendances importantes : `dompurify`, `marked`, `unpdf`, `turndown`.
- Commandes disponibles :
  - `npm run dev` : lance le serveur Vite.
  - `npm run build` : compile TypeScript puis génère le build Vite.
  - `npm run preview` : sert le build généré.

## Architecture à respecter

- `src/main.ts` initialise l’application, branche les événements globaux, expose `window.localMindAI` et détruit la session au `pagehide`.
- `src/constants.ts` centralise les options du modèle, les références DOM, les clés de stockage, les familles de sources, la configuration des panneaux latéraux et le prompt système RAG.
- `src/functions.ts` contient la logique applicative :
  - détection et création de session `LanguageModel` ;
  - gestion des sources locales et web ;
  - persistance/restauration du corpus dans `sessionStorage` ;
  - génération de suggestions ;
  - construction du contenu de corpus pour les prompts ;
  - conversation en streaming avec rendu Markdown sécurisé.
- `src/global.d.ts` décrit les types globaux navigateur et les types métier (`LocalSource`, `SourceFamily`, `CorpusPromptPart`, etc.).

## Conventions de code

- Conserver le style TypeScript strict existant : typage explicite sur les fonctions, unions littérales, `unknown` dans les `catch`, retours `void` lorsque pertinent.
- Préférer les fonctions utilitaires locales déjà présentes avant d’ajouter de nouvelles abstractions.
- Ne pas déplacer de logique entre fichiers sans nécessité : le projet est volontairement simple et centré sur quelques fichiers.
- Respecter les noms et messages en français pour tout texte affiché ou lié à l’expérience utilisateur.
- Les modifications DOM doivent utiliser les helpers et références existants, notamment `queryElement` et `elements`.
- Pour les imports dynamiques, conserver le lazy loading quand il protège le bundle initial ou correspond au fonctionnement existant.
- Ne pas affaiblir la sécurité du rendu : le Markdown généré doit rester sanitizé avec `DOMPurify` avant injection HTML.

## Corpus, sources et stockage

- Les sources supportées sont catégorisées par `SourceFamily` : `image`, `text`, `office`, `pdf`, `web`.
- Les données du corpus sont limitées par `MAX_LOCAL_STORAGE_BYTES` et stockées pendant la session navigateur.
- Toute modification du stockage doit préserver :
  - la clé d’index `SOURCE_INDEX_STORAGE_KEY` ;
  - le préfixe de données `SOURCE_DATA_STORAGE_PREFIX` ;
  - la restauration des sources après rechargement ;
  - le comportement de suppression via le bouton d’effacement de session.
- Les sources web doivent rester nettoyées avant persistance ou injection dans le prompt. Ne pas réintroduire de balises actives ou de contenu inutile (`link`, `style`, `script`, etc.) dans le corpus transmis au modèle.
- Pour les sources web, conserver les conversions et nettoyages déjà en place et éviter les reconversions inutiles au moment de construire le prompt.

## Prompt API et conversation

- L’application dépend de l’API expérimentale `LanguageModel` exposée par Chrome. Ne pas remplacer cette API par un service distant sans demande explicite.
- Le prompt système `RAG_SYSTEM_PROMPT` impose une réponse factuelle basée exclusivement sur le corpus. Ne pas l’assouplir sans raison fonctionnelle claire.
- Les sessions temporaires créées pour les suggestions ou la conversation doivent être détruites avec `destroy()` dès qu’elles ne sont plus nécessaires.
- Les réponses assistant sont streamées, converties depuis Markdown, puis insérées dans la conversation. Préserver l’état `conversationPending` pour éviter les soumissions concurrentes.

## Validation attendue

- Pour une modification de code TypeScript ou de comportement applicatif, exécuter au minimum `npm run build` lorsque c’est possible.
- Pour une modification documentaire seule, une relecture ciblée suffit ; aucun build n’est requis.
- En cas de changement touchant le corpus ou `sessionStorage`, vérifier les scénarios suivants : import, rejet doublon/format/quota, restauration après rechargement, suppression d’une source et effacement complet de session.
- En cas de changement touchant la conversation, vérifier au moins : bouton d’envoi désactivé/activé, affichage du message utilisateur, streaming du message assistant, restauration de l’état du compositeur après succès ou erreur.

## À éviter

- Ne pas ajouter de stockage persistant (`localStorage`, backend, base de données) sans demande explicite : le comportement actuel est limité à la session.
- Ne pas supprimer les garde-fous de disponibilité du modèle local ni les messages d’état utilisateur.
- Ne pas introduire de dépendance lourde si une dépendance existante couvre déjà le besoin.
- Ne pas contourner TypeScript strict avec des `any` évitables ou des suppressions d’erreurs non justifiées.
- Ne pas modifier `node_modules`, `dist` ou les artefacts générés pour corriger le comportement source.