import './style.css';
import { 
  availability, checkPromptApi, 
  clearReadyTimer, createSession, 
  initializeConversation, 
  initializeLocalSources, 
  initializeSidebars, 
  sendConversationMessage, 
  session, setCreationPromise, 
  setSession 
} from './functions';
import { elements, MODEL_OPTIONS } from './constants';

initializeLocalSources();

initializeSidebars();

initializeConversation();

elements.action.addEventListener("click", () => {
  /*
   * Aucun await avant cet appel : le geste utilisateur doit rester actif.
   */
  void createSession();
});

elements.retry.addEventListener("click", () => {
  void checkPromptApi();
});

elements.composer.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();
  void sendConversationMessage();
});

window.addEventListener("pagehide", () => {
  clearReadyTimer();

  session?.destroy();

  setSession(null);
  setCreationPromise(null);
});

window.localMindAI = Object.freeze({
  get session(): LanguageModelSession | null {
    return session;
  },

  get availability(): RuntimeAvailability {
    return availability;
  },

  get options(): LanguageModelOptions {
    return MODEL_OPTIONS;
  },

  check: checkPromptApi,
});

void checkPromptApi();