import React, { useState, useMemo } from "react";
import { Input } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";

export interface StickerEntry {
  id: string;
  name: string;
  url: string;
  pack?: string;
}

// Built-in sticker packs — in production these would come from the server
const BUILT_IN_STICKERS: StickerEntry[] = [
  { id: "wave", name: "Wave", url: "", pack: "Bergamot" },
  { id: "thumbsup", name: "Thumbs Up", url: "", pack: "Bergamot" },
  { id: "heart", name: "Heart", url: "", pack: "Bergamot" },
  { id: "laugh", name: "Laugh", url: "", pack: "Bergamot" },
  { id: "think", name: "Think", url: "", pack: "Bergamot" },
  { id: "fire", name: "Fire", url: "", pack: "Bergamot" },
  { id: "eyes", name: "Eyes", url: "", pack: "Bergamot" },
  { id: "clap", name: "Clap", url: "", pack: "Bergamot" },
  { id: "cry", name: "Cry", url: "", pack: "Bergamot" },
  { id: "party", name: "Party", url: "", pack: "Bergamot" },
  { id: "skull", name: "Skull", url: "", pack: "Bergamot" },
  { id: "sunglasses", name: "Cool", url: "", pack: "Bergamot" },
];

// Map sticker IDs to fallback emoji for the placeholder UI
const STICKER_EMOJI: Record<string, string> = {
  wave: "👋", thumbsup: "👍", heart: "❤️", laugh: "😂",
  think: "🤔", fire: "🔥", eyes: "👀", clap: "👏",
  cry: "😢", party: "🎉", skull: "💀", sunglasses: "😎",
};

interface Props {
  onSelect: (sticker: StickerEntry) => void;
  onClose: () => void;
}

export const StickerPicker: React.FC<Props> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return BUILT_IN_STICKERS;
    const q = search.toLowerCase();
    return BUILT_IN_STICKERS.filter(
      (s) => s.name.toLowerCase().includes(q) || s.pack?.toLowerCase().includes(q),
    );
  }, [search]);

  const packs = useMemo(() => {
    const map = new Map<string, StickerEntry[]>();
    for (const s of filtered) {
      const pack = s.pack || "Uncategorized";
      if (!map.has(pack)) map.set(pack, []);
      map.get(pack)!.push(s);
    }
    return map;
  }, [filtered]);

  return (
    <div className="sticker-picker" onClick={(e) => e.stopPropagation()}>
      <div className="sticker-picker__header">
        <Input
          prefix={<PhIcon name="magnifying-glass" size={14} />}
          placeholder="Search stickers"
          value={search}
          onChange={setSearch}
          size="small"
          className="sticker-picker__search"
        />
      </div>
      <div className="sticker-picker__body">
        {Array.from(packs).map(([packName, stickers]) => (
          <div key={packName} className="sticker-picker__pack">
            <div className="sticker-picker__pack-name">{packName}</div>
            <div className="sticker-picker__grid">
              {stickers.map((s) => (
                <div
                  key={s.id}
                  className="sticker-picker__item"
                  title={s.name}
                  onClick={() => { onSelect(s); onClose(); }}
                >
                  {s.url ? (
                    <img src={s.url} alt={s.name} className="sticker-picker__img" />
                  ) : (
                    <span className="sticker-picker__fallback">
                      {STICKER_EMOJI[s.id] || "🏷️"}
                    </span>
                  )}
                  <span className="sticker-picker__label">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="sticker-picker__empty">No stickers found</div>
        )}
      </div>
    </div>
  );
};
