# Implementation Plan

## Architecture
Add a typed, dependency-free locale context and translation catalog. Keep canonical itinerary data unchanged and derive localized locations by ID at render time.

## Tasks
1. Add a failing executable i18n coverage check.
2. Add the locale provider, UI catalog, complete English itinerary catalog, and localization helpers.
3. Wire localized text and a language control into the app, welcome page, map, and driver card.
4. Run i18n coverage, TypeScript, production build, and browser smoke checks.

## Expected Files
- `src/i18n.tsx`
- `src/data/itinerary.json`
- `src/main.tsx`
- `src/App.tsx`
- `src/components/WelcomePage.tsx`
- `src/components/MapComponent.tsx`
- `src/components/MV1InfoCard.tsx`
- `scripts/check-i18n.ts`
- `package.json`

## Risks
- Special F1 styling must not depend on translated display names.
- Map marker content is imperative and must refresh when locale changes.

## Acceptance Mapping
The executable coverage check validates all itinerary fields and English preservation; lint/build validate integration; browser checks validate switching and persistence.
