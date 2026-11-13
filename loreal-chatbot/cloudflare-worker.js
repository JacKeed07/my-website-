// Cloudflare Worker for the L'Oréal Paris chatbot — FREE route via GitHub Models.
// Serves OpenAI's GPT-4o model through GitHub's free inference tier (no credit
// card needed, 50 requests/day for GPT-4o). Copy this code into your Cloudflare
// Worker script (dashboard: Workers & Pages → Create Worker → paste → Deploy),
// then add your GitHub personal access token under Settings → Variables and
// Secrets as GITHUB_TOKEN. The browser never sees the token: it only talks to
// this Worker.
//
// v2: robust error handling — upstream errors are returned as text with their
// real status instead of throwing, and GET returns a small health check.

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
        JSON.stringify({ status: 'ok', model: 'openai/gpt-4o', backend: 'github-models' }),
        { headers: corsHeaders }
      );
    }

    const token = env.GITHUB_TOKEN; // GitHub fine-grained PAT (models:read) in the Cloudflare Workers dashboard
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'GITHUB_TOKEN is not configured on this Worker.' }),
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

    const apiUrl = 'https://models.github.ai/inference/chat/completions';
    const requestBody = {
      model: 'openai/gpt-4o',
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
        JSON.stringify({ error: 'Could not reach GitHub Models: ' + e.message }),
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
        JSON.stringify({ error: 'GitHub Models returned a non-JSON response', status: response.status, body: text.slice(0, 500) }),
        { status: response.status || 502, headers: corsHeaders }
      );
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'GitHub Models error', status: response.status, detail: data }),
        { status: response.status, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
