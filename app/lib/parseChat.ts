export interface ReplyTo {
  sender: string;
  text: string;
}

export interface ChatMessage {
  id: number;
  timestamp: string; // time only, e.g. "15:49"
  date: string;      // ISO date string, e.g. "2026-05-22"
  sender: string;
  text: string;
  replyTo?: ReplyTo;
}

// Format A: [HH:MM, M/D/YYYY] Name: message   (newer web export)
const FORMAT_A = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?),\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\]\s+(.+?):\s*(.*)/;
// Format B: [M/D/YYYY, HH:MM] Name: message   (older web export)
const FORMAT_B = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s*(.*)/;
// Format C: [M/D, HH:MM] Name: message        (mobile, no year)
const FORMAT_C = /^\[(\d{1,2}\/\d{1,2}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s+(.+?):\s*(.*)/;

/** Normalise time string to HH:MM (24h), stripping seconds and AM/PM. */
function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  const ampm = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const meridiem = ampm[3].toUpperCase();
    if (meridiem === "AM" && h === 12) h = 0;
    if (meridiem === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  const h24 = trimmed.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/);
  if (h24) return h24[1];
  return trimmed;
}

/** Return ISO date string "YYYY-MM-DD" from M/D/YYYY or M/D/YY. */
function parseDateFull(raw: string): string {
  const parts = raw.trim().split("/");
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Return ISO date string "YYYY-MM-DD" from M/D (no year — uses current year). */
function parseDateShort(raw: string): string {
  const parts = raw.trim().split("/");
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseWhatsAppChat(raw: string): { messages: ChatMessage[]; participants: string[] } {
  const lines = raw.split("\n");
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  let id = 0;

  for (const line of lines) {
    const a = line.match(FORMAT_A);
    const b = !a ? line.match(FORMAT_B) : null;
    const c = !a && !b ? line.match(FORMAT_C) : null;

    if (a) {
      // [time, date] Name: msg
      if (current) messages.push(current);
      current = { id: ++id, timestamp: normalizeTime(a[1]), date: parseDateFull(a[2]), sender: a[3].trim(), text: a[4] };
    } else if (b) {
      // [date, time] Name: msg
      if (current) messages.push(current);
      current = { id: ++id, timestamp: normalizeTime(b[2]), date: parseDateFull(b[1]), sender: b[3].trim(), text: b[4] };
    } else if (c) {
      // [M/D, time] Name: msg  (no year)
      if (current) messages.push(current);
      current = { id: ++id, timestamp: normalizeTime(c[2]), date: parseDateShort(c[1]), sender: c[3].trim(), text: c[4] };
    } else if (current) {
      // Continuation line — same bubble as previous message
      current.text += "\n" + line;
    }
  }

  if (current) messages.push(current);

  // Trim trailing whitespace from each message
  for (const msg of messages) {
    msg.text = msg.text.trim();
  }

  // Detect reply quotes: if the first line of a message exactly matches a
  // previous message's text, treat it as a quoted reply.
  const textToMessage = new Map<string, ChatMessage>();
  for (const msg of messages) {
    textToMessage.set(msg.text, msg);
  }
  for (const msg of messages) {
    const newlineIndex = msg.text.indexOf("\n");
    const firstLine = newlineIndex !== -1 ? msg.text.slice(0, newlineIndex).trim() : null;
    if (firstLine) {
      const quoted = textToMessage.get(firstLine);
      if (quoted && quoted.id !== msg.id) {
        msg.replyTo = { sender: quoted.sender, text: quoted.text };
        msg.text = msg.text.slice(newlineIndex + 1).trim();
      }
    }
  }

  const participants = [...new Set(messages.map((m) => m.sender))];

  return { messages, participants };
}
