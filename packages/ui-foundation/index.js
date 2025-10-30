import tokens from "./tokens.json" assert { type: "json" };

export const colors = tokens.colors;
export const fonts = tokens.fonts;
export const spacing = tokens.spacing;
export const radius = tokens.radius;

export function getColor(name, fallback) {
  return colors[name] ?? fallback ?? colors.ink;
}

export default tokens;
