export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('GROQ_API_KEY');
  if (!key) return new Response('Server not configured', { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const prompt = String(body.prompt || '');
  if (prompt.length < 20 || prompt.length > 24000) return new Response('Bad prompt size', { status: 400 });
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: Netlify.env.get('LLM_MODEL') || 'llama-3.3-70b-versatile',
      max_tokens: 3000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) return new Response('Upstream error', { status: r.status === 429 ? 429 : 502 });
  const d = await r.json();
  const text = (d.choices && d.choices[0] && d.choices[0].message.content) || '';
  return new Response(JSON.stringify({ text }), { headers: { 'content-type': 'application/json' } });
};
