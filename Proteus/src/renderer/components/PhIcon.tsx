import React from "react";

/**
 * Phosphor icon component wrapping the font-based icon system.
 *
 * Usage:
 *   <PhIcon name="hash" />           // regular weight
 *   <PhIcon name="gear" weight="fill" />
 *   <PhIcon name="plus" size={20} />
 */

export type PhWeight = "regular" | "fill" | "bold";

interface PhIconProps {
  /** Icon name without the "ph-" prefix (e.g., "hash", "gear", "plus") */
  name: string;
  /** Icon weight variant */
  weight?: PhWeight;
  /** Font size in pixels */
  size?: number;
  /** Extra CSS class names */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
}

const weightClass: Record<PhWeight, string> = {
  regular: "ph",
  fill: "ph-fill",
  bold: "ph-bold",
};

export const PhIcon: React.FC<PhIconProps> = ({
  name,
  weight = "regular",
  size,
  className = "",
  style,
  onClick,
}) => {
  const classes = `${weightClass[weight]} ph-${name} ${className}`.trim();
  const mergedStyle: React.CSSProperties = {
    ...(size ? { fontSize: size } : {}),
    ...style,
  };

  return (
    <i
      className={classes}
      style={Object.keys(mergedStyle).length > 0 ? mergedStyle : undefined}
      onClick={onClick}
      aria-hidden="true"
    />
  );
};
