import { describe, expect, it, vi } from "vitest";
import { mountIndexHtml } from "./test/dom";

describe("constants", () => {
  it("expose les constantes et les éléments DOM", async () => {
    vi.resetModules();
    mountIndexHtml();

    const constants = await import("./constants");

    expect(constants.MODEL_OPTIONS.expectedInputs.length).toBeGreaterThan(0);
    expect(constants.MAX_LOCAL_STORAGE_BYTES).toBe(500 * 1024 * 1024);
    expect(constants.SOURCE_INDEX_STORAGE_KEY).toBe("localmind:session:sources");
    expect(constants.SOURCE_DATA_STORAGE_PREFIX).toBe("localmind:session:source:");
    expect(constants.TEXT_EXTENSIONS.has("md")).toBe(true);
    expect(constants.OFFICE_EXTENSIONS.has("docx")).toBe(true);
    expect(constants.elements.composer).toBeInstanceOf(HTMLFormElement);
    expect(constants.elements.runtimeControls.length).toBeGreaterThan(0);
    expect(constants.SIDEBAR_CONFIG.sources.closeLabel).toContain("sources");
    expect(constants.RAG_SYSTEM_PROMPT).toContain("Je ne sais pas");
    expect(constants.conversationHistory).toEqual([]);
    expect(constants.localSources).toEqual([]);
  });
});
