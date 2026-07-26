import { defineConfig } from 'vite';

export default defineConfig({
  // Projekt-Root ist das aktuelle Verzeichnis
  root: '.',

  // Statische Assets aus public/ werden unverändert kopiert (ohne Hash)
  publicDir: 'public',

  build: {
    // Build-Output-Ordner (Capacitors webDir)
    outDir: 'www',
    // www/ leeren vor jedem Build
    emptyOutDir: true,
  },

  server: {
    // Fester Port erleichtert Bookmark im Browser
    port: 5173,
    // Auto-open des Standard-Browsers bei npm run dev
    open: true,
  },
});
