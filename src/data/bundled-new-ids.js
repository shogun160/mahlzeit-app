// IDs der Rezepte, die in der aktuellen APK-Version als "neu" gelten sollen.
// Wird bei Fresh-Install (state.remoteUpdatedAt === null) in state.remoteNewIds
// geseedet — damit sieht der User beim ersten App-Start die aktuellen
// Bundled-Neuen mit "Neu"-Marker im Picker.
//
// Ein User-Import (Settings > Rezepte importieren) darf remoteNewIds
// ueberschreiben — dann greift die normale Remote-Logik.
//
// Wartung: Bei jedem Release die Liste aktualisieren — die seit dem letzten
// Release dazugekommenen IDs rein, die alten raus. loadState() vergleicht
// diese Liste gegen state.bundledNewSeed und seedet bei jeder Aenderung neu,
// also auch wenn die APK ueber eine bestehende Installation gelegt wird.

// 16 ist nicht neu, aber mit Rotkohl-Slaw und Goma-Dip so stark ueberarbeitet,
// dass es sich fuer den User wie ein neues Rezept anfuehlt.
export const BUNDLED_NEW_IDS = [16, 42];
