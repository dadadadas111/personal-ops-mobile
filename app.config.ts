import type { ExpoConfig } from 'expo/config';
import pkg from './package.json';

const versionCode = Number.parseInt(process.env.ANDROID_VERSION_CODE ?? '1', 10);

const config: ExpoConfig = {
  name: 'Personal Ops',
  slug: 'personal-ops-mobile',
  version: pkg.version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'io.github.dadadadas111.personalops',
  },
  android: {
    package: 'io.github.dadadadas111.personalops',
    versionCode: Number.isNaN(versionCode) ? 1 : versionCode,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['POST_NOTIFICATIONS'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
    'expo-notifications',
  ],
  extra: {
    appName: 'Personal Ops',
  },
};

export default config;
