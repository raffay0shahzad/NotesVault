import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeI18n } from './src/lib/services/localizationService';
import languageFactories, { AppLanguage } from './src/resources/localization';
import { i18next } from './src/lib/services/localizationService';
import './src/styles/global.css';
import { env } from './src/config/config';

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      const translations = {
        [AppLanguage.en]: languageFactories[AppLanguage.en](),
        [AppLanguage.fr]: languageFactories[AppLanguage.fr](),
      };

      await initializeI18n(translations, true);
      setIsReady(true);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setIsReady(true); // Still show the app even if i18n fails
    }
  };

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <View
          style={styles.container}
          className="flex-1 justify-center items-center"
        >
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View
        style={styles.container}
        className="flex-1 justify-center items-center bg-white"
      >
        <Text className="text-2xl font-bold text-red-500">
          {i18next.t('app.name')}
          {env.BASE_URL}
        </Text>
      </View>
    </SafeAreaProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
