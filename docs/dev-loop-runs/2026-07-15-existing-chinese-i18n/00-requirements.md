# Requirements Baseline

## Goal
Add Chinese/English internationalization for the existing user-visible Chinese content.

## Non-goals
- Do not rewrite strings that are already English.
- Do not translate source comments or historical design documents.
- Do not change itinerary structure, coordinates, links, or visual design.

## User-visible Behavior
- The initial locale follows the saved choice, then the browser language.
- A visible language control switches between Chinese and English and persists the choice.
- UI labels and itinerary names, addresses, and descriptions change with the locale.

## Acceptance Criteria
- No Han characters remain in English itinerary display data.
- Existing English brand/event copy remains English.
- Locale selection updates the document language and persists.
- TypeScript and production build pass.

## Constraints
- Work only in the requested isolated worktree.
- Avoid adding an i18n runtime dependency for this small static application.

## Assumptions
- Supported locales are `zh` and `en`.
- Chinese remains the fallback for Chinese browsers; other browsers default to English.

## Open Questions
None blocking.

## Source Request
“国际化做一下，主要针对现存的中文，已经是英文的保持英文。通过worktree，因为现在正在执行另外的任务。”

## Repo Context
React/Vite single-page application with static itinerary JSON and no existing i18n layer.
