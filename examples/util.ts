export function fmtDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDuration(ms: number) {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  if (m > 0) return `${m}m ${s.toFixed(2)}s`;
  return `${s.toFixed(2)}s`;
}

export function logArticle(prefix: string, a: any) {
  const totalMs = a?.timings?.totalMs;
  const totalTokens = a?.usage?.total?.totalTokens;
  console.log(`[sample:${prefix}] status=${a.status} duration=${fmtDuration(totalMs)} tokens=${totalTokens}`);
}
