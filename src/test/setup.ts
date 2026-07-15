import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  sessionStorage.clear();

  if (!("scrollIntoView" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  }

  if (!("text" in File.prototype)) {
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      writable: true,
      value: async function fileText(this: File): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
              return;
            }

            resolve("");
          });
          reader.addEventListener("error", () => reject(reader.error ?? new Error("Lecture impossible")));
          reader.readAsText(this);
        });
      },
    });
  }

  if (!("arrayBuffer" in File.prototype)) {
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      writable: true,
      value: async function fileArrayBuffer(this: File): Promise<ArrayBuffer> {
        return await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (reader.result instanceof ArrayBuffer) {
              resolve(reader.result);
              return;
            }

            resolve(new ArrayBuffer(0));
          });
          reader.addEventListener("error", () => reject(reader.error ?? new Error("Lecture impossible")));
          reader.readAsArrayBuffer(this);
        });
      },
    });
  }

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 780px") ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      randomUUID: vi.fn(() => "uuid-test"),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
