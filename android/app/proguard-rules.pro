# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Realm — keep the whole library + generated proxies (looked up by reflection/JNI)
-keep class io.realm.** { *; }
-keep interface io.realm.** { *; }
-keep class * extends io.realm.RealmObject { *; }
-keep @io.realm.annotations.RealmModule class * { *; }
-keep class io.realm.internal.Keep { *; }
-keep @io.realm.internal.Keep class * { *; }
-dontwarn io.realm.**

# Our native modules + React packages are instantiated at ReactInstance startup
-keep class com.chuchplayer.** { *; }

# Add any project specific keep options here:
