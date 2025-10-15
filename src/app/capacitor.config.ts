import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.kubelens',
  appName: 'Kubelens',
  webDir: 'dist',
  server: {
    // Allow cleartext HTTP in development
    // In production, always use HTTPS
    androidScheme: 'https',
    iosScheme: 'https',
    // Hostname for the app
    hostname: 'kubelens.app',
    // Allow navigation to external URLs
    allowNavigation: ['*'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#465fff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
}

export default config

