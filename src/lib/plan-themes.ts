// Shared theme definitions for plan reports.
// One source of truth — consumed by the PDF builder and the public share page.

export type PlanThemeId = "light" | "dark" | "sepia" | "navy" | "terracotta";

export const THEME_IDS: PlanThemeId[] = ["light", "dark", "sepia", "navy", "terracotta"];

export type PlanTheme = {
  id: PlanThemeId;
  label: string;
  // Web swatch colors (hex)
  paper: string;
  ink: string;
  inkSoft: string;
  inkMute: string;
  faint: string;
  ember: string;
  sage: string;
  gold: string;
};

export const PLAN_THEMES: Record<PlanThemeId, PlanTheme> = {
  light: {
    id: "light",
    label: "Light",
    paper: "#ffffff",
    ink: "#1a1a1a",
    inkSoft: "#3d3d3d",
    inkMute: "#6b6b6b",
    faint: "#d9d2c0",
    ember: "#c4452d",
    sage: "#52805c",
    gold: "#c79a33",
  },
  dark: {
    id: "dark",
    label: "Dark",
    paper: "#121214",
    ink: "#f0efea",
    inkSoft: "#d4cdc1",
    inkMute: "#a6a09a",
    faint: "#47474c",
    ember: "#f37551",
    sage: "#8cc794",
    gold: "#f3c75c",
  },
  sepia: {
    id: "sepia",
    label: "Sepia",
    paper: "#f9f1e0",
    ink: "#33260e",
    inkSoft: "#5a4128",
    inkMute: "#75614a",
    faint: "#c7b48c",
    ember: "#b84e1f",
    sage: "#5c7548",
    gold: "#b3851a",
  },
  navy: {
    id: "navy",
    label: "Navy",
    paper: "#f4f6fb",
    ink: "#0f1b3d",
    inkSoft: "#1e3a5f",
    inkMute: "#5c6f8e",
    faint: "#c1cad9",
    ember: "#3b6fa0",
    sage: "#3f7a63",
    gold: "#b8923a",
  },
  terracotta: {
    id: "terracotta",
    label: "Terracotta",
    paper: "#faf3ec",
    ink: "#3d2418",
    inkSoft: "#5e3a26",
    inkMute: "#8a6f5e",
    faint: "#d4b89e",
    ember: "#c4654a",
    sage: "#7a9568",
    gold: "#c08940",
  },
};

export function getPlanTheme(id: string | null | undefined): PlanTheme {
  if (id && (id as PlanThemeId) in PLAN_THEMES) return PLAN_THEMES[id as PlanThemeId];
  return PLAN_THEMES.light;
}

// Convert "#rrggbb" to [0..1, 0..1, 0..1] for pdf-lib's rgb()
export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}
