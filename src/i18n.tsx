import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { DayPlan, Location } from './constants';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'happy-travel-locale';

const messages = {
  zh: {
    'app.title': '上海周末行程',
    'app.documentTitle': '上海 F1 周末行程',
    'app.openLink': '打开链接',
    'language.label': '语言',
    'language.switchLabel': 'English',
    'welcome.heading': '欢迎开启上海狂欢周末',
    'welcome.line1': '引擎轰鸣碰撞摇滚风暴',
    'welcome.line2': '一场魔都竞速与梦龙狂欢的探索之旅',
    'map.legend': '图例',
    'map.poi': '地点',
    'type.sports': '体育/场馆',
    'type.hotel': '酒店',
    'type.museum': '美术馆',
    'type.theatre': '剧院',
    'type.park': '公园',
    'type.cafe': '咖啡',
    'type.restaurant': '餐厅',
    'type.spa': 'SPA',
    'type.citywalk': 'Citywalk',
    'driver.country': '荷兰',
    'driver.championships': '冠军',
    'driver.wins': '胜场',
    'driver.poles': '杆位',
    'driver.highlights': '职业生涯亮点',
    'driver.achievement.2021': '首个世界冠军',
    'driver.achievement.2022': '卫冕成功',
    'driver.achievement.2023': '统治赛季 (19胜)',
    'driver.achievement.2024': '四冠王',
    'showroom.ignition.hold': '按住空格/回车或点击启动引擎',
    'showroom.ignition.starting': '引擎启动中',
    'showroom.ignition.ready': '狂欢开启',
    'showroom.skip': '跳过动画',
    'showroom.chapter': '章节',
    'countdown.back': '返回行程',
    'countdown.eventTitle': 'NEXT SHANGHAI GRAND PRIX',
    'countdown.shanghaiTime': '上海时间',
    'countdown.official': '官方正赛时间',
    'countdown.estimated': '暂定日期 · 等待官方赛程确认',
    'countdown.loading': '正在确认下一场上海大奖赛',
    'countdown.remaining': '距离上海大奖赛还有',
    'countdown.lightsOut': '比赛开始',
    'countdown.units.days': '天',
    'countdown.units.hours': '小时',
    'countdown.units.minutes': '分钟',
    'countdown.units.seconds': '秒',
  },
  en: {
    'app.title': 'Shanghai Weekend Itinerary',
    'app.documentTitle': 'Shanghai F1 Weekend Itinerary',
    'app.openLink': 'Open link',
    'language.label': 'Language',
    'language.switchLabel': '中文',
    'welcome.heading': 'Welcome to an Epic Shanghai Weekend',
    'welcome.line1': 'Where roaring engines meet a rock storm',
    'welcome.line2': 'A Shanghai adventure of racing and Imagine Dragons',
    'map.legend': 'Legend',
    'map.poi': 'POI',
    'type.sports': 'Sports / Venue',
    'type.hotel': 'Hotel',
    'type.museum': 'Museum',
    'type.theatre': 'Theatre',
    'type.park': 'Park',
    'type.cafe': 'Cafe',
    'type.restaurant': 'Restaurant',
    'type.spa': 'SPA',
    'type.citywalk': 'Citywalk',
    'driver.country': 'Netherlands',
    'driver.championships': 'Titles',
    'driver.wins': 'Wins',
    'driver.poles': 'Poles',
    'driver.highlights': 'Career Highlights',
    'driver.achievement.2021': 'First World Championship',
    'driver.achievement.2022': 'Back-to-back Champion',
    'driver.achievement.2023': 'Dominant Season (19 Wins)',
    'driver.achievement.2024': 'Four-time Champion',
    'showroom.ignition.hold': 'Hold Space/Enter or Click to Start Engine',
    'showroom.ignition.starting': 'Engine Starting',
    'showroom.ignition.ready': 'Enter Showroom',
    'showroom.skip': 'Skip Intro',
    'showroom.chapter': 'Chapter',
    'countdown.back': 'Back to itinerary',
    'countdown.eventTitle': 'NEXT SHANGHAI GRAND PRIX',
    'countdown.shanghaiTime': 'Shanghai time',
    'countdown.official': 'Official race time',
    'countdown.estimated': 'Provisional date · Awaiting official confirmation',
    'countdown.loading': 'Confirming the next Shanghai Grand Prix',
    'countdown.remaining': 'Time until the Shanghai Grand Prix',
    'countdown.lightsOut': 'Race started',
    'countdown.units.days': 'Days',
    'countdown.units.hours': 'Hours',
    'countdown.units.minutes': 'Minutes',
    'countdown.units.seconds': 'Seconds',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}

export function getInitialLocale(browserLanguage: string | undefined, storedLocale: string | null): Locale {
  if (storedLocale === 'zh' || storedLocale === 'en') return storedLocale;
  return browserLanguage?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function localizeItinerary<T extends readonly { date: string; locations: readonly Location[] }[]>(
  itinerary: T,
  locale: Locale,
): DayPlan[] {
  return itinerary.map((day) => ({
    date: day.date,
    locations: day.locations.map((location) => locale === 'zh'
      ? { ...location }
      : {
          ...location,
          name: location.nameEn,
          address: location.addressEn,
          description: location.descriptionEn,
        }),
  }));
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale(
    typeof navigator === 'undefined' ? undefined : navigator.language,
    typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY),
  ));

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    localStorage.setItem(STORAGE_KEY, nextLocale);
  };

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = translate(locale, 'app.documentTitle');
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    toggleLocale: () => setLocale(locale === 'zh' ? 'en' : 'zh'),
    t: (key) => translate(locale, key),
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
