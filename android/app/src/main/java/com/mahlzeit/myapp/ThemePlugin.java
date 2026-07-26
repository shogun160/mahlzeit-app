package com.mahlzeit.myapp;

import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Bridge fuer den App-Theme-Toggle. AppCompatDelegate.setDefaultNightMode kippt
// die Activity-Configuration.uiMode selbst — dadurch folgen sowohl unsere
// eigene Bar-Icon-Logik (MainActivity.applySystemBarAppearance) als auch die
// WebView-Media-Query prefers-color-scheme automatisch dem App-Theme statt
// dem System.
@CapacitorPlugin(name = "Theme")
public class ThemePlugin extends Plugin {
    @PluginMethod
    public void setNightMode(PluginCall call) {
        String mode = call.getString("mode", "follow_system");
        final int nightMode;
        if ("yes".equals(mode)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_YES;
        } else if ("no".equals(mode)) {
            nightMode = AppCompatDelegate.MODE_NIGHT_NO;
        } else {
            nightMode = AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        }
        // Muss auf dem UI-Thread laufen, sonst crasht das Configuration-Update.
        getActivity().runOnUiThread(() -> AppCompatDelegate.setDefaultNightMode(nightMode));
        call.resolve();
    }
}
