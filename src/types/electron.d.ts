export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      platform?: string;
      version?: () => Promise<string>;
      update?: {
        check?: () => Promise<void>;
        download?: () => Promise<void>;
        install?: () => Promise<void>;
        onChecking?: (callback: () => void) => () => void;
        onAvailable?: (callback: (data: { version: string }) => void) => () => void;
        onNotAvailable?: (callback: () => void) => () => void;
        onProgress?: (callback: (data: { percent: number }) => void) => () => void;
        onDownloaded?: (callback: (data: { version: string }) => void) => () => void;
        onError?: (callback: (data: { message: string }) => void) => () => void;
      };
    };
  }
}
