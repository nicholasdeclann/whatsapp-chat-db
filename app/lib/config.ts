/**
 * Google Sheet published CSV URL.
 * Set NEXT_PUBLIC_SHEET_URL at build time, or replace the fallback with your URL.
 *
 * How to get the URL:
 *   Google Sheets → File → Share → Publish to web
 *   → select the tab → CSV format → Copy link
 *
 * Format:
 *   https://docs.google.com/spreadsheets/d/{ID}/pub?gid={GID}&single=true&output=csv
 */
export const SHEET_URL =
  process.env.NEXT_PUBLIC_SHEET_URL ??
  "https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/pub?gid=0&single=true&output=csv";

/** Name shown in the header bar */
export const CHAT_NAME = process.env.NEXT_PUBLIC_CHAT_NAME ?? "WhatsApp Chat";

/**
 * Display name overrides — maps the raw sender name from the WhatsApp export
 * to a display name shown in the UI.
 */
export const NAME_OVERRIDES: Record<string, string> = {
  "Nicholas Declan": "Peyaa 💜",
  "Vica 💙": "Pikachu 💙",
};
