import assert from 'node:assert/strict';
import itinerary from '../src/data/itinerary.json';
import {
  getInitialLocale,
  localizeItinerary,
  translate,
  type Locale,
} from '../src/i18n';
import type { DayPlan } from '../src/constants';

const containsHan = (value: string | undefined) => Boolean(value && /\p{Script=Han}/u.test(value));

assert.equal(getInitialLocale('zh-CN', null), 'zh');
assert.equal(getInitialLocale('en-US', null), 'en');
assert.equal(getInitialLocale('zh-CN', 'en'), 'en');
assert.equal(getInitialLocale('en-US', 'unsupported'), 'en');

assert.equal(translate('en', 'app.title'), 'Shanghai Weekend Itinerary');
assert.equal(translate('zh', 'app.title'), '上海周末行程');

const sourceItinerary = itinerary as unknown as DayPlan[];
for (const location of sourceItinerary.flatMap((day) => day.locations)) {
  assert.ok(location.nameEn, `Missing nameEn: ${location.id}`);
  assert.ok(location.addressEn, `Missing addressEn: ${location.id}`);
  if (location.description) assert.ok(location.descriptionEn, `Missing descriptionEn: ${location.id}`);
}
const english = localizeItinerary(sourceItinerary, 'en');
const chinese = localizeItinerary(sourceItinerary, 'zh');

for (const day of english) {
  for (const location of day.locations) {
    assert.equal(containsHan(location.name), false, `English name still contains Chinese: ${location.id}`);
    assert.equal(containsHan(location.address), false, `English address still contains Chinese: ${location.id}`);
    assert.equal(containsHan(location.description), false, `English description still contains Chinese: ${location.id}`);
  }
}

assert.equal(chinese[0].locations[1].name, itinerary[0].locations[1].name);
assert.match(english[1].locations[1].description ?? '', /Imagine Dragons LOOM World Tour/);

const locales: Locale[] = ['zh', 'en'];
assert.deepEqual(locales.map((locale) => translate(locale, 'language.switchLabel')), ['English', '中文']);

console.log(`i18n checks passed for ${english.flatMap((day) => day.locations).length} locations`);
