import { marked } from "marked";
import DOMPurify from "dompurify";

const DEFAULT_STORAGE_KEY = "localmind:notes:markdown";
const DEFAULT_CODE_LANGUAGE = "ts";
const SUPPORTED_CODE_LANGUAGES = [
  "txt", "js", "ts", "jsx", "tsx", "python", "java", "c", "cpp", "csharp",
  "go", "rust", "php", "ruby", "swift", "kotlin", "json", "yaml", "html",
  "css", "scss", "sql", "bash", "powershell", "markdown",
];
const CODE_LANGUAGE_OPTIONS = SUPPORTED_CODE_LANGUAGES
  .map((language) => {
    const selected = language === DEFAULT_CODE_LANGUAGE ? " selected" : "";
    return `<option value="${language}"${selected}>${language}</option>`;
  })
  .join("");

type HighlightApi = {
  highlight: (code: string, options: { language: string; ignoreIllegals: boolean }) => { value: string };
  highlightAuto: (code: string) => { value: string };
};

const TEMPLATE_HTML = `
  <div class="notes-editor">
    <div class="notes-editor__toolbar" role="toolbar" aria-label="Formatage des notes">
      <div class="notes-editor__commands">
        <div class="notes-editor__group" role="group" aria-label="Titres">
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="P" aria-label="Paragraphe">P</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="H1" aria-label="Titre niveau 1">H1</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="H2" aria-label="Titre niveau 2">H2</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="H3" aria-label="Titre niveau 3">H3</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="H4" aria-label="Titre niveau 4">H4</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="H5" aria-label="Titre niveau 5">H5</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="H6" aria-label="Titre niveau 6">H6</button>
        </div>
        <div class="notes-editor__group" role="group" aria-label="Texte">
          <button class="icon-button icon-button--small" type="button" data-note-command="bold" aria-label="Gras"><strong>B</strong></button>
          <button class="icon-button icon-button--small" type="button" data-note-command="italic" aria-label="Italique"><em>I</em></button>
          <button class="icon-button icon-button--small" type="button" data-note-command="strikeThrough" aria-label="Barré"><s>S</s></button>
          <button class="icon-button icon-button--small" type="button" data-note-command="formatBlock" data-note-value="BLOCKQUOTE" aria-label="Citation">&#8220;</button>
        </div>
        <div class="notes-editor__group" role="group" aria-label="Listes et blocs">
          <button class="icon-button icon-button--small" type="button" data-note-command="insertUnorderedList" aria-label="Liste à puces">&#8226;</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="insertOrderedList" aria-label="Liste numérotée">1.</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="notes-task-list" aria-label="Liste de tâches">&#9744;</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="notes-code-block" aria-label="Bloc de code">{ }</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="insertHorizontalRule" aria-label="Ligne horizontale">&#8213;</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="notes-table" aria-label="Tableau">T</button>
        </div>
        <div class="notes-editor__group" role="group" aria-label="Liens">
          <button class="icon-button icon-button--small" type="button" data-note-command="notes-link" aria-label="Insérer un lien">&#128279;</button>
          <button class="icon-button icon-button--small" type="button" data-note-command="notes-image" aria-label="Insérer une image">&#128247;</button>
        </div>
        <div class="notes-editor__group" role="group" aria-label="Langage de code">
          <label class="visually-hidden" for="notes-code-language">Langage du bloc de code</label>
          <select id="notes-code-language" class="notes-editor__language-select" aria-label="Langage du bloc de code">${CODE_LANGUAGE_OPTIONS}</select>
        </div>
      </div>
      <div class="segmented-control notes-editor__mode" aria-label="Mode d'édition des notes">
        <button id="notes-mode-wysiwyg" class="segmented-control__item segmented-control__item--active" type="button" aria-current="page">WYSIWYG</button>
        <button id="notes-mode-markdown" class="segmented-control__item" type="button">Markdown</button>
      </div>
    </div>

    <div id="notes-wysiwyg" class="notes-editor__surface" contenteditable="true" role="textbox" aria-multiline="true"></div>
    <label class="visually-hidden" for="notes-markdown">Notes en Markdown</label>
    <textarea id="notes-markdown" class="notes-editor__markdown" hidden placeholder="Écrivez vos notes en Markdown..."></textarea>
  </div>
  <p class="notes-editor__hint">Astuce: passez de WYSIWYG à Markdown à tout moment, le contenu est synchronisé.</p>
`;

const STYLE_CSS = `
  :host {
    display: grid;
    gap: 0.75rem;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  .notes-editor {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid var(--border-subtle, #d7d7db);
    border-radius: 1.35rem;
    background: var(--surface-1, #fff);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(20 20 40 / 0.06), 0 1px 6px rgb(20 20 40 / 0.04));
  }

  .notes-editor__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .notes-editor__commands {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  .notes-editor__group {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem;
    border: 1px solid var(--border-subtle, #d7d7db);
    border-radius: 0.7rem;
    background: var(--surface-2, #f8f8fb);
  }

  .notes-editor__language-select {
    min-height: 2rem;
    padding: 0.1rem 0.45rem;
    border: 1px solid var(--border-subtle, #d7d7db);
    border-radius: 0.55rem;
    background: var(--surface-1, #fff);
    color: var(--text-1, #21232d);
    font-size: 0.72rem;
    font-family: inherit;
  }

  .notes-editor__language-select:focus {
    outline: none;
    border-color: var(--brand-400, #6d55ff);
    box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand-400, #6d55ff) 20%, transparent);
  }

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    min-height: 2rem;
    border: 0;
    border-radius: 0.7rem;
    background: transparent;
    color: var(--text-2, #5f6270);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .icon-button:hover {
    background: var(--surface-3, #ececf2);
    color: var(--text-1, #21232d);
  }

  .segmented-control {
    display: inline-grid;
    grid-auto-flow: column;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: 0.7rem;
    background: var(--surface-3, #ececf2);
  }

  .segmented-control__item {
    min-height: 2rem;
    padding-inline: 0.75rem;
    border: 0;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--text-2, #5f6270);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }

  .segmented-control__item--active {
    background: var(--surface-1, #fff);
    color: var(--text-1, #21232d);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(20 20 40 / 0.06), 0 1px 6px rgb(20 20 40 / 0.04));
  }

  .notes-editor__surface,
  .notes-editor__markdown {
    min-height: 20rem;
    padding: 1rem;
    border: 1px solid var(--border-subtle, #d7d7db);
    border-radius: 1rem;
    background: var(--surface-2, #f8f8fb);
  }

  .notes-editor__surface {
    outline: none;
    overflow: auto;
    line-height: 1.6;
    color: var(--text-1, #21232d);
  }

  .notes-editor__surface:focus,
  .notes-editor__markdown:focus {
    border-color: var(--brand-400, #6d55ff);
    box-shadow: 0 0 0 4px color-mix(in oklch, var(--brand-400, #6d55ff) 22%, transparent);
  }

  .notes-editor__surface h1,
  .notes-editor__surface h2,
  .notes-editor__surface h3,
  .notes-editor__surface p,
  .notes-editor__surface ul,
  .notes-editor__surface ol,
  .notes-editor__surface blockquote {
    margin-bottom: 0.75rem;
  }

  .notes-editor__surface ul,
  .notes-editor__surface ol {
    padding-left: 1.4rem;
  }

  .notes-editor__surface pre {
    position: relative;
    margin: 0 0 0.9rem;
    padding: 2rem 0.9rem 0.9rem;
    border: 1px solid var(--border-subtle, #d7d7db);
    border-radius: 0.8rem;
    background: color-mix(in oklch, var(--surface-2, #f8f8fb) 65%, var(--surface-1, #fff));
    overflow: auto;
  }

  .notes-editor__surface pre[contenteditable="false"]::after {
    content: "";
    display: block;
    position: absolute;
    inset: 0;
    padding: 0.8rem;
    background: transparent;
    color: var(--text-3, #7a7c89);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    text-align: center;
    border-radius: inherit;
    pointer-events: none;
    cursor: default;
  }

  .notes-editor__surface pre::before {
    content: attr(data-language);
    position: absolute;
    top: 0.45rem;
    right: 0.65rem;
    padding: 0.12rem 0.4rem;
    border-radius: 999px;
    background: var(--surface-3, #ececf2);
    color: var(--text-3, #7a7c89);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .notes-editor__surface pre code {
    display: block;
    font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
    font-size: 0.78rem;
    line-height: 1.55;
    color: var(--text-1, #21232d);
    white-space: pre;
    user-select: none;
  }

  .notes-editor__surface code.hljs {
    background: transparent;
    padding: 0;
  }

  .notes-editor__surface .hljs-comment,
  .notes-editor__surface .hljs-quote {
    color: var(--text-3, #7a7c89);
    font-style: italic;
  }

  .notes-editor__surface .hljs-keyword,
  .notes-editor__surface .hljs-selector-tag,
  .notes-editor__surface .hljs-literal,
  .notes-editor__surface .hljs-name,
  .notes-editor__surface .hljs-meta {
    color: #7f38c2;
    font-weight: 600;
  }

  .notes-editor__surface .hljs-string,
  .notes-editor__surface .hljs-title,
  .notes-editor__surface .hljs-section,
  .notes-editor__surface .hljs-attr,
  .notes-editor__surface .hljs-template-variable {
    color: #17744d;
  }

  .notes-editor__surface .hljs-number,
  .notes-editor__surface .hljs-symbol,
  .notes-editor__surface .hljs-bullet,
  .notes-editor__surface .hljs-type,
  .notes-editor__surface .hljs-built_in,
  .notes-editor__surface .hljs-class,
  .notes-editor__surface .hljs-doctag {
    color: #ab4b00;
  }

  .notes-editor__surface .hljs-tag,
  .notes-editor__surface .hljs-variable,
  .notes-editor__surface .hljs-subst,
  .notes-editor__surface .hljs-regexp,
  .notes-editor__surface .hljs-link {
    color: #af2458;
  }

  .notes-editor__markdown {
    width: 100%;
    resize: vertical;
    outline: none;
    font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
    font-size: 0.82rem;
    line-height: 1.55;
    color: var(--text-1, #21232d);
  }

  .notes-editor__hint {
    margin: 0;
    color: var(--text-3, #7a7c89);
    font-size: 0.7rem;
  }

  .visually-hidden {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }
`;

class MarkdownWysiwygElement extends HTMLElement {
  private mode: "wysiwyg" | "markdown" = "wysiwyg";
  private saveTimer: number | null = null;
  private turndownPromise: Promise<{ turndown: (html: string) => string }> | null = null;
  private highlighterPromise: Promise<HighlightApi> | null = null;
  private liveHighlightRunId = 0;
  private savedSelectionRange: Range | null = null;

  private get storageKey(): string {
    return this.getAttribute("storage-key") ?? DEFAULT_STORAGE_KEY;
  }

  connectedCallback(): void {
    if (this.dataset.initialized === "true") return;
    this.dataset.initialized = "true";

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }

    this.render();
    this.bindEvents();
    this.loadFromStorage();
  }

  private root(): ShadowRoot {
    if (!this.shadowRoot) {
      throw new Error("ShadowRoot non initialisé pour markdown-wysiwyg.");
    }

    return this.shadowRoot;
  }

  private select<T extends Element>(selector: string): T | null {
    return this.root().querySelector<T>(selector);
  }

  get value(): string {
    const markdown = this.select<HTMLTextAreaElement>("#notes-markdown");
    return markdown?.value ?? "";
  }

  set value(markdown: string) {
    const markdownEditor = this.select<HTMLTextAreaElement>("#notes-markdown");
    if (!markdownEditor) return;

    markdownEditor.value = markdown;
    this.persist(markdown);
    void this.syncMarkdownToWysiwyg();
  }

  private render(): void {
    this.root().innerHTML = `<style>${STYLE_CSS}</style>${TEMPLATE_HTML}`;
  }

  private bindEvents(): void {
    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    const notesMarkdown = this.select<HTMLTextAreaElement>("#notes-markdown");
    const notesWysiwygModeButton = this.select<HTMLButtonElement>("#notes-mode-wysiwyg");
    const notesMarkdownModeButton = this.select<HTMLButtonElement>("#notes-mode-markdown");
    const notesCodeLanguage = this.select<HTMLSelectElement>("#notes-code-language");
    const notesToolbar = this.select<HTMLElement>(".notes-editor__commands");

    if (!notesWysiwyg || !notesMarkdown || !notesWysiwygModeButton || !notesMarkdownModeButton || !notesToolbar) {
      throw new Error("Le composant markdown-wysiwyg n'a pas pu initialiser ses contrôles.");
    }

    notesWysiwyg.addEventListener("input", () => {
      void this.refreshWysiwygCodeBlocksHighlight();
      this.scheduleWysiwygSave();
    });

    const preventCodeBlockEdit = (event: Event): void => {
      if (this.mode !== "wysiwyg") return;
      if (!this.selectionTouchesCodeBlock()) return;

      event.preventDefault();
      event.stopPropagation();
    };

    notesWysiwyg.addEventListener("beforeinput", preventCodeBlockEdit);
    notesWysiwyg.addEventListener("paste", preventCodeBlockEdit);
    notesWysiwyg.addEventListener("drop", preventCodeBlockEdit);
    notesWysiwyg.addEventListener("cut", preventCodeBlockEdit);

    const rememberSelection = (): void => {
      this.captureSelectionRange();
    };

    notesWysiwyg.addEventListener("keyup", rememberSelection);
    notesWysiwyg.addEventListener("mouseup", rememberSelection);
    notesWysiwyg.addEventListener("focus", rememberSelection);

    notesToolbar.addEventListener("mousedown", (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const commandButton = target?.closest<HTMLButtonElement>("[data-note-command]");
      if (!commandButton) return;

      // Evite de perdre la selection en cliquant sur un bouton de la toolbar.
      event.preventDefault();
      this.restoreSelectionRange();
    });

    notesMarkdown.addEventListener("input", () => {
      this.persist(notesMarkdown.value);
      this.dispatchEvent(new Event("input", { bubbles: true }));
    });

    notesWysiwygModeButton.addEventListener("click", () => {
      void this.setEditorMode("wysiwyg");
    });

    notesMarkdownModeButton.addEventListener("click", () => {
      void this.setEditorMode("markdown");
    });

    notesCodeLanguage?.addEventListener("change", () => {
      const activeCodeBlock = this.findActiveCodeBlock();
      if (!activeCodeBlock) return;

      activeCodeBlock.pre.dataset.language = this.normalizeCodeLanguage(notesCodeLanguage.value);
      void this.refreshWysiwygCodeBlocksHighlight();
      this.scheduleWysiwygSave();
    });

    notesToolbar.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement | null;
      const commandButton = target?.closest<HTMLButtonElement>("[data-note-command]");
      if (!commandButton) return;

      notesWysiwyg.focus();
      this.restoreSelectionRange();

      if (this.selectionTouchesCodeBlock()) {
        return;
      }

      const command = commandButton.dataset.noteCommand ?? "";

      if (!this.handleAdvancedCommand(command)) {
        this.execCommand(command, commandButton.dataset.noteValue);
      }

      this.scheduleWysiwygSave();
    });

    document.addEventListener("selectionchange", () => {
      this.captureSelectionRange();
    });
  }

  private captureSelectionRange(): void {
    const selection = window.getSelection();
    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    if (!selection || !notesWysiwyg || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (!notesWysiwyg.contains(container)) return;

    this.savedSelectionRange = range.cloneRange();
  }

  private restoreSelectionRange(): void {
    if (!this.savedSelectionRange) return;

    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(this.savedSelectionRange);
  }

  private loadFromStorage(): void {
    const notesMarkdown = this.select<HTMLTextAreaElement>("#notes-markdown");
    if (!notesMarkdown) return;

    notesMarkdown.value = this.readFromStorage();
    void this.syncMarkdownToWysiwyg();
  }

  private readFromStorage(): string {
    try {
      return localStorage.getItem(this.storageKey) ?? "";
    } catch {
      return "";
    }
  }

  private persist(markdown: string): void {
    try {
      localStorage.setItem(this.storageKey, markdown);
    } catch (error: unknown) {
      console.error("Impossible d’enregistrer les notes dans localStorage", error);
    }
  }

  private async parseMarkdownToSafeHtml(markdown: string): Promise<string> {
    const parsed = await marked.parse(markdown);
    const sanitized = DOMPurify.sanitize(parsed);
    return this.highlightRenderedCodeBlocks(sanitized);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private tableToMarkdown(table: HTMLTableElement): string {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) return "";

    const markdownRows = rows.map((row) =>
      Array.from(row.querySelectorAll("th, td"))
        .map((cell) => (cell.textContent ?? "").trim().replace(/\|/g, "\\|"))
        .join(" | "),
    );

    const headerCells = markdownRows[0]?.split(" | ") ?? [];
    if (headerCells.length === 0) return "";
    const separator = headerCells.map(() => "---").join(" | ");

    return [
      `| ${markdownRows[0]} |`,
      `| ${separator} |`,
      ...markdownRows.slice(1).map((line) => `| ${line} |`),
    ].join("\n");
  }

  private async getTurndown(): Promise<{ turndown: (html: string) => string }> {
    if (!this.turndownPromise) {
      this.turndownPromise = import("turndown").then(({ default: TurndownService }) => {
        const service = new TurndownService({
          headingStyle: "atx",
          bulletListMarker: "-",
          codeBlockStyle: "fenced",
          emDelimiter: "*",
          strongDelimiter: "**",
        });

        service.addRule("strikethrough", {
          filter: ["s", "del"],
          replacement: (content) => `~~${content}~~`,
        });

        service.addRule("markdownTable", {
          filter: (node) => node.nodeName === "TABLE",
          replacement: (_, node) => `\n\n${this.tableToMarkdown(node as HTMLTableElement)}\n\n`,
        });

        service.addRule("fencedCodeBlockWithLanguage", {
          filter: (node) => node.nodeName === "PRE",
          replacement: (_, node) => {
            const pre = node as HTMLPreElement;
            const codeElement = pre.querySelector("code");
            // En contenteditable, le navigateur peut temporairement sortir du texte hors de <code>
            // pendant l'édition d'un bloc surligné. On lit tout le texte du <pre> pour éviter
            // de perdre des lignes au passage WYSIWYG -> Markdown.
            const code = (pre.textContent ?? "").trimEnd();
            const classLanguage = codeElement?.className.match(/language-([\w-]+)/i)?.[1];
            const dataLanguage = pre.dataset.language;
            const language = this.normalizeCodeLanguage(classLanguage || dataLanguage || DEFAULT_CODE_LANGUAGE);

            // Cas texte brut: conserver la syntaxe inline `...` demandee.
            if (language === "txt") {
              const oneLineCode = code.replace(/\r?\n/g, " ").trim();
              return oneLineCode.length > 0 ? `\n\n\`${oneLineCode}\`\n\n` : "";
            }

            return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
          },
        });

        return {
          turndown: (value: string): string => service.turndown(value),
        };
      });
    }

    return this.turndownPromise;
  }

  private async convertHtmlToMarkdown(html: string): Promise<string> {
    const normalizedHtml = this.normalizeCodeBlocksForSerialization(html);
    const cleanedHtml = DOMPurify.sanitize(normalizedHtml);
    const service = await this.getTurndown();
    const markdown = service.turndown(cleanedHtml);
    return this.ensureBlankLineAfterFencedCode(markdown);
  }

  private normalizeCodeBlocksForSerialization(html: string): string {
    const container = document.createElement("div");
    container.innerHTML = html;

    const codeBlocks = container.querySelectorAll("pre");
    for (const preElement of codeBlocks) {
      const pre = preElement as HTMLPreElement;
      const firstCode = pre.querySelector("code");
      const classLanguage = firstCode?.className.match(/language-([\w-]+)/i)?.[1] ?? "";
      const language = this.normalizeCodeLanguage(pre.dataset.language || classLanguage || DEFAULT_CODE_LANGUAGE);
      const sourceCode = pre.textContent ?? "";

      const cleanCode = document.createElement("code");
      cleanCode.className = `language-${language}`;
      cleanCode.textContent = sourceCode;

      pre.dataset.language = language;
      pre.replaceChildren(cleanCode);
    }

    return container.innerHTML;
  }

  private ensureBlankLineAfterFencedCode(markdown: string): string {
    const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    const output: string[] = [];
    let inFencedBlock = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      output.push(line);

      if (!line.startsWith("```")) continue;

      if (!inFencedBlock) {
        inFencedBlock = true;
        continue;
      }

      inFencedBlock = false;
      const nextLine = lines[index + 1] ?? "";
      if (nextLine.trim().length > 0 || index === lines.length - 1) {
        output.push("");
      }
    }

    return output.join("\n");
  }

  private setSegmentedButtonState(button: HTMLButtonElement, active: boolean): void {
    button.classList.toggle("segmented-control__item--active", active);
    if (active) {
      button.setAttribute("aria-current", "page");
      return;
    }

    button.removeAttribute("aria-current");
  }

  private execCommand(command: string, value?: string): void {
    if (typeof document.execCommand !== "function") return;
    document.execCommand(command, false, value);
  }

  private getSelectionText(): string {
    const selection = window.getSelection?.();
    const selected = selection?.toString() ?? "";
    if (selected.trim().length > 0) return selected;

    if (this.savedSelectionRange) {
      return this.savedSelectionRange.toString();
    }

    return "";
  }

  private normalizeUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    if (trimmed.length === 0) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  private normalizeCodeLanguage(rawLanguage: string): string {
    const normalized = rawLanguage.trim().toLowerCase();
    if (normalized.length === 0) return DEFAULT_CODE_LANGUAGE;
    if (SUPPORTED_CODE_LANGUAGES.includes(normalized)) return normalized;
    return DEFAULT_CODE_LANGUAGE;
  }

  private selectionTouchesCodeBlock(): boolean {
    const selection = window.getSelection();
    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    if (!selection || !notesWysiwyg || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer as Element
      : range.startContainer.parentElement;
    const endElement = range.endContainer.nodeType === Node.ELEMENT_NODE
      ? range.endContainer as Element
      : range.endContainer.parentElement;

    if (startElement?.closest("pre") || endElement?.closest("pre")) {
      return true;
    }

    const codeBlocks = notesWysiwyg.querySelectorAll("pre");
    for (const codeBlock of codeBlocks) {
      if (range.intersectsNode(codeBlock)) {
        return true;
      }
    }

    return false;
  }

  private resolveHighlightLanguage(language: string): string {
    const normalized = this.normalizeCodeLanguage(language);
    const aliases: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      csharp: "csharp",
      txt: "plaintext",
      powershell: "powershell",
      markdown: "markdown",
    };

    return aliases[normalized] ?? normalized;
  }

  private selectedCodeLanguage(): string {
    const languageSelect = this.select<HTMLSelectElement>("#notes-code-language");
    if (!languageSelect) return DEFAULT_CODE_LANGUAGE;
    return this.normalizeCodeLanguage(languageSelect.value);
  }

  private async getHighlighter(): Promise<HighlightApi> {
    if (!this.highlighterPromise) {
      this.highlighterPromise = import("highlight.js/lib/common")
        .then((module) => {
          const highlighter = module.default;
          return {
            highlight: (code: string, options: { language: string; ignoreIllegals: boolean }) =>
              highlighter.highlight(code, options),
            highlightAuto: (code: string) => highlighter.highlightAuto(code),
          };
        });
    }

    return this.highlighterPromise;
  }

  private async highlightRenderedCodeBlocks(html: string): Promise<string> {
    const container = document.createElement("div");
    container.innerHTML = html;
    const highlighter = await this.getHighlighter();

    const codeBlocks = container.querySelectorAll("pre > code");
    for (const codeBlock of codeBlocks) {
      const pre = codeBlock.parentElement as HTMLPreElement | null;
      if (!pre) continue;

      const classLanguage = codeBlock.className.match(/language-([\w-]+)/i)?.[1] ?? "";
      const language = this.normalizeCodeLanguage(pre.dataset.language || classLanguage || DEFAULT_CODE_LANGUAGE);
      const code = codeBlock.textContent ?? "";
      const highlightLanguage = this.resolveHighlightLanguage(language);

      let highlighted = this.escapeHtml(code);
      if (language !== "txt") {
        try {
          highlighted = highlighter.highlight(code, {
            language: highlightLanguage,
            ignoreIllegals: true,
          }).value;
        } catch {
          highlighted = highlighter.highlightAuto(code).value;
        }
      }

      pre.dataset.language = language;
      pre.setAttribute("contenteditable", "false");
      codeBlock.className = `hljs language-${highlightLanguage}`;
      codeBlock.innerHTML = highlighted;
    }

    return container.innerHTML;
  }

  private findActiveCodeBlock(): { pre: HTMLPreElement; code: HTMLElement } | null {
    const selection = window.getSelection();
    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    if (!selection || !notesWysiwyg || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    if (!notesWysiwyg.contains(container)) return null;

    const element = container.nodeType === Node.ELEMENT_NODE
      ? container as Element
      : container.parentElement;
    if (!element) return null;

    const pre = element.closest("pre") as HTMLPreElement | null;
    if (!pre || !notesWysiwyg.contains(pre)) return null;

    const existingCode = pre.querySelector(":scope > code") as HTMLElement | null;
    const code = existingCode ?? document.createElement("code");

    return { pre, code };
  }

  private getCaretTextOffset(root: Node, range: Range): number {
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(root);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    return preCaretRange.toString().length;
  }

  private restoreCaretFromTextOffset(container: HTMLElement, offset: number): void {
    const selection = window.getSelection();
    if (!selection) return;

    const safeOffset = Math.max(0, offset);
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let remaining = safeOffset;
    let targetNode: Node | null = null;
    let targetOffset = 0;

    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      const textLength = textNode.textContent?.length ?? 0;

      if (remaining <= textLength) {
        targetNode = textNode;
        targetOffset = remaining;
        break;
      }

      remaining -= textLength;
    }

    const range = document.createRange();
    if (targetNode) {
      range.setStart(targetNode, targetOffset);
    } else {
      range.setStart(container, container.childNodes.length);
    }
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
    this.captureSelectionRange();
  }

  private async refreshWysiwygCodeBlocksHighlight(): Promise<void> {
    if (this.mode !== "wysiwyg") return;

    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    if (!notesWysiwyg) return;

    const selection = window.getSelection();
    let activePre: HTMLPreElement | null = null;
    let caretOffset = 0;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      if (notesWysiwyg.contains(container)) {
        const element = container.nodeType === Node.ELEMENT_NODE
          ? container as Element
          : container.parentElement;
        const pre = element?.closest("pre") as HTMLPreElement | null;
        if (pre && notesWysiwyg.contains(pre)) {
          activePre = pre;
          caretOffset = this.getCaretTextOffset(pre, range);
        }
      }
    }

    const codeBlocks = Array.from(notesWysiwyg.querySelectorAll("pre"));
    if (codeBlocks.length === 0) return;

    const runId = ++this.liveHighlightRunId;
    const highlighter = await this.getHighlighter();
    if (runId !== this.liveHighlightRunId) return;

    for (const preElement of codeBlocks) {
      const pre = preElement as HTMLPreElement;
      if (!pre.isConnected) continue;

      const firstCode = pre.querySelector(":scope > code") as HTMLElement | null;
      const classLanguage = firstCode?.className.match(/language-([\w-]+)/i)?.[1] ?? "";
      const language = this.normalizeCodeLanguage(pre.dataset.language || classLanguage || DEFAULT_CODE_LANGUAGE);
      const highlightLanguage = this.resolveHighlightLanguage(language);
      const sourceCode = pre.textContent ?? "";

      let highlighted = this.escapeHtml(sourceCode);
      if (language !== "txt") {
        try {
          highlighted = highlighter.highlight(sourceCode, {
            language: highlightLanguage,
            ignoreIllegals: true,
          }).value;
        } catch {
          highlighted = highlighter.highlightAuto(sourceCode).value;
        }
      }

      pre.dataset.language = language;
      pre.setAttribute("contenteditable", "false");
      const nextCode = document.createElement("code");
      nextCode.className = `hljs language-${highlightLanguage}`;
      nextCode.innerHTML = highlighted;
      pre.replaceChildren(nextCode);

      if (activePre && pre === activePre) {
        this.restoreCaretFromTextOffset(nextCode, caretOffset);
      }
    }
  }

  private handleAdvancedCommand(command: string): boolean {
    switch (command) {
      case "notes-code-block": {
        const language = this.selectedCodeLanguage();

        const selected = this.escapeHtml(this.getSelectionText().trim() || "Votre code ici");

        // En texte brut, on utilise un code inline au lieu d'un bloc pre.
        if (language === "txt") {
          this.execCommand("insertHTML", `<code>${selected}</code><p><br></p>`);
          return true;
        }

        this.execCommand(
          "insertHTML",
          `<pre data-language="${language}" contenteditable="false"><code class="language-${language}">${selected}</code></pre><p><br></p>`,
        );
        return true;
      }
      case "notes-table": {
        this.execCommand(
          "insertHTML",
          "<table><thead><tr><th>Colonne 1</th><th>Colonne 2</th></tr></thead><tbody><tr><td>Valeur A</td><td>Valeur B</td></tr></tbody></table><p><br></p>",
        );
        return true;
      }
      case "notes-task-list": {
        this.execCommand("insertHTML", "<ul><li>[ ] Tâche 1</li><li>[x] Tâche terminée</li></ul><p><br></p>");
        return true;
      }
      case "notes-link": {
        const selected = this.getSelectionText().trim();
        const rawUrl = window.prompt("URL du lien :", "https://");
        if (rawUrl === null) return true;

        const url = this.normalizeUrl(rawUrl);
        if (!url) return true;

        if (selected.length > 0) {
          this.execCommand("createLink", url);
        } else {
          this.execCommand("insertHTML", `<a href="${url}">${url}</a>`);
        }
        return true;
      }
      case "notes-image": {
        const rawUrl = window.prompt("URL de l'image :", "https://");
        if (rawUrl === null) return true;

        const url = this.normalizeUrl(rawUrl);
        if (!url) return true;

        this.execCommand("insertImage", url);
        this.execCommand("insertHTML", "<p><br></p>");
        return true;
      }
      default:
        return false;
    }
  }

  private async setEditorMode(mode: "wysiwyg" | "markdown"): Promise<void> {
    if (mode === this.mode) return;

    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    const notesMarkdown = this.select<HTMLTextAreaElement>("#notes-markdown");
    const notesWysiwygModeButton = this.select<HTMLButtonElement>("#notes-mode-wysiwyg");
    const notesMarkdownModeButton = this.select<HTMLButtonElement>("#notes-mode-markdown");

    if (!notesWysiwyg || !notesMarkdown || !notesWysiwygModeButton || !notesMarkdownModeButton) return;

    if (mode === "markdown") {
      const markdownFromWysiwyg = await this.convertHtmlToMarkdown(notesWysiwyg.innerHTML);
      notesMarkdown.value = markdownFromWysiwyg;
      this.persist(markdownFromWysiwyg);
      notesWysiwyg.hidden = true;
      notesMarkdown.hidden = false;
      notesMarkdown.focus();
    } else {
      const html = await this.parseMarkdownToSafeHtml(notesMarkdown.value);
      notesWysiwyg.innerHTML = html || "<p><br></p>";
      this.persist(notesMarkdown.value);
      notesMarkdown.hidden = true;
      notesWysiwyg.hidden = false;
      notesWysiwyg.focus();
    }

    this.mode = mode;
    this.setSegmentedButtonState(notesWysiwygModeButton, mode === "wysiwyg");
    this.setSegmentedButtonState(notesMarkdownModeButton, mode === "markdown");
  }

  private async syncMarkdownToWysiwyg(): Promise<void> {
    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    const notesMarkdown = this.select<HTMLTextAreaElement>("#notes-markdown");
    if (!notesWysiwyg || !notesMarkdown) return;

    const html = await this.parseMarkdownToSafeHtml(notesMarkdown.value);
    notesWysiwyg.innerHTML = html || "<p><br></p>";
  }

  private scheduleWysiwygSave(): void {
    const notesWysiwyg = this.select<HTMLElement>("#notes-wysiwyg");
    const notesMarkdown = this.select<HTMLTextAreaElement>("#notes-markdown");
    if (!notesWysiwyg || !notesMarkdown) return;

    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }

    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void (async () => {
        const markdown = await this.convertHtmlToMarkdown(notesWysiwyg.innerHTML);
        notesMarkdown.value = markdown;
        this.persist(markdown);
        this.dispatchEvent(new Event("input", { bubbles: true }));
      })();
    }, 220);
  }
}

if (!customElements.get("markdown-wysiwyg")) {
  customElements.define("markdown-wysiwyg", MarkdownWysiwygElement);
}

export { MarkdownWysiwygElement };
