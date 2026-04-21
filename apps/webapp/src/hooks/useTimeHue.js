import { useEffect, useMemo } from 'react';

// The accent color's hue shifts with the time of day — warm in morning,
// blue at midday, purple at dusk, deep at night. Applied as a CSS var
// so any component touching `var(--accent)` picks it up.
export default function useTimeHue() {
  const hue = useMemo(() => {
    const h = new Date().getHours();
    if (h < 6) return 250;
    if (h < 11) return 28;
    if (h < 16) return 225;
    if (h < 20) return 18;
    return 295;
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent-h', String(hue));
  }, [hue]);

  return hue;
}
