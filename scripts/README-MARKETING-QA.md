# Marketing site QA script

`scripts/marketing-qa.mjs` visits each marketing URL, takes a screenshot, and reports PASS/FAIL/WARN.

## Prerequisites

1. **Dev server running:** `npm run dev` (app runs at http://localhost:3001).
2. **Playwright browsers:** `npx playwright install chromium` (or `npx playwright install` for all).

## Run

```bash
node scripts/marketing-qa.mjs
```

If you see `Executable doesn't exist` for Chromium, install to your user cache and point Playwright at it:

```bash
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" node scripts/marketing-qa.mjs
```

## Output

- **Screenshots:** `qa-screenshots/<name>.png` (e.g. `home.png`, `pricing.png`).
- **Report:** `qa-screenshots/report.json` (status + message per URL).
- **Console:** One line per page (PASS/FAIL/WARN + message).

## URLs covered

1. / (home)
2. /pricing
3. /features
4. /industries
5. /about
6. /contact
7. /privacy
8. /terms
