import { generateText as realGenerateText } from 'ai';

// Model to provider mapping
const MODEL_PROVIDER_MAP: Record<string, 'openai' | 'deepseek' | 'lmstudio'> = {
  'gpt-4o-mini': 'openai',
  'gpt-4o': 'openai',
  'gpt-4.1': 'openai',
  'gpt-4.1-mini': 'openai',
  'o3-mini': 'openai',
  'text-davinci-003': 'openai',
  'deepseek-chat': 'deepseek',
  'deepseek-reasoner': 'deepseek',
  'llama-3': 'lmstudio',
  'llama-3.1': 'lmstudio',
  'qwen2': 'lmstudio',
  'phi-3': 'lmstudio',
  'mistral': 'lmstudio',
  'openai/gpt-oss-20b': 'lmstudio'
};

export function resolveProviderForModel(model: string): 'openai' | 'deepseek' | 'lmstudio' {
  const key = model.toLowerCase();
  if (MODEL_PROVIDER_MAP[key]) return MODEL_PROVIDER_MAP[key];
  throw new Error(`Unknown model '${model}'. Please add it to MODEL_PROVIDER_MAP.`);
}

let _generateTextImpl: typeof realGenerateText | ((args: any) => Promise<any>) = realGenerateText;
export function __setGenerateTextImpl(fn: typeof realGenerateText | ((args: any) => Promise<any>)) {
  _generateTextImpl = fn;
}

let _lmstudioWarmed = false;

export async function safeGenerateText(args: any, context: { provider: string; model: string; phase: string }) {
  try {
    if (context.provider === 'deepseek') {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY.');
      let base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      if (!/\/v\d+$/.test(base)) base = base.replace(/\/$/, '') + '/v1';
      const url = base.replace(/\/$/, '') + '/chat/completions';
      const messages = args.messages ? args.messages.map((m: any) => ({ role: m.role, content: m.content })) : [{ role: 'user', content: args.prompt }];
      const body: any = { model: context.model, messages };
      if (args.temperature != null) body.temperature = args.temperature;
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
      if (!resp.ok) { const txt = await resp.text(); throw new Error(`Deepseek API error ${resp.status}: ${txt}`); }
      const json: any = await resp.json();
      const content = json.choices?.[0]?.message?.content || '';
      const usage = json.usage ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens, totalTokens: json.usage.total_tokens } : undefined;
      return { text: content, usage };
    }
    if (context.provider === 'lmstudio') {
      let base = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
      if (!/\/v\d+$/.test(base)) base = base.replace(/\/$/, '') + '/v1';
      const url = base.replace(/\/$/, '') + '/chat/completions';
      if (!_lmstudioWarmed && process.env.LMSTUDIO_WARM !== '0') {
  try { const warmResp = await fetch(base.replace(/\/$/, '') + '/models', { method: 'GET' }); if (warmResp.ok) _lmstudioWarmed = true; } catch { /* ignore warm errors */ }
      }
      const messages = args.messages ? args.messages.map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((c: any) => c?.text || JSON.stringify(c)).join('\n') : JSON.stringify(m.content)) })) : [{ role: 'user', content: args.prompt }];
      const body: any = { model: context.model, messages };
      if (args.temperature != null) body.temperature = args.temperature;
      const wantStream = process.env.LMSTUDIO_STREAM === '1';
      if (wantStream) body.stream = true;
      const timeoutMs = parseInt(process.env.LMSTUDIO_TIMEOUT_MS || '900000', 10);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let resp: Response;
      try {
        resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      } catch (e: any) {
        clearTimeout(timer);
        if (e?.name === 'AbortError') throw new Error(`LM Studio request aborted after ${timeoutMs}ms.`);
        throw e;
      }
      clearTimeout(timer);
      if (!resp.ok) { const txt = await resp.text().catch(() => ''); throw new Error(`LM Studio API error ${resp.status}: ${txt}`); }
      if (wantStream) {
        const reader = resp.body?.getReader();
        if (!reader) { const fallback = await resp.text(); try { const parsed = JSON.parse(fallback); const content = parsed.choices?.[0]?.message?.content || fallback; return { text: content, usage: undefined }; } catch { return { text: fallback, usage: undefined }; } }
        const decoder = new TextDecoder(); let buf = ''; let assembled = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split(/\r?\n/);
            buf = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.slice(5).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                  const deltaObj = JSON.parse(jsonStr);
                  const delta = deltaObj.choices?.[0]?.delta?.content || deltaObj.choices?.[0]?.message?.content;
                  if (delta) assembled += delta;
                } catch { /* ignore parse */ }
              } else {
                assembled += trimmed + '\n';
              }
            }
        }
        return { text: assembled.trim(), usage: undefined };
      }
      const json: any = await resp.json().catch(async () => ({ raw: await resp.text() }));
      const content = json.choices?.[0]?.message?.content || json.raw || '';
      const usage = json.usage ? { promptTokens: json.usage.prompt_tokens, completionTokens: json.usage.completion_tokens, totalTokens: json.usage.total_tokens } : undefined;
      return { text: content, usage };
    }
    return await _generateTextImpl(args);
  } catch (err: any) {
    const status = err?.statusCode || err?.status || err?.code;
    if (status === 404) {
      const hints: string[] = [ 'Received 404 from model API.', `Phase: ${context.phase}`, `Provider: ${context.provider}`, `Model: ${context.model}` ];
      if (context.provider === 'deepseek') hints.push('Hints: Ensure base URL includes /v1', 'Check model name (deepseek-chat).');
      else if (context.provider === 'lmstudio') hints.push('Hints: Ensure LM Studio server running.', 'Check LMSTUDIO_BASE_URL.', 'Confirm model loaded.');
      err.message = `${err.message || '404 Not Found'}\n - ${hints.join('\n - ')}`;
    }
    throw err;
  }
}
