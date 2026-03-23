import React from "react";
import styles from "./WorkspacePage.module.css";
import { PhIcon } from "./PhIcon";

export interface WorkspaceHeroStat {
  label: string;
  value: string;
}

export interface WorkspaceCardItem {
  title: string;
  description: string;
  icon: string;
  meta?: string;
  onClick?: () => void;
}

export interface WorkspaceListItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  meta?: string;
  active?: boolean;
  onClick?: () => void;
}

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  heroActionLabel?: string;
  heroActionIcon?: string;
  onHeroAction?: () => void;
  heroStats?: WorkspaceHeroStat[];
  cardsTitle?: string;
  cardsHint?: string;
  cards?: WorkspaceCardItem[];
  listTitle?: string;
  listHint?: string;
  listItems?: WorkspaceListItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export const WorkspacePage: React.FC<Props> = ({
  eyebrow,
  title,
  description,
  heroActionLabel,
  heroActionIcon = "arrow-right",
  onHeroAction,
  heroStats = [],
  cardsTitle,
  cardsHint,
  cards = [],
  listTitle,
  listHint,
  listItems = [],
  emptyTitle = "Nothing here yet",
  emptyDescription = "Proteus is ready for this surface, but the data is still warming up.",
}) => {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>{eyebrow}</div>
          <div className={styles.title}>{title}</div>
          <div className={styles.description}>{description}</div>
          {heroActionLabel && onHeroAction && (
            <button className={styles.heroAction} onClick={onHeroAction}>
              <PhIcon name={heroActionIcon} size={16} />
              <span>{heroActionLabel}</span>
            </button>
          )}
        </div>

        {heroStats.length > 0 && (
          <div className={styles.heroStatus}>
            {heroStats.map((stat) => (
              <div key={stat.label} className={styles.statusCard}>
                <div className={styles.statusLabel}>{stat.label}</div>
                <div className={styles.statusValue}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>{cardsTitle || "Highlights"}</div>
            {cardsHint && <div className={styles.sectionHint}>{cardsHint}</div>}
          </div>
          <div className={styles.cardGrid}>
            {cards.map((card) => (
              <div key={card.title} className={styles.card} onClick={card.onClick}>
                <div className={styles.cardIcon}>
                  <PhIcon name={card.icon} size={18} />
                </div>
                <div className={styles.cardTitle}>{card.title}</div>
                <div className={styles.cardBody}>{card.description}</div>
                {card.meta && <div className={styles.cardMeta}>{card.meta}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>{listTitle || "Activity"}</div>
          {listHint && <div className={styles.sectionHint}>{listHint}</div>}
        </div>

        {listItems.length > 0 ? (
          <div className={styles.list}>
            {listItems.map((item) => (
              <div
                key={item.id}
                className={`${styles.listItem} ${item.active ? styles.listItemActive : ""}`}
                onClick={item.onClick}
              >
                <div className={styles.listIcon}>
                  <PhIcon name={item.icon} size={18} />
                </div>
                <div className={styles.listCopy}>
                  <div className={styles.listTitle}>{item.title}</div>
                  <div className={styles.listSubtitle}>{item.subtitle}</div>
                </div>
                {item.meta && <div className={styles.listMeta}>{item.meta}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{emptyTitle}</div>
            <div className={styles.emptyCopy}>{emptyDescription}</div>
          </div>
        )}
      </div>
    </div>
  );
};
