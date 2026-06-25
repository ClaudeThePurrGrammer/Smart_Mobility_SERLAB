// lib/format.ts — Formattazione di date/orari in stile relativo italiano.

const MS_DAY = 86_400_000;

/** "Adesso", "2 ore fa", "Ieri", "3 gg fa", oppure "10 mag". */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < 60_000) return 'Adesso';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min fa`;
  if (diffMs < MS_DAY && now.getDate() === d.getDate()) return `${Math.floor(diffMs / 3_600_000)} ore fa`;

  const days = Math.floor(diffMs / MS_DAY);
  if (days <= 1) return 'Ieri';
  if (days < 7) return `${days} gg fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/** "Oggi, 08:36" / "Ieri, 17:57" / "10 mag". */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hhmm = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - MS_DAY).toDateString() === d.toDateString();
  if (sameDay) return `Oggi, ${hhmm}`;
  if (yesterday) return `Ieri, ${hhmm}`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}
