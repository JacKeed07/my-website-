// Cloudflare Worker for the L'Oréal Paris chatbot — FREE route via Groq.
// Serves Meta's Llama 3.1 8B (instant) through Groq's free tier (no credit
// card needed, OpenAI-compatible API). Copy this code into your Cloudflare
// Worker script (dashboard: Workers & Pages → Create Worker → paste → Deploy),
// then add your Groq API key under Settings → Variables and Secrets as
// GROQ_API_KEY. The browser never sees the key: it only talks to this Worker.
//
// v3: switched from GitHub Models (its gateway kept answering plain "OK"
// and never recorded the token as used) to Groq, whose API answers with
// proper JSON. Same robust error handling as v2.

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

    // Health check (no body needed)
    if (request.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', model: 'llama-3.1-8b-instant', backend: 'groq' }),
        { headers: corsHeaders }
      );
    }

    const token = env.GROQ_API_KEY; // Groq API key in the Cloudflare Workers dashboard
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY is not configured on this Worker.' }),
        { status: 500, headers: corsHeaders }
      );
    }

    let userInput;
    try {
      userInput = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Request body must be JSON with a messages array.' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const requestBody = {
      model: 'llama-3.1-8b-instant',
      messages: userInput.messages,
      max_tokens: 300,
    };

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Could not reach Groq: ' + e.message }),
        { status: 502, headers: corsHeaders }
      );
    }

    // Read as text first: if the upstream returns a non-JSON error page,
    // pass it through with its real status instead of throwing.
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Groq returned a non-JSON response', status: response.status, body: text.slice(0, 500) }),
        { status: response.status || 502, headers: corsHeaders }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'Groq error', status: response.status, detail: data }),
        { status: response.status, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
