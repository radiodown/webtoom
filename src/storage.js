export const defaults = { width: 800, gap: 12, theme: 'dark' };
export function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Reading works without storage. */ }
}
export function readSettings() {
  const saved = readStorage('webtoon:settings') || {};
  return {
    width: [640, 800, 1054].includes(saved.width) ? saved.width : defaults.width,
    gap: Number.isInteger(saved.gap) && saved.gap >= 4 && saved.gap <= 40 ? saved.gap : defaults.gap,
    theme: saved.theme === 'light' ? 'light' : 'dark'
  };
}
export function readPosition(episode) {
  const saved = readStorage(`webtoon:position:${episode.id}`);
  if (!saved || !Number.isInteger(saved.page) || saved.page < 0 || saved.page >= episode.images.length) return null;
  return { page: saved.page, fraction: Math.max(0, Math.min(1, Number(saved.fraction) || 0)) };
}
