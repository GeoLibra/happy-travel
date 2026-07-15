# Implementation Log

## Red
- Added `scripts/check-i18n.ts` before production implementation.
- First valid run failed with `ERR_MODULE_NOT_FOUND` for the absent `src/i18n` module.

## Green
- Added a typed `zh`/`en` message catalog and complete English translations for 37 itinerary locations.
- Added `nameEn`, `addressEn`, and `descriptionEn` beside their Chinese fields in each `src/data/itinerary.json` location record, keeping both languages with the data they describe.
- Added browser-locale detection, persisted override, document title/language synchronization, and a locale context.
- Wired localized content into the welcome page, itinerary, map legend, accessibility labels, and MV1 driver card.
- Added a visible language switch in the application header.

## Refactor and Review
- Replaced translated-name F1 detection with stable location ID detection.
- Reviewed hooks, state derivation, stable list keys, semantic controls, accessibility labels, and TypeScript usage.

## Verification Evidence
- `npm run check:i18n`: 37 locations passed.
- `npm run lint`: TypeScript passed.
- `npm run build`: Vite production build passed.
- Browser snapshots verified English, Chinese switching, dynamic title, and persisted locale after reload.
- Development-only console notices: missing local AMap key and favicon.
