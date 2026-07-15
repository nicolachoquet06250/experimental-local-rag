import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const indexPath = resolve(process.cwd(), "index.html");

export function mountIndexHtml(): void {
  const html = readFileSync(indexPath, "utf-8");
  const cleaned = html.replace(/<script type="module" src="\/src\/main\.ts"><\/script>/, "");

  document.open();
  document.write(cleaned);
  document.close();

  if (!document.querySelector("#runtime-action use")) {
    const action = document.querySelector("#runtime-action");
    if (action) action.innerHTML = '<svg aria-hidden="true"><use href="#icon-download" /></svg><span>Installer et initialiser</span>';
  }
}

export function createLanguageModelSessionMock(overrides?: {
  prompt?: LanguageModelSession["prompt"];
  promptStreaming?: LanguageModelSession["promptStreaming"];
  destroy?: LanguageModelSession["destroy"];
}): LanguageModelSession {
  const defaultStream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue("Réponse");
      controller.close();
    },
  });

  return {
    prompt: overrides?.prompt ?? (async () => JSON.stringify({ prompts: ["Q1 ?", "Q2 ?", "Q3 ?", "Q4 ?"] })),
    promptStreaming: overrides?.promptStreaming ?? (() => defaultStream),
    destroy: overrides?.destroy ?? (() => undefined),
  };
}
