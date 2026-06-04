export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
  md: "0 4px 6px rgba(0, 0, 0, 0.4)",
  lg: "0 10px 15px rgba(0, 0, 0, 0.5)",
  xl: "0 20px 25px rgba(0, 0, 0, 0.6)",
  "glow-gold": "0 0 20px rgba(255, 215, 0, 0.3)",
  "glow-blue": "0 0 20px rgba(0, 217, 255, 0.3)",
  "glow-red": "0 0 20px rgba(255, 59, 92, 0.3)",
} as const;

export type ShadowKey = keyof typeof shadows;
