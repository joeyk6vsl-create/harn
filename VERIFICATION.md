# Verification — 2026-10-14

- JavaScript syntax checks passed for app.js and core.js.
- 21 automated tests passed. Coverage includes exact integer rounding, equal/item splits, multiple payers, removal guards, 500 generated conservation/settlement cases, quantity multiplication and bounds, 10-person saved groups, backup isolation and v1 migration.
- Static files use relative paths and need no build or runtime dependency. The publishing folder is docs/.
- Browser verification was attempted on several local preview ports; the in-app browser returned connection timeout/refused errors. Consequently this version has not completed visual responsive QA or end-to-end browser interaction testing. No new screenshot or WCAG conformity claim is provided.

Recommended browser acceptance checks after opening the preview or GitHub Pages: create a ten-person group, reload, create a bill using that group, remove an absent attendee, add an item priced 50,000 with quantity 3, verify 150,000 total, switch split modes, export/import backup and verify the group and bill. Check at 320, 390, 768, 1024 and 1440px, including long names and keyboard access.
