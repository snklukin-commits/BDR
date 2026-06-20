# Changelog

## 3.3.0

- Reworked Operations into a single functional workspace with filters, manual entry and inline editing.
- Added transaction splitting into two category parts while excluding the original operation from totals.
- Rebuilt Credits into a portfolio view with summary KPIs, manual credit creation and linked payment operations.
- Added backend API settings, bank sync endpoint hook and remote AI categorization endpoint hook.
- Removed the extra first-run import CTA so import/connect actions live in Management.

## 3.2.0

- Added a product-style onboarding screen for first launch without imported data.
- Added a financial health score, expense load progress and top spending insight on the dashboard.
- Added a monthly control card with month balance, operation count and attention hints.
- Added editable monthly reserve target in Management that affects the required cut amount.
- Refined branding, header status and responsive visual polish for a more complete app feel.

## 3.1.0

- Added editable categorization rules inside the Management tab.
- Added rule fields: name, match type, pattern, category, direction, include in totals and priority.
- Added local AI-like rule suggestions based on repeated unknown operations.
- Added recategorization action for all non-manually edited operations.
- Improved visual design toward a modern finance dashboard.
- Added safer note that real external AI requires a server layer and must not store API keys in the browser.

## 3.0.0

- Rebuilt the project as a personal BDR manager, not a simple summation page.
- Left only required tabs: Dashboard, Current month, Operations, Credits, Management.
- Added XLSX import through SheetJS.
- Added simultaneous import of multiple bank files.
- Added file type detection by sheet headers and filename hints.
- Added import preview with totals, duplicates, excluded operations, internal transfers, credits and mortgage info.
- Added deduplication by date, amount, bank, description, account and operation type.
- Added core BDR classification rules: salary, stipend, cashback, ЖКХ, ипотека info, mortgage payments, cash top-ups, internal transfers, refunds, Galina salary correction, technical 1 RUB operations.
- Added current month view.
- Added editable operations table with filters.
- Added credits tab with multiple credits, mortgage calculator and early payments.
- Added management tab with import, export, backup, limits, categories and settings.

## 2.1.0

- Added in-app data upload tab.
- Added drag-and-drop file loading.
- Added support for JSON, JS operations variable, CSV and TXT.
- Added manual paste import.
- Added local browser save, clear and JSON export.

## 2.0.0

- Initialized BDR Money App on GitHub.
- Added dashboard structure.
- Added config and budget rules.
- Added placeholders for operations data.
