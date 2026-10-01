/**
 * The live site's stand-in for ./install. vite.config.ts swaps it in for every
 * build except the demo, so no demo code — the fake server, the in-browser
 * PDF maker — can end up in what customers download.
 */
export function installDemo(): void {}
