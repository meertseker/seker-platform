export {};

// Vitest happy-dom ortamı window'a happyDOM ekler; testler URL'yi bununla değiştirir.
declare global {
  interface Window {
    happyDOM: { setURL(url: string): void };
  }
}
