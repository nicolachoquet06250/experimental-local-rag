# Copilot Instructions — LocalMind

## Contexte

LocalMind est une application front-end **Vite / TypeScript** qui expose une interface RAG locale autour de l'API expérimentale `LanguageModel` (Chrome / Gemini Nano). Tout le traitement reste côté navigateur : aucun backend, aucune persistance au-delà de la session (`sessionStorage`).

L'interface, les messages d'erreur, les prompts système et les libellés utilisateur sont **en français**. Toute évolution fonctionnelle visible doit conserver ce ton et cette langue.

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `src/main.ts` | Point d'entrée — initialisation, événements globaux, `window.localMindAI`, destruction de session |
| `src/constants.ts` | Options du modèle, références DOM (`elements`), clés de stockage, familles de sources, config panneaux, `RAG_SYSTEM_PROMPT` |
| `src/functions.ts` | Logique applicative : session, sources locales/web, corpus, suggestions, conversation streaming |
| `src/global.d.ts` | Types globaux navigateur et types métier (`LocalSource`, `SourceFamily`, `CorpusPromptPart`, etc.) |
| `src/style.css` | Styles de l'application |
| `index.html` | Page HTML principale |

Ne pas déplacer de logique entre ces fichiers sans nécessité : le projet est volontairement simple et centré sur quelques fichiers.

---

## Stack et commandes

- **Runtime/build** : Vite avec TypeScript en modules ES (`"type": "module"`)
- **Dépendances clés** : `dompurify`, `marked`, `unpdf`, `turndown`
- **TypeScript** : ~6.x, mode strict

```bash
npm run dev       # serveur Vite
npm run build     # tsc + vite build
npm run preview   # sert le build
```

Après toute modification TypeScript ou comportement applicatif, exécuter au minimum `npm run build`.

---

## Conventions TypeScript

- Typage explicite sur les fonctions publiques, unions littérales, `unknown` dans les `catch`, retours `void` quand pertinent.
- Pas de `any` évitable ni de suppressions d'erreurs non justifiées (`// @ts-ignore`, `as any`).
- Préférer les utilitaires locaux existants avant d'en créer de nouveaux.
- Ne pas créer d'abstractions ou de helpers pour des opérations ponctuelles.
- Conserver les imports dynamiques lazy-loaded quand ils protègent le bundle initial.

---

## Sécurité et rendu

- Tout Markdown généré par le modèle **doit être sanitizé via `DOMPurify`** avant injection HTML. Ne pas affaiblir ce garde-fou.
- Les sources web nettoyées via `sanitizeWebDocument` ne doivent pas réintroduire de balises actives (`link`, `style`, `script`, `img`, `svg`, etc.) dans le corpus transmis au modèle.
- Ne pas contourner l'OWASP Top 10 : valider à la frontière système, pas partout.

---

## Corpus, sources et stockage

- Familles supportées (`SourceFamily`) : `image`, `text`, `office`, `pdf`, `web`.
- Taille limitée par `MAX_LOCAL_STORAGE_BYTES` (500 Mo).
- Clés de stockage à ne pas renommer :
  - Index : `SOURCE_INDEX_STORAGE_KEY` (`"localmind:session:sources"`)
  - Données : préfixe `SOURCE_DATA_STORAGE_PREFIX` (`"localmind:session:source:"`)
- Tout changement sur le corpus doit préserver : import, rejet doublon/format/quota, restauration après rechargement, suppression unitaire, effacement complet de session.
- Ne pas reconvertir inutilement les contenus déjà transformés lors de la construction du prompt.

---

## API LanguageModel et conversation

- L'application dépend de `window.LanguageModel` (API expérimentale Chrome). Ne pas la remplacer par un service distant sans demande explicite.
- Le `RAG_SYSTEM_PROMPT` impose une réponse factuelle basée **exclusivement** sur le corpus. Ne pas l'assouplir sans raison fonctionnelle claire.
- Les sessions temporaires (suggestions, conversation) doivent être détruites via `.destroy()` dès qu'elles ne sont plus nécessaires.
- Les réponses sont streamées, converties depuis Markdown, puis insérées dans la conversation. Préserver `conversationPending` pour éviter les soumissions concurrentes.

---

## DOM et helpers

- Utiliser `queryElement<T>(selector)` pour accéder au DOM — il lève une erreur explicite si l'élément est absent.
- Utiliser les références centralisées dans `elements` de `constants.ts` plutôt que d'appeler `document.querySelector` directement.
- Ne pas contourner `elements` pour accéder aux contrôles UI.

---

## À éviter absolument

- Pas de `localStorage`, backend ou base de données : le stockage est limité à la session navigateur.
- Pas de suppression des garde-fous de disponibilité du modèle ni des messages d'état utilisateur.
- Pas de nouvelle dépendance lourde si une dépendance existante couvre déjà le besoin.
- Pas de modification de `node_modules`, `dist` ou artefacts générés pour corriger le comportement source.
- Pas de `git push --force`, suppression de branches ou reset destructif sans confirmation explicite.
