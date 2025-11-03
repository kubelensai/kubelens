// Runtime configuration types
export interface RuntimeConfig {
  API_SERVER: string;
  MODE: 'development' | 'production';
}

declare global {
  interface Window {
    env: RuntimeConfig;
  }
}

export {};

