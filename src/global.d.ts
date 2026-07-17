declare global {
    type PromptAvailability =
        | "available"
        | "downloadable"
        | "downloading"
        | "unavailable";

    type LegacyPromptAvailability = 
        | "readily" 
        | "after-download" 
        | "no";

    type RuntimeAvailability = PromptAvailability | "unknown";

    type RuntimeState =
        | "checking"
        | "downloadable"
        | "downloading"
        | "initializing"
        | "ready"
        | "error"
        | "unsupported";

    type RuntimeStepState = 
        | "pending" 
        | "current" 
        | "complete" 
        | "error";

    type RuntimeStepName = "support" | "model" | "session";

    type FooterState =
        | "checking"
        | "downloadable"
        | "downloading"
        | "initializing"
        | "ready"
        | "error";

    interface LanguageModelIOConfiguration {
        readonly type: "text" | "image" | "audio";
        readonly languages?: readonly string[];
    }

    interface LanguageModelOptions {
        readonly expectedInputs: readonly LanguageModelIOConfiguration[];
        readonly expectedOutputs: readonly LanguageModelIOConfiguration[];
    }

    interface LanguageModelDownloadProgressEvent extends Event {
        readonly loaded: number;
    }

    interface LanguageModelMonitor extends EventTarget {
        addEventListener(
            type: "downloadprogress",
            listener: (event: LanguageModelDownloadProgressEvent) => void,
            options?: boolean | AddEventListenerOptions,
        ): void;
        addEventListener(
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions,
        ): void;
    }

    interface LanguageModelCreateOptions extends LanguageModelOptions {
        monitor?: (monitor: LanguageModelMonitor) => void;
    }

    interface LanguageModelSession {
        prompt(
            input: string,
            options?: {
                responseConstraint?: Record<string, unknown>;
                omitResponseConstraintInput?: boolean;
                signal?: AbortSignal;
            },
        ): Promise<string>;
        prompt(
            history: {
                role: "user" | "assistant" | "system";
                content: string | {
                    type: "text" | "image" | "audio" | "video";
                    value: any;
                }[];
            }[],
            options?: {
                responseConstraint?: Record<string, unknown>;
                omitResponseConstraintInput?: boolean;
                signal?: AbortSignal;
            },
        ): Promise<string>;
        promptStreaming(
            input: string,
            options?: {
                responseConstraint?: Record<string, unknown>;
                omitResponseConstraintInput?: boolean;
                signal?: AbortSignal;
            },
        ): ReadableStream<string>;
        promptStreaming(
            history: {
                role: "user" | "assistant" | "system";
                content: string | {
                    type: "text" | "image" | "audio" | "video";
                    value: any;
                }[];
            }[],
            options?: {
                responseConstraint?: Record<string, unknown>;
                omitResponseConstraintInput?: boolean;
                signal?: AbortSignal;
            },
        ): ReadableStream<string>;
        destroy(): void;
    }

    interface LanguageModelAPI {
        availability(
            options: LanguageModelOptions,
        ): Promise<PromptAvailability | LegacyPromptAvailability>;

        create(options: LanguageModelCreateOptions): Promise<LanguageModelSession>;
    }

    interface GlobalThisWithLanguageModel {
        LanguageModel?: LanguageModelAPI;
    }

    interface LocalMindReadyDetail {
        session: LanguageModelSession;
        options: LanguageModelOptions;
    }

    interface LocalMindAI {
        readonly session: LanguageModelSession | null;
        readonly availability: RuntimeAvailability;
        readonly options: LanguageModelOptions;
        check(): Promise<void>;
    }

    interface RuntimeStateContent {
        title?: string;
        description?: string;
        detail?: string;
    }

    type RuntimeControl =
        | HTMLButtonElement
        | HTMLSelectElement
        | HTMLTextAreaElement;

    type SourceFamily = "image" | "text" | "office" | "pdf" | "web";

    interface LocalSource {
        id: string;
        file: File;
        family: SourceFamily;
        selected: boolean;
    }

    interface StoredSourceMetadata {
        id: string;
        name: string;
        type: string;
        lastModified: number;
        family: SourceFamily;
        selected: boolean;
    }

    interface SuggestedPromptsResponse {
        prompts: string[];
    }

    type ConversationHistoryMessage = {
        role: "user" | "assistant";
        content: string;
    };
    
    type SourceFamily = "image" | "text" | "office" | "pdf" | "web";

    type SidebarName = "sources";

    interface SidebarConfig {
        panelSelector: string;
        closeLabel: string;
        openLabel: string;
        icon: string;
    }

    type CorpusPromptPart = {
        type: "text" | "image" | "audio" | "video";
        value: unknown;
    };

    interface Window {
        localMindAI: Readonly<LocalMindAI>;
    }

    interface WindowEventMap {
        "localmind:ai-ready": CustomEvent<LocalMindReadyDetail>;
    }
}

export {};