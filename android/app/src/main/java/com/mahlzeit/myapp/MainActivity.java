package com.mahlzeit.myapp;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarAppearance();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Fängt System-Dark-Mode-Wechsel während App läuft ab (User dreht in
        // Android-Settings um). Bar-Icons aktualisieren sich damit ohne Restart.
        applySystemBarAppearance();
    }

    // Setzt Status- und Navigation-Bar-Icons je nach System-Dark-Mode. Bei
    // hellem Modus dunkle Icons, bei dunklem Modus helle Icons.
    // Trade-off (Session 14): folgt dem System, nicht dem App-Theme-Toggle. Wenn
    // User in der App "Hell" aber System auf "Dark" ist, bekommen wir helle
    // Icons auf hellem Bar — Mismatch. Akzeptiert für v1; ein späteres
    // @capacitor/status-bar Plugin könnte das dynamisch aus JS setzen.
    private void applySystemBarAppearance() {
        int nightModeFlags = getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        boolean isSystemDark = (nightModeFlags == Configuration.UI_MODE_NIGHT_YES);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!isSystemDark);
        controller.setAppearanceLightNavigationBars(!isSystemDark);
    }
}
