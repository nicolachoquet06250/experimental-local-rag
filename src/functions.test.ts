import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLanguageModelSessionMock, mountIndexHtml } from "./test/dom";

vi.mock("unpdf", () => ({
  extractText: vi.fn(async () => ({ text: "Contenu PDF" })),
  getDocumentProxy: vi.fn(async () => ({ id: "pdf" })),
}));

vi.mock("marked", () => ({
  marked: {
    parse: vi.fn(async (markdown: string) => `<p>${markdown}</p>`),
  },
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: vi.fn((html: string) => html),
  },
}));

async function loadModules() {
  vi.resetModules();
  mountIndexHtml();
  const functions = await import("./functions");
  const constants = await import("./constants");

  return { functions, constants };
}

function createDragEvent(type: string, files: File[] = [], types: string[] = ["Files"]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: { types, files, dropEffect: "none" },
  });

  return event;
}

beforeEach(() => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
});

afterEach(() => {
  Object.defineProperty(globalThis, "LanguageModel", { configurable: true, value: undefined });
});

describe("functions.queryElement", () => {
  it("retourne un élément quand il existe", async () => {
    const { functions } = await loadModules();
    const element = functions.queryElement<HTMLElement>("#runtime-title");
    expect(element.textContent).toContain("Vérification");
  });

  it("lève une erreur quand le sélecteur est absent", async () => {
    const { functions } = await loadModules();
    expect(() => functions.queryElement("#absent")).toThrow("Élément DOM introuvable");
  });
});

describe("functions.initializeSidebars", () => {
  it("crée les boutons et gère ouverture/fermeture", async () => {
    const { functions } = await loadModules();

    functions.initializeSidebars();

    const workspace = document.querySelector<HTMLElement>("#workspace");
    const openButton = document.querySelector<HTMLButtonElement>(".sidebar-open-button--sources");
    const closeButton = document.querySelector<HTMLButtonElement>(".panel--sources button[aria-label=\"Réduire le panneau des sources\"]");

    expect(document.head.querySelector("style")?.textContent).toContain("sidebar-collapsed-size");
    closeButton?.click();
    expect(workspace?.classList.contains("sidebar-sources-closed")).toBe(true);

    openButton?.click();
    expect(workspace?.classList.contains("sidebar-sources-closed")).toBe(false);

    const panel = document.querySelector<HTMLElement>(".panel--sources");
    panel?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(workspace?.classList.contains("sidebar-sources-closed")).toBe(true);
  });
});

describe("functions.checkPromptApi et createSession", () => {
  it("gère le contexte non sécurisé", async () => {
    const { functions } = await loadModules();
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });

    await functions.checkPromptApi();

    expect(functions.availability).toBe("unavailable");
    expect(document.body.dataset.runtimeState).toBe("unsupported");
  });

  it("gère l'absence de LanguageModel", async () => {
    const { functions } = await loadModules();

    await functions.checkPromptApi();

    expect(functions.availability).toBe("unavailable");
    expect(document.body.dataset.runtimeState).toBe("unsupported");
  });

  it("passe en mode downloadable", async () => {
    const { functions } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "downloadable"),
        create: vi.fn(async () => createLanguageModelSessionMock()),
      } satisfies LanguageModelAPI,
    });

    await functions.checkPromptApi();

    const action = document.querySelector<HTMLButtonElement>("#runtime-action");
    expect(action?.hidden).toBe(false);
    expect(action?.textContent).toContain("Télécharger");
    expect(document.body.dataset.runtimeState).toBe("downloadable");
  });

  it("passe en mode downloading", async () => {
    const { functions } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "downloading"),
        create: vi.fn(async () => createLanguageModelSessionMock()),
      } satisfies LanguageModelAPI,
    });

    await functions.checkPromptApi();

    const action = document.querySelector<HTMLButtonElement>("#runtime-action");
    expect(action?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("#runtime-title")?.textContent).toContain("Téléchargement déjà en cours");
  });

  it("initialise automatiquement la session quand available", async () => {
    const { functions } = await loadModules();
    const createdSession = createLanguageModelSessionMock();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: vi.fn(async ({ monitor }: LanguageModelCreateOptions) => {
          const fakeMonitor = new EventTarget() as LanguageModelMonitor;
          monitor?.(fakeMonitor);
          return createdSession;
        }),
      } satisfies LanguageModelAPI,
    });

    await functions.checkPromptApi();
    await Promise.resolve();
    await Promise.resolve();

    expect(functions.session).toBe(createdSession);
    expect(functions.availability).toBe("available");
    expect(document.body.dataset.runtimeState).toBe("ready");

    functions.clearReadyTimer();
  });

  it("retourne la session existante", async () => {
    const { functions } = await loadModules();
    const existing = createLanguageModelSessionMock();
    functions.setSession(existing);

    const result = await functions.createSession();
    expect(result).toBe(existing);
  });

  it("retourne la promesse de création existante", async () => {
    const { functions } = await loadModules();
    const deferred = Promise.resolve(createLanguageModelSessionMock());
    functions.setCreationPromise(deferred);

    const result = await functions.createSession();
    expect(result).toBe(await deferred);
  });

  it("gère une erreur synchrone de create", async () => {
    const { functions } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: vi.fn(() => {
          throw new DOMException("err", "InvalidStateError");
        }),
      } satisfies LanguageModelAPI,
    });

    const result = await functions.createSession();
    expect(result).toBeNull();
    expect(document.body.dataset.runtimeState).toBe("error");
  });

  it("gère une erreur asynchrone de create", async () => {
    const { functions } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: vi.fn(async () => {
          throw new DOMException("quota", "QuotaExceededError");
        }),
      } satisfies LanguageModelAPI,
    });

    const promise = functions.createSession();
    await expect(promise).rejects.toBeInstanceOf(DOMException);
    await Promise.resolve();

    expect(document.body.dataset.runtimeState).toBe("error");
    expect(document.querySelector<HTMLButtonElement>("#runtime-retry")?.hidden).toBe(false);
  });
});

describe("functions.initializeLocalSources", () => {
  it("importe des fichiers locaux, gère les doublons et la suppression", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeLocalSources();

    const input = document.querySelector<HTMLInputElement>("#source-file");
    const file = new File(["contenu"], "notes.md", { type: "text/markdown", lastModified: 1 });

    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input?.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(constants.localSources.length).toBe(1));
    expect(document.querySelector(".source-card strong")?.textContent).toBe("notes.md");

    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    input?.dispatchEvent(new Event("change"));

    await vi.waitFor(() => expect(constants.localSources.length).toBe(1));

    const removeButton = document.querySelector<HTMLButtonElement>(".source-card .icon-button--small");
    removeButton?.click();

    expect(constants.localSources.length).toBe(0);
  });

  it("importe une URL, applique les validations et efface la session", async () => {
    const { functions, constants } = await loadModules();
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("http")) {
        return {
          ok: true,
          status: 200,
          text: async () => "<html><body><h1>Doc</h1><script>alert(1)</script></body></html>",
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        text: async () => "",
        blob: async () => new Blob(["x"], { type: "text/plain" }),
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    functions.initializeLocalSources();

    const urlToggle = document.querySelector<HTMLButtonElement>(".source-import-actions .icon-button");
    urlToggle?.click();

    const form = document.querySelector<HTMLFormElement>(".source-url-form");
    const input = document.querySelector<HTMLInputElement>(".source-url-form input");

    if (!form || !input) throw new Error("Formulaire URL introuvable");

    input.value = "https://example.com/page";
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(constants.localSources.length).toBe(1));

    input.value = "https://example.com/page";
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(document.querySelector(".source-upload-status")?.textContent).toContain("déjà présente");
    });

    input.value = "ftp://example.com";
    form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => {
      expect(document.querySelector(".source-upload-status")?.textContent).toContain("HTTP et HTTPS");
    });

    const clearButton = document.querySelector<HTMLButtonElement>("#clear-session");
    clearButton?.click();

    expect(constants.localSources.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("restaure les sources depuis sessionStorage", async () => {
    const metadata: StoredSourceMetadata[] = [
      {
        id: "id-text",
        name: "note.txt",
        type: "text/plain",
        lastModified: 10,
        family: "text",
        selected: true,
      },
      {
        id: "id-web",
        name: "https://example.com",
        type: "text/markdown",
        lastModified: 11,
        family: "web",
        selected: false,
      },
    ];

    sessionStorage.setItem("localmind:session:sources", JSON.stringify(metadata));
    sessionStorage.setItem("localmind:session:source:id-text", "data:text/plain;base64,SGVsbG8=");
    sessionStorage.setItem("localmind:session:source:id-web", "# Titre");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        blob: async () => new Blob(["Hello"], { type: "text/plain" }),
        text: async () => "Hello",
      })),
    );

    const { functions, constants } = await loadModules();
    functions.initializeLocalSources();

    await vi.waitFor(() => expect(constants.localSources.length).toBe(2));
    expect(constants.localSources[0]?.file.name).toBe("note.txt");
    expect(constants.localSources[1]?.family).toBe("web");
  });
});

describe("functions.initializeLocalSources — glisser-déposer", () => {
  it("affiche la zone de dépôt uniquement pour un glisser de fichiers", async () => {
    const { functions } = await loadModules();
    functions.initializeLocalSources();

    const sourceList = document.querySelector(".source-list");
    if (!sourceList) throw new Error("Liste des sources introuvable");

    sourceList.dispatchEvent(createDragEvent("dragenter", [], ["text/plain"]));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(false);

    sourceList.dispatchEvent(createDragEvent("dragenter", [], ["Files"]));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(true);
  });

  it("empêche le comportement par défaut et force le dropEffect à copy sur dragover", async () => {
    const { functions } = await loadModules();
    functions.initializeLocalSources();

    const sourceList = document.querySelector(".source-list");
    if (!sourceList) throw new Error("Liste des sources introuvable");

    const dragOverEvent = createDragEvent("dragover");
    const preventDefaultSpy = vi.spyOn(dragOverEvent, "preventDefault");

    sourceList.dispatchEvent(dragOverEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect((dragOverEvent as unknown as DragEvent).dataTransfer?.dropEffect).toBe("copy");

    const ignoredEvent = createDragEvent("dragover", [], ["text/plain"]);
    const ignoredPreventDefaultSpy = vi.spyOn(ignoredEvent, "preventDefault");

    sourceList.dispatchEvent(ignoredEvent);

    expect(ignoredPreventDefaultSpy).not.toHaveBeenCalled();
  });

  it("ne retire la zone de dépôt qu'une fois toutes les entrées imbriquées sorties", async () => {
    const { functions } = await loadModules();
    functions.initializeLocalSources();

    const sourceList = document.querySelector(".source-list");
    if (!sourceList) throw new Error("Liste des sources introuvable");

    sourceList.dispatchEvent(createDragEvent("dragenter"));
    sourceList.dispatchEvent(createDragEvent("dragenter"));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(true);

    sourceList.dispatchEvent(createDragEvent("dragleave"));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(true);

    sourceList.dispatchEvent(createDragEvent("dragleave"));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(false);

    sourceList.dispatchEvent(createDragEvent("dragleave"));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(false);
  });

  it("ignore un dragleave qui ne concerne pas un glisser de fichiers", async () => {
    const { functions } = await loadModules();
    functions.initializeLocalSources();

    const sourceList = document.querySelector(".source-list");
    if (!sourceList) throw new Error("Liste des sources introuvable");

    sourceList.dispatchEvent(createDragEvent("dragenter"));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(true);

    sourceList.dispatchEvent(createDragEvent("dragleave", [], ["text/plain"]));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(true);
  });

  it("importe les fichiers déposés et réinitialise l'état visuel", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeLocalSources();

    const sourceList = document.querySelector(".source-list");
    if (!sourceList) throw new Error("Liste des sources introuvable");

    const file = new File(["contenu"], "dropped.txt", { type: "text/plain" });

    sourceList.dispatchEvent(createDragEvent("dragenter"));
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(true);

    const dropEvent = createDragEvent("drop", [file]);
    const preventDefaultSpy = vi.spyOn(dropEvent, "preventDefault");

    sourceList.dispatchEvent(dropEvent);

    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(sourceList.classList.contains("source-list--drag-over")).toBe(false);
    expect(document.querySelector(".source-upload-status")?.textContent).toContain("en attente");

    await vi.waitFor(() => expect(constants.localSources.length).toBe(1));
    expect(constants.localSources[0]?.file.name).toBe("dropped.txt");
  });

  it("ignore un dépôt sans fichiers et un dépôt qui n'en contient pas", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeLocalSources();

    const sourceList = document.querySelector(".source-list");
    if (!sourceList) throw new Error("Liste des sources introuvable");

    sourceList.dispatchEvent(createDragEvent("drop", [], ["Files"]));
    expect(constants.localSources.length).toBe(0);
    expect(document.querySelector(".source-upload-status")?.textContent).toBe("");

    sourceList.dispatchEvent(createDragEvent("drop", [], ["text/plain"]));
    expect(constants.localSources.length).toBe(0);
    expect(document.querySelector(".source-upload-status")?.textContent).toBe("");
  });
});

describe("functions.initializeConversation et sendConversationMessage", () => {
  it("met à jour l'état du compositeur et efface la conversation", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeConversation();

    constants.conversationHistory.push({ role: "user", content: "A" }, { role: "assistant", content: "B" });

    const clearButton = document.querySelector<HTMLButtonElement>("#clear-session");
    clearButton?.click();

    expect(constants.conversationHistory).toHaveLength(0);
    expect(document.querySelector("#dynamic-message-list")?.children.length).toBe(0);
  });

  it("bloque l'envoi sans source sélectionnée", async () => {
    const { functions } = await loadModules();
    functions.initializeConversation();

    const sessionMock = createLanguageModelSessionMock();
    functions.setSession(sessionMock);

    const input = document.querySelector<HTMLTextAreaElement>("#prompt");
    if (!input) throw new Error("Textarea introuvable");
    input.value = "Question";

    const reportSpy = vi.spyOn(input, "reportValidity").mockImplementation(() => true);

    await functions.sendConversationMessage();

    expect(reportSpy).toHaveBeenCalledTimes(1);
  });

  it("envoie un message et stream une réponse", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeConversation();

    constants.localSources.push({
      id: "src-1",
      file: new File(["Texte"], "doc.txt", { type: "text/plain" }),
      family: "text",
      selected: true,
    });

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: vi.fn(async () => {
          return createLanguageModelSessionMock({
            promptStreaming: () =>
              new ReadableStream<string>({
                start(controller) {
                  controller.enqueue("Bon");
                  controller.enqueue("Bonjour");
                  controller.close();
                },
              }),
          });
        }),
      } satisfies LanguageModelAPI,
    });

    functions.setSession(createLanguageModelSessionMock());

    const input = document.querySelector<HTMLTextAreaElement>("#prompt");
    if (!input) throw new Error("Textarea introuvable");
    input.value = "Que dit le document ?";

    await functions.sendConversationMessage();

    expect(constants.conversationHistory).toHaveLength(2);
    expect(document.querySelectorAll("#dynamic-message-list .message").length).toBe(2);
    expect(document.querySelector(".message--assistant .message__content")?.textContent).toContain("Bonjour");
    expect(document.querySelector(".message__locality")?.textContent).toContain("Généré localement en");
  });

  it("gère une erreur d'envoi et restaure le texte utilisateur", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeConversation();

    constants.localSources.push({
      id: "src-2",
      file: new File(["Texte"], "doc.txt", { type: "text/plain" }),
      family: "text",
      selected: true,
    });

    functions.setSession(createLanguageModelSessionMock());

    const input = document.querySelector<HTMLTextAreaElement>("#prompt");
    if (!input) throw new Error("Textarea introuvable");
    input.value = "Question en erreur";

    await functions.sendConversationMessage();

    expect(document.querySelector("#dynamic-message-list")?.textContent).toContain("Je n'ai pas pu analyser le corpus");
    expect(input.value).toBe("Question en erreur");
  });

  it("gère une réponse vide du modèle", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeConversation();

    constants.localSources.push({
      id: "src-3",
      file: new File(["Texte"], "doc.txt", { type: "text/plain" }),
      family: "text",
      selected: true,
    });

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: vi.fn(async () => {
          return createLanguageModelSessionMock({
            promptStreaming: () =>
              new ReadableStream<string>({
                start(controller) {
                  controller.enqueue("   ");
                  controller.close();
                },
              }),
          });
        }),
      } satisfies LanguageModelAPI,
    });

    functions.setSession(createLanguageModelSessionMock());

    const input = document.querySelector<HTMLTextAreaElement>("#prompt");
    if (!input) throw new Error("Textarea introuvable");
    input.value = "Question vide";

    await functions.sendConversationMessage();

    expect(document.querySelector("#dynamic-message-list")?.textContent).toContain("Je n'ai pas pu analyser le corpus");
    expect(input.value).toBe("Question vide");
  });

  it("couvre les familles image/pdf/office dans le corpus et l'historique conversation", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeConversation();

    constants.localSources.push(
      {
        id: "img",
        file: new File(["img"], "capture.png", { type: "image/png" }),
        family: "image",
        selected: true,
      },
      {
        id: "pdf",
        file: new File(["%PDF"], "spec.pdf", { type: "application/pdf" }),
        family: "pdf",
        selected: true,
      },
      {
        id: "office",
        file: new File(["bin"], "plan.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
        family: "office",
        selected: true,
      },
    );

    constants.conversationHistory.push({ role: "user", content: "Ancien" });

    const createSpy = vi.fn(async () => {
      return createLanguageModelSessionMock({
        promptStreaming: () =>
          new ReadableStream<string>({
            start(controller) {
              controller.enqueue("Réponse multi");
              controller.close();
            },
          }),
      });
    });

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: createSpy,
      } satisfies LanguageModelAPI,
    });

    functions.setSession(createLanguageModelSessionMock());

    const input = document.querySelector<HTMLTextAreaElement>("#prompt");
    if (!input) throw new Error("Textarea introuvable");
    input.value = "Analyse complète";

    await functions.sendConversationMessage();

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(constants.conversationHistory.length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector(".message--assistant .message__content")?.textContent).toContain("Réponse multi");
  });

  it("met à jour l'état sur input du compositeur", async () => {
    const { functions, constants } = await loadModules();
    functions.initializeConversation();

    constants.localSources.push({
      id: "src-4",
      file: new File(["Texte"], "doc.txt", { type: "text/plain" }),
      family: "text",
      selected: true,
    });
    functions.setSession(createLanguageModelSessionMock());

    const input = document.querySelector<HTMLTextAreaElement>("#prompt");
    const send = document.querySelector<HTMLButtonElement>(".send-button");
    if (!input || !send) throw new Error("Contrôles du compositeur introuvables");

    input.value = "Question active";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(send.disabled).toBe(false);
  });
});

describe("fonctions avancées de disponibilité et suggestions", () => {
  it("gère un createSession sans LanguageModel", async () => {
    const { functions } = await loadModules();
    functions.setSession(null);
    functions.setCreationPromise(null);

    const result = await functions.createSession();
    expect(result).toBeNull();
    expect(document.body.dataset.runtimeState).toBe("error");
  });

  it("gère l'indisponibilité du modèle", async () => {
    const { functions } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "unavailable"),
        create: vi.fn(async () => createLanguageModelSessionMock()),
      } satisfies LanguageModelAPI,
    });

    await functions.checkPromptApi();
    expect(document.body.dataset.runtimeState).toBe("unsupported");
    expect(document.querySelector("#runtime-title")?.textContent).toContain("indisponible");
  });

  it("gère une erreur de vérification availability", async () => {
    const { functions } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async () => {
          throw new DOMException("network", "NetworkError");
        }),
        create: vi.fn(async () => createLanguageModelSessionMock()),
      } satisfies LanguageModelAPI,
    });

    await functions.checkPromptApi();
    expect(document.body.dataset.runtimeState).toBe("error");
    expect(document.querySelector<HTMLButtonElement>("#runtime-retry")?.hidden).toBe(false);
  });

  it("génère et applique des suggestions dynamiques", async () => {
    const { functions, constants } = await loadModules();

    Object.defineProperty(globalThis, "LanguageModel", {
      configurable: true,
      value: {
        availability: vi.fn(async (): Promise<PromptAvailability> => "available"),
        create: vi.fn(async () =>
          createLanguageModelSessionMock({
            prompt: async () => JSON.stringify({ prompts: ["Question A", "Question B", "Question C", "Question D"] }),
          }),
        ),
      } satisfies LanguageModelAPI,
    });

    functions.setSession(createLanguageModelSessionMock());
    constants.localSources.push({
      id: "src-suggest",
      file: new File(["Texte suggestion"], "suggest.md", { type: "text/markdown" }),
      family: "text",
      selected: true,
    });

    functions.initializeLocalSources();

    const selectAll = document.querySelector<HTMLInputElement>("#select-all-sources");
    if (!selectAll) throw new Error("Sélecteur global introuvable");
    selectAll.checked = true;
    selectAll.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => {
      expect(document.querySelectorAll("#dynamic-suggestion-grid .suggestion-card").length).toBe(4);
    });

    const firstSuggestion = document.querySelector<HTMLButtonElement>("#dynamic-suggestion-grid .suggestion-card");
    firstSuggestion?.click();
    expect((document.querySelector<HTMLTextAreaElement>("#prompt") as HTMLTextAreaElement).value).toBe("Question A");
  });
});
