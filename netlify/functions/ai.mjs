const pick = () => {
  const g = Netlify.env.get('GROQ_API_KEY'), a = Netlify.env.get('ANTHROPIC_API_KEY');
  return g ? ['groq', g] : a ? ['anthropic', a] : [null, null];
};
const call = (provider, key, prompt, pdf, max) => {
  const model = Netlify.env.get('LLM_MODEL');
  if (provider === 'groq') {
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: model || 'llama-3.3-70b-versatile', max_tokens: max, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
    });
  }
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: max, messages: [{ role: 'user', content: pdf ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } }, { type: 'text', text: prompt }] : prompt }] }),
  });
};
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  const [provider, key] = pick();
  if (req.method === 'GET') {
    if (!provider) return j({ keySet: false, hint: 'Add GROQ_API_KEY or ANTHROPIC_API_KEY in Netlify, then redeploy' });
    const r = await call(provider, key, 'Say OK', null, 5);
    return j({ keySet: true, provider, status: r.status, reply: (await r.text()).slice(0, 300) });
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
