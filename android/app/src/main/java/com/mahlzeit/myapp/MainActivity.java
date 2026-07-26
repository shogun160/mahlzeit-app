package com.mahlzeit.myapp;

import android.content.res.Configuration;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThemePlugin.class);
        super.onCreate(savedInstanceState);
        applySystemBarAppearance();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // Wird sowohl bei System-Dark-Mode-Wechsel als auch bei App-Theme-Toggle
        // via AppCompatDelegate.setDefaultNightMode (ThemePlugin) getriggert.
        applySystemBarAppearance();
    }

    // Setzt Status- und Navigation-Bar-Icons je nach effektivem uiMode. Weil
    // AppCompatDelegate.setDefaultNightMode die Activity-Configuration kippt,
    // spiegelt uiMode hier immer das aktive App-Theme (Auto folgt System).
    private void applySystemBarAppearance() {
        int nightModeFlags = getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        boolean isDark = (nightModeFlags == Configuration.UI_MODE_NIGHT_YES);
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(!isDark);
        controller.setAppearanceLightNavigationBars(!isDark);
    }
}
