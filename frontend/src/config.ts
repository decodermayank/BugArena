const strip = (s: string) => s.replace(/\/+$/, '');

export const API_URL: string = strip(
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://127.0.0.1:8000',
);
export const WS_URL: string = strip(
  (import.meta.env.VITE_WS_URL as string | undefined) || 'ws://127.0.0.1:8000',
);
