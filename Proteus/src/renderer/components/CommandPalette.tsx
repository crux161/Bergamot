import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./CommandPalette.module.css";
import { PhIcon } from "./PhIcon";

export interface CommandPaletteItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  keywords?: string[];
  hint?: string;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  items: CommandPaletteItem[];
  onClose: () => void;
}

export const CommandPalette: React.FC<Props> = ({ open, items, onClose }) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.title, item.subtitle, ...(item.keywords || [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(filteredItems.length - 1, 0)));
  }, [filteredItems.length]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) =>
          filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length,
        );
        return;
      }
      if (event.key === "Enter") {
        const active = filteredItems[activeIndex];
        if (!active) return;
        event.preventDefault();
        active.onSelect();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, filteredItems, onClose, open]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(event) => event.stopPropagation()}>
        <div className={styles.searchRow}>
          <PhIcon name="magnifying-glass" size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Jump to a conversation, server, or tool"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className={styles.results}>
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => (
              <div
                key={item.id}
                className={`${styles.result} ${index === activeIndex ? styles.resultActive : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  item.onSelect();
                  onClose();
                }}
              >
                <div className={styles.resultIcon}>
                  <PhIcon name={item.icon} size={18} />
                </div>
                <div className={styles.resultCopy}>
                  <div className={styles.resultTitle}>{item.title}</div>
                  <div className={styles.resultSubtitle}>{item.subtitle}</div>
                </div>
                {item.hint && <div className={styles.resultHint}>{item.hint}</div>}
              </div>
            ))
          ) : (
            <div className={styles.empty}>No routes, servers, or conversations match that search yet.</div>
          )}
        </div>

        <div className={styles.footer}>
          <span>Arrow keys to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
