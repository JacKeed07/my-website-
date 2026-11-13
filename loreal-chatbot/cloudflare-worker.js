// Cloudflare Worker for the L'Oréal Paris chatbot.
// Copy this code into your Cloudflare Worker script (dashboard: Workers & Pages
// → Create Worker → paste → Deploy), then add your OpenAI API key under
// Settings → Variables and Secrets as OPENAI_API_KEY.
// The browser never sees the key: it only talks to this Worker.

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

    const apiKey = env.OPENAI_API_KEY; // Name your secret OPENAI_API_KEY in the Cloudflare Workers dashboard
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured on this Worker.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    const userInput = await request.json();

    const requestBody = {
      model: 'gpt-4o',
      messages: userInput.messages,
      max_completion_tokens: 300,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
