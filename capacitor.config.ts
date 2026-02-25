import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.editorialai.app',
  appName: 'Editorial AI',
  webDir: 'dist',
  server: {
    // Set this to your production server URL when deploying.
    // Leave commented out to bundle the dist folder locally in the APK.
    // url: 'https://your-production-server.run.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
