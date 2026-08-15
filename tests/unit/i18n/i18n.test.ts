import { describe, expect, it } from 'vitest';
import itinerary from '../../../src/data/itinerary.json';
import {
  getInitialLocale,
  localizeItinerary,
  translate,
  type Locale,
} from '../../../src/i18n';
import type { DayPlan } from '../../../src/constants';

const containsHan = (value: string | undefined) => Boolean(value && /\p{Script=Han}/u.test(value));

describe('i18n Internationalization Contract', () => {
  describe('Locale Selection & Fallbacks', () => {
    it('resolves initial locale according to browser preferences and stored choice', () => {
      expect(getInitialLocale('zh-CN', null)).toBe('zh');
      expect(getInitialLocale('en-US', null)).toBe('en');
      expect(getInitialLocale('zh-CN', 'en')).toBe('en');
      expect(getInitialLocale('en-US', 'unsupported')).toBe('en');
    });
  });

  describe('Translation Keys', () => {
    it('translates core application titles and labels', () => {
      expect(translate('en', 'app.title')).toBe('Shanghai Weekend Itinerary');
      expect(translate('zh', 'app.title')).toBe('上海周末行程');

      const locales: Locale[] = ['zh', 'en'];
      expect(locales.map((locale) => translate(locale, 'language.switchLabel'))).toEqual(['English', '中文']);
    });

    it('translates the race countdown status and unit labels in both locales', () => {
      expect(translate('zh', 'countdown.back')).toBe('返回行程');
      expect(translate('zh', 'countdown.official')).toBe('官方正赛时间');
      expect(translate('zh', 'countdown.estimated')).toBe('暂定日期 · 等待官方赛程确认');
      expect(translate('zh', 'countdown.units.days')).toBe('天');

      expect(translate('en', 'countdown.back')).toBe('Back to itinerary');
      expect(translate('en', 'countdown.official')).toBe('Official race time');
      expect(translate('en', 'countdown.estimated')).toBe('Provisional date · Awaiting official confirmation');
      expect(translate('en', 'countdown.units.days')).toBe('Days');
    });
  });

  describe('Itinerary Data Localization', () => {
    const sourceItinerary = itinerary as unknown as DayPlan[];

    it('ensures all itinerary locations have required English metadata', () => {
      for (const location of sourceItinerary.flatMap((day) => day.locations)) {
        expect(location.nameEn).toBeTruthy();
        expect(location.addressEn).toBeTruthy();
        if (location.description) {
          expect(location.descriptionEn).toBeTruthy();
        }
      }
    });

    it('ensures localized English itinerary contains no Han script characters', () => {
      const english = localizeItinerary(sourceItinerary, 'en');

      for (const day of english) {
        for (const location of day.locations) {
          expect(containsHan(location.name)).toBe(false);
          expect(containsHan(location.address)).toBe(false);
          expect(containsHan(location.description)).toBe(false);
        }
      }
    });

    it('retains original Chinese names in Chinese localized itinerary', () => {
      const chinese = localizeItinerary(sourceItinerary, 'zh');
      expect(chinese[0].locations[1].name).toBe(itinerary[0].locations[1].name);
    });
  });
});
