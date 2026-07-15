import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountIndexHtml } from "./test/dom";

const fns = {
  queryElement: (<T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Élément DOM introuvable : ${selector}`);
    return element;
  }),
  checkPromptApi: vi.fn(async () => undefined),
  clearReadyTimer: vi.fn(),
  createSession: vi.fn(async () => null),
  initializeConversation: vi.fn(),
  initializeLocalSources: vi.fn(),
  initializeSidebars: vi.fn(),
  sendConversationMessage: vi.fn(async () => undefined),
  setCreationPromise: vi.fn(),
  setSession: vi.fn(),
  availability: "unknown" as RuntimeAvailability,
  session: null as LanguageModelSession | null,
};

vi.mock("./functions", () => fns);

beforeEach(() => {
  vi.resetModules();
  mountIndexHtml();
  Object.values(fns).forEach((value) => {
    if (typeof value === "function" && "mockClear" in value) {
      (value as { mockClear: () => void }).mockClear();
    }
  });
});

describe("main", () => {
  it("initialise l'application et branche les événements", async () => {
    await import("./main");

    expect(window.localMindAI.availability).toBe("unknown");
    expect(window.localMindAI.session).toBeNull();
    expect(window.localMindAI.options.expectedOutputs[0]?.type).toBe("text");

    expect(fns.initializeLocalSources).toHaveBeenCalledTimes(1);
    expect(fns.initializeSidebars).toHaveBeenCalledTimes(1);
    expect(fns.initializeConversation).toHaveBeenCalledTimes(1);
    expect(fns.checkPromptApi).toHaveBeenCalledTimes(1);

    const action = document.querySelector<HTMLButtonElement>("#runtime-action");
    action?.click();
    expect(fns.createSession).toHaveBeenCalledTimes(1);

    const retry = document.querySelector<HTMLButtonElement>("#runtime-retry");
    retry?.click();
    expect(fns.checkPromptApi).toHaveBeenCalledTimes(2);

    const composer = document.querySelector<HTMLFormElement>(".composer");
    composer?.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    expect(fns.sendConversationMessage).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("pagehide"));
    expect(fns.clearReadyTimer).toHaveBeenCalledTimes(1);
    expect(fns.setSession).toHaveBeenCalledWith(null);
    expect(fns.setCreationPromise).toHaveBeenCalledWith(null);
  });
});
