// L'Oréal Paris — Smart Routine & Product Advisor
// Frontend chat logic. The API token is NEVER in this file:
// the browser only talks to the Cloudflare Worker, which holds the token
// as a secret and forwards requests to the AI model (Llama 3.1 via Groq).

/* ---------- Configuration ---------- */
// Paste the deployed Cloudflare Worker URL here after deployment, e.g.
// "https://loreal-chatbot.<your-subdomain>.workers.dev"
// While this is empty, the chatbot answers from a small built-in demo
// guide so the interface can be tried out; live AI replies need the Worker.
const WORKER_URL = "https://loreal-chatbot.jack-wangzf.workers.dev";

/* ---------- System prompt (sent with every request) ---------- */
const SYSTEM_PROMPT = [
  "You are the L'Oréal Paris Smart Routine & Product Advisor, a friendly beauty expert.",
  "Only answer questions about L'Oréal products — makeup, skincare, haircare, and fragrance —",
  "beauty routines, and product recommendations.",
  "If a question is unrelated to L'Oréal or beauty, politely refuse and steer the user back",
  "to L'Oréal products and routines.",
  "Keep answers short, friendly, and helpful, with a warm tone and an occasional emoji.",
  "When you recommend products, name specific L'Oréal Paris lines (for example Revitalift,",
  "True Match, Elvive, Infallible, or Voluminous) and briefly explain why they fit.",
  "If the user shares their name, skin type, hair type, or preferences, remember them and",
  "use them in later answers.",
].join(" ");

/* ---------- DOM elements ---------- */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const currentQuestion = document.getElementById("currentQuestion");
const demoNote = document.getElementById("demoNote");
const sendBtn = document.getElementById("sendBtn");

/* ---------- Conversation history (LevelUp: maintain context) ---------- */
const messages = [{ role: "system", content: SYSTEM_PROMPT }];

/* ---------- Helpers ---------- */
function addBubble(text, who) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "msg ai typing";
  div.textContent = "…";
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

/* ---------- Demo fallback (used only while WORKER_URL is not set) ---------- */
function demoReply(question) {
  const q = question.toLowerCase();
  if (q.includes("serum") && (q.includes("treatment") || q.includes("difference"))) {
    return "💧 A serum is a lightweight, fast-absorbing liquid you use daily to target a specific concern, like hydration or dullness — try Revitalift Triple Action Serum. A treatment product is a more targeted step, like a cream or mask, for issues such as acne or dark spots — for example, Revitalift Triple Action Cream. Serums go on first, treatments follow. Want me to build a routine around one of them?";
  }
  if (q.includes("dry skin") || q.includes("dry")) {
    return "💧 For dry skin, try this simple routine: 1) Revitalift Triple Action Cleanser, 2) Revitalift Triple Action Serum with hyaluronic acid, 3) Revitalift Triple Action Day Cream, 4) sunscreen in the morning. The serum plus cream pair is the key step for lasting hydration. Shall I tailor it to your skin type?";
  }
  if (q.includes("oily")) {
    return "✨ For oily skin, keep it light: a gentle gel cleanser, a niacinamide serum, and an oil-free moisturizer. Revitalift Water Cream is a good lightweight option, and blotting papers help during the day. Want a full morning and evening routine?";
  }
  if (q.includes("foundation") || q.includes("shade") || q.includes("warm")) {
    return "🎨 For warm skin tones, look for True Match shades with a warm (W) undertone — golden or peachy shades blend best. If veins on your wrist look greenish, warm undertones are likely. Tell me your current shade and I can suggest a closer match!";
  }
  if (q.includes("hair") || q.includes("shampoo") || q.includes("elvive")) {
    return "💇 For everyday care, Elvive is a great place to start: Elvive Total Repair 5 for damaged hair, or Elvive Dream Lengths for long hair. Use the matching shampoo and conditioner, and a weekly mask for extra repair. What is your main hair concern?";
  }
  if (q.includes("lipstick") || q.includes("mascara") || q.includes("makeup")) {
    return "💄 For makeup, Infallible Pro-Matte Foundation gives long wear, Voluminous Mascara adds volume, and Colour Riche Lipstick has a shade for every mood. Tell me the look you want and I will suggest shades!";
  }
  if (q.includes("hello") || q.includes("hi") || q === "hey") {
    return "👋 Hello! I am your L'Oréal Paris advisor. Ask me about skincare routines, makeup, haircare, or fragrances — for example, what is the difference between a serum and a treatment product?";
  }
  if (
    q.includes("weather") || q.includes("football") || q.includes("soccer") ||
    q.includes("politics") || q.includes("stock") || q.includes("homework") ||
    q.includes("math") || q.includes("movie") || q.includes("recipe")
  ) {
    return "Sorry, I can only help with L'Oréal products, beauty routines, and recommendations. 😊 Ask me about skincare, makeup, haircare, or fragrance — for example, what is the best routine for dry skin?";
  }
  return "Thanks for asking! I can help with L'Oréal makeup, skincare, haircare, and fragrances — try asking for a routine, a product recommendation, or the difference between two products. 💄";
}

/* ---------- Live AI call through the Cloudflare Worker ---------- */
async function askWorker() {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    throw new Error("Worker error: " + response.status);
  }
  const data = await response.json();
  const content = data && data.choices && data.choices[0] &&
    data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    throw new Error("Empty reply from the AI.");
  }
  return content;
}

/* ---------- Submit ---------- */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // LevelUp: show the user's latest question above the response.
  currentQuestion.textContent = "You asked: “" + text + "”";
  currentQuestion.hidden = false;

  addBubble(text, "user");
  messages.push({ role: "user", content: text });
  userInput.value = "";
  userInput.focus();
  sendBtn.disabled = true;

  const typing = showTyping();
  try {
    let reply;
    if (WORKER_URL) {
      reply = await askWorker();
      demoNote.hidden = true;
    } else {
      // Small delay so the demo feels like a real reply.
      await new Promise((r) => setTimeout(r, 600));
      reply = demoReply(text);
      demoNote.hidden = false;
    }
    typing.remove();
    messages.push({ role: "assistant", content: reply });
    addBubble(reply, "ai");
  } catch (err) {
    typing.remove();
    addBubble(
      "Sorry, I could not reach the beauty advisor just now. Please check your connection and try again. 💄",
      "ai"
    );
  } finally {
    sendBtn.disabled = false;
  }
});

/* ---------- Suggestion chips ---------- */
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    userInput.value = chip.textContent.trim();
    chatForm.requestSubmit();
  });
});

/* ---------- Welcome message ---------- */
addBubble(
  "👋 Hello! I'm your L'Oréal Paris Smart Routine & Product Advisor. Ask me about skincare routines, makeup, haircare, or fragrances — or tap a suggestion below to start!",
  "ai"
);
