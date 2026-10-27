// Recherche dans le glossaire (ignore accents et majuscules)
const search = document.querySelector("[data-search]");
const entries = [...document.querySelectorAll("[data-gloss] > div")];
const empty = document.querySelector("[data-empty]");
const plain = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

search?.addEventListener("input", () => {
  const q = plain(search.value.trim());
  let shown = 0;
  for (const e of entries) {
    const hit = !q || plain(e.textContent).includes(q);
    e.hidden = !hit;
    if (hit) shown++;
  }
  empty.hidden = shown > 0;
});

// Solana en direct : chiffres publics du réseau via PublicNode
const RPC = "https://solana-rpc.publicnode.com";
const live = document.querySelector(".live");
const tpsEl = document.querySelector("[data-tps]");
const slotEl = document.querySelector("[data-slot]");
const noteEl = document.querySelector("[data-live-note]");
const fr = new Intl.NumberFormat("fr-FR");

async function rpc(method, params = []) {
  const r = await fetch(RPC, {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!r.ok) throw new Error("RPC");
  const j = await r.json();
  if (!j.result) throw new Error(j.error?.message || "RPC");
  return j.result;
}

function offline() {
  live.classList.add("is-off");
  noteEl.textContent = "Chiffres en direct indisponibles pour le moment.";
}

async function refreshTps() {
  try {
    const [s] = await rpc("getRecentPerformanceSamples", [1]);
    tpsEl.textContent = fr.format(Math.round(s.numTransactions / s.samplePeriodSecs));
  } catch { offline(); }
}

async function refreshSlot() {
  try {
    slotEl.textContent = fr.format(await rpc("getSlot"));
    live.classList.remove("is-off");
  } catch { offline(); }
}

if (live) {
  refreshTps();
  refreshSlot();
  setInterval(refreshTps, 30000);
  setInterval(() => document.hidden || refreshSlot(), 12000);
}
