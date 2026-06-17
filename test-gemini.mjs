import 'dotenv/config';

const apiKey = process.env.GROQ_API_KEY || '';
const model  = process.env.GROQ_MODEL   || 'meta-llama/llama-4-scout-17b-16e-instruct';
const url    = 'https://api.groq.com/openai/v1/chat/completions';

console.log(`Model   : ${model}`);
console.log(`API Key : ${apiKey ? '✅ loaded' : '❌ missing (set GROQ_API_KEY in .env)'}`);

const response = await fetch(url, {
  method : 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body   : JSON.stringify({
    model,
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Hello' }]
  })
});

const data = await response.json();
console.log(`HTTP    : ${response.status}`);
console.log('Response:', JSON.stringify(data, null, 2));
if (!response.ok) process.exitCode = 1;
