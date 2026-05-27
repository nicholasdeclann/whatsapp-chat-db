"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseWhatsAppChat, ChatMessage } from "./lib/parseChat";
import { SHEETS, CHAT_NAME, NAME_OVERRIDES } from "./lib/config";

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

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ---------------------------------------------------------------------------
// Calendar Modal
// ---------------------------------------------------------------------------

function CalendarModal({
  open,
  onClose,
  datesWithChats,
  onSelectDate,
}: {
  open: boolean;
  onClose: () => void;
  datesWithChats: Set<string>;
  onSelectDate: (date: string) => void;
}) {
  // Determine year range from available dates
  const years = useMemo(() => {
    const yrs = new Set<number>();
    datesWithChats.forEach((d) => yrs.add(parseInt(d.slice(0, 4), 10)));
    return [...yrs].sort();
  }, [datesWithChats]);

  const [viewYear, setViewYear] = useState(() => years[years.length - 1] ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  if (!open) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  // Days in this month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const cells: React.ReactNode[] = [];
  // Empty cells for offset
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<div key={`e-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    const hasChat = datesWithChats.has(dateStr);
    cells.push(
      <button
        key={day}
        disabled={!hasChat}
        onClick={() => { onSelectDate(dateStr); onClose(); }}
        className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
          hasChat
            ? "text-white bg-[#00a884] hover:bg-[#02b698] cursor-pointer"
            : "text-[#3b4a54] cursor-default"
        }`}
      >
        {day}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1f2c34] rounded-2xl shadow-xl w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
          {/* Year selector */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <button onClick={() => setViewYear(viewYear - 1)} className="text-[#8696a0] hover:text-white px-2 py-1 text-sm">
              &laquo;
            </button>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setViewYear(y)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                  y === viewYear ? "bg-[#00a884] text-white" : "text-[#8696a0] hover:text-white"
                }`}
              >
                {y}
              </button>
            ))}
            <button onClick={() => setViewYear(viewYear + 1)} className="text-[#8696a0] hover:text-white px-2 py-1 text-sm">
              &raquo;
            </button>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={goToPrevMonth} className="text-[#8696a0] hover:text-white p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-white text-sm font-semibold">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={goToNextMonth} className="text-[#8696a0] hover:text-white p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[#8696a0] text-[10px] font-medium">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {cells}
          </div>

          {/* Close */}
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="text-[#8696a0] hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ChatViewer with windowed rendering for large chats
// ---------------------------------------------------------------------------

const PAGE_SIZE = 200;

function ChatViewer({
  messages,
  participants,
  perspective,
  scrollToDate,
  scrollToMsgId,
  highlightMsgIds,
  onScrollHandled,
}: {
  messages: ChatMessage[];
  participants: string[];
  perspective: string;
  scrollToDate: string | null;
  scrollToMsgId: number | null;
  highlightMsgIds: Set<number>;
  onScrollHandled: () => void;
}) {
  const [visibleEnd, setVisibleEnd] = useState(PAGE_SIZE);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dateRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const msgRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    setVisibleEnd(Math.min(messages.length, PAGE_SIZE));
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Scroll to a specific date when requested
  useEffect(() => {
    if (!scrollToDate) return;

    // Find the first message index on or after this date
    const idx = messages.findIndex((m) => m.date >= scrollToDate);
    if (idx === -1) { onScrollHandled(); return; }

    // Ensure enough messages are loaded to include this date
    const needed = messages.length - idx;
    if (needed > visibleEnd) {
      setVisibleEnd(Math.min(messages.length, needed + PAGE_SIZE));
    }

    // After render, scroll to the date separator
    requestAnimationFrame(() => {
      const el = dateRefs.current.get(scrollToDate);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      onScrollHandled();
    });
  }, [scrollToDate, messages, visibleEnd, onScrollHandled]);

  // Scroll to a specific message by id
  useEffect(() => {
    if (!scrollToMsgId) return;

    const idx = messages.findIndex((m) => m.id === scrollToMsgId);
    if (idx === -1) { onScrollHandled(); return; }

    const needed = messages.length - idx;
    if (needed > visibleEnd) {
      setVisibleEnd(Math.min(messages.length, needed + PAGE_SIZE));
    }

    requestAnimationFrame(() => {
      const el = msgRefs.current.get(scrollToMsgId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      onScrollHandled();
    });
  }, [scrollToMsgId, messages, visibleEnd, onScrollHandled]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop < 200 && visibleEnd < messages.length) {
      const prevScrollHeight = el.scrollHeight;
      setVisibleEnd((v) => Math.min(v + PAGE_SIZE, messages.length));
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

  for (let i = 0; i < visible.length; i++) {
    const msg = visible[i];
    if (msg.date !== lastDate) {
      lastDate = msg.date;
      items.push(
        <div
          key={`sep-${msg.date}-${msg.id}`}
          ref={(el) => { if (el) dateRefs.current.set(msg.date, el); }}
          className="flex justify-center my-2"
        >
          <span className="bg-[#1f2c34] text-[#8696a0] text-xs px-3 py-1 rounded-full shadow">
            {formatDateLabel(msg.date)}
          </span>
        </div>
      );
    }
    const isMe = msg.sender === perspective;
    const prevMsg = i > 0 ? visible[i - 1] : undefined;
    const showSender = !isMe && (
      !prevMsg || prevMsg.sender !== msg.sender || prevMsg.date !== msg.date
    );
    const isHighlighted = highlightMsgIds.has(msg.id);
    items.push(
      <div
        key={msg.id}
        ref={(el) => { if (el) msgRefs.current.set(msg.id, el); }}
        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
      >
        <div className={`relative max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-md ${
          isHighlighted
            ? "bg-[#5e4b00] text-white rounded-br-sm rounded-bl-sm"
            : isMe ? "bg-[#005c4b] text-white rounded-br-sm" : "bg-[#1f2c34] text-white rounded-bl-sm"
        }`}>
          {showSender && (
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scrollToDate, setScrollToDate] = useState<string | null>(null);
  const [scrollToMsgId, setScrollToMsgId] = useState<number | null>(null);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<number[]>([]); // message ids
  const [searchIndex, setSearchIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derive set of dates that have chats
  const datesWithChats = useMemo(
    () => new Set(messages.map((m) => m.date)),
    [messages]
  );

  const handleScrollHandled = useCallback(() => {
    setScrollToDate(null);
    setScrollToMsgId(null);
  }, []);

  // Search handlers
  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchIndex(0);
  };
  const doSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); setSearchIndex(0); return; }
    const q = query.toLowerCase();
    const results = messages.filter((m) => m.text.toLowerCase().includes(q)).map((m) => m.id);
    setSearchResults(results);
    const lastIdx = results.length - 1;
    setSearchIndex(Math.max(0, lastIdx));
    if (results.length > 0) setScrollToMsgId(results[lastIdx]);
  };
  const searchPrev = () => {
    if (searchResults.length === 0) return;
    const newIdx = searchIndex > 0 ? searchIndex - 1 : searchResults.length - 1;
    setSearchIndex(newIdx);
    setScrollToMsgId(searchResults[newIdx]);
  };
  const searchNext = () => {
    if (searchResults.length === 0) return;
    const newIdx = searchIndex < searchResults.length - 1 ? searchIndex + 1 : 0;
    setSearchIndex(newIdx);
    setScrollToMsgId(searchResults[newIdx]);
  };

  useEffect(() => {
    setLoadState("loading");

    const parseCSV = (csv: string) =>
      csv
        .split("\n")
        .map((row) => {
          const trimmed = row.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1).replace(/""/g, '"');
          }
          return trimmed;
        })
        .filter(Boolean)
        .join("\n");

    Promise.all(
      SHEETS.map((sheet) =>
        fetch(sheet.url)
          .then((res) => {
            if (!res.ok) throw new Error(`Failed to load ${sheet.label}: HTTP ${res.status}`);
            return res.text();
          })
          .then(parseCSV)
      )
    )
      .then((csvTexts) => {
        const combined = csvTexts.join("\n");
        const { messages: msgs, participants: parts } = parseWhatsAppChat(combined);

        if (msgs.length === 0) {
          throw new Error("No messages parsed. Check that the sheets have raw WhatsApp lines in column A.");
        }

        msgs.sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.timestamp.localeCompare(b.timestamp);
        });
        msgs.forEach((m, i) => { m.id = i + 1; });

        const rename = (name: string) => NAME_OVERRIDES[name] ?? name;
        for (const msg of msgs) {
          msg.sender = rename(msg.sender);
          if (msg.replyTo) msg.replyTo.sender = rename(msg.replyTo.sender);
        }
        const renamedParts = parts.map(rename);

        setMessages(msgs);
        setParticipants(renamedParts);
        setPerspective(renamedParts[0] ?? "");
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
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] shrink-0 min-h-[56px]">
        {searchOpen ? (
          /* Search bar mode */
          <div className="flex items-center gap-2 w-full">
            <button onClick={closeSearch} className="text-[#8696a0] hover:text-white shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages…"
              value={searchQuery}
              onChange={(e) => doSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchNext(); if (e.key === "Escape") closeSearch(); }}
              className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg px-3 py-1.5 border border-[#3b4a54] outline-none placeholder-[#8696a0] focus:border-[#00a884] transition-colors"
            />
            {searchResults.length > 0 && (
              <span className="text-[#8696a0] text-xs shrink-0">
                {searchIndex + 1}/{searchResults.length}
              </span>
            )}
            <button onClick={searchPrev} disabled={searchResults.length === 0} className="text-[#8696a0] hover:text-white disabled:opacity-30 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button onClick={searchNext} disabled={searchResults.length === 0} className="text-[#8696a0] hover:text-white disabled:opacity-30 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        ) : (
          /* Normal header mode */
          <>
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

            <div className="flex items-center gap-3">
              {/* Search button */}
              {loadState === "done" && (
                <button
                  onClick={openSearch}
                  title="Search messages"
                  className="text-[#8696a0] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}

              {/* Calendar button */}
              {loadState === "done" && (
                <button
                  onClick={() => setCalendarOpen(true)}
                  title="Jump to date"
                  className="text-[#8696a0] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              )}

              {/* Perspective selector */}
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
            </div>
          </>
        )}
      </header>

      {/* Calendar Modal */}
      <CalendarModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        datesWithChats={datesWithChats}
        onSelectDate={setScrollToDate}
      />

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
          <p className="text-[#8696a0] text-sm">Loading {SHEETS.length} year{SHEETS.length !== 1 ? "s" : ""} of messages…</p>
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
          scrollToDate={scrollToDate}
          scrollToMsgId={scrollToMsgId}
          highlightMsgIds={new Set(searchResults)}
          onScrollHandled={handleScrollHandled}
        />
      )}
    </div>
  );
}
