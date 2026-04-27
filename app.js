const prototypes = [
  {
    title: "錯過",
    description: "A Reigns-like narrative prototype about choices, silence, and the paths that remain.",
    href: "./prototypes/missed/index.html",
    cover: "./prototypes/missed/cover.svg",
    tags: ["Game", "Narrative", "Cards"],
    addedAt: "2026-04-27",
  },
  {
    title: "Dependency",
    description:
      "A Vampire Survivors-like arena prototype with automatic shooting, simple shapes, and endless pressure.",
    href: "./prototypes/dependency/index.html?play=1",
    cover: "./prototypes/dependency/cover.svg",
    tags: ["Game", "Canvas", "Survival"],
    addedAt: "2026-04-27",
  },
  {
    title: "Snake",
    description: "A standard Snake game with keyboard controls, scoring, pause, and restart.",
    href: "./prototypes/snake/index.html?play=1",
    cover: "./prototypes/snake/cover.svg",
    tags: ["Game", "Canvas", "Practice"],
    addedAt: "2026-04-26",
  },
];

const latestContainer = document.querySelector("#latest-prototype");
const grid = document.querySelector("#prototype-grid");
const sortedPrototypes = [...prototypes].sort(
  (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
);

renderLatest(sortedPrototypes[0]);
renderGrid(sortedPrototypes);

function renderLatest(item) {
  if (!item) {
    latestContainer.textContent = "No prototypes yet.";
    return;
  }

  latestContainer.append(createLatestCard(item));
}

function renderGrid(items) {
  grid.replaceChildren(...items.map(createGridCard));
}

function createLatestCard(item) {
  const card = document.createElement("article");
  card.className = "latest-card";
  card.innerHTML = `
    ${createCoverMarkup(item)}
    <div class="prototype-info">
      <h3>${escapeHtml(item.title)}</h3>
      <ul class="tag-row">${createTagsMarkup(item.tags)}</ul>
      <p>${escapeHtml(item.description)}</p>
      <a class="play-link" href="${item.href}">Play prototype</a>
    </div>
  `;

  return card;
}

function createGridCard(item) {
  const card = document.createElement("article");
  card.className = "prototype-card";
  card.innerHTML = `
    ${createCoverMarkup(item)}
    <h3>${escapeHtml(item.title)}</h3>
    <ul class="tag-row">${createTagsMarkup(item.tags)}</ul>
    <p>${escapeHtml(item.description)}</p>
  `;

  return card;
}

function createCoverMarkup(item) {
  return `
    <a class="cover-link" href="${item.href}" aria-label="Play ${escapeHtml(item.title)}">
      <img src="${item.cover}" alt="${escapeHtml(item.title)} cover" />
    </a>
  `;
}

function createTagsMarkup(tags) {
  return tags.map((tag) => `<li>#${escapeHtml(tag)}</li>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return replacements[character];
  });
}
