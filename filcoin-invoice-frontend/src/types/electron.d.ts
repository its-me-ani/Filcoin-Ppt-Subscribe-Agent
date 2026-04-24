interface ElectronAiAPI {
  sendMessage: (provider: string, config: object, messages: object[]) => Promise<string>;
  testConnection: (provider: string, config: object) => Promise<boolean>;
  listModels: (provider: string, config: object) => Promise<string[]>;
}

interface ElectronAPI {
  platform: 'electron';
  ai: ElectronAiAPI;
}

interface Window {
  electronAPI?: ElectronAPI;
}
