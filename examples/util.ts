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

export function logArticle(prefix: string, payload: any) {
  const rt = payload?.output?.runtime;
  const timings = rt?.timings;
  const usage = rt?.usage;
  const strictFailed = rt?.strategy?.requiredCoverage?.strictFailed;
  const warning = rt?.warning;
  const overused = rt?.strategy?.requiredCoverage?.overused?.length;
  let status: string = 'success';
  if (strictFailed) status = 'strict-failed';
  else if (warning) status = 'warning';
  else if (overused) status = 'overuse';
  const totalMs: number | undefined = timings?.totalMs;
  const totalTokens = usage?.total?.totalTokens;
  const dur = typeof totalMs === 'number' ? fmtDuration(totalMs) : 'n/a';
  console.log(`[sample:${prefix}] status=${status} duration=${dur} tokens=${totalTokens ?? 'n/a'}`);
}
