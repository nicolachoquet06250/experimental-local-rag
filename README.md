# LocalMind — RAG local

Interface web de RAG (*Retrieval-Augmented Generation*) entièrement côté navigateur, construite autour de l'API expérimentale `LanguageModel` de Chrome (Gemini Nano). Aucun backend, aucune donnée transmise à un serveur externe : le modèle d'inférence et le corpus de documents restent locaux.

[Voir le détails de la couverture de tests](https://nicolachoquet06250.github.io/experimental-local-rag/)

---

## Activer l'API LanguageModel

L'API `LanguageModel` est expérimentale. La compatibilité par navigateur selon [caniuse / MDN](https://caniuse.com/wf-languagemodel) est la suivante :

| Navigateur | Support | Canal requis |
|---|---|---|
| **Chrome** ≥ 148 | Via flag | Stable, Dev, Canary |
| **Edge** ≥ 138 | Via flag | Canary, Dev uniquement |
| **Firefox** | ✗ Non supporté | — |
| **Safari** | ✗ Non supporté | — |

### Chrome ≥ 148

L'API est disponible nativement à partir de Chrome 148 stable. Pour les versions antérieures (Dev/Canary), deux flags sont nécessaires dans `chrome://flags` :

| Flag | Valeur |
|---|---|
| `chrome://flags/#optimization-guide-on-device-model` | **Enabled** |
| `chrome://flags/#prompt-api-for-gemini-nano` | **Enabled** ou **Enabled BypassPerfRequirement** |
| `chrome://flags/#blocking-focus-without-user-activation` | **Enabled** |
| `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` | **Enabled** |


Relancer Chrome, puis vérifier dans la console DevTools :

```js
await LanguageModel.availability(); // "available", "downloadable" ou "downloading"
```

Consulter `chrome://on-device-internals` (onglet *Model Status*) pour suivre le téléchargement de Gemini Nano.

### Edge ≥ 138 (Canary / Dev uniquement)

Edge utilise **Phi-4-mini** comme modèle embarqué (à la place de Gemini Nano). Un seul flag à activer dans `edge://flags` :

| Flag | Valeur |
|---|---|
| `edge://flags` → rechercher **"Prompt API for on-device language model"** | **Enabled** |

Relancer Edge, puis vérifier dans `edge://on-device-internals` (onglet *Model Status*) que le modèle est bien disponible et que la **Device performance class** est **High** ou supérieure.

> À partir d'Edge 150, il est aussi possible d'activer le flag **"Enable prerelease on-device language model"** pour utiliser **Aion-1.0-Instruct**, un modèle plus léger supportant les appareils avec GPU insuffisant ou sans GPU (inférence CPU).

### Firefox / Safari

Ces navigateurs ne supportent pas l'API `LanguageModel`. Aucun flag ne permet de l'activer.

---

## Prérequis

| Prérequis | Détail |
|---|---|
| **Navigateur chromium** | Avec les flags adéquats activés |
| **Gemini Nano | Phi-4-mini** disponible | Le modèle doit être téléchargé ou téléchargeable sur l'appareil |
| **Node.js** ≥ 20 | Pour le développement local uniquement |

> L'API `window.LanguageModel` est une fonctionnalité expérimentale. Elle n'est pas disponible dans Firefox, Safari, ou les versions stables de Chrome sans configuration spécifique.

> ⚠️ Pour que l'API `LanguageModel` puisse télécharger et utiliser le modèle, il faut au moins 22 Go d'espace libre sur le disque contenant le profil Chrome.
Après installation, si l'espace libre descend sous 10 Go, le navigateur supprime automatiquement le modèle local.

---

## Démarrage rapide

```bash
npm install
npm run dev      # serveur Vite — http://localhost:5173
```

Puis ouvrir l'URL dans une version de Chrome compatible.

---

## Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Lance le serveur de développement Vite |
| `npm run build` | Compile TypeScript puis génère le bundle de production |
| `npm run preview` | Sert le build de production localement |
| `npm run test` | Exécute les tests unitaires (Vitest) |
| `npm run test:watch` | Mode watch pour les tests |
| `npm run test:coverage` | Rapport de couverture de code |

---

## Fonctionnement

L'application suit un cycle en trois étapes à l'ouverture :

1. **Vérification du support** — détecte si `window.LanguageModel` est disponible dans le navigateur.
2. **Disponibilité du modèle** — interroge l'API pour savoir si Gemini Nano est prêt, téléchargeable ou absent. Un indicateur de progression s'affiche pendant le téléchargement.
3. **Création de session** — instancie une session `LanguageModel` configurée pour accepter du texte et des images en entrée, et produire du texte en français.

Une fois la session active, l'interface passe en mode conversation. Les réponses sont streamées et rendues en Markdown sanitizé.

### Mode RAG

Toute question posée est enrichie avec le contenu des sources sélectionnées dans le panneau de gauche. Le prompt système impose au modèle de répondre **exclusivement** à partir du corpus fourni, sans recourir à ses connaissances générales. Si la réponse ne figure pas dans les documents, le modèle l'indique explicitement.

### Suggestions automatiques

Lorsqu'un corpus est chargé, l'interface génère des suggestions de questions adaptées aux documents présents. Chaque suggestion ouvre directement une requête en conversation.

---

## Sources du corpus

Le panneau latéral gauche permet d'importer des documents qui serviront de base documentaire aux réponses du modèle.

### Formats supportés

| Famille | Extensions / types |
|---|---|
| **Texte** | `.txt`, `.md`, `.csv`, `.json`, `.yaml`, `.html`, `.js`, `.ts`, `.py`, `.sql`, `.log`, etc. |
| **PDF** | `.pdf` |
| **Office** | `.docx`, `.xlsx`, `.pptx`, `.odt`, `.ods`, `.odp`, `.rtf`, etc. |
| **Image** | Tous les types `image/*` (JPEG, PNG, WebP, GIF…) |
| **Web** | Import depuis une URL — le HTML est nettoyé puis converti en Markdown |
| | ⚠️ Une url ne fonctionne que si le site ne bloque pas les cors ⚠️ |

### Stockage

Les sources sont persistées en `sessionStorage` pendant la durée de la session navigateur et restaurées automatiquement après un rechargement de page. La limite de stockage est fixée à **500 Mo**. L'effacement complet est disponible via le bouton de session.

---

## Architecture

```
src/
├── main.ts          # Point d'entrée : initialisation, événements globaux, window.localMindAI
├── constants.ts     # Options modèle, références DOM, clés de stockage, RAG_SYSTEM_PROMPT
├── functions.ts     # Logique applicative : session, sources, corpus, suggestions, conversation
├── global.d.ts      # Types TypeScript globaux (LanguageModel API, types métier)
└── style.css        # Styles de l'application
index.html           # Page HTML principale
```

### `window.localMindAI`

Un objet de débogage est exposé sur `window` :

```ts
window.localMindAI.session       // session LanguageModel active ou null
window.localMindAI.availability  // état de disponibilité du modèle
window.localMindAI.options       // options de configuration du modèle
window.localMindAI.check()       // re-vérifie la disponibilité de l'API
```

---

## Stack technique

| Outil | Rôle |
|---|---|
| [Vite](https://vitejs.dev/) | Bundler et serveur de développement |
| [TypeScript](https://www.typescriptlang.org/) ~6.x | Langage principal, mode strict |
| [marked](https://marked.js.org/) | Conversion Markdown → HTML |
| [DOMPurify](https://github.com/cure53/DOMPurify) | Sanitisation HTML avant injection dans le DOM |
| [unpdf](https://github.com/unjs/unpdf) | Extraction de texte depuis les fichiers PDF |
| [Turndown](https://github.com/mixmark-io/turndown) | Conversion HTML → Markdown pour les sources web |
| [Vitest](https://vitest.dev/) | Tests unitaires |

---

## Sécurité

- Tout le Markdown produit par le modèle est systématiquement sanitizé via `DOMPurify` avant injection HTML.
- Les sources web sont nettoyées avant persistance : les balises `script`, `style`, `link`, `img`, `svg` et les commentaires sont supprimés du corpus transmis au modèle.
- Le prompt système interdit explicitement toute déduction ou réponse inventée hors corpus.
- Aucune donnée ne quitte le navigateur.