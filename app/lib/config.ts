/**
 * Google Sheets data source config.
 *
 * HOW TO ADD A NEW YEAR SHEET:
 *   1. Create a new sheet tab in the spreadsheet (e.g. "2021")
 *   2. Open it in the browser — the URL will end with #gid=XXXXXXXXX
 *   3. Copy that gid number
 *   4. Add a new entry to SHEETS below:
 *      { label: "2021", url: `${BASE}&gid=XXXXXXXXX` }
 *   5. Commit and push — GitHub Actions will redeploy automatically
 */

const BASE =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZvWm_5wh8yILpvbu0oN8oevvHLjLYO6z6V9LMK_yPSPIt5BV6E2Zik92AkxpCVyUsUueBIHRXsbtf/pub?output=csv";

export const SHEETS: { label: string; url: string }[] = [
  { label: "2019", url: `${BASE}&gid=0` },
  { label: "2020", url: `${BASE}&gid=1522915668` },
];

/** Name shown in the header bar */
export const CHAT_NAME = "Peyaa & Pikachu";

/**
 * Display name overrides — maps the raw sender name from the WhatsApp export
 * to a display name shown in the UI.
 */
export const NAME_OVERRIDES: Record<string, string> = {
  "Nicholas Declan": "Peyaa 💜",
  "Vica 💙": "Pikachu 💙",
};
