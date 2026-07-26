// Bridge zum nativen Theme-Plugin (siehe ThemePlugin.java). Setzt Android's
// AppCompatDelegate-NightMode, damit die Activity-Configuration.uiMode dem
// App-Theme folgt statt dem System — Status-/Navigation-Bar-Icons und die
// WebView-Media-Query bekommen dadurch automatisch den korrekten Modus.
//
// Im Browser (Vite-Dev-Server) ist der Aufruf ein No-Op — dort steuert der
// User den Modus ohnehin nur ueber CSS/data-theme.

import { Capacitor, registerPlugin } from '@capacitor/core';

const nativeTheme = registerPlugin('Theme');

export async function setNativeNightMode(mode) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await nativeTheme.setNightMode({ mode });
  } catch (e) {
    console.warn('[theme] setNightMode failed', e);
  }
}
