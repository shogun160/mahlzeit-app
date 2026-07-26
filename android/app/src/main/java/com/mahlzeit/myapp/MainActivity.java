package com.mahlzeit.myapp;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // App-Content ist immer hell (kein Dark Mode implementiert). Status-
        // und Navigation-Bar-Icons dunkel rendern, damit sie auch im System-
        // Darkmode sichtbar bleiben. Das Theme-Attribut windowLightStatusBar
        // greift bei erzwungener Edge-to-Edge (Android 15+) nicht zuverlässig,
        // deshalb hier zusätzlich programmatisch über den InsetsController.
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(true);
        controller.setAppearanceLightNavigationBars(true);
    }
}
