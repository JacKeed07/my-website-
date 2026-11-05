// NASA Space Explorer App
// Uses NASA's Astronomy Picture of the Day (APOD) API.

// NASA's free demo key. It works for this project, but it has low rate
// limits. You can get your own free key at https://api.nasa.gov and
// paste it here instead.
const API_KEY = "DEMO_KEY";
const APOD_URL = "https://api.nasa.gov/planetary/apod";

// API Ninjas key for the Space Fact of the Day. Get a free key at
// https://api.api-ninjas.com and paste it here. If no key is set, the
// app falls back to the built-in space facts below so a fact still shows.
const FACT_API_KEY = "";
const FACT_URL = "https://api.api-ninjas.com/v1/facts?limit=1";

// Built-in space facts, used when the Fact API has no key or fails.
const SPACE_FACTS = [
  "A day on Venus is longer than a year on Venus.",
  "Neutron stars are so dense that a teaspoon of one would weigh about a billion tons.",
  "There are more stars in the universe than grains of sand on all the beaches on Earth.",
  "Saturn would float in water because its average density is lower than water.",
  "The footprints left by Apollo astronauts on the Moon will likely last 100 million years.",
  "Jupiter's Great Red Spot is a storm bigger than Earth that has lasted for hundreds of years.",
  "A single solar flare can release as much energy as billions of atomic bombs.",
  "The Sun makes up about 99.86% of all the mass in our solar system."
];

const datePicker = document.getElementById("date-picker");
const exploreBtn = document.getElementById("explore-btn");
const gallery = document.getElementById("gallery");
const loading = document.getElementById("loading");
const modal = document.getElementById("space-modal");
const modalImage = document.getElementById("modal-image");
const modalVideoLink = document.getElementById("modal-video-link");
const modalTitle = document.getElementById("modal-title");
const modalDate = document.getElementById("modal-date");
const modalExplanation = document.getElementById("modal-explanation");
const closeModalBtn = document.getElementById("close-modal");

// Format a Date as YYYY-MM-DD for the API.
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// Add days to a date and return a new Date.
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Fetch APOD data for the selected start date and the next 8 days (9 days).
async function fetchGallery(startDate) {
  const start = formatDate(startDate);
  const today = new Date();
  // APOD has no future pictures, so stop at today.
  let end = addDays(startDate, 8);
  if (end > today) {
    end = today;
  }

  // Show the loading message while fetching.
  loading.hidden = false;
  gallery.innerHTML = "";

  try {
    const response = await fetch(
      `${APOD_URL}?api_key=${API_KEY}&start_date=${start}&end_date=${formatDate(end)}`
    );
    const data = await response.json();
    const items = Array.isArray(data) ? data : [data];
    items.forEach((item) => {
      gallery.appendChild(createGalleryItem(item));
    });
  } catch (error) {
    gallery.innerHTML = "<p>Something went wrong while loading the pictures. Please try again.</p>";
    console.error(error);
  } finally {
    // Remove the loading message once all items are fetched.
    loading.hidden = true;
  }
}

// Build one gallery card: image (or video), title, and date.
function createGalleryItem(item) {
  const card = document.createElement("div");
  card.className = "gallery-item";

  if (item.media_type === "video") {
    // APOD video entry: embed the video.
    const video = document.createElement("iframe");
    video.src = item.url;
    video.title = item.title;
    video.allowFullscreen = true;
    card.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.title;
    card.appendChild(img);
  }

  const title = document.createElement("h3");
  title.textContent = item.title;
  card.appendChild(title);

  const date = document.createElement("p");
  date.textContent = item.date;
  card.appendChild(date);

  // Clicking a gallery item opens the modal.
  card.addEventListener("click", () => openModal(item));
  return card;
}

// Open the modal with the full-size image, title, date, and explanation.
function openModal(item) {
  modalTitle.textContent = item.title;
  modalDate.textContent = item.date;
  modalExplanation.textContent = item.explanation;

  if (item.media_type === "video") {
    modalImage.hidden = true;
    modalVideoLink.hidden = false;
    modalVideoLink.href = item.url;
    modalVideoLink.textContent = "Watch the video";
  } else {
    modalImage.hidden = false;
    modalVideoLink.hidden = true;
    modalImage.src = item.url;
    modalImage.alt = item.title;
  }

  modal.style.display = "block";
}

// Close the modal.
function closeModal() {
  modal.style.display = "none";
}

closeModalBtn.addEventListener("click", closeModal);

// Close the modal when the user clicks outside of it.
window.addEventListener("click", (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// Explore button: fetch 9 days of APOD starting from the picked date.
exploreBtn.addEventListener("click", () => {
  const picked = datePicker.value;
  if (!picked) {
    alert("Please pick a start date first.");
    return;
  }
  fetchGallery(new Date(picked + "T00:00:00"));
});

// Space Fact of the Day (LevelUp): fetch a random fact and show it.
async function getSpaceFact() {
  const factBox = document.getElementById("fact");
  try {
    if (!FACT_API_KEY) {
      throw new Error("No Fact API key set");
    }
    const response = await fetch(FACT_URL, {
      headers: { "X-Api-Key": FACT_API_KEY }
    });
    const data = await response.json();
    const fact = data[0] && data[0].fact;
    if (!fact) {
      throw new Error("No fact returned");
    }
    factBox.textContent = "Did You Know? " + fact;
  } catch (error) {
    // Fallback: pick a built-in space fact so one always shows.
    const fact = SPACE_FACTS[Math.floor(Math.random() * SPACE_FACTS.length)];
    factBox.textContent = "Did You Know? " + fact;
  }
}

// Load the gallery for the last 9 days when the page first opens.
const defaultStart = addDays(new Date(), -8);
datePicker.value = formatDate(defaultStart);
datePicker.max = formatDate(new Date());
getSpaceFact();
fetchGallery(defaultStart);
