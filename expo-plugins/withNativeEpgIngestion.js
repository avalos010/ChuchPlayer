const { withAppBuildGradle, withMainApplication } = require('@expo/config-plugins');

/**
 * Expo config plugin to configure native EPG ingestion + player modules
 * - Adds Realm, OkHttp, Coroutines, and Media3 dependencies
 * - Configures sourceSets to include native/ folder
 * - Registers EpgIngestionPackage and ExoPlayerPackage in MainApplication.kt
 */
const withNativeEpgIngestion = (config) => {
  // Step 1: Modify build.gradle to add dependencies and sourceSets
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let buildGradle = config.modResults.contents;

      // Add dependencies if not already present
      if (!buildGradle.includes('androidx.media3:media3-exoplayer:1.8.0')) {
        // Find the dependencies block by looking for the closing brace
        // We'll insert before the last closing brace of the dependencies block
        const dependenciesMatch = buildGradle.match(/dependencies\s*\{/);
        if (dependenciesMatch) {
          let braceCount = 0;
          let inDependencies = false;
          let insertIndex = -1;
          
          for (let i = dependenciesMatch.index; i < buildGradle.length; i++) {
            if (buildGradle[i] === '{') {
              braceCount++;
              inDependencies = true;
            } else if (buildGradle[i] === '}') {
              braceCount--;
              if (inDependencies && braceCount === 0) {
                insertIndex = i;
                break;
              }
            }
          }
          
          if (insertIndex !== -1) {
            const newDependencies = `    
    // Native module dependencies
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    // Realm Java SDK - compatible with Realm JS
    // Note: Realm Java SDK uses different versioning than Realm JS
    implementation("io.realm:realm-android-library:10.15.1")
    // WorkManager for periodic EPG fetching
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    // Media3 / ExoPlayer
    implementation("androidx.media3:media3-exoplayer:1.8.0")
    implementation("androidx.media3:media3-exoplayer-hls:1.8.0")
    implementation("androidx.media3:media3-datasource:1.8.0")
`;
            buildGradle = buildGradle.substring(0, insertIndex) + newDependencies + buildGradle.substring(insertIndex);
          }
        }
      }

      // Add sourceSets configuration if not already present
      if (!buildGradle.includes('srcDirs += [\'../../native/android/src/main/java\']')) {
        // Find the android block
        const androidMatch = buildGradle.match(/android\s*\{/);
        if (androidMatch) {
          let braceCount = 0;
          let inAndroid = false;
          let insertIndex = -1;
          
          for (let i = androidMatch.index; i < buildGradle.length; i++) {
            if (buildGradle[i] === '{') {
              braceCount++;
              inAndroid = true;
            } else if (buildGradle[i] === '}') {
              braceCount--;
              if (inAndroid && braceCount === 0) {
                insertIndex = i;
                break;
              }
            }
          }
          
          if (insertIndex !== -1) {
            const sourceSetsConfig = `    
    sourceSets {
        main {
            java {
                // Include Kotlin source files from native/android folder
                srcDirs += ['../../native/android/src/main/java']
            }
        }
    }
`;
            buildGradle = buildGradle.substring(0, insertIndex) + sourceSetsConfig + buildGradle.substring(insertIndex);
          }
        }
      }

      config.modResults.contents = buildGradle;
    }
    return config;
  });

  // Step 2: Modify MainApplication.kt to register native packages
  config = withMainApplication(config, (config) => {
    let mainApplication = config.modResults.contents;

    // Add loadReactNative import if not present
    if (!mainApplication.includes('import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative')) {
      const importRegex = /(import\s+[^\n]+\n)/g;
      const imports = mainApplication.match(importRegex) || [];
      const lastImportIndex = mainApplication.lastIndexOf(imports[imports.length - 1] || '');

      if (lastImportIndex !== -1) {
        const beforeImports = mainApplication.substring(0, lastImportIndex + imports[imports.length - 1].length);
        const afterImports = mainApplication.substring(lastImportIndex + imports[imports.length - 1].length);
        mainApplication = beforeImports + 'import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative\n' + afterImports;
      } else {
        const packageMatch = mainApplication.match(/package\s+[^\n]+\n/);
        if (packageMatch) {
          const packageIndex = mainApplication.indexOf(packageMatch[0]) + packageMatch[0].length;
          mainApplication = mainApplication.substring(0, packageIndex) +
            '\nimport com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative\n' +
            mainApplication.substring(packageIndex);
        }
      }
    }

    // Add EPG import if not present
    if (!mainApplication.includes('import com.chuchplayer.epg.EpgIngestionPackage')) {
      // Find the last import statement
      const importRegex = /(import\s+[^\n]+\n)/g;
      const imports = mainApplication.match(importRegex) || [];
      const lastImportIndex = mainApplication.lastIndexOf(imports[imports.length - 1] || '');
      
      if (lastImportIndex !== -1) {
        const beforeImports = mainApplication.substring(0, lastImportIndex + imports[imports.length - 1].length);
        const afterImports = mainApplication.substring(lastImportIndex + imports[imports.length - 1].length);
        mainApplication = beforeImports + 'import com.chuchplayer.epg.EpgIngestionPackage\n' + afterImports;
      } else {
        // If no imports found, add after package declaration
        const packageMatch = mainApplication.match(/package\s+[^\n]+\n/);
        if (packageMatch) {
          const packageIndex = mainApplication.indexOf(packageMatch[0]) + packageMatch[0].length;
          mainApplication = mainApplication.substring(0, packageIndex) + 
            '\nimport com.chuchplayer.epg.EpgIngestionPackage\n' + 
            mainApplication.substring(packageIndex);
        }
      }
    }

    // Add ExoPlayer import if not present
    if (!mainApplication.includes('import com.chuchplayer.player.ExoPlayerPackage')) {
      const importRegex = /(import\s+[^\n]+\n)/g;
      const imports = mainApplication.match(importRegex) || [];
      const lastImportIndex = mainApplication.lastIndexOf(imports[imports.length - 1] || '');

      if (lastImportIndex !== -1) {
        const beforeImports = mainApplication.substring(0, lastImportIndex + imports[imports.length - 1].length);
        const afterImports = mainApplication.substring(lastImportIndex + imports[imports.length - 1].length);
        mainApplication = beforeImports + 'import com.chuchplayer.player.ExoPlayerPackage\n' + afterImports;
      } else {
        const packageMatch = mainApplication.match(/package\s+[^\n]+\n/);
        if (packageMatch) {
          const packageIndex = mainApplication.indexOf(packageMatch[0]) + packageMatch[0].length;
          mainApplication = mainApplication.substring(0, packageIndex) +
            '\nimport com.chuchplayer.player.ExoPlayerPackage\n' +
            mainApplication.substring(packageIndex);
        }
      }
    }

    // Add EPG package registration if not present
    if (!mainApplication.includes('add(EpgIngestionPackage())')) {
      // Find the getPackages method
      const packagesMatch = mainApplication.match(/getPackages\(\):\s*List<ReactPackage>\s*=\s*PackageList\(this\)\.packages\.apply\s*\{/);
      
      if (packagesMatch) {
        let braceCount = 0;
        let inPackages = false;
        let insertIndex = -1;
        
        // Find the closing brace of the apply block
        for (let i = packagesMatch.index; i < mainApplication.length; i++) {
          if (mainApplication[i] === '{') {
            braceCount++;
            inPackages = true;
          } else if (mainApplication[i] === '}') {
            braceCount--;
            if (inPackages && braceCount === 0) {
              insertIndex = i;
              break;
            }
          }
        }
        
        if (insertIndex !== -1) {
          // Check if there's already a comment about adding packages
          const beforeBrace = mainApplication.substring(packagesMatch.index, insertIndex);
          if (beforeBrace.includes('// add(MyReactNativePackage())')) {
            mainApplication = mainApplication.substring(0, insertIndex) + 
              '\n              add(EpgIngestionPackage())' + 
              mainApplication.substring(insertIndex);
          } else {
            // Add before the closing brace with proper indentation
            mainApplication = mainApplication.substring(0, insertIndex) + 
              '\n              add(EpgIngestionPackage())\n            ' + 
              mainApplication.substring(insertIndex);
          }
        }
      }
    }

    // Add ExoPlayer package registration if not present
    if (!mainApplication.includes('add(ExoPlayerPackage())')) {
      const packagesMatch = mainApplication.match(/getPackages\(\):\s*List<ReactPackage>\s*=\s*PackageList\(this\)\.packages\.apply\s*\{/);

      if (packagesMatch) {
        let braceCount = 0;
        let inPackages = false;
        let insertIndex = -1;

        for (let i = packagesMatch.index; i < mainApplication.length; i++) {
          if (mainApplication[i] === '{') {
            braceCount++;
            inPackages = true;
          } else if (mainApplication[i] === '}') {
            braceCount--;
            if (inPackages && braceCount === 0) {
              insertIndex = i;
              break;
            }
          }
        }

        if (insertIndex !== -1) {
          mainApplication = mainApplication.substring(0, insertIndex) +
            '\n              add(ExoPlayerPackage())\n            ' +
            mainApplication.substring(insertIndex);
        }
      }
    }

    if (!mainApplication.includes('loadReactNative(this)')) {
      mainApplication = mainApplication.replace(
        '    ApplicationLifecycleDispatcher.onApplicationCreate(this)',
        '    loadReactNative(this)\n    ApplicationLifecycleDispatcher.onApplicationCreate(this)'
      );
    }

    config.modResults.contents = mainApplication;
    return config;
  });

  return config;
};

module.exports = withNativeEpgIngestion;
