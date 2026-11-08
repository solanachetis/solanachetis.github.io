// Détecteur d'arnaque : tout se passe dans le navigateur, rien n'est envoyé.
const root = document.querySelector("[data-detect]");
if (root) {
  const input = root.querySelector("[data-detect-input]");
  const out = root.querySelector("[data-detect-out]");
  const plain = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  // Domaines officiels : un lien vers autre chose qui ressemble à « solana » est suspect
  const OFFICIELS = ["solanamobile.com", "solana.com", "solana.org", "solanafoundation.org"];
  const RACCOURCIS = ["bit.ly", "tinyurl.com", "cutt.ly", "t.co", "rb.gy", "is.gd", "shorturl.at", "linktr.ee"];
  const TLD_RISQUE = ["xyz", "top", "click", "site", "online", "icu", "shop", "live", "cc", "tk", "ml", "ga", "cf", "gq"];

  // poids : 3 = très grave, 2 = grave, 1 = à surveiller
  const REGLES = [
    { w: 3, re: /(phrase (de )?(recuperation|secrete|de recup)|seed ?phrase|recovery phrase|cle privee|private key|(12|24|douze|vingt[- ]quatre) mots|mnemonic)/,
      titre: "On vous parle de vos 24 mots ou de votre clé privée",
      aide: "Personne de sérieux ne les demande, jamais : ni Solana Mobile, ni un support, ni une app. Quiconque les a peut vider votre portefeuille." },
    { w: 3, re: /(anydesk|teamviewer|rustdesk|partage(r)? (de )?(votre )?ecran|prise en main a distance|screen ?share)/,
      titre: "On vous demande de prendre la main sur votre téléphone",
      aide: "Un faux support veut voir votre écran pour récupérer vos mots. N'installez rien et ne partagez pas votre écran." },
    { w: 2, re: /(connect(er|ez)? (votre )?(wallet|portefeuille)|synchronis|valid(er|ez) (votre )?(wallet|portefeuille)|verif(ier|iez) (votre )?(wallet|portefeuille)|wallet connect|restaur(er|ez) (votre )?(wallet|portefeuille))/,
      titre: "On vous pousse à connecter, vérifier ou « synchroniser » votre portefeuille",
      aide: "C'est la méthode classique pour vous faire signer une transaction qui vide le portefeuille. Ne connectez rien depuis un lien reçu." },
    { w: 2, re: /(airdrop|reclam(er|ez)|claim|vous avez (gagne|ete selectionne|recu)|cadeau|gratuit(ement)?|token offert|distribution gratuite|bonus)/,
      titre: "Promesse d'airdrop, de cadeau ou de gain surprise",
      aide: "Un vrai projet ne vous écrit pas en privé pour offrir des tokens. Les récompenses se réclament dans l'app officielle, jamais via un lien reçu." },
    { w: 2, re: /(support|service client|assistance|helpdesk|equipe (de )?solana|solana mobile (team|support)|moderateur|admin)/,
      titre: "Quelqu'un se présente comme du support ou de l'équipe",
      aide: "Un vrai support ne vous écrit pas en premier et ne vous demande jamais vos mots. Passez par le site officiel, tapé à la main." },
    { w: 2, re: /(doublez|doubler|x ?2\b|x ?10\b|rendement garanti|gains? garantis?|sans risque|100 ?% (sur|garanti)|revenu passif garanti|retour sur investissement garanti)/,
      titre: "Promesse de gains garantis ou d'argent doublé",
      aide: "Aucun placement n'est garanti. Un gain promis « sans risque » est le signe d'une arnaque." },
    { w: 2, re: /(frais (de )?(deblocage|retrait|activation|livraison)|payer (d'abord|avant)|paiement d'abord|envoyez (d'abord )?\d|envoyer \d+ ?(sol|usdc|eur|€)|depot (de )?garantie)/,
      titre: "On vous demande de payer ou d'envoyer de l'argent d'abord",
      aide: "Demander des frais pour « débloquer » un gain est une arnaque classique : l'argent promis n'arrive jamais." },
    { w: 2, re: /(seeker.{0,30}(moins cher|promo|solde|-\s?[3-9]0 ?%|a prix casse|presque gratuit)|(moins cher|promo|solde).{0,30}seeker|revendeur (non )?(officiel|agree))/,
      titre: "Un Seeker « moins cher » proposé par un revendeur",
      aide: "Commandez uniquement sur la boutique officielle de Solana Mobile : un Seeker acheté ailleurs n'est pas couvert par la garantie." },
    { w: 1, re: /(urgent|urgence|immediatement|dans les? (24|48) ?h|derniere chance|dernier avertissement|expire (bientot|aujourd'hui)|sous peine|avant (minuit|ce soir)|compte (suspendu|bloque|restreint|compromis)|agissez vite|offre limitee)/,
      titre: "Le message vous met la pression",
      aide: "L'urgence sert à vous empêcher de réfléchir. Un vrai projet ne vous presse pas : prenez le temps de vérifier." },
    { w: 1, re: /(\.apk\b|installer (cette|l') ?(app|application) (depuis|hors)|telecharg(er|ez) (cette|l'|notre) ?(app|application|fichier))/,
      titre: "On vous fait installer un fichier ou une app hors des stores",
      aide: "Installez vos applis uniquement depuis le dApp Store ou le Google Play Store." },
    { w: 1, re: /(message prive|\bmp\b|\bdm\b|ecrivez[- ]moi|contactez[- ]moi (sur|en)|telegram|whatsapp)/,
      titre: "On vous emmène vers une conversation privée",
      aide: "Les arnaqueurs passent en privé pour que personne ne les contredise. Méfiez-vous des contacts qui arrivent sans que vous les ayez demandés." },
  ];

  const urlRe = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;

  function analyserLiens(texte) {
    const trouves = [];
    for (const m of texte.matchAll(urlRe)) {
      const brut = m[1].replace(/[),.;!?]+$/, "");
      let host;
      try { host = new URL(/^https?:/i.test(brut) ? brut : "https://" + brut).hostname.toLowerCase(); } catch { continue; }
      if (!host.includes(".")) continue;
      const base = host.split(".").slice(-2).join(".");
      const tld = host.split(".").pop();
      if (OFFICIELS.includes(base)) continue;
      if (RACCOURCIS.includes(base)) {
        trouves.push({ w: 2, titre: "Lien raccourci : « " + host + " »", aide: "Un lien raccourci cache la vraie destination. N'ouvrez pas." });
      } else if (/solana|seeker|skr|phantom|solflare|jupiter|backpack/.test(host) || /(^|\.)xn--/.test(host)) {
        trouves.push({ w: 3, titre: "Adresse qui imite une marque : « " + host + " »", aide: "Ce site n'est pas un site officiel de Solana Mobile ni de Solana. Les faux sites copient le nom d'un vrai projet." });
      } else if (TLD_RISQUE.includes(tld)) {
        trouves.push({ w: 1, titre: "Adresse peu courante : « " + host + " »", aide: "Ce type de terminaison est souvent utilisé par des sites jetables. Vérifiez avant d'y aller." });
      }
    }
    return trouves;
  }

  function analyser(texte) {
    const t = plain(texte);
    const signaux = [];
    for (const r of REGLES) if (r.re.test(t)) signaux.push({ w: r.w, titre: r.titre, aide: r.aide });
    signaux.push(...analyserLiens(texte));
    const score = signaux.reduce((s, x) => s + x.w, 0);
    const grave = signaux.some((x) => x.w === 3);
    let niveau = "ok";
    if (grave || score >= 5) niveau = "high";
    else if (score >= 2) niveau = "mid";
    else if (score >= 1) niveau = "low";
    return { signaux, niveau };
  }

  const TEXTES = {
    high: ["Très suspect", "Ne répondez pas, ne cliquez sur rien, ne signez rien. Ce message cumule des signaux typiques d'arnaque."],
    mid: ["À éviter", "Plusieurs signaux d'arnaque. Ne cliquez pas et vérifiez par le site officiel, tapé à la main."],
    low: ["À surveiller", "Un signal isolé. Ce n'est pas forcément une arnaque, mais restez prudent et vérifiez avant d'agir."],
    ok: ["Aucun signal détecté", "Cela ne veut pas dire que le message est sûr. Dans le doute, ne cliquez pas, ne signez rien et ne donnez jamais vos 24 mots."],
  };

  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function afficher({ signaux, niveau }) {
    const [titre, texte] = TEXTES[niveau];
    const liste = signaux
      .sort((a, b) => b.w - a.w)
      .map((s) => `<li><strong>${esc(s.titre)}</strong><span>${esc(s.aide)}</span></li>`)
      .join("");
    const suite = niveau === "ok" ? "" : `<p class="verdict-next">Vous avez déjà cliqué, signé ou donné vos mots&nbsp;? <a class="link" href="securite.html#perdu">Voir quoi faire tout de suite</a>.</p>`;
    out.className = "verdict verdict-" + niveau;
    out.innerHTML = `<p class="verdict-title">${titre}</p><p class="verdict-text">${texte}</p>${liste ? `<ul class="signals">${liste}</ul>` : ""}${suite}`;
    out.hidden = false;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const EXEMPLES = [
    "Bonjour, ici le support Solana Mobile. Votre compte est suspendu, c'est urgent. Pour le débloquer, envoyez-nous votre phrase de récupération de 24 mots en message privé.",
    "AIRDROP SKR pour les détenteurs de Seeker ! Vous avez gagné 5 000 SKR. Réclamez maintenant sur https://skr-claim.xyz avant minuit, connectez votre wallet pour valider.",
    "Seeker neuf à -50 % chez un revendeur non officiel, livraison rapide ! Écrivez-moi en MP sur Telegram, paiement d'abord en USDC. Offre limitée, dernière chance.",
  ];

  root.querySelector("[data-detect-go]").addEventListener("click", () => {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    afficher(analyser(v));
  });
  root.querySelector("[data-detect-clear]").addEventListener("click", () => {
    input.value = ""; out.hidden = true; input.focus();
  });
  root.querySelectorAll("[data-ex]").forEach((b) =>
    b.addEventListener("click", () => {
      input.value = EXEMPLES[+b.dataset.ex];
      afficher(analyser(input.value));
    })
  );
}
