// Détecteur d'arnaque : tout se passe dans le navigateur, rien n'est envoyé.
// Testé par outils/test_detecteur.js (node outils/test_detecteur.js).

const plain = (s) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[’‘`´]/g, "'").replace(/\s+/g, " ");

// Sites officiels : seuls ces domaines (et leurs sous-domaines) ne sont pas signalés.
const OFFICIELS = ["solanamobile.com", "solana.com", "solana.org", "solanafoundation.org", "solanachetis.github.io"];
const RACCOURCIS = ["bit.ly", "tinyurl.com", "cutt.ly", "t.co", "rb.gy", "is.gd", "shorturl.at", "linktr.ee", "ow.ly", "buff.ly", "rebrand.ly", "t.ly", "s.id", "goo.gl", "tiny.cc", "lnkd.in"];
const TLD_RISQUE = ["xyz", "top", "click", "site", "online", "icu", "shop", "live", "cc", "tk", "ml", "ga", "cf", "gq", "pw", "buzz", "rest", "lol", "monster", "cyou", "sbs", "cfd", "bond", "fun", "vip", "win", "pro", "info", "biz", "app", "link", "claims", "network", "finance", "dev"];
// Pour reconnaître une adresse écrite sans « https:// »
const TLD_CONNUS = ["com", "net", "org", "io", "fr", "eu", "be", "ch", "ca", "co", "me", "gg", "so", "to", "ai", "us", "uk", "de", "ly", "gl", "ee", "id", "in", "gd", "at", ...TLD_RISQUE];
// Noms qu'imitent les faux sites
const MARQUES = ["solana", "solanamobile", "seeker", "seedvault", "phantom", "solflare", "jupiter", "jup", "backpack", "magiceden", "tensor", "raydium", "orca", "skr", "saga"];

// poids : 3 = très grave, 2 = grave, 1 = à surveiller
const REGLES = [
  { w: 3, re: /(phrase (de |de la )?(recuperation|secrete|recup|de passe)|seed ?phrase|seed words|(votre|ta|your|my|ma) seed\b|recovery (phrase|words|key)|secret (phrase|recovery|words)|passphrase|cle(s)? privee|private key|(12|24|douze|vingt[- ]quatre|twelve|twenty[- ]four) (mots|words)|mnemonic|mots? secrets?)/,
    titre: "On vous parle de vos 24 mots ou de votre clé privée",
    aide: "Personne de sérieux ne les demande, jamais : ni Solana Mobile, ni un support, ni une app, ni un site. Quiconque les a peut vider votre portefeuille." },
  { w: 3, re: /(anydesk|teamviewer|rustdesk|airdroid|quicksupport|quick support|partage (de |d')?ecran|partag(er|ez) (votre |ton )?ecran|prise en main|controle a distance|remote (access|control)|screen ?shar)/,
    titre: "On veut prendre la main sur votre téléphone",
    aide: "Un faux support veut voir ou contrôler votre écran pour récupérer vos mots. N'installez rien et ne partagez jamais votre écran." },
  { w: 3, re: /((envoy|send|transf|depos).{0,40}(recev|receive|get back|rend|renv|retourn|double|x2|x ?10)|(recev|receive|get).{0,25}(le double|double|twice|2x|x2) )/,
    titre: "On vous promet de renvoyer plus que ce que vous envoyez",
    aide: "« Envoyez 1 SOL, recevez-en 2 » : c'est toujours une arnaque. L'argent envoyé ne revient jamais." },
  { w: 3, re: /((recuper|recover|retrouv).{0,25}(fonds|cryptos?|funds|bitcoins?|argent|sol|wallet|portefeuille).{0,25}(vole|perdu|stolen|lost|hack|pirat|arnaqu|scamm)|fund recovery|hacker ethique|ethical hacker|recovery (agent|expert|service))/,
    titre: "On vous propose de récupérer des cryptos volées ou perdues",
    aide: "Les « services de récupération » sont une deuxième arnaque qui vise les victimes. Personne ne peut annuler une transaction sur Solana." },
  { w: 2, re: /(connect(er|ez|e)? (votre |ton |your )?(wallet|portefeuille)|connect wallet|wallet ?connect|synchronis|sync (your |votre )?wallet|valid(er|ez|ate) (votre |ton |your )?(wallet|portefeuille)|verif(ier|iez|y) (votre |ton |your )?(wallet|portefeuille)|restaur(er|ez) (votre |ton )?(wallet|portefeuille)|restore (your )?wallet|rectif|import(er|ez)? (votre |your )?(wallet|portefeuille)|migr(er|ez|ate|ation).{0,20}(wallet|portefeuille|tokens?|skr))/,
    titre: "On vous pousse à connecter, vérifier ou « synchroniser » votre portefeuille",
    aide: "C'est la méthode classique pour vous faire signer une transaction qui vide le portefeuille. Ne connectez rien depuis un lien reçu." },
  { w: 2, re: /(sign(ez|er|e)? (la |cette |une |the |this )?(transaction|demande|request|message)|approuv(ez|er)|approve|autoris(ez|er) (la |cette )?(transaction|connexion|demande))/,
    titre: "On vous demande de signer ou d'approuver une transaction",
    aide: "Une signature peut autoriser le retrait de vos tokens. Ne signez jamais une demande qui vient d'un message ou d'un lien reçu." },
  { w: 2, re: /(airdrop|reclam(er|ez)|\bclaim|vous avez (gagne|ete (selectionne|choisi|tire))|you('ve| have)? (won|been selected)|winner|gagnant|cadeau|giveaway|gratuit|free (sol|skr|usdc|tokens?|nft|mint|crypto)|tokens? offerts?|distribution gratuite|bonus|whitelist|white list|mint (gratuit|free)|free mint|eligible|allocation|recompense (en attente|non reclamee)|unclaimed)/,
    titre: "Promesse d'airdrop, de cadeau ou de gain surprise",
    aide: "Un vrai projet ne vous écrit pas en privé pour offrir des tokens. Les récompenses du Seeker se réclament uniquement dans l'app officielle, jamais via un lien reçu." },
  { w: 2, re: /(support|service client|assistance|help ?desk|customer (care|service)|equipe (de |du )?(solana|seeker)|solana mobile (team|equipe)|team solana|moderat|\badmin)/,
    titre: "Quelqu'un se présente comme du support ou de l'équipe",
    aide: "Un vrai support ne vous écrit jamais en premier, en privé. Pour le support de Solana Mobile, passez par son site officiel, tapé à la main." },
  { w: 2, re: /(doubl(ez|er|e) (votre|vos|ton|your)|double your|\bx ?(2|3|5|10|20|50|100)\b|rendement (garanti|quotidien|journalier)|gains? garantis?|profits? garantis?|guaranteed|sans (aucun )?risque|risk[- ]?free|no risk|revenu passif|passive income|\d+ ?% (par jour|par semaine|par mois|per day|daily|weekly|a day))/,
    titre: "Promesse de gains garantis ou d'argent multiplié",
    aide: "Aucun placement n'est garanti. Un gain promis « sans risque » ou « garanti » est le signe d'une arnaque." },
  { w: 2, re: /(frais (de |d')?(deblocage|retrait|activation|livraison|dossier|gas|reseau|verification|traitement|douane)|pay(er|ez)? (d'abord|avant|first)|paiement (d'abord|avant|en avance)|envoy(ez|er) (d'abord )?(\d|un |une |des )|send \d|deposit \d|depot (de )?garantie|(fee|fees) to (unlock|withdraw|claim|release)|unlock fee|withdrawal fee)/,
    titre: "On vous demande de payer ou d'envoyer de l'argent d'abord",
    aide: "Demander des frais pour « débloquer » un gain ou une commande est une arnaque classique : l'argent promis n'arrive jamais." },
  { w: 2, re: /(seeker.{0,40}(moins cher|pas cher|cheap|discount|promo|solde|-\s?\d\d ?%|\d\d ?% off|prix casse|presque gratuit|en stock|dispo tout de suite)|(moins cher|pas cher|cheap|promo|solde|discount).{0,40}seeker|revendeur|reseller)/,
    titre: "Un Seeker « moins cher » ou vendu par un revendeur",
    aide: "Commandez uniquement sur la boutique officielle de Solana Mobile. Un Seeker acheté ailleurs n'est pas couvert par la garantie, et beaucoup d'annonces sont des arnaques." },
  { w: 2, re: /(\bkyc\b|verif(ier|iez|iez pas|ication) (de |d')?(votre |ton )?(identite|compte)|verify (your )?(account|identity)|piece d'identite|carte d'identite|passeport|passport|selfie)/,
    titre: "On vous demande de vérifier votre identité ou votre compte",
    aide: "Les faux « contrôles » servent à voler vos papiers ou à vous mener vers un faux site. Un portefeuille Seeker ne demande jamais de pièce d'identité." },
  { w: 2, re: /((trader|coach|mentor|gestionnaire|account manager|expert|conseiller|courtier|broker).{0,30}(crypto|trading|invest|placement)|(crypto|trading|invest).{0,30}(trader|coach|mentor|gestionnaire|account manager|expert|conseiller|broker)|groupe (de )?signaux|signals? (group|channel)|\bpump\b)/,
    titre: "Un « expert » propose de faire fructifier votre argent",
    aide: "Les faux traders et « coachs » vous font déposer de l'argent sur une plateforme qui ne rend jamais rien." },
  { w: 2, re: /(mise a jour (obligatoire|urgente|de securite|necessaire)|(update|upgrade) (required|now|your (wallet|app|seed vault))|nouvelle version (du|de la|de votre) (wallet|portefeuille|seed vault|app)|\.apk\b|installer (cette|l') ?(app|application) (depuis|hors|via)|telecharg(er|ez) (cette|l'|notre|la) ?(app|application|fichier|mise a jour))/,
    titre: "On vous fait installer une app ou une « mise à jour » depuis un lien",
    aide: "Installez vos applis et mises à jour uniquement depuis le dApp Store, le Google Play Store ou les réglages du téléphone. Jamais depuis un lien reçu." },
  { w: 1, re: /(qr ?code|scann(ez|er|e) (ce|le|this))/,
    titre: "On vous demande de scanner un QR code",
    aide: "Un QR code peut cacher un faux site ou une demande de signature. Ne scannez pas un QR code reçu d'un inconnu." },
  { w: 1, re: /(urgent|urgence|immediatement|tout de suite|au plus vite|asap|immediately|dans les? (\d+) ?(h|heures|minutes)|within \d+|derniere chance|last chance|dernier (avertissement|rappel)|final (warning|notice)|expire|sous peine|avant (minuit|ce soir|demain)|compte (sera |va etre |a ete |est )?(suspendu|bloque|restreint|compromis|desactive|ferme|supprime)|account (will be |has been |is )?(suspended|locked|restricted|compromised|disabled|closed)|(wallet|portefeuille) (bloque|compromis|locked|compromised)|agissez vite|act (now|fast)|offre limitee|limited (time|spots|offer)|places limitees)/,
    titre: "Le message vous met la pression",
    aide: "L'urgence sert à vous empêcher de réfléchir. Un vrai projet ne vous presse jamais : prenez le temps de vérifier." },
  { w: 1, re: /(message prive|\bmp\b|\bdm\b|en prive|ecri(s|vez)[- ]moi|contact(e|ez)[- ]moi|contact me|text me|write me|message me|telegram|whatsapp|discord|\bsignal\b|t\.me\/)/,
    titre: "On vous emmène vers une conversation privée",
    aide: "Les arnaqueurs passent en privé pour que personne ne les contredise. Méfiez-vous des contacts qui arrivent sans que vous les ayez demandés." },
];

// Adresse Solana (32 à 44 caractères en base58)
const ADRESSE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,10}(?:\/[^\s<>"']*)?)/gi;

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function estOfficiel(host) {
  return OFFICIELS.some((o) => host === o || host.endsWith("." + o));
}

function imiteMarque(host) {
  if (/(^|\.)xn--/.test(host)) return true; // lettres étrangères déguisées
  const etiquettes = host.split(".").slice(0, -1).join("-").replace(/[0-9]/g, (c) => ({ 0: "o", 1: "l", 3: "e", 5: "s" }[c] || c));
  const morceaux = [etiquettes.replace(/-/g, ""), ...etiquettes.split("-")];
  return MARQUES.some((m) => morceaux.some((x) => x.includes(m) || (m.length >= 6 && x.length >= 5 && distance(x, m) <= 2)));
}

function analyserLiens(texte) {
  const trouves = [];
  const vus = new Set();
  for (const m of texte.matchAll(URL_RE)) {
    const brut = m[1].replace(/[),.;:!?»"]+$/, "");
    const avecProto = /^https?:\/\//i.test(brut);
    let host;
    try { host = new URL(avecProto ? brut : "https://" + brut).hostname.toLowerCase(); } catch { continue; }
    if (!host.includes(".") || vus.has(host)) continue;
    const tld = host.split(".").pop();
    if (!avecProto && !/^www\./i.test(brut) && !TLD_CONNUS.includes(tld)) continue; // « M.Dupont », « etc.» : pas des liens
    vus.add(host);
    if (estOfficiel(host)) continue;
    const base = host.split(".").slice(-2).join(".");
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      trouves.push({ w: 2, titre: "Lien vers une adresse chiffrée : « " + host + " »", aide: "Un vrai site n'utilise pas une suite de chiffres comme adresse. N'ouvrez pas." });
    } else if (RACCOURCIS.includes(base) || RACCOURCIS.includes(host)) {
      trouves.push({ w: 2, titre: "Lien raccourci : « " + host + " »", aide: "Un lien raccourci cache la vraie destination. N'ouvrez pas." });
    } else if (imiteMarque(host)) {
      trouves.push({ w: 3, titre: "Adresse qui imite une marque : « " + host + " »", aide: "Ce n'est pas un site officiel de Solana Mobile ni de Solana. Les faux sites copient le nom d'un vrai projet, parfois à une lettre près." });
    } else if (TLD_RISQUE.includes(tld)) {
      trouves.push({ w: 2, titre: "Adresse peu fiable : « " + host + " »", aide: "Ce type d'adresse est très utilisé par des sites jetables. N'ouvrez pas un lien reçu en message." });
    } else {
      trouves.push({ w: 1, titre: "Lien vers un site inconnu : « " + host + " »", aide: "Nous ne pouvons pas savoir si ce site est fiable. Ne l'ouvrez pas depuis un message reçu : tapez vous-même l'adresse du site officiel." });
    }
  }
  return trouves;
}

// La personne a-t-elle collé sa propre phrase de récupération ?
function ressembleAPhrase(texte) {
  const mots = texte.trim().toLowerCase().split(/[\s,;.\-]+/).map((m) => m.replace(/^\d+[.)]?/, "")).filter(Boolean);
  if (![12, 15, 18, 21, 24].includes(mots.length)) return false;
  return mots.every((m) => /^[a-z]{3,8}$/.test(m));
}

function analyser(texte) {
  if (ressembleAPhrase(texte)) return { niveau: "seed", signaux: [] };
  const t = plain(texte);
  const signaux = [];
  for (const r of REGLES) if (r.re.test(t)) signaux.push({ w: r.w, titre: r.titre, aide: r.aide });
  if (ADRESSE.test(texte) && /(envoy|send|transf|depos|virement|paye)/.test(t))
    signaux.push({ w: 2, titre: "On vous demande d'envoyer des fonds à une adresse", aide: "Une transaction sur Solana ne s'annule pas. N'envoyez jamais de crypto à une adresse reçue d'un inconnu." });
  signaux.push(...analyserLiens(texte));
  const score = signaux.reduce((s, x) => s + x.w, 0);
  let niveau = "ok";
  if (signaux.some((x) => x.w === 3) || score >= 5) niveau = "high";
  else if (signaux.some((x) => x.w === 2) || score >= 2) niveau = "mid";
  else if (score >= 1) niveau = "low";
  return { signaux: signaux.sort((a, b) => b.w - a.w), niveau };
}

if (typeof module !== "undefined") module.exports = { analyser };

const TEXTES = {
  seed: ["Stop : on dirait une phrase de récupération", "Si ce sont vos vrais mots, ne les collez nulle part, même ici. Nous avons effacé le texte. Si vous les avez déjà donnés à quelqu'un ou collés sur un site, déplacez vos fonds vers un nouveau portefeuille au plus vite."],
  high: ["Très suspect", "Ne répondez pas, ne cliquez sur rien, ne signez rien. Ce message contient des signaux typiques d'arnaque."],
  mid: ["À éviter", "Ce message contient au moins un signal d'arnaque. Ne cliquez pas et vérifiez par le site officiel, tapé à la main."],
  low: ["À surveiller", "Un signal faible. Ce n'est pas forcément une arnaque, mais vérifiez avant d'agir."],
  ok: ["Aucun signal connu", "Attention : notre outil ne repère que les arnaques courantes, et les arnaqueurs inventent sans cesse de nouvelles formules. Les règles restent les mêmes : ne donnez jamais vos 24 mots, ne signez rien que vous ne comprenez pas, et méfiez-vous de tout contact que vous n'avez pas demandé."],
};

const root = typeof document !== "undefined" && document.querySelector("[data-detect]");
if (root) {
  const input = root.querySelector("[data-detect-input]");
  const out = root.querySelector("[data-detect-out]");

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function afficher({ signaux, niveau }) {
    const [titre, texte] = TEXTES[niveau];
    const liste = signaux.map((s) => `<li><strong>${esc(s.titre)}</strong><span>${esc(s.aide)}</span></li>`).join("");
    const suite = niveau === "ok" ? "" : `<p class="verdict-next">Vous avez déjà cliqué, signé ou donné vos mots&nbsp;? <a class="link" href="securite.html#perdu">Voir quoi faire tout de suite</a>.</p>`;
    out.className = "verdict verdict-" + (niveau === "seed" ? "high" : niveau);
    out.innerHTML = `<p class="verdict-title">${titre}</p><p class="verdict-text">${texte}</p>${liste ? `<ul class="signals">${liste}</ul>` : ""}${suite}`;
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function lancer() {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    const r = analyser(v);
    if (r.niveau === "seed") input.value = "";
    afficher(r);
  }

  const EXEMPLES = [
    "Bonjour, ici le support Solana Mobile. Votre compte est suspendu, c'est urgent. Pour le débloquer, envoyez-nous votre phrase de récupération de 24 mots en message privé.",
    "AIRDROP SKR pour les détenteurs de Seeker ! Vous avez gagné 5 000 SKR. Réclamez maintenant sur https://skr-claim.xyz avant minuit, connectez votre wallet pour valider.",
    "Seeker neuf à -50 % chez un revendeur, livraison rapide ! Écrivez-moi en MP sur Telegram, paiement d'abord en USDC. Offre limitée, dernière chance.",
  ];

  root.querySelector("[data-detect-go]").addEventListener("click", lancer);
  root.querySelector("[data-detect-clear]").addEventListener("click", () => {
    input.value = ""; out.hidden = true; input.focus();
  });
  root.querySelectorAll("[data-ex]").forEach((b) =>
    b.addEventListener("click", () => { input.value = EXEMPLES[+b.dataset.ex]; lancer(); })
  );
}
