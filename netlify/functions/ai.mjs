let MODEL = null;
const PREF = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
const pick = () => {
  const g = Netlify.env.get('GROQ_API_KEY'), a = Netlify.env.get('ANTHROPIC_API_KEY');
  return g ? ['groq', g] : a ? ['anthropic', a] : [null, null];
};
async function groqModels(key) {
  const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { authorization: 'Bearer ' + key } });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.data || []).map((m) => m.id);
}
async function groqModel(key) {
  const set = Netlify.env.get('LLM_MODEL');
  if (set) return set;
  if (MODEL) return MODEL;
  const ids = await groqModels(key);
  MODEL = PREF.find((p) => ids.includes(p)) ||
    ids.find((i) => /llama|gpt-oss|qwen|kimi/i.test(i) && !/whisper|tts|guard|prompt|compound|safeguard/i.test(i)) || null;
  return MODEL;
}
const call = async (provider, key, prompt, pdf, max) => {
  if (provider === 'groq') {
    const model = await groqModel(key);
    if (!model) return new Response('No usable Groq model for this key', { status: 404 });
    const body = { model, max_tokens: max, temperature: 0.2, messages: [{ role: 'user', content: prompt }] };
    if (/gpt-oss/.test(model)) body.reasoning_effort = 'low';
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
    });
  }
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: Netlify.env.get('LLM_MODEL') || 'claude-sonnet-5-5',
      max_tokens: max,
      messages: [{ role: 'user', content: pdf ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } }, { type: 'text', text: prompt }] : prompt }],
    }),
  });
};

export default async (req) => {
  const [provider, key] = pick();
  if (req.method === 'GET') {
    if (!provider) return j({ keySet: false, hint: 'Add GROQ_API_KEY or ANTHROPIC_API_KEY in Netlify, then redeploy' });
    const models = provider === 'groq' ? (await groqModels(key)).slice(0, 25) : undefined;
    const r = await call(provider, key, 'Say OK', null, 20);
    return j({ keySet: true, provider, chosenModel: provider === 'groq' ? await groqModel(key) : undefined, models, status: r.status, reply: (await r.text()).slice(0, 300) });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!provider) return new Response('Server not configured', { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const prompt = String(body.prompt || ''), pdf = body.pdf ? String(body.pdf) : null;
  if (prompt.length < 20 || prompt.length > 24000 || (pdf && pdf.length > 5000000)) return new Response('Bad size', { status: 400 });
  const r = await call(provider, key, prompt, pdf, 3000);
  if (!r.ok) return new Response('Upstream error ' + (await r.text()).slice(0, 200), { status: r.status === 429 ? 429 : 502 });
  const d = await r.json();
  const text = provider === 'groq'
    ? (d.choices && d.choices[0] && d.choices[0].message.content) || ''
    : (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return j({ text });
};
