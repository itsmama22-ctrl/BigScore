export const typography = {
  fontFamily: {
    sans: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
    mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`,
  },
  scale: {
    display: { fontSize: "48px", lineHeight: "56px", fontWeight: 700 },
    h1: { fontSize: "32px", lineHeight: "40px", fontWeight: 700 },
    h2: { fontSize: "24px", lineHeight: "32px", fontWeight: 600 },
    h3: { fontSize: "20px", lineHeight: "28px", fontWeight: 600 },
    h4: { fontSize: "18px", lineHeight: "24px", fontWeight: 600 },
    "body-lg": { fontSize: "16px", lineHeight: "24px", fontWeight: 400 },
    body: { fontSize: "14px", lineHeight: "20px", fontWeight: 400 },
    "body-sm": { fontSize: "13px", lineHeight: "18px", fontWeight: 400 },
    label: { fontSize: "12px", lineHeight: "16px", fontWeight: 500 },
    caption: { fontSize: "11px", lineHeight: "14px", fontWeight: 400 },
    code: { fontSize: "14px", lineHeight: "20px" },
  },
} as const;

export type TypographyScale = keyof typeof typography.scale;
