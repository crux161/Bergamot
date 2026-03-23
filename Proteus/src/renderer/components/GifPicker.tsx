import React, { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";

export interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

// Placeholder trending results — in production these come from Tenor/Giphy API
const TRENDING_PLACEHOLDER: GifResult[] = [
  { id: "1", title: "Hello", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "2", title: "Thumbs Up", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "3", title: "Laughing", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "4", title: "Dancing", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "5", title: "Mind Blown", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "6", title: "Applause", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "7", title: "Crying", url: "", previewUrl: "", width: 200, height: 150 },
  { id: "8", title: "Victory", url: "", previewUrl: "", width: 200, height: 150 },
];

interface Props {
  onSelect: (gif: GifResult) => void;
  onClose: () => void;
}

export const GifPicker: React.FC<Props> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<GifResult[]>(TRENDING_PLACEHOLDER);
  const searchTimerRef = useRef<number>();

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setResults(TRENDING_PLACEHOLDER);
      return;
    }
    // Debounce search — in production this calls Tenor/Giphy API
    searchTimerRef.current = window.setTimeout(() => {
      const filtered = TRENDING_PLACEHOLDER.filter((g) =>
        g.title.toLowerCase().includes(query.toLowerCase()),
      );
      setResults(filtered);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  return (
    <div className="gif-picker" onClick={(e) => e.stopPropagation()}>
      <div className="gif-picker__header">
        <Input
          prefix={<PhIcon name="magnifying-glass" size={14} />}
          placeholder="Search GIFs"
          value={search}
          onChange={handleSearch}
          size="small"
          className="gif-picker__search"
        />
      </div>
      <div className="gif-picker__body">
        {!search.trim() && (
          <div className="gif-picker__section-title">Trending</div>
        )}
        <div className="gif-picker__grid">
          {results.map((gif) => (
            <div
              key={gif.id}
              className="gif-picker__item"
              title={gif.title}
              onClick={() => { onSelect(gif); onClose(); }}
            >
              {gif.previewUrl ? (
                <img src={gif.previewUrl} alt={gif.title} className="gif-picker__img" />
              ) : (
                <div className="gif-picker__placeholder">
                  <PhIcon name="gif" size={24} />
                  <span>{gif.title}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {results.length === 0 && (
          <div className="gif-picker__empty">No GIFs found for "{search}"</div>
        )}
      </div>
      <div className="gif-picker__footer">
        Powered by GIF search — connect a Tenor or Giphy API key in settings
      </div>
    </div>
  );
};
