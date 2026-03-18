import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  EMOJI_CATEGORIES,
  getAllEmojis,
  getEmojisByCategory,
  getFrequentEmojis,
  searchEmojis,
  recordEmojiUsage,
} from "../data/emojiData";
import type { EmojiEntry } from "../data/emojiData";

interface Props {
  onSelect: (emoji: string, shortcode: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<Props> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("frequentlyUsed");
  const [hoveredEmoji, setHoveredEmoji] = useState<EmojiEntry | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on mount
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  const frequent = useMemo(() => getFrequentEmojis(), []);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    return searchEmojis(search.trim());
  }, [search]);

  const handleSelect = useCallback(
    (entry: EmojiEntry) => {
      recordEmojiUsage(entry.shortcode);
      onSelect(entry.emoji, entry.shortcode);
    },
    [onSelect],
  );

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    setSearch("");
    const el = gridRef.current?.querySelector(`[data-category="${catId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Track scroll position to highlight active category
  const handleScroll = useCallback(() => {
    if (search) return;
    const container = gridRef.current;
    if (!container) return;
    const headers = container.querySelectorAll<HTMLElement>("[data-category]");
    let current = "frequentlyUsed";
    for (const header of Array.from(headers)) {
      if (header.offsetTop <= container.scrollTop + 8) {
        current = header.dataset.category!;
      }
    }
    setActiveCategory(current);
  }, [search]);

  const renderGrid = (entries: EmojiEntry[]) =>
    entries.map((entry) => (
      <button
        key={`${entry.category}-${entry.shortcode}`}
        className="emoji-picker__emoji"
        onClick={() => handleSelect(entry)}
        onMouseEnter={() => setHoveredEmoji(entry)}
        onMouseLeave={() => setHoveredEmoji(null)}
        title={`:${entry.shortcode}:`}
      >
        {entry.emoji}
      </button>
    ));

  return (
    <div className="emoji-picker" ref={pickerRef}>
      {/* Search */}
      <div className="emoji-picker__search">
        <input
          ref={searchRef}
          type="text"
          className="emoji-picker__search-input"
          placeholder="Find the perfect emoji"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="emoji-picker__body">
        {/* Category sidebar */}
        <div className="emoji-picker__sidebar">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`emoji-picker__sidebar-btn ${activeCategory === cat.id ? "emoji-picker__sidebar-btn--active" : ""}`}
              onClick={() => scrollToCategory(cat.id)}
              title={cat.label}
            >
              {cat.icon}
            </button>
          ))}
        </div>

        {/* Emoji grid */}
        <div
          className="emoji-picker__grid-container"
          ref={gridRef}
          onScroll={handleScroll}
        >
          {searchResults ? (
            <>
              <div className="emoji-picker__category-header">
                Search Results
              </div>
              <div className="emoji-picker__grid">
                {searchResults.length > 0 ? (
                  renderGrid(searchResults)
                ) : (
                  <div className="emoji-picker__no-results">No emoji found</div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Frequently Used */}
              {frequent.length > 0 && (
                <>
                  <div
                    className="emoji-picker__category-header"
                    data-category="frequentlyUsed"
                  >
                    Frequently Used
                  </div>
                  <div className="emoji-picker__grid">
                    {renderGrid(frequent)}
                  </div>
                </>
              )}

              {/* All categories */}
              {EMOJI_CATEGORIES.filter((c) => c.id !== "frequentlyUsed").map(
                (cat) => {
                  const entries = getEmojisByCategory(cat.id);
                  if (entries.length === 0) return null;
                  return (
                    <React.Fragment key={cat.id}>
                      <div
                        className="emoji-picker__category-header"
                        data-category={cat.id}
                      >
                        {cat.label}
                      </div>
                      <div className="emoji-picker__grid">
                        {renderGrid(entries)}
                      </div>
                    </React.Fragment>
                  );
                },
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom preview bar */}
      <div className="emoji-picker__preview">
        {hoveredEmoji ? (
          <>
            <span className="emoji-picker__preview-emoji">
              {hoveredEmoji.emoji}
            </span>
            <span className="emoji-picker__preview-name">
              :{hoveredEmoji.shortcode}:
            </span>
          </>
        ) : (
          <span className="emoji-picker__preview-hint">
            Pick an emoji…
          </span>
        )}
      </div>
    </div>
  );
};
