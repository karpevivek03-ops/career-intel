export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!key) return new Response('Server not configured', { status: 500 });
  let body;
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const prompt = String(body.prompt || '');
  const pdf = body.pdf ? String(body.pdf) : null;
  if (prompt.length < 20 || prompt.length > 24000) return new Response('Bad prompt size', { status: 400 });
  if (pdf && pdf.length > 5000000) return new Response('PDF too large', { status: 413 });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: Netlify.env.get('CLAUDE_MODEL') || 'claude-sonnet-5-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: pdf ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } }, { type: 'text', text: prompt }] : prompt }],
    }),
  });
  if (!r.ok) return new Response('Upstream error', { status: r.status === 429 ? 429 : 502 });
  const d = await r.json();
  const text = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return new Response(JSON.stringify({ text }), { headers: { 'content-type': 'application/json' } });
};
