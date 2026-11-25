// L'Oréal Paris — Smart Routine Builder
// Frontend logic. No API key is in this file: the browser only talks to
// the Cloudflare Worker, which holds the key as a secret and forwards
// requests to the AI model (Llama 3.1 via Groq).
// While the Worker is not deployed yet, the page still works: it builds
// routines and answers from the selected products' own data (demo mode).

/* ---------- Configuration ---------- */
// Planned Cloudflare Worker URL (not deployed yet).
const WORKER_URL = "https://loreal-routine.jack-wangzf.workers.dev";

// Key for saving selected products in the browser.
const STORAGE_KEY = "loreal-routine-selected";

/* ---------- System prompt (sent with every request) ---------- */
const SYSTEM_PROMPT = [
  "You are the L'Oréal Paris Routine Builder, a friendly beauty expert.",
  "Build a personalized routine using ONLY the products the user selected.",
  "Order the steps in a logical way: cleanse first, then treat (serum or",
  "treatment), then moisturize, then protect with sunscreen in the morning.",
  "Haircare, hair color, and makeup steps go after the skincare steps.",
  "Keep answers short and friendly. Name the specific products and say why",
  "each one fits the user's routine.",
  "Only answer questions about L'Oréal products, beauty routines, and",
  "product recommendations. If a question is unrelated to beauty, politely",
  "refuse and steer the user back to products and routines.",
  "If the user shares their name, skin type, hair type, or preferences,",
  "remember them and use them in later answers.",
].join(" ");

/* ---------- DOM elements ---------- */
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const noResults = document.getElementById("noResults");
const selectedList = document.getElementById("selectedProductsList");
const selectedEmpty = document.getElementById("selectedEmpty");
const clearSelectedBtn = document.getElementById("clearSelected");
const generateBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const currentQuestion = document.getElementById("currentQuestion");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const demoNote = document.getElementById("demoNote");
const rtlToggle = document.getElementById("rtlToggle");

/* ---------- App state ---------- */
// All products, loaded from products.json.
let allProducts = [];
// Ids of the products the user selected.
let selectedIds = [];
// Full conversation history. The system prompt stays first, and every
// request sends this whole array so the AI remembers the conversation.
const messages = [{ role: "system", content: SYSTEM_PROMPT }];

/* ---------- Helpers ---------- */
// Escape text before putting it into HTML, so product names with
// characters like ' or & display safely.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Short version of a description: just the first sentence.
function firstSentence(text) {
  const sentence = String(text).split(". ")[0];
  return sentence.endsWith(".") ? sentence : sentence + ".";
}

// Find a product by its id.
function findProduct(id) {
  return allProducts.find((p) => p.id === id);
}

// The products the user selected, in the order they appear in the catalog.
function selectedProducts() {
  return allProducts.filter((p) => selectedIds.includes(p.id));
}

/* ---------- Chat bubbles ---------- */
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

/* ---------- Load products ---------- */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
}

/* ---------- Product grid ---------- */
// Show the products that match the search text AND the category filter.
function getFilteredProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  return allProducts.filter((product) => {
    const matchesCategory =
      category === "all" || product.category === category;
    const matchesSearch =
      query === "" ||
      product.name.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
}

function renderProducts() {
  const products = getFilteredProducts();
  noResults.hidden = products.length > 0;
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedIds.includes(product.id);
      return `
      <article class="product-card${isSelected ? " selected" : ""}" data-id="${product.id}">
        <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <p class="product-brand">${escapeHtml(product.brand)}</p>
        <p class="product-category">${escapeHtml(product.category)}</p>
        <p class="product-desc" hidden>${escapeHtml(product.description)}</p>
        <button type="button" class="desc-toggle" aria-expanded="false">Show description</button>
        <button type="button" class="select-btn${isSelected ? " selected" : ""}">
          ${isSelected ? "Selected ✓" : "Select"}
        </button>
      </article>`;
    })
    .join("");
}

// Search and category filter: re-render the grid on every change,
// so the two filters always work together in real time.
searchInput.addEventListener("input", renderProducts);
categoryFilter.addEventListener("change", renderProducts);

// One click handler for the whole grid: description toggles and Select.
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.dataset.id);

  if (e.target.classList.contains("desc-toggle")) {
    const desc = card.querySelector(".product-desc");
    const isHidden = desc.hidden;
    desc.hidden = !isHidden;
    e.target.textContent = isHidden ? "Hide description" : "Show description";
    e.target.setAttribute("aria-expanded", String(isHidden));
    return;
  }

  if (e.target.classList.contains("select-btn")) {
    toggleSelect(id);
  }
});

/* ---------- Selection + localStorage ---------- */
// Save the selected ids so they survive a page reload.
function saveSelection() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
}

// Load the saved ids when the page opens. Ids that no longer exist
// in products.json are dropped.
function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
      selectedIds = saved.filter((id) => findProduct(id));
    }
  } catch (err) {
    selectedIds = [];
  }
}

function toggleSelect(id) {
  if (selectedIds.includes(id)) {
    selectedIds = selectedIds.filter((savedId) => savedId !== id);
  } else {
    selectedIds.push(id);
  }
  saveSelection();
  renderProducts();
  renderSelected();
}

// Show the selected products above the Generate Routine button.
function renderSelected() {
  const products = selectedProducts();
  selectedEmpty.hidden = products.length > 0;
  clearSelectedBtn.style.display = products.length > 0 ? "" : "none";
  selectedList.innerHTML = products
    .map(
      (product) => `
      <li>
        <span>${escapeHtml(product.name)} — ${escapeHtml(product.brand)}</span>
        <button type="button" class="remove-btn" data-id="${product.id}">Remove</button>
      </li>`
    )
    .join("");
}

// Remove one product from the selected list.
selectedList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-btn")) return;
  const id = Number(e.target.dataset.id);
  selectedIds = selectedIds.filter((savedId) => savedId !== id);
  saveSelection();
  renderProducts();
  renderSelected();
});

// Clear all selected products.
clearSelectedBtn.addEventListener("click", () => {
  selectedIds = [];
  saveSelection();
  renderProducts();
  renderSelected();
});

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
  const content =
    data && data.choices && data.choices[0] &&
    data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    throw new Error("Empty reply from the AI.");
  }
  return content;
}

/* ---------- Demo fallback (used while the Worker is not deployed) ---------- */
// Routine step order: cleanse, treat, moisturize, protect, then hair/makeup.
const ROUTINE_ORDER = {
  cleanser: 0,
  skincare: 1,
  moisturizer: 2,
  suncare: 3,
  haircare: 4,
  "hair color": 5,
  "hair styling": 6,
  makeup: 7,
  fragrance: 8,
  "men's grooming": 9,
};

// Build a routine from the selected products' own data — no AI needed.
function buildDemoRoutine(products) {
  const ordered = [...products].sort(
    (a, b) => ROUTINE_ORDER[a.category] - ROUTINE_ORDER[b.category]
  );
  const steps = ordered.map((product, index) => {
    return `${index + 1}. ${product.name} (${product.brand}): ${firstSentence(product.description)}`;
  });
  return [
    "Here is a routine made from your selected products.",
    "(Demo version — the live AI is not connected yet, so I built this from the products you picked.)",
    "",
    ...steps,
    "",
    "Use the sunscreen step in the morning. Ask me if you want to change the order or add a step.",
  ].join("\n");
}

// Words that mean the question is not about beauty.
const OFF_TOPIC_WORDS = [
  "weather", "football", "soccer", "politics", "stock", "homework",
  "math", "movie", "recipe", "news", "coding", "javascript", "python",
  "president", "election", "bitcoin", "crypto", "sports",
];

function isOffTopic(question) {
  const q = question.toLowerCase();
  return OFF_TOPIC_WORDS.some((word) => q.includes(word));
}

// Demo answer for a follow-up question, using the selected products.
function demoFollowUp(question) {
  const q = question.toLowerCase();

  if (isOffTopic(question)) {
    return "Sorry, I can only help with L'Oréal products, beauty routines, and recommendations. 😊 Ask me about your selected products or your routine — for example, what order should I use my products in?";
  }

  // If the question names a selected product, answer from its description.
  const named = selectedProducts().find((product) =>
    q.includes(product.name.toLowerCase())
  );
  if (named) {
    return `${named.name} (${named.brand}) — ${firstSentence(named.description)} It is in your selected products, so it is part of your routine. Want me to explain where it fits?`;
  }

  // Questions about the routine order or the routine itself.
  if (q.includes("routine") || q.includes("order") || q.includes("step")) {
    const products = selectedProducts();
    if (products.length === 0) {
      return "You have no products selected yet. Pick a few products above, then click Generate Routine and I will build your routine step by step.";
    }
    return buildDemoRoutine(products);
  }

  // Skin concerns: match products whose description mentions the concern.
  const concerns = ["dry", "oily", "sensitive", "acne", "dull"];
  const concern = concerns.find((word) => q.includes(word));
  if (concern) {
    const matches = selectedProducts().filter((product) =>
      product.description.toLowerCase().includes(concern)
    );
    if (matches.length > 0) {
      const names = matches.map((p) => p.name).join(", ");
      return `For ${concern} skin, these products you selected fit well: ${names}. ${firstSentence(matches[0].description)} Want a full routine with them?`;
    }
    return `For ${concern} skin, look at your selected products' descriptions — the ones that mention ${concern} skin are the best fit. Select a few and click Generate Routine.`;
  }

  if (q.includes("hello") || q.includes("hi") || q === "hey") {
    return "👋 Hi! Pick some products above and click Generate Routine, or ask me about your routine — for example, what order should I use my products in?";
  }

  const products = selectedProducts();
  if (products.length > 0) {
    return `I can help with your selected products (${products.map((p) => p.name).join(", ")}) and your routine. Ask me about the order, a specific product, or your skin or hair type. 💄`;
  }
  return "Thanks for asking! Pick some products above, then click Generate Routine — or ask me for a routine idea, and I will help you choose. 💄";
}

/* ---------- Generate Routine ---------- */
generateBtn.addEventListener("click", async () => {
  const products = selectedProducts();
  if (products.length === 0) {
    addBubble(
      "Please select at least one product first — click Select on a product, then click Generate Routine.",
      "ai"
    );
    return;
  }

  // Send the selected products as data, so the AI builds the routine
  // from real product information.
  const productData = products.map((p) => ({
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));
  const requestText =
    "Please build my personal routine using ONLY these selected products: " +
    JSON.stringify(productData);

  currentQuestion.textContent =
    "You asked: Build a routine from my " + products.length + " selected product(s)";
  currentQuestion.hidden = false;

  messages.push({ role: "user", content: requestText });
  generateBtn.disabled = true;
  sendBtn.disabled = true;
  const typing = showTyping();

  try {
    const reply = await askWorker();
    typing.remove();
    demoNote.hidden = true;
    messages.push({ role: "assistant", content: reply });
    addBubble(reply, "ai");
  } catch (err) {
    // The Worker is not deployed yet: build the routine on this page.
    typing.remove();
    const reply = buildDemoRoutine(products);
    demoNote.hidden = false;
    messages.push({ role: "assistant", content: reply });
    addBubble(reply, "ai");
  } finally {
    generateBtn.disabled = false;
    sendBtn.disabled = false;
  }
});

/* ---------- Follow-up chat ---------- */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  // Show the user's latest question above the response.
  currentQuestion.textContent = "You asked: “" + text + "”";
  currentQuestion.hidden = false;

  addBubble(text, "user");
  messages.push({ role: "user", content: text });
  userInput.value = "";
  userInput.focus();
  sendBtn.disabled = true;
  generateBtn.disabled = true;

  const typing = showTyping();
  try {
    const reply = await askWorker();
    typing.remove();
    demoNote.hidden = true;
    messages.push({ role: "assistant", content: reply });
    addBubble(reply, "ai");
  } catch (err) {
    // Demo fallback while the Worker is not deployed.
    await new Promise((r) => setTimeout(r, 600));
    typing.remove();
    const reply = demoFollowUp(text);
    demoNote.hidden = false;
    messages.push({ role: "assistant", content: reply });
    addBubble(reply, "ai");
  } finally {
    sendBtn.disabled = false;
    generateBtn.disabled = false;
  }
});

/* ---------- Suggestion chips ---------- */
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    userInput.value = chip.textContent.trim();
    chatForm.requestSubmit();
  });
});

/* ---------- RTL toggle ---------- */
rtlToggle.addEventListener("click", () => {
  const html = document.documentElement;
  const isRtl = html.getAttribute("dir") === "rtl";
  html.setAttribute("dir", isRtl ? "ltr" : "rtl");
  rtlToggle.textContent = isRtl
    ? "Switch to right-to-left layout"
    : "Switch to left-to-right layout";
});

/* ---------- Start the page ---------- */
(async function start() {
  try {
    await loadProducts();
  } catch (err) {
    productsContainer.innerHTML =
      '<p class="placeholder-message">Sorry, the products could not be loaded. Please check your connection and refresh the page.</p>';
    return;
  }
  loadSelection();
  renderProducts();
  renderSelected();
  addBubble(
    "👋 Hello! I'm your L'Oréal Paris Routine Builder. Pick some products above and click Generate Routine — or ask me about your routine!",
    "ai"
  );
})();
