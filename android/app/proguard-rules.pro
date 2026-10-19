# Proguard rules for Vritta TWA
-keepattributes *Annotation*
-dontwarn com.google.androidbrowserhelper.**
-keep class com.google.androidbrowserhelper.** { *; }
-dontwarn androidx.browser.**
-keep class androidx.browser.** { *; }
