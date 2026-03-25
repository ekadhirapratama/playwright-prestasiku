import { GeneratedTC } from './backlog-types';

export async function openrouterChat(prompt: string, model?: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY tidak ditemukan');
  const selectedModel = model ?? process.env.QA_MODEL ?? 'mistralai/mistral-7b-instruct';

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/qa-tools',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

export function parseJsonFromAI(text: string): GeneratedTC[] {
  // Toleran terhadap markdown fences
  const fenced = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (fenced) return JSON.parse(fenced[1]);
  const bare = text.match(/(\[[\s\S]*\])/);
  if (bare) return JSON.parse(bare[1]);
  throw new Error(`Tidak ada JSON array dalam respons:\n${text.slice(0, 400)}`);
}
