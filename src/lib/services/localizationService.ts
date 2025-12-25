import { createMMKV } from 'react-native-mmkv';
import { getLocales } from 'react-native-localize';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import languageFactories, {
  AppLanguage,
  Localizations,
  LocalizationKey,
  LanguageNameInEnglish,
} from '../../resources/localization';

const FALLBACK_LANGUAGE = AppLanguage.en;

const localizationStorage = createMMKV({
  id: 'localization-storage',
  encryptionKey: 'localization-encryption-key',
});

const STORAGE_KEYS = {
  CURRENT_LANGUAGE: 'current_language',
  LANGUAGE_OVERRIDE: 'language_override',
  LANGUAGE_CACHE_PREFIX: 'lang_cache_',
} as const;

const translationCache = new Map<AppLanguage, Localizations>();

class LanguageChangeEmitter {
  private listeners: Array<(language: AppLanguage) => void> = [];

  subscribe(listener: (language: AppLanguage) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  emit(language: AppLanguage): void {
    this.listeners.forEach(listener => listener(language));
  }
}

const languageChangeEmitter = new LanguageChangeEmitter();

export class LocalizationService {
  private static instance: LocalizationService;
  private currentLanguage: AppLanguage = FALLBACK_LANGUAGE;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): LocalizationService {
    if (!LocalizationService.instance) {
      LocalizationService.instance = new LocalizationService();
    }
    return LocalizationService.instance;
  }

  async initialize(
    translations: Partial<Record<AppLanguage, Localizations>> = {},
    allowLanguageOverride: boolean = true,
  ): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const initialLanguage = this.getInitialLanguage(allowLanguageOverride);

      await this.loadTranslations(translations);

      await i18n.use(initReactI18next).init({
        lng: initialLanguage,
        fallbackLng: FALLBACK_LANGUAGE,
        resources: this.buildI18nResources(),
        interpolation: {
          escapeValue: false,
        },
        react: {
          useSuspense: false,
        },
      });

      this.currentLanguage = initialLanguage;
      this.isInitialized = true;

      console.log(
        `Localization initialized with language: ${this.currentLanguage}`,
      );
    } catch (error) {
      console.error('Failed to initialize localization:', error);
      throw error;
    }
  }

  getCurrentLanguage(): AppLanguage {
    return this.currentLanguage;
  }

  getAvailableLanguages(): Array<{ code: AppLanguage; name: string }> {
    return Object.values(AppLanguage).map(code => ({
      code,
      name: LanguageNameInEnglish[code],
    }));
  }

  async changeLanguage(language: AppLanguage): Promise<void> {
    if (!Object.values(AppLanguage).includes(language)) {
      throw new Error(`Unsupported language: ${language}`);
    }

    try {
      await i18n.changeLanguage(language);
      this.currentLanguage = language;
      this.saveLanguage(language);
      languageChangeEmitter.emit(language);

      console.log(`Language changed to: ${language}`);
    } catch (error) {
      console.error('Failed to change language:', error);
      throw error;
    }
  }

  t(
    key?: LocalizationKey | string,
    options?: any,
  ): string {
    if (!key) return i18n.t as any;
    return i18n.t(key, options) as string;
  }

  onLanguageChange(listener: (language: AppLanguage) => void): () => void {
    return languageChangeEmitter.subscribe(listener);
  }

  clearCache(): void {
    try {
      translationCache.clear();
      localizationStorage.clearAll();
      console.log('Localization cache cleared');
    } catch (error) {
      console.error('Failed to clear localization cache:', error);
    }
  }

  getCacheStats(): { cachedLanguages: number; storageSize: number } {
    return {
      cachedLanguages: translationCache.size,
      storageSize: localizationStorage.getAllKeys().length,
    };
  }

  private getInitialLanguage(allowLanguageOverride: boolean): AppLanguage {
    if (allowLanguageOverride) {
      const override = this.getLanguageOverride();
      if (override) {
        return override;
      }
    }

    const savedLanguage = this.getSavedLanguage();
    if (savedLanguage) {
      return savedLanguage;
    }

    const deviceLanguage = this.getDeviceLanguage();
    return deviceLanguage;
  }

  private getDeviceLanguage(): AppLanguage {
    try {
      const locales = getLocales();
      const deviceLang = locales[0]?.languageCode;

      if (
        deviceLang &&
        Object.values(AppLanguage).includes(deviceLang as AppLanguage)
      ) {
        return deviceLang as AppLanguage;
      }
    } catch (error) {
      console.warn('Failed to get device language:', error);
    }

    return FALLBACK_LANGUAGE;
  }

  private getSavedLanguage(): AppLanguage | null {
    try {
      const saved = localizationStorage.getString(
        STORAGE_KEYS.CURRENT_LANGUAGE,
      );
      if (saved && Object.values(AppLanguage).includes(saved as AppLanguage)) {
        return saved as AppLanguage;
      }
    } catch (error) {
      console.warn('Failed to get saved language:', error);
    }
    return null;
  }

  private getLanguageOverride(): AppLanguage | null {
    try {
      const override = localizationStorage.getString(
        STORAGE_KEYS.LANGUAGE_OVERRIDE,
      );
      if (
        override &&
        Object.values(AppLanguage).includes(override as AppLanguage)
      ) {
        return override as AppLanguage;
      }
    } catch (error) {
      console.warn('Failed to get language override:', error);
    }
    return null;
  }

  private saveLanguage(language: AppLanguage): void {
    try {
      localizationStorage.set(STORAGE_KEYS.CURRENT_LANGUAGE, language);
    } catch (error) {
      console.error('Failed to save language:', error);
    }
  }

  private async loadTranslations(
    translations: Partial<Record<AppLanguage, Localizations>>,
  ): Promise<void> {
    for (const language of Object.values(AppLanguage)) {
      if (!translationCache.has(language)) {
        try {
          const baseTranslations = languageFactories[language]();
          const mergedTranslations = translations[language]
            ? { ...baseTranslations, ...translations[language] }
            : baseTranslations;

          translationCache.set(language, mergedTranslations);
          this.cacheTranslations(language, mergedTranslations);
        } catch (error) {
          console.error(`Failed to load translations for ${language}:`, error);
        }
      }
    }
  }

  private cacheTranslations(
    language: AppLanguage,
    translations: Localizations,
  ): void {
    try {
      const cacheKey = `${STORAGE_KEYS.LANGUAGE_CACHE_PREFIX}${language}`;
      localizationStorage.set(cacheKey, JSON.stringify(translations));
    } catch (error) {
      console.warn(`Failed to cache translations for ${language}:`, error);
    }
  }

  private loadCachedTranslations(language: AppLanguage): Localizations | null {
    try {
      const cacheKey = `${STORAGE_KEYS.LANGUAGE_CACHE_PREFIX}${language}`;
      const cached = localizationStorage.getString(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn(
        `Failed to load cached translations for ${language}:`,
        error,
      );
      return null;
    }
  }

  private buildI18nResources(): Record<string, { translation: Localizations }> {
    const resources: Record<string, { translation: Localizations }> = {};

    for (const language of Object.values(AppLanguage)) {
      const translations = translationCache.get(language);
      if (translations) {
        resources[language] = { translation: translations };
      }
    }

    return resources;
  }
}

export const localizationService = LocalizationService.getInstance();

export const i18next = i18n;
export const t = localizationService.t.bind(localizationService);
export const changeLanguage =
  localizationService.changeLanguage.bind(localizationService);
export const getCurrentLanguage =
  localizationService.getCurrentLanguage.bind(localizationService);

export async function initializeI18n(
  translations?: Partial<Record<AppLanguage, Localizations>>,
  allowLanguageOverride: boolean = true,
): Promise<void> {
  await localizationService.initialize(
    translations || {},
    allowLanguageOverride,
  );
}
