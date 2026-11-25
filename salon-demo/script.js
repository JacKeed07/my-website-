// Lumen Hair Studio (fictional demo salon) — AI receptionist
// Cloned from Jack's L'Oréal chatbot (Course 11062 Project 8), rebranded
// 2026-11-25 for the passive-income / AI-automation sketch.
// Demo mode: WORKER_URL is empty, so it answers from the built-in price
// list below. No token in this file. For a paying client, point WORKER_URL
// at that client's Cloudflare Worker (Groq, free tier) and swap the
// SYSTEM_PROMPT / price list for the real salon's FAQ.

/* ---------- Configuration ---------- */
const WORKER_URL = "";

/* ---------- System prompt (sent with every request, live mode) ---------- */
const SYSTEM_PROMPT = [
  "You are the AI receptionist for Lumen Hair Studio, a hair salon on",
  "South Congress in Austin, Texas. Answer only about the salon: services,",
  "prices, hours, walk-ins, and booking.",
  "Prices: women's cut $68, men's cut $38, blowout $45, balayage from $185,",
  "full color from $95, highlights from $120, deep conditioning $35.",
  "Hours: Tue-Fri 10am-7pm, Sat 9am-6pm, Sun 11am-5pm, Mon closed.",
  "Walk-ins welcome Tue-Thu; appointments recommended Fri-Sat.",
  "If a question is unrelated to the salon, politely refuse and steer back",
  "to services, prices, hours, or booking. Keep answers short and friendly.",
  "If someone wants to book, ask for their name, phone, service, and",
  "preferred day, and point them to the booking form on the page.",
].join(" ");

/* ---------- DOM elements ---------- */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const currentQuestion = document.getElementById("currentQuestion");
const demoNote = document.getElementById("demoNote");
const sendBtn = document.getElementById("sendBtn");
const leadForm = document.getElementById("leadForm");
const leadConfirm = document.getElementById("leadConfirm");

/* ---------- Conversation history ---------- */
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

/* ---------- Demo fallback (used while WORKER_URL is not set) ---------- */
function demoReply(question) {
  const q = question.toLowerCase();
  if (q.includes("balayage")) {
    return "✨ Balayage starts at $185, depending on length and how much lightness you want. It usually takes 2–3 hours. Want me to book you in? Tell me your name, phone, and preferred day — or use the booking form below.";
  }
  if (q.includes("walk-in") || q.includes("walk in")) {
    return "Yes — walk-ins are welcome Tue–Thu. Fri and Sat fill up fast, so an appointment is best then. Want to book a time instead?";
  }
  if (q.includes("hour") || q.includes("open") || q.includes("close")) {
    return "We're open Tue–Fri 10am–7pm, Sat 9am–6pm, Sun 11am–5pm, and closed Mondays. 🕙";
  }
  if (q.includes("book") || q.includes("appointment") || q.includes("reserve")) {
    return "Happy to help you book! Tell me your name, phone, which service you want, and your preferred day — or fill in the booking form below and we'll confirm by text. 📅";
  }
  if (q.includes("price") || q.includes("cost") || q.includes("how much") || q.includes("cut")) {
    return "Here's the list: women's cut $68, men's cut $38, blowout $45, balayage from $185, full color from $95, highlights from $120, deep conditioning $35. Which one are you thinking of?";
  }
  if (q.includes("color") || q.includes("colour") || q.includes("highlight")) {
    return "For color: full color from $95, highlights from $120, balayage from $185. A quick consult at the salon is free if you're not sure which fits your hair. What are you going for?";
  }
  if (q.includes("where") || q.includes("location") || q.includes("address") || q.includes("park")) {
    return "We're on South Congress in Austin. Street parking is nearby, and we're a short walk from the bus stop. Want hours or booking help too?";
  }
  if (q.includes("hello") || q.includes("hi") || q === "hey") {
    return "👋 Hi! Welcome to Lumen Hair Studio. Ask me about prices, hours, walk-ins, or booking — for example, how much is a balayage?";
  }
  if (
    q.includes("weather") || q.includes("football") || q.includes("soccer") ||
    q.includes("politics") || q.includes("stock") || q.includes("homework") ||
    q.includes("math") || q.includes("movie") || q.includes("recipe")
  ) {
    return "Sorry, I can only help with Lumen Hair Studio — services, prices, hours, and booking. 😊 What would you like to know about the salon?";
  }
  return "Thanks for asking! I can help with Lumen's services, prices, hours, walk-ins, and booking — try asking how much a balayage is, or what our hours are. ✂️";
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
      "Sorry, I could not reach the salon just now. Please check your connection and try again. ✂️",
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

/* ---------- Lead form (demo: stays in the browser, nothing is sent) ---------- */
leadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("leadName").value.trim();
  const phone = document.getElementById("leadPhone").value.trim();
  const service = document.getElementById("leadService").value;
  const day = document.getElementById("leadDay").value.trim();
  leadConfirm.textContent =
    "Thanks, " + name + "! Your request for " + service + " on " + day +
    " is noted (demo — nothing was sent). In the live version the salon would text " +
    phone + " to confirm.";
  leadConfirm.hidden = false;
  addBubble(
    "Booking request noted: " + name + " — " + service + ", " + day +
    ". The salon will text " + phone + " to confirm.",
    "ai"
  );
  leadForm.reset();
});

/* ---------- Welcome message ---------- */
addBubble(
  "👋 Hi! I'm Lumen's AI receptionist. Ask me about prices, hours, walk-ins, or booking — or tap a suggestion below to start!",
  "ai"
);
