// Cloudflare Worker for the L'Oréal Paris chatbot — FREE route via GitHub Models.
// Serves OpenAI's GPT-4o model through GitHub's free inference tier (no credit
// card needed, 50 requests/day for GPT-4o). Copy this code into your Cloudflare
// Worker script (dashboard: Workers & Pages → Create Worker → paste → Deploy),
// then add your GitHub personal access token under Settings → Variables and
// Secrets as GITHUB_TOKEN. The browser never sees the token: it only talks to
// this Worker.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const token = env.GITHUB_TOKEN; // GitHub fine-grained PAT (models:read) in the Cloudflare Workers dashboard
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'GITHUB_TOKEN is not configured on this Worker.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const apiUrl = 'https://models.github.ai/inference/chat/completions';
    const userInput = await request.json();

    const requestBody = {
      model: 'openai/gpt-4o',
      messages: userInput.messages,
      max_tokens: 300,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
