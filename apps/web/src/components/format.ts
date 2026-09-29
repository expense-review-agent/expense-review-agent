const TAIPEI_DATE_TIME = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO datetime → 台北時間 `YYYY-MM-DD HH:mm`（審查紀錄與處理紀錄的時間）。 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : TAIPEI_DATE_TIME.format(date);
}
