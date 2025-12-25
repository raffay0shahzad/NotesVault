import en from './en.json';
import fr from './fr.json';

export enum AppLanguage {
  en = 'en',
  fr = 'fr',
}

export type En = typeof en;
export type Fr = typeof fr;

const languageSource: Record<AppLanguage, Partial<Localizations>> = {
  en,
  fr: fr as Partial<Localizations>,
};

export const LanguageNameInEnglish: Record<AppLanguage, string> = {
  [AppLanguage.en]: 'English',
  [AppLanguage.fr]: 'French',
};

export type Localizations = En;
export type LocalizationKey = keyof Localizations;

const languageFactories: Record<AppLanguage, () => Localizations> = {
  en: () => en,
  fr: () => ({ ...en, ...fr }) as Localizations,
} as const;

export function listMissingStringsForLanguage(source: AppLanguage) {
  const language = languageSource[source];
  const keysForLanguage = new Set(Object.keys(language));
  const output: Record<string, any> = {};
  for (const key of Object.keys(en)) {
    if (!keysForLanguage.has(key)) {
      output[key] = (en as any)[key];
    }
  }
  return output;
}

export default languageFactories;
