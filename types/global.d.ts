// Global type declarations for window extensions

interface Window {
  aistudio?: {
    prompt: (options: { prompt: string; systemInstruction?: string; config?: any }) => Promise<any>;
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  };
}
