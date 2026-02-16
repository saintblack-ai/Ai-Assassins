import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saintblack.aiassassins',
  appName: 'AI Assassins',
  webDir: '../docs',
  bundledWebRuntime: false,
  server: {
    cleartext: false
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#070b10',
      showSpinner: false
    }
  }
};

export default config;
