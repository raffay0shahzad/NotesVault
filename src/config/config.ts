import Config from 'react-native-config';
export const env = {
  BASE_URL: Config.BASE_URL,
};

// Log for debugging (remove in production)
if (__DEV__) {
  console.log('Environment Config:', {
    BASE_URL: env.BASE_URL,
    rawConfig: Config.BASE_URL,
  });
}
