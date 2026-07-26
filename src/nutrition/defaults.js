// DEFAULT_USER = Fallback-Diner, wenn portions > profiles.length. Wird bei der
// Kochmengen-Aggregation eingesetzt, damit fuer Gaeste ohne eigenes Profil ein
// realistischer Bedarf angenommen wird — sonst wuerde eine 5-Personen-Runde bei
// 2 Profilen unterportioniert kochen.
//
// Werte-Referenz: DGE-Empfehlungen fuer Erwachsene mit mittlerer koerperlicher
// Aktivitaet (PAL ≈ 1.4–1.6), konservativ als 2200 kcal Tagesziel angesetzt —
// leicht unter dem DGE-Mittel (Frau 2200 + Mann 2600 = Ø 2400), damit Gaeste-
// Runden nicht ueberkocht werden. Aufteilung auf Mahlzeiten: 25/35/40 =
// 550/770/880 kcal (letzteres ist die fuer die Rezept-Skalierung relevante
// Abendessen-Zahl).
//
// dailyTargetOverride wird bewusst gesetzt statt via BMR-Formel berechnet, damit
// die 2200 kcal stabil bleiben, selbst wenn spaeter Alter/Gewicht/PAL der
// Formel sich aendert. Der User sieht DEFAULT_USER nie in der Settings-UI —
// er ist reiner Compute-Fallback.
//
// TODO vor Merge in `beta`: DGE-Referenzwerte gegen aktuelle Quelle
// (https://www.dge.de/wissenschaft/referenzwerte/) abgleichen.
export const DEFAULT_USER = Object.freeze({
  id: '_default',
  name: 'Gast',
  gender: 'male',        // neutraler Fallback; wird nur relevant wenn Override wegfaellt
  age: 40,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 3,      // Level 3 = "aktiv"
  goal: 'maintain',
  dailyTargetOverride: 2200,
  breakfastKcal: 550,
  lunchKcal: 770,
  // Abendessen = 2200 − 550 − 770 = 880 kcal (berechnet, nicht gespeichert).
  showCalorieBar: false, // Gast hat keine eigene Bedarfs-Pille im Dashboard
  macroPreset: 'balanced',
  macroTargets: null,
  favorites: Object.freeze({}),
});
