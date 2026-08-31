# Zutaten-Katalog

**Auto-generiert aus `src/data/ingredients.json` — nicht manuell editieren.**
Neu erzeugen: `node scripts/zutaten-katalog.js`

**151 Zutaten** gesamt, sortiert nach Kategorie.

## Vor dem Anlegen einer neuen Zutat

1. In diesem Katalog per **Cmd+F** nach Namen suchen (deutsch UND englisch).
2. Auch verwandte Formen prüfen — z. B. „Petersilie" vs. „Petersilie glatt" vs. „Petersilie kraus".
3. Bei Unit-Abweichung (Bund vs. g) trotzdem die bestehende Zutat nutzen, wenn semantisch dieselbe — Guardrail 8 verhindert Duplikate wie zwei Petersilie-Einträge, die die Einkaufsliste doppelt zeigen.
4. Nur wenn wirklich neu → in `ingredients.json` anlegen, dann `node scripts/zutaten-katalog.js` ausführen.

## Fleisch & Fisch (19)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `entenbrust` | Entenbrust, ohne Haut | g | 123 | 19.6 | 0 | 4.5 |
| `garnelen` | Garnelen, roh, geschält | g | 85 | 20 | 0.2 | 0.5 |
| `haehnchenbrust` | Hähnchenbrust | g | 120 | 22.5 | 0 | 2.6 |
| `kabeljau` | Kabeljau (Wildfang), Filet | g | 82 | 17.8 | 0 | 0.7 |
| `kalb_loin` | Kalbsmedaillons (Loin, roh) | g | 127 | 21.3 | 0 | 4.2 |
| `lammkeule` | Lammkeule, mager | g | 170 | 20 | 0 | 10 |
| `putenbrust` | Putenbrust | g | 105 | 24 | 0 | 1 |
| `putenhack` | Putenhack | g | 149 | 19.6 | 0 | 7.6 |
| `rind_sirloin` | Rind (Sirloin/Flanksteak) | g | 137 | 21 | 0 | 5.4 |
| `rinderfilet` | Rinderfilet | g | 143 | 21 | 0 | 6 |
| `rindergulasch` | Rindergulasch | g | 116 | 17 | 0.1 | 5 |
| `sardellenfilet` | Sardellenfilets in Öl | g | 210 | 28 | 0 | 10 |
| `sardinen` | Sardinen, roh (Wildfang, Filet) | g | 208 | 24.6 | 0 | 11.4 |
| `schweinefilet` | Schweinefilet | g | 106 | 20.5 | 0 | 2.5 |
| `thunfisch_sashimi` | Thunfischfilet, Sashimi-Qualität | g | 132 | 28 | 0 | 1.3 |
| `lachs_keta` | Wildlachs (Keta), Filet | g | 131 | 22 | 0 | 4.8 |
| `lachs_sockeye` | Wildlachs (Sockeye), Filet | g | 156 | 22.5 | 0 | 6.9 |
| `lachs_senfhonig` | Wildlachs in Senf-Honig-Sauce | g | 114 | 14 | 7 | 2.3 |
| `zander` | Zanderfilet (Wildfang, roh) | g | 91 | 18.6 | 0 | 1 |

## Kühlware (Milchprodukte, Tofu etc.) (11)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `butter` | Butter | g | 717 | 0.9 | 0.1 | 81 |
| `edamame` | Edamame, geschält (TK) | g | 122 | 11.9 | 8.9 | 5.2 |
| `ei` | Eier | ei × 53 g | 143 | 12.6 | 0.7 | 9.5 |
| `erbsen_tk` | Erbsen (TK) | g | 81 | 5.3 | 14.5 | 0.3 |
| `joghurt_griech10` | Griechischer Joghurt 10 % | g | 115 | 5.5 | 3.6 | 10 |
| `joghurt_griech` | Griechischer Joghurt 2 % | g | 73 | 10 | 3.6 | 2 |
| `kimchi` | Kimchi | g | 15 | 1.1 | 2.4 | 0.2 |
| `feta_schaf` | Schafskäse (Feta) | g | 264 | 14.2 | 4 | 21.3 |
| `skyr` | Skyr, natur | g | 63 | 11 | 4 | 0.2 |
| `tempeh` | Soja-Tempeh | g | 193 | 19 | 9 | 11 |
| `tofu_fest` | Tofu, fest | g | 144 | 15.8 | 2.8 | 8.7 |

## Frisch (Gemüse, Kräuter, Obst) (51)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `aubergine` | Aubergine | stueck × 250 g | 25 | 1 | 4 | 0.2 |
| `austernpilze` | Austernpilze | g | 33 | 3.3 | 6.1 | 0.4 |
| `avocado` | Avocado | stueck × 150 g | 160 | 2 | 8.5 | 14.7 |
| `spinat` | Baby-Spinat | g | 23 | 2.9 | 3.6 | 0.4 |
| `blumenkohl` | Blumenkohl | stueck × 700 g | 25 | 2 | 5 | 0.3 |
| `brokkoli` | Brokkoli | stueck × 400 g | 28 | 3.4 | 2.7 | 0.4 |
| `buschbohnen` | Buschbohnen | g | 32 | 1.8 | 4 | 0.2 |
| `champignons` | Champignons | g | 22 | 3.1 | 3.3 | 0.3 |
| `cherry_tomate` | Cherry-Tomaten | g | 17 | 0.9 | 3.5 | 0.2 |
| `chili_frisch` | Chili, frisch (mit Kernen) | stueck × 6 g | 40 | 1.9 | 8.8 | 0.4 |
| `curryblatt` | Curryblätter, frisch | g | 108 | 6 | 18.7 | 1 |
| `daikon` | Daikon (Rettich) | stueck × 400 g | 18 | 0.6 | 4.1 | 0.1 |
| `fenchel` | Fenchel | stueck × 300 g | 31 | 1.2 | 7.3 | 0.2 |
| `fruehlingszwiebel` | Frühlingszwiebel | bund × 80 g | 32 | 2 | 7 | 0 |
| `galangal` | Galangal | g | 71 | 1.6 | 15 | 0.5 |
| `paprika_gelb` | Gelbe Paprika | stueck × 150 g | 28 | 1 | 5 | 0.3 |
| `granatapfelkerne` | Granatapfelkerne | g | 83 | 1.7 | 18.7 | 1.2 |
| `ingwer` | Ingwer | g | 80 | 1.8 | 18 | 0.8 |
| `karotte` | Karotte | stueck × 70 g | 41 | 1 | 9.5 | 0.2 |
| `karotten_bunt` | Karotten, bunt | stueck × 70 g | 41 | 0.9 | 9.6 | 0.2 |
| `kartoffeln` | Kartoffeln | stueck × 150 g | 77 | 2 | 17 | 0.1 |
| `knoblauch` | Knoblauch | zehe × 3 g | 148 | 6.7 | 33.3 | 0 |
| `kopfsalat` | Kopfsalat / Romana | stueck × 300 g | 17 | 1.2 | 3 | 0.3 |
| `kurkuma_frisch` | Kurkuma, frisch | g | 82 | 1.7 | 13.4 | 1.1 |
| `lauch` | Lauch | stueck × 200 g | 30 | 1.5 | 3.3 | 0.3 |
| `limette` | Limette, Saft | stueck × 25 g | 25 | 0.4 | 8.4 | 0.1 |
| `mais_kolben` | Maiskolben | stueck × 200 g | 108 | 3.3 | 21 | 1.5 |
| `mango` | Mango | stueck × 300 g | 60 | 0.8 | 15 | 0.4 |
| `minze` | Minze, frisch | g | 44 | 3.3 | 8.4 | 0.7 |
| `orange` | Orange | stueck × 200 g | 47 | 0.9 | 8.3 | 0.1 |
| `orangensaft` | Orangensaft | ml | 45 | 0.7 | 10.4 | 0.2 |
| `pak_choi` | Pak Choi / Bok Choy | stueck × 200 g | 13 | 1.5 | 2.2 | 0.2 |
| `paprika` | Paprika | stueck × 150 g | 31 | 1 | 6 | 0.3 |
| `petersilie` | Petersilie | bund × 30 g | 36 | 4 | 6 | 0 |
| `radieschen` | Radieschen | g | 16 | 0.7 | 3.4 | 0.1 |
| `rosmarin_thymian` | Rosmarin & Thymian | g | 100 | 3 | 20 | 6 |
| `rote_zwiebel` | Rote Zwiebel | stueck × 100 g | 40 | 1.2 | 9.3 | 0.2 |
| `rotkohl` | Rotkohl | g | 21 | 1.5 | 3.5 | 0.2 |
| `rucola` | Rucola | g | 25 | 2.6 | 2 | 0.7 |
| `gurke` | Salatgurke | stueck × 300 g | 12 | 0.6 | 2.2 | 0.2 |
| `schalotte` | Schalotte | stueck × 20 g | 72 | 2.5 | 16 | 0.1 |
| `schnittlauch` | Schnittlauch | bund | 30 | 3 | 4.4 | 0.7 |
| `paprika_spitz` | Spitzpaprika | stueck × 100 g | 31 | 1 | 6 | 0.3 |
| `sellerie_stauden` | Staudensellerie | g | 16 | 1.2 | 2.2 | 0.3 |
| `suesskartoffel` | Süßkartoffel | stueck × 250 g | 86 | 1.6 | 20 | 0.1 |
| `thai_basilikum` | Thai-Basilikum | g | 22 | 3.2 | 2.7 | 0.6 |
| `tomate` | Tomate | stueck × 100 g | 18 | 0.9 | 3.9 | 0.2 |
| `zitrone` | Zitrone, Saft | stueck × 40 g | 22 | 0.4 | 6.9 | 0.2 |
| `zitronengras` | Zitronengras | g | 99 | 1.8 | 25 | 0.5 |
| `zucchini` | Zucchini | stueck × 200 g | 17 | 1.2 | 3.1 | 0.3 |
| `zwiebel` | Zwiebel | stueck × 100 g | 40 | 1 | 9.2 | 0 |

## Trocken (Reis, Pasta, Bohnen, Nüsse) (29)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `aprikosen_getrocknet` | Aprikosen, getrocknet | g | 241 | 3.3 | 62.7 | 0.3 |
| `reis_basmati_vollkorn` | Basmati Vollkorn (trocken) | g | 355 | 8 | 73 | 2.5 |
| `bulgur` | Bulgur (trocken) | g | 342 | 12.3 | 63.4 | 1.3 |
| `bohnen_cannellini` | Cannellini-Bohnen (trocken) | g | 333 | 22 | 60 | 1.7 |
| `couscous` | Couscous | g | 376 | 12.8 | 72.4 | 0.6 |
| `erdnuesse` | Erdnüsse, geröstet, ungesalzen | g | 585 | 24 | 21.3 | 50 |
| `freekeh` | Freekeh (ganz) | g | 337 | 12.6 | 62 | 2.7 |
| `haselnuesse` | Haselnüsse | g | 628 | 15 | 17 | 61 |
| `kichererbsen_dose` | Kichererbsen (Abtropfgewicht) | g | 119 | 6.5 | 14 | 2.3 |
| `kichererbsen_trocken` | Kichererbsen (trocken) | g | 364 | 19.3 | 61 | 6 |
| `bohnen_kidney` | Kidneybohnen (Abtropfgewicht) | g | 127 | 8.7 | 22.8 | 0.5 |
| `mais_dose` | Mais (Dose) | g | 86 | 3.2 | 19 | 1.2 |
| `mandeln` | Mandeln | g | 579 | 20.8 | 21.7 | 50 |
| `miso` | Miso-Paste | g (tl) | 199 | 12 | 26 | 6 |
| `pinienkerne` | Pinienkerne | g | 673 | 14 | 13 | 68 |
| `quinoa` | Quinoa (trocken) | g | 368 | 14.1 | 57.2 | 6.1 |
| `reis_rundkorn` | Reis, Rundkorn/Bomba | g | 349 | 6.7 | 77.5 | 0.6 |
| `reisnudeln_duenn` | Reisnudeln, dünn (trocken) | g | 364 | 1.1 | 83 | 0.2 |
| `reispapier` | Reispapier (Banh Trang) | g | 333 | 1 | 78 | 0.2 |
| `linsen_rot_trocken` | Rote Linsen (trocken) | g | 353 | 24.6 | 60.1 | 1.1 |
| `bohnen_schwarz` | Schwarze Bohnen (Dose) | g | 91 | 6.3 | 16.6 | 0.5 |
| `bohnen_schwarz_gek` | Schwarze Bohnen (gekocht) | g | 132 | 8.9 | 23.7 | 0.5 |
| `tomaten_passiert` | Tomaten, passiert | g | 32 | 1.6 | 5.9 | 0.3 |
| `tomatenmark` | Tomatenmark | g | 82 | 4.5 | 19 | 0.5 |
| `tortilla_mais` | Tortilla, Mais | stueck × 30 g | 218 | 5.7 | 45.2 | 2.3 |
| `vollkornbrot` | Vollkornbrot | g | 240 | 8.5 | 41 | 3.5 |
| `vollkornpasta` | Vollkornpasta | g | 348 | 13 | 64 | 2.4 |
| `bohnen_weiss` | Weiße Bohnen (Dose) | g | 90 | 6.6 | 16 | 0.3 |
| `bohnen_weiss_gek` | Weiße Bohnen (gekocht) | g | 139 | 9 | 25 | 0.6 |

## Gewürze & Aromate (16)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `gewuerz_backpulver` | Backpulver | g (tl) | 53 | 0 | 28 | 0 |
| `gewuerz_chili` | Chiliflocken | g (tl) | 282 | 13 | 55 | 14 |
| `gewuerz_curry` | Currypulver (mild) | g (tl) | 325 | 14.3 | 55.8 | 14 |
| `gewuerz_garam` | Garam Masala | g (tl) | 380 | 15 | 45 | 15 |
| `gewuerz_paprika_gerauch` | Geräuchertes Paprikapulver | g (tl) | 282 | 14 | 54 | 13 |
| `gewuerz_koriander` | Koriandersamen, gemahlen | g (tl) | 300 | 12.4 | 55 | 17.8 |
| `gewuerz_kreuzkuemmel` | Kreuzkümmel, gemahlen | g (tl) | 375 | 18 | 44 | 22 |
| `gewuerz_kurkuma` | Kurkuma, gemahlen | g (tl) | 354 | 8 | 65 | 10 |
| `gewuerz_paprika_edelsuess` | Paprikapulver, edelsüß | g (tl) | 282 | 14 | 54 | 13 |
| `gewuerz_raselhanout` | Ras-el-Hanout | g (tl) | 320 | 12 | 45 | 10 |
| `gewuerz_roganjosh` | Rogan-Josh-Gewürzmischung | vorrat (tl) | 300 | 10 | 40 | 10 |
| `gewuerz_senfkoerner` | Senfkörner | g (tl) | 508 | 26.1 | 28.1 | 36.2 |
| `sesam` | Sesam, Samen | vorrat (tl) | 572 | 17.5 | 23.8 | 50 |
| `gewuerz_sumach` | Sumach | g (tl) | 310 | 8 | 62 | 6 |
| `gewuerz_tikka` | Tikka-Gewürzmischung | vorrat (tl) | 300 | 10 | 40 | 10 |
| `gewuerz_zaatar` | Za'atar | g (tl) | 350 | 10 | 30 | 20 |

## Öl, Sauce & Würzmittel (4)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `oel_neutral` | Öl, neutral (Raps/Sonnenblume) | vorrat | 884 | 0 | 0 | 100 |
| `olivenoel` | Olivenöl | vorrat (el) | 884 | 0 | 0 | 100 |
| `sesamoel` | Sesamöl | vorrat (tl) | 884 | 0 | 0 | 100 |
| `tahini` | Tahini | g (el) | 595 | 17 | 21.2 | 53.8 |

## Sonstige (21)

| Key | Label | Einheit | kcal/100g | P | KH | F |
|---|---|---|---:|---:|---:|---:|
| `achiote_paste` | Achiote-Paste | g | 240 | 3 | 40 | 6 |
| `ahornsirup` | Ahornsirup | g (el) | 260 | 0 | 67 | 0.2 |
| `chuan_nan_chili` | Chuan-Nan Chopped Chili | g | 206 | 15 | 4.8 | 20.6 |
| `dijon_senf` | Dijon-Senf | g (tl) | 60 | 4.4 | 5.3 | 3.4 |
| `erdnussbutter` | Erdnussbutter (natur, ungesüßt) | g | 588 | 25 | 20 | 50 |
| `fischsauce` | Fischsauce | ml (el) | 35 | 5 | 3.6 | 0 |
| `gochujang` | Gochujang | g | 230 | 4 | 48 | 2 |
| `honig` | Honig | vorrat (el) | 304 | 0 | 82.5 | 0 |
| `kalamata_oliven` | Kalamata-Oliven | g | 115 | 0.8 | 6.3 | 10.7 |
| `kapern` | Kapern (abgetropft) | g | 23 | 2.4 | 4.9 | 0.9 |
| `reisessig` | Reisessig | ml (el) | 20 | 0.3 | 5 | 0 |
| `rotweinessig` | Rotweinessig | ml | 19 | 0.1 | 0.3 | 0 |
| `senf_mittelscharf` | Senf, mittelscharf | g | 88 | 5.6 | 7.4 | 5 |
| `shaoxing_reiswein` | Shaoxing-Reiswein | ml (el) | 130 | 0.4 | 5 | 0 |
| `sojasauce` | Sojasauce | vorrat (el) | 53 | 8 | 4.7 | 0 |
| `sriracha` | Sriracha-Sauce | ml | 93 | 2 | 19 | 1 |
| `currypaste_thai` | Thai-Currypaste | g (tl) | 120 | 2 | 15.2 | 4.8 |
| `tomatenpassata` | Tomaten Passata | g | 32 | 1.6 | 5.9 | 0.3 |
| `tomaten_stueckig` | Tomaten, stückig (Dose) | g | 27 | 1.5 | 5 | 0.3 |
| `weisswein_trocken` | Weißwein, trocken (zum Kochen) | ml | 83 | 0.1 | 2.6 | 0 |
| `zhacai` | Zhacai (eingelegter Senfkohl, in Öl) | g | 220 | 4 | 8 | 20.6 |
