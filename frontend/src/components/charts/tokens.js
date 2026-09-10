/**
 * Chart tokens.
 *
 * The categorical order below is the validated one — it clears the lightness
 * band, the chroma floor, adjacent-pair CVD separation (ΔE 9.7 worst pair,
 * protanopia), the normal-vision floor (ΔE 20.2) and 3:1 contrast against the
 * card surface. Assign slots in this order; never cycle or generate a new hue.
 */

export const SERIES = {
  equity: "#0f7d58",
  bonds: "#b8800f",
  property: "#2f5f9e",
  cash: "#a8332c",
  receivable: "#7a4bb0",
  liquid: "#a8332c",
};

export const SURFACE = "#fdfbf6";
export const GRID = "#e4dbc8";
export const AXIS_TEXT = "#7b7566";

export const STATUS = {
  good: "#146c46",
  warning: "#9a6209",
  critical: "#9d2b25",
  info: "#24466d",
};

/** 2px of surface between touching marks — white does the separating. */
export const MARK_GAP = 2;
export const BAR_THICKNESS = 22;
