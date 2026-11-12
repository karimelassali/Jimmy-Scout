/** French relative time, e.g. "à l'instant", "il y a 5 min", "il y a 2 h", "il y a 3 jours". */
export function formatRelativeTimeFr(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "à l'instant";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years === 1 ? '' : 's'}`;
}
