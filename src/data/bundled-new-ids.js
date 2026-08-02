// IDs der Rezepte, die in der aktuellen APK-Version als "neu" gelten sollen.
// Wird bei Fresh-Install (state.remoteUpdatedAt === null) in state.remoteNewIds
// geseedet — damit sieht der User beim ersten App-Start die aktuellen
// Bundled-Neuen mit "Neu"-Marker im Picker.
//
// Ein User-Import (Settings > Rezepte importieren) darf remoteNewIds
// ueberschreiben — dann greift die normale Remote-Logik.
//
// Wartung: Bei jedem Release die Liste aktualisieren. Bei Version 1.5.7
// z.B. die dann neuen IDs (42+) reinnehmen, alte rausnehmen.

export const BUNDLED_NEW_IDS = [36, 37, 38, 39, 40, 41];
