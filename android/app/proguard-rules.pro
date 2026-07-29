# ProGuard/R8-Regeln fuer den Release-Build. Aktiviert via minifyEnabled true
# in build.gradle. Ziel: alles rausminifizieren was nicht ueber Reflection/JNI
# oder JS-Bridge angesprochen wird. Die Rules unten schuetzen die Bereiche
# die R8 sonst zerlegt.

# --- Line-Numbers fuer verstaendliche Stack-Traces bewahren.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- Capacitor-Core: Plugin-Klassen + Bridge-Reflection.
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class *
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# --- Cordova-Plugin-Layer (Capacitor nutzt die Cordova-Bridge fuer manche Plugins).
-keep class org.apache.cordova.** { *; }

# --- Eigene App-Klassen (MainActivity + Manifest-Referenzen).
-keep class com.mahlzeit.myapp.** { *; }

# --- MLKit Barcode Scanning + TFLite-Modelle.
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.tflite.** { *; }
-keep class com.google.android.gms.internal.mlkit_** { *; }
-dontwarn com.google.mlkit.**

# --- AndroidX AppCompat (WebView-Activity-Basis).
-keep class androidx.appcompat.app.AppCompatActivity { *; }

# --- JavaScript-Interface (WebView -> Native calls).
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
