// Filtres par catégorie et recherche dans le dApp Store en français
const chips = [...document.querySelectorAll("[data-filter]")];
const cats = [...document.querySelectorAll("[data-cat]")];
const search = document.querySelector("[data-app-search]");
const empty = document.querySelector("[data-app-empty]");
const plain = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
let filtre = "";

function apply() {
  const q = plain(search.value.trim());
  let shown = 0;
  for (const cat of cats) {
    let inCat = 0;
    for (const card of cat.querySelectorAll(".card")) {
      const hit = (!filtre || cat.dataset.cat === filtre) && (!q || plain(card.textContent).includes(q));
      card.hidden = !hit;
      if (hit) inCat++;
    }
    cat.hidden = inCat === 0;
    shown += inCat;
  }
  empty.hidden = shown > 0;
}

for (const chip of chips) {
  chip.addEventListener("click", () => {
    filtre = chip.dataset.filter;
    for (const c of chips) c.classList.toggle("is-on", c === chip);
    for (const c of chips) c.setAttribute("aria-pressed", String(c === chip));
    apply();
  });
}
search.addEventListener("input", apply);
