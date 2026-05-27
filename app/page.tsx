"use client";

import { useEffect, useRef, useState } from "react";
import { parseWhatsAppChat, ChatMessage } from "./lib/parseChat";
import { SHEET_URL, CHAT_NAME } from "./lib/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFormattedSegment(text: string, key: string): React.ReactNode {
  const FORMATTING_RE = /(\*(.+?)\*|_(.+?)_|~(.+?)~|`(.+?)`)/;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  while (remaining) {
    const match = remaining.match(FORMATTING_RE);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }
    if (match.index > 0) parts.push(remaining.slice(0, match.index));
    const k = `${key}-${idx++}`;
    if (match[2] !== undefined) {
      parts.push(<strong key={k} className="font-bold">{renderFormattedSegment(match[2], k)}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={k} className="italic">{renderFormattedSegment(match[3], k)}</em>);
    } else if (match[4] !== undefined) {
      parts.push(<del key={k} className="line-through">{renderFormattedSegment(match[4], k)}</del>);
    } else if (match[5] !== undefined) {
      parts.push(<code key={k} className="bg-[#1a2b33] px-1 rounded text-[#e9e9e9] text-[13px] font-mono">{match[5]}</code>);
    }
    remaining = remaining.slice(match.index + match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderTextWithLinks(text: string, participants: string[]) {
  const escapedNames = participants
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const splitPattern = escapedNames.length
    ? new RegExp(`(https?:\\/\\/[^\\s]+|@(?:${escapedNames.join("|")}))`, "g")
    : /(https?:\/\/[^\s]+)/g;

  const parts = text.split(splitPattern).filter(Boolean);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="underline text-[#53bdeb] break-all">
          {part}
        </a>
      );
    }
    if (/^@/.test(part)) {
      return <span key={i} className="text-[#53bdeb]">{part}</span>;
    }
    return <span key={i}>{renderFormattedSegment(part, `seg-${i}`)}</span>;
  });
}

function formatDateLabel(isoDate: string): string {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  if (isoDate === todayStr) return "Today";
  if (isoDate === yesterdayStr) return "Yesterday";
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// ChatViewer with windowed rendering for large chats
// ---------------------------------------------------------------------------

const PAGE_SIZE = 200;

function ChatViewer({
  messages,
  participants,
  perspective,
}: {
  messages: ChatMessage[];
  participants: string[];
  perspective: string;
}) {
  const [visibleEnd, setVisibleEnd] = useState(PAGE_SIZE);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    setVisibleEnd(Math.min(messages.length, PAGE_SIZE));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    // Load more when scrolled near top
    if (el.scrollTop < 200 && visibleEnd < messages.length) {
      const prevScrollHeight = el.scrollHeight;
      setVisibleEnd((v) => Math.min(v + PAGE_SIZE, messages.length));
      // Restore scroll position after render
      requestAnimationFrame(() => {
        el.scrollTop += el.scrollHeight - prevScrollHeight;
      });
    }
  };

  const visible = messages.slice(Math.max(0, messages.length - visibleEnd));

  const items: React.ReactNode[] = [];
  let lastDate = "";

  if (messages.length > visibleEnd) {
    items.push(
      <div key="load-more" className="flex justify-center my-2">
        <span className="text-[#8696a0] text-xs">Scroll up to load older messages</span>
      </div>
    );
  }

  for (const msg of visible) {
    if (msg.date !== lastDate) {
      lastDate = msg.date;
      items.push(
        <div key={`sep-${msg.date}-${msg.id}`} className="flex justify-center my-2">
          <span className="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">
            {formatDateLabel(msg.date)}
          </span>
        </div>
      );
    }
    const isMe = msg.sender === perspective;
    items.push(
      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
        <div className={`relative max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-md ${
          isMe ? "bg-[#005c4b] text-white rounded-br-sm" : "bg-[#1f2c34] text-white rounded-bl-sm"
        }`}>
          {!isMe && (
            <p className="text-[#00a884] font-semibold text-xs mb-1">{msg.sender}</p>
          )}
          {msg.replyTo && (
            <div className={`mb-2 px-2 py-1.5 rounded-lg border-l-4 text-xs ${
              isMe ? "bg-[#004036] border-[#00a884]" : "bg-[#16232b] border-[#00a884]"
            }`}>
              <p className="text-[#00a884] font-semibold mb-0.5">{msg.replyTo.sender}</p>
              <p className="text-[#8696a0] line-clamp-2 whitespace-pre-wrap">{msg.replyTo.text}</p>
            </div>
          )}
          <p className="whitespace-pre-wrap leading-relaxed">
            {renderTextWithLinks(msg.text, participants)}
          </p>
          <p className="text-[#8696a0] text-[10px] text-right mt-1 -mb-0.5">{msg.timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 bg-[#0b141a] flex flex-col gap-1 p-4 overflow-y-auto"
    >
      {items}
      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type LoadState = "idle" | "loading" | "error" | "done";

export default function Home() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [perspective, setPerspective] = useState("");

  useEffect(() => {
    if (SHEET_URL.includes("YOUR_SPREADSHEET_ID")) {
      setErrorMsg("No sheet URL configured. Set NEXT_PUBLIC_SHEET_URL or update app/lib/config.ts.");
      setLoadState("error");
      return;
    }

    setLoadState("loading");

    // Use a CORS proxy approach: Google Sheets published CSV supports direct fetch
    fetch(SHEET_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((csv) => {
        // Each row in column A is one raw WhatsApp line; CSV may wrap values in quotes
        const lines = csv
          .split("\n")
          .map((row) => {
            // Strip leading/trailing quote added by CSV serialisation for single-column sheets
            const trimmed = row.trim();
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
              return trimmed.slice(1, -1).replace(/""/g, '"');
            }
            return trimmed;
          })
          .filter(Boolean);

        const rawText = lines.join("\n");
        const { messages: msgs, participants: parts } = parseWhatsAppChat(rawText);

        if (msgs.length === 0) {
          throw new Error("No messages parsed. Check that the sheet has raw WhatsApp lines in column A.");
        }

        setMessages(msgs);
        setParticipants(parts);
        setPerspective(parts[0] ?? "");
        setLoadState("done");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        setLoadState("error");
      });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#111b21] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white font-semibold text-sm uppercase shrink-0">
            {CHAT_NAME.charAt(0)}
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{CHAT_NAME}</p>
            {loadState === "done" && (
              <p className="text-[#8696a0] text-xs">
                {messages.length.toLocaleString()} messages
              </p>
            )}
          </div>
        </div>

        {loadState === "done" && participants.length > 0 && (
          <div className="flex flex-col items-end gap-0.5">
            <label className="text-[#8696a0] text-[10px]">Your perspective</label>
            <select
              className="bg-[#2a3942] text-white text-xs rounded-lg px-2 py-1 border border-[#3b4a54] outline-none"
              value={perspective}
              onChange={(e) => setPerspective(e.target.value)}
            >
              {participants.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Body */}
      {loadState === "idle" && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#8696a0] text-sm">Initialising…</p>
        </div>
      )}

      {loadState === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <svg className="w-8 h-8 animate-spin text-[#00a884]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-[#8696a0] text-sm">Loading messages…</p>
        </div>
      )}

      {loadState === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-red-400 text-sm font-medium">Failed to load chat</p>
          <p className="text-[#8696a0] text-xs max-w-sm">{errorMsg}</p>
        </div>
      )}

      {loadState === "done" && (
        <ChatViewer
          messages={messages}
          participants={participants}
          perspective={perspective}
        />
      )}
    </div>
  );
}
