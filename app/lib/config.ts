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
  { label: "2021", url: `${BASE}&gid=832201667` },
  { label: "2022", url: `${BASE}&gid=2116208670` },
  { label: "2023", url: `${BASE}&gid=1566113035` },
  { label: "2024", url: `${BASE}&gid=110535389` },
  { label: "2025", url: `${BASE}&gid=115047342` },
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

/** Google Drive folder ID for media files */
export const MEDIA_FOLDER_ID = "1xRqf4NWE8cRr2FV95l9nguhsCbnvckZO";
