// Shared pricing utilities (moved from ./article/pricing.ts)
// Prefer importing from './pricing.js'.
export const MODEL_ENV_MAP: Record<string, { in: string; out: string }> = {
	'gpt-4o-mini': { in: 'PRICE_GPT4O_MINI_IN', out: 'PRICE_GPT4O_MINI_OUT' },
	'gpt-4o': { in: 'PRICE_GPT4O_IN', out: 'PRICE_GPT4O_OUT' },
	'deepseek-chat': { in: 'PRICE_DEEPSEEK_CHAT_IN', out: 'PRICE_DEEPSEEK_CHAT_OUT' },
	'deepseek-coder': { in: 'PRICE_DEEPSEEK_CODER_IN', out: 'PRICE_DEEPSEEK_CODER_OUT' },
};

export function resolvePrices(
	modelId?: string,
	cliIn?: string | number,
	cliOut?: string | number
): { in?: number; out?: number; found: boolean; source: 'cli'|'model'|'global'|'none'; pickedInKey?: string; pickedOutKey?: string } {
	const toNum = (v?: string | number | null) => (v == null || v === '' ? undefined : (Number.isFinite(+v) ? +v : undefined));
	const inArg = toNum(cliIn); const outArg = toNum(cliOut);
	if (inArg != null || outArg != null) return { in: inArg, out: outArg, found: true, source: 'cli' };
	if (modelId && MODEL_ENV_MAP[modelId]) {
		const { in: inKey, out: outKey } = MODEL_ENV_MAP[modelId];
		const inVal = toNum(process.env[inKey]); const outVal = toNum(process.env[outKey]);
		if (inVal != null || outVal != null) return { in: inVal, out: outVal, found: true, source: 'model', pickedInKey: inKey, pickedOutKey: outKey };
	}
	const globalIn = toNum(process.env.PRICE_IN); const globalOut = toNum(process.env.PRICE_OUT);
	if (globalIn != null || globalOut != null) return { in: globalIn, out: globalOut, found: true, source: 'global' };
	return { found: false, source: 'none' };
}
