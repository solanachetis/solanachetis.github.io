// Détecteur d'arnaque : tout se passe dans le navigateur, rien n'est envoyé.
// Testé par outils/test_detecteur.js (node outils/test_detecteur.js).
// La partie entre DEBUT et FIN LOGIQUE est recopiée dans le bot Telegram (telegram/bot/sync.mjs).

// --- DEBUT LOGIQUE ---
// Caractères invisibles (trait d'union optionnel, espaces de largeur nulle…) : un arnaqueur en glisse
// dans « seed phrase » pour échapper aux règles. On les retire avant d'analyser.
const INVISIBLES = /[­​-‍⁠﻿]/g;
// Lettres cyrilliques ou grecques qui ressemblent à des lettres latines (un « е » russe dans « seed »).
const SOSIES = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
  "і": "i", "ѕ": "s", "ј": "j", "һ": "h", "ԁ": "d", "к": "k", "м": "m",
  "т": "t", "в": "b", "н": "h",
  "ο": "o", "α": "a", "ρ": "p", "ν": "v", "ι": "i", "ε": "e", "κ": "k", "τ": "t",
};
const AUTRES_ALPHABETS = /[Ͱ-ϿЀ-ԯ]/g;
// Une lettre latine collée à une lettre cyrillique ou grecque : des lettres déguisées dans un mot.
const MELANGE = /[a-z][Ͱ-ϿЀ-ԯ]|[Ͱ-ϿЀ-ԯ][a-z]/i;

const plain = (s) =>
  s.normalize("NFKD").replace(INVISIBLES, "").replace(/\p{M}/gu, "").toLowerCase()
    .replace(AUTRES_ALPHABETS, (c) => SOSIES[c] || c)
    .replace(/[’‘`´]/g, "'").replace(/\s+/g, " ");

// Sites officiels : seuls ces domaines (et leurs sous-domaines) ne sont pas signalés.
const OFFICIELS = ["solanamobile.com", "solana.com", "solana.org", "solanafoundation.org", "solanachetis.github.io"];
const RACCOURCIS = ["bit.ly", "tinyurl.com", "cutt.ly", "t.co", "rb.gy", "is.gd", "shorturl.at", "linktr.ee", "ow.ly", "buff.ly", "rebrand.ly", "t.ly", "s.id", "goo.gl", "tiny.cc", "lnkd.in"];
const TLD_RISQUE = ["xyz", "top", "click", "site", "online", "icu", "shop", "live", "cc", "tk", "ml", "ga", "cf", "gq", "pw", "buzz", "rest", "lol", "monster", "cyou", "sbs", "cfd", "bond", "fun", "vip", "win", "pro", "info", "biz", "app", "link", "claims", "network", "finance", "dev"];
// Pour reconnaître une adresse écrite sans « https:// »
const TLD_CONNUS = ["com", "net", "org", "io", "fr", "eu", "be", "ch", "ca", "co", "me", "gg", "so", "to", "ai", "us", "uk", "de", "ly", "gl", "ee", "id", "in", "gd", "at", ...TLD_RISQUE];
// Noms qu'imitent les faux sites
const MARQUES = ["solana", "solanamobile", "seeker", "seedvault", "phantom", "solflare", "jupiter", "jup", "backpack", "magiceden", "tensor", "raydium", "orca", "skr", "saga"];

// Une QUESTION : la personne demande comment faire, elle ne subit pas une demande.
const QUESTION = /(\b(comment|how (do|can|should|to|does)|ou (est|puis|trouve|ranger|stocker|garder)|que faire|que dois|what (is|are|does|do)|c'est quoi|qu'est[- ]ce|est[- ]ce (que|qu')|pourquoi|why|quelqu'un (sait|peut|a deja|a un|a des|aurait)|does anyone|anyone know|peut[- ]on|puis[- ]je|can i|should i|faut[- ]il|dois[- ]je|savez[- ]vous|sais[- ]tu|ca marche comment|c'est normal|je cherche|je voudrais savoir|je veux savoir|je souhaite savoir|a quoi (sert|ca sert|servent)|avez[- ]vous|as[- ]tu|connaissez[- ]vous|connais[- ]tu|expliqu|looking for|i'm looking|do you have|where (can|do))\b|\?\s*$)/;

// Une PHRASE PERSONNELLE : la personne parle de SA propre phrase (« j'ai mis ma phrase dans un coffre »).
const PERSONNEL = /\b(j'ai|je l'ai|i have|i've|ma|mon|mes|my)\b.{0,20}\b(phrase|seed|mots|cle|words|key|sauvegarde|backup)\b/;

// Un AVERTISSEMENT : le message met en garde contre une arnaque (il ne la commet pas).
const AVERTISSEMENT = /(\bjamais\b|\bnever\b|ne [a-z']{1,14}( [a-z']{1,14})? pas\b|do not\b|don't\b|\battention\b|\bmefiez|\bmefie[- ]toi|\bbeware\b|\bwarning\b|\barnaques?\b|\bscams?\b|\bprudence\b|\bgare a\b)/;

// Une DEMANDE adressée à vous : quelqu'un exige quelque chose de vous.
const DEMANDE = /(donn(ez|er|e)[- ]moi|envoy(ez|er|e)[- ]moi|ecri(vez|re|s)[- ]moi|dites[- ]moi|dis[- ]moi|montrez[- ]moi|transmet(tez|s)[- ]moi|partag(ez|er) (avec moi|votre|vos|ton|ta|tes)|communiqu(ez|er)[- ]moi|fourniss(ez|er)|saisi(ssez|r) (votre|vos|ton|tes)|entrez (votre|vos)|tapez (votre|vos)|collez (votre|vos)|copiez (votre|vos)|send me|share your|give me|tell me|provide your|enter your|type your|paste your|j'ai besoin (de|d')|i need (your|the|to)|(indiquez|renseignez|precisez|fournissez|saisissez)\b.{0,15}\b(votre|vos|ton|tes|ta)\b|(quelle est|what is|what's) (votre|ta|ton|your) (phrase|seed|cle|mot)|il (me )?faut (que vous|vos|votre)|vous devez|you (must|need to|have to)|pouvez[- ]vous (me |nous )?(donner|envoyer|partager|communiquer|dire|ecrire)|peux[- ]tu (m'|me |nous )?(donner|envoyer|partager|communiquer|dire|ecrire)|tu peux (m'|me )?(donner|envoyer|partager|communiquer|dire|ecrire)|pourri(ez|ons|ais)[- ](vous|tu) (m'|me |nous )?(donner|envoyer|partager|communiquer|dire|ecrire)|\b(m'|me )(donner|envoyer|ecrire|dire|montrer|transmettre|communiquer|partager|copier)\b|can you (send|share|give|tell)|send (it |them )?to me)/;

// poids : 3 = très grave, 2 = grave, 1 = à surveiller
// info : la règle ne se déclenche pas si le texte est une simple question (voir QUESTION et DEMANDE)
const REGLES = [
  { w: 3, info: true,
    re: /(phrase (de |de la )?(recuperation|secrete|recup|de passe|de sauvegarde)|seed ?phrase|seed words|(votre|ta|your|my|ma|ton|tes|vos) seed\b|recovery (phrase|words|key)|backup (phrase|words)|secret (phrase|recovery|words)|passphrase|cle(s)? privee|private key|(12|24|douze|vingt[- ]quatre|twelve|twenty[- ]four)[- ]?(mots?|words?)|mnemonic|mots? secrets?|(votre|your|ton|ta|wallet|portefeuille) (wallet )?backup|(code|codes) (de )?recuperation|recovery codes?|code secret|secret code|(les |des )?mots (de |du |d')?(votre |ton |ta |vos )?(sauvegarde|backup|recuperation|coffre|seed vault|portefeuille|wallet)|wallet (backup )?words|(capture d'ecran|screenshot|photo|image) (de |d'|of )?(votre |ton |ta |your )?(seed|wallet|portefeuille|sauvegarde|cle|phrase|recovery|backup|coffre))/,
    titre: "On vous parle de vos 24 mots ou de votre clé privée",
    aide: "Personne de sérieux ne les demande, jamais : ni Solana Mobile, ni un support, ni une app, ni un site. Quiconque les a peut vider votre portefeuille." },
  { w: 3,
    re: /(anydesk|teamviewer|rustdesk|airdroid|quicksupport|quick support|partage (de |d')?ecran|partag(er|ez) (votre |ton )?ecran|share (your )?screen|prise en main|controle a distance|remote (access|control)|screen ?shar|acces a distance)/,
    titre: "On veut prendre la main sur votre téléphone",
    aide: "Un faux support veut voir ou contrôler votre écran pour récupérer vos mots. N'installez rien et ne partagez jamais votre écran." },
  { w: 3,
    re: /((envoy|envoi|send|transf|depos).{0,40}(recev|receive|get back|rend|renv|retourn|double|triple|x2|x ?10)|(recev|receive|get).{0,25}(le double|double|twice|2x|x2) )/,
    titre: "On vous promet de renvoyer plus que ce que vous envoyez",
    aide: "« Envoyez 1 SOL, recevez-en 2 » : c'est toujours une arnaque. L'argent envoyé ne revient jamais." },
  { w: 3,
    re: /((transferez|transfer|deplacez|move|envoyez|send)\w*.{0,35}(vers|to) (ce|un|cette|this|a|another|notre|our|le) ?(nouveau |new )?(portefeuille|wallet|adresse|address|compte|account)|portefeuille (temporaire|securise|de securite|de secours)|(safe|secure|temporary|backup) wallet|nous vous les rendrons|we will (return|give back)|(mettre|mettez|put|place)\w* .{0,15}(fonds|funds|cryptos?) .{0,15}(en|in) (securite|safety|lieu sur))/,
    titre: "On vous demande de déplacer vos fonds vers un autre portefeuille",
    aide: "Aucun service sérieux ne vous demande de transférer vos fonds vers un portefeuille « sécurisé » ou « temporaire ». Tout ce que vous y envoyez est perdu. Vos fonds sont déjà en sécurité dans votre Seed Vault." },
  { w: 3,
    re: /((recuper|recover|retrouv).{0,25}(fonds|cryptos?|funds|bitcoins?|argent|sol|wallet|portefeuille).{0,25}(vole|perdu|stolen|lost|hack|pirat|arnaqu|scamm)|fund recovery|hacker ethique|ethical hacker|recovery (agent|expert|service)|(specialiste|expert|service|agence|cabinet|specialist)s? (en |de |of |in )?(recuperation|recovery).{0,40}(crypto|bitcoin|fonds|funds|btc|eth|sol)|recuperation (de |des |d')?(bitcoins?|cryptos?|fonds|crypto|cryptomonnaies?)|(retrouv|recuper)(er|ons|e)? (vos|vos cryptos|your) (fonds|cryptos?|bitcoins?|funds))/,
    titre: "On vous propose de récupérer des cryptos volées ou perdues",
    aide: "Les « services de récupération » sont une deuxième arnaque qui vise les victimes. Personne ne peut annuler une transaction sur Solana." },
  { w: 2, info: true,
    re: /(connect(er|ez|e)? (votre |ton |your )?(wallet|portefeuille)|connect wallet|wallet ?connect|synchronis|sync (your |votre )?wallet|valid(er|ez|ate) (votre |ton |your )?(wallet|portefeuille)|verif(ier|iez|y) (votre |ton |your )?(wallet|portefeuille)|confirm(er|ez)? (votre |ton |your )?(wallet|portefeuille)|restaur(er|ez) (votre |ton )?(wallet|portefeuille)|restore (your )?wallet|rectif|import(er|ez)? (votre |your )?(wallet|portefeuille)|migr(er|ez|ate|ation).{0,20}(wallet|portefeuille|tokens?|skr)|(connectez|connect)[- ]vous.{0,30}(recuper|reclam|claim|valid|verif)|(identif(iez|ier)|log ?in|connectez).{0,20}(pour (recuperer|recevoir|reclamer|valider)|to (claim|receive|verify|recover)))/,
    titre: "On vous pousse à connecter, vérifier ou « synchroniser » votre portefeuille",
    aide: "C'est la méthode classique pour vous faire signer une transaction qui vide le portefeuille. Ne connectez rien depuis un lien reçu." },
  { w: 2,
    re: /(sign(ez|er|e)? (la |cette |une |the |this )?(transaction|demande|request|message)|approuv(ez|er)|approve|autoris(ez|er) (la |cette )?(transaction|connexion|demande)|(accord(ez|er)|donn(ez|er)|grant|give).{0,25}(acces|access|permission|droit|autorisation).{0,25}(illimit|unlimited|total|complet|full|a vos tokens|your tokens|a votre (wallet|portefeuille))|(autoris(e|ez|er)|allow|authorize|authorise).{0,30}(acces|access|acced).{0,25}(tokens?|jetons|portefeuille|wallet|fonds|tous|all)|unlimited (access|approval|allowance)|acces illimite|approbation illimitee|(retirer|retrait|withdraw|prelev|spend|transferer|deplacer).{0,25}(vos |your |des |les )?(usdc|sol|tokens?|jetons|fonds|funds|skr).{0,30}(de votre|from your|depuis votre|a tout moment|at any time)|(accept(ez|er)|confirm(ez|er)|accepte|accept|confirm|validez|valider).{0,45}(pour continuer|to continue|pour (debloquer|recevoir|activer|valider|recuperer|reclamer|participer)|to (unlock|receive|claim|activate|verify|proceed|participate)))/,
    titre: "On vous demande de signer, d'approuver ou de confirmer pour « débloquer » quelque chose",
    aide: "Une signature peut autoriser le retrait de vos tokens. Ne signez, n'acceptez et ne confirmez jamais une demande qui vient d'un message ou d'un lien reçu." },
  { w: 2, info: true,
    re: /(airdrop|reclam(er|ez)|\bclaim|vous avez (gagne|ete (selectionne|choisi|tire))|you('ve| have)? (won|been selected)|winner|gagnant|cadeau|giveaway|gratuit|free (sol|skr|usdc|tokens?|nft|mint|crypto)|tokens? offerts?|distribution gratuite|bonus|whitelist|white list|mint (gratuit|free)|free mint|eligible|allocation|recompense (en attente|non reclamee)|unclaimed)/,
    titre: "Promesse d'airdrop, de cadeau ou de gain surprise",
    aide: "Un vrai projet ne vous écrit pas en privé pour offrir des tokens. Les récompenses du Seeker se réclament uniquement dans l'app officielle, jamais via un lien reçu." },
  { w: 2,
    re: /((recompense|reward|gain|allocation|prime|cadeau|lot|bonus|jetons|tokens?|skr|usdc|fonds|argent|prix|prize)s?.{0,40}(vous attend|vous attendent|est prete?|sont pretes?|en attente|a reclamer|a recuperer|a valider|vous est (destine|reserve)|disponible pour vous|ready|waiting for you|pending|available to claim|to claim)|(vous avez|you('ve| have)) (bien )?(recu|received|gagne|won).{0,25}(\d|skr|sol\b|usdc|tokens?|jetons|recompense|reward|prix|prize)|(vous faites partie|you are (one )?of|you're among|parmi les).{0,30}(premiers|first|\d+).{0,25}(utilisateurs|users|detenteurs|holders|personnes|people|proprietaires|owners)|(felicitations|congratulations|congrats|bravo).{0,40}(vous|you|recompense|reward|gagn|won|choisi|selectionn|eligible|premier)|(vous etes|you were|you have been|vous avez ete) (choisi|selectionne|tire au sort|chosen|selected)|(you are|vous etes) eligible|surprise.{0,25}(vous attend|waiting|portefeuille|wallet|seeker)|(recup(erez|erer)|collect|get|obtenez|recevez) (vos|your|votre) (jetons|tokens|recompense|reward|skr|gains?)|jetons gratuits|(remboursement|refund|compensation|dedommagement|indemnite)s?.{0,40}(vous attend|attend|vous devons|vous doit|entitled|due|owed|en attente|pending|a recuperer|disponible)|(vous etes|you are|you're) (en droit|entitled)|entitled to (a )?(refund|compensation)|\b(concours|contest|giveaway|tirage au sort|loterie|lottery|raffle)\b.{0,60}(seeker|skr|solana|wallet|portefeuille|adresse|connect|signez|sign|crypto|sol\b)|(tire|tiree) au sort|(skr|tokens?|jetons|allocation|recompense|fonds|funds)s?.{0,40}(n'ont pas ete|pas ete|pas encore|not yet|have not been|haven't been) (reclam|claim|valid|recupere)|(fonds|funds|tokens?|jetons|cryptos?|argent|money|balance).{0,40}(detect|trouve|found|identif|noticed|dormant|oublie|abandon).{0,40}(portefeuille|wallet|compte|account)|reprendre possession|take possession|(ancien|old|previous|abandoned|dormant) (portefeuille|wallet|compte))/,
    titre: "On vous annonce une récompense ou un gain que vous n'attendiez pas",
    aide: "Un vrai projet ne vous écrit pas pour vous offrir des tokens. Les récompenses du Seeker se réclament uniquement dans l'app officielle, jamais via un message." },
  { w: 2,
    re: /((je suis|je travaille|je fais partie|nous sommes|on est|on travaille|i am|i'm|we are|this is)\b.{0,30}\b(chez|du|de la|de l'|from|at|member of|membre de|part of)\b.{0,20}(solana|seeker)|(je suis|nous sommes|on est|i am|i'm|we are|this is|ici|here)\s+(le |la |l'|un |une |du |de l'|the |a |an )?(support|equipe|service (client|technique|securite)|assistance|technicien|conseiller|agent|team)\b|(je gere|nous gerons|i manage|i run|je m'occupe (du|de l')|je tiens)\s+(le |la |l'|du |de l'|the )?(support|assistance|equipe|service|team)\b|(equipe|team|service|departement|department) (technique|de securite|securite|security|support|assistance|client|solana|seeker|verification|conformite|compliance)|(je suis|i am|i'm|we are)\s+(un |une |le |la |a |an |the )?(modo|mod|moderat\w+|admin\w*)\b.{0,40}(solana|seeker|skr|crypto|wallet|portefeuille|discord|telegram|official|officiel)|from (the )?(seeker|solana|solana mobile) (team|support)|de la part (de|du) (support|l'equipe|solana|seeker)|solana mobile (support|team|equipe)|support (solana|seeker|technique)|(customer|client) (support|service)|service client|(helpdesk|help desk)|(centre d'aide|help center|helpcenter|support center)|ticket (number|n°|no\.?|numero|#) ?\d+|(votre|your) (ticket|dossier|case).{0,30}(action|requis|required|attente|pending|en cours))/,
    titre: "Quelqu'un se présente comme du support ou de l'équipe",
    aide: "Un vrai support ne vous écrit jamais en premier, en privé. Pour le support de Solana Mobile, passez par son site officiel, tapé à la main." },
  { w: 1,
    re: /(je peux (t'|vous |te |m')?(aider|help)|je vais (t'|vous |te )?aider|laisse[- ]moi (t'|vous )?aider|laissez[- ]moi (vous )?aider|i can help|let me help|i('ll| will) help you|happy to help you|(un |une |a |some )?(souci|probleme|bug|erreur|issue|problem|error|trouble).{0,25}(avec|with) (ton|votre|your|ta|tes|vos) (wallet|portefeuille|seeker|compte|seed vault|account|appareil|telephone|device))/,
    titre: "Quelqu'un vous propose de l'aide que vous n'avez pas demandée",
    aide: "Dans les groupes et en messages privés, les arnaqueurs proposent « de l'aide » à ceux qui ont un souci, puis demandent vos mots. Les vraies réponses se donnent dans le groupe, jamais en privé." },
  { w: 2,
    re: /((votre|ton|ta|vos|your)\s+(seeker|appareil|telephone|portefeuille|wallet|compte|device|seed vault|coffre).{0,45}(probleme|problem|piratage|pirate|hack|compromis|suspect|anomalie|danger|faille|virus|infecte|menace|vulnerab|a risque|en danger|security (issue|alert|breach))|(activite|activity|connexion|login|acces|tentative) (suspecte|suspicious|inhabituelle|unusual|inconnue|anormale)|(probleme|problem|faille|alerte|alert|incident) (de |d')?(securite|security)|(detecte|detected|noticed|remarque).{0,25}(activite|activity|intrusion|piratage|tentative)|(wallet|portefeuille|compte|account).{0,30}(connecte a|connected to).{0,25}(site|app|application).{0,20}(non securis|unsafe|dangereux|dangerous|malveill|malicious|suspect|unsecure)|(eviter|avoid|prevent) (le |un )?(piratage|hack|vol|theft)|(signale|flagged|reported)\b.{0,25}(votre|ton|your)\s+(portefeuille|wallet|compte|account))/,
    titre: "On vous annonce un problème de sécurité pour vous faire réagir",
    aide: "Solana Mobile ne vous écrit jamais pour vous dire qu'un problème touche votre Seeker ou votre portefeuille. C'est un prétexte pour vous faire donner vos mots ou cliquer sur un lien." },
  { w: 2,
    re: /((gagn(er|ez|e)|earn|make|faire|generer|toucher).{0,30}(\d+ ?(€|euros?|\$|usd|usdc|sol\b|dollars?)|des? (milliers|centaines)|beaucoup d'argent|de l'argent|money).{0,30}(par jour|par semaine|par mois|chaque jour|per day|a day|daily|weekly|hebdo|quotidien|par heure|per hour)|\d+ ?(€|euros?|\$|usd|usdc|sol\b|dollars?) ?(par jour|par semaine|par heure|per day|a day|per hour|chaque jour)|(multipli(er|ez)|grow|augmenter|faire fructifier).{0,25}(capital|argent|mon argent|money|investissement)|(petit investissement|small investment|investissez|invest).{0,35}(retir|withdraw|gagn|recev|return|rapporte|\d+ ?(fois|x)|dans (une|1) semaine|en \d+ (jours|h|heures))|(plateforme|platform|site|application|bot).{0,25}(rentable|profitable|lucrative|rapporte|rendement|trading automatique|auto-?trading)|bot (automatique|de trading|trading)|rendement.{0,12}\d+ ?%|(inscri(vez|re)|join|rejoignez).{0,30}(vip|groupe de trading|trading group|signaux|signals)|\bvip (trading|group|groupe)|(mon|my) mentor|(ma|mon) (tante|oncle|cousin|cousine|ami|amie|voisin|collegue|frere|soeur).{0,30}gagne.{0,40}(crypto|bitcoin|euros|\$)|(opportunite|opportunity) (d'investissement|unique|en or|investment)|investissement (tres )?rentable|retour sur investissement (garanti|rapide)|(depos|deposit|invest|verse|place|mise|envoi).{0,30}\d+.{0,50}(transform|devien|obtien|recev|get|becomes?|gagn|retir|withdraw|rapport|=|->).{0,30}\d+.{0,25}(jour|day|semaine|week|heure|hour|mois|month)|(\bia\b|\bai\b|intelligence artificielle|robot|algorithme|algorithm).{0,25}(trading|trade|invest)|taux de (reussite|succes) (de )?\d{2}|\d{2} ?% (de )?(reussite|succes|win ?rate)|success rate|(commenc(e|ez|er)|start(ing)?|demarr(e|ez|er)) (avec|with|from) \d+ ?(€|euros?|\$|usd|usdt|usdc|dollars?)|(ouvr(e|ez|ir)|creer|cree|creez|open|create).{0,20}(un )?(compte|account).{0,30}(plateforme|platform|notre site|our (site|platform))|(revenus?|gains?|argent) passifs?|\bdu passif\b|\bpassif (tous|chaque)|(rapport|genere|generate)\w* .{0,20}(tous les jours|chaque jour|every day|daily)|arreter de travailler|quit (your )?job|quitt\w+ (son|mon|ton|ma|sa) (job|travail|emploi)|financial freedom|liberte financiere|(grace a|thanks to) (cette|cet|this) (plateforme|appli|application|methode|strategie|bot|systeme|platform|method|system)|(je te montrerai|je peux (t'|vous )?(apprendre|montrer)|i can (teach|show) you|je t'apprendrai|i('ll| will) (teach|show) you).{0,30}(invest|crypto|trading|gagner|earn|money|argent)|comment j'investis|how i invest|(a lot of|beaucoup d')\s?(money|argent).{0,25}(crypto|bitcoin|trading|invest)|made .{0,20}(money|fortune).{0,15}(crypto|bitcoin|trading)|club (d')?(investisseurs?|investors?|prive|vip)|rendement (hebdomadaire|mensuel|weekly|monthly)|\d+ ?% (hebdomadaire|mensuel|quotidien|weekly|monthly)|acces limite|limited access|(gerer|manage).{0,15}(mon|my) (portefeuille|wallet|compte|argent|fonds|account)|(tu|vous) gardes? \d+ ?%|(garde|keep)\w* \d+ ?% (des|of|de) (gains|profits?|benefices)|quelqu'un de confiance|argent facile|easy money|(gagner|gagn|earn|make).{0,15}(de l'? ?argent|money).{0,10}(facile|easy|rapide|fast|vite)|j'?ai un (truc|plan|bon plan|deal|projet).{0,20}(pour toi|for you|pour vous)|(je dirige|i run|i manage|je gere).{0,25}(fonds|fund|societe|company|entreprise).{0,40}(investissement|investment)|(proposer|offer|propose).{0,15}(une collaboration|a collaboration|partenariat|partnership)|(trouve|found|vu|saw) (votre|your) (profil|profile)|gagne\w* .{0,6}\d[\d ]*(€|euros?|\$|usd).{0,20}(en|in|par) (une |1 )?(semaine|jour|mois|week|day|month|heures?)|(m'a parle de (toi|vous)|told me about you|referred you)|avec notre (appli|application|plateforme|app|site))/,
    titre: "On vous promet de l'argent facile ou on vous invite à investir",
    aide: "Personne ne peut promettre de vous faire gagner de l'argent chaque jour. Les faux « investissements », « mentors » et « bots de trading » vous font déposer de l'argent qui ne revient jamais." },
  { w: 2,
    re: /((offre|opportunite|proposition) (d'emploi|de travail|d'embauche|de job)|job (opportunity|offer)|(travail|job|emploi|work|poste|boulot).{0,30}(a distance|a domicile|depuis chez (vous|toi)|from home|remote).{0,70}(€|euros?|\$|par jour|par heure|per day|per hour|paiement quotidien|paye (chaque|tous)|daily pay)|(cliqu(ez|er) sur|liking|likes?|regarder|watch(ing)?).{0,25}(videos?|posts?|annonces|ads|publicites)|nous recrutons|we('re| are) hiring|recrut(e|ons|ement).{0,40}(crypto|testeurs?|testers?|a distance)|(testeur|tester)s? (d'|de |of )?(application|app|crypto)|(gagn(ez|er)|earn).{0,25}(en likant|en cliquant|liking|clicking|en regardant)|paiement quotidien|daily payment|salaire.{0,20}(sans experience|sans diplome|immediat)|remote job|work from home|(simple|easy) tasks?|get paid|paid (in|daily|every)|tasks? on your phone|travail a distance|(note|noter|rate|rating|evaluer|evaluez).{0,20}(produits?|products?|applications?|videos?)|complement de revenu|extra income|side income|revenu complementaire|temps partiel.{0,40}(\d+ ?(€|euros?)|par jour)|(sans|no) experience|pas d'experience|(missions?|taches?|tasks?).{0,20}(simples?|faciles?|easy)|remuneration (immediate|quotidienne|chaque (jour|soir))|(paye|paie|remunere|paid) (immediatement|chaque (jour|soir)|tous les (jours|soirs))|recrute\w* .{0,25}(collaborat|assistants?|agents?|employes?|candidats?)|(sur|on (your )?)smartphone.{0,30}(\d+ ?(€|euros?)|remuner|paye|paid)|collaborateurs? (pour|for) (missions|taches|tasks))/,
    titre: "Une offre de travail trop belle pour être vraie",
    aide: "Les arnaques à l'emploi promettent un bon salaire pour des tâches très simples (cliquer, liker), puis demandent de l'argent. Un vrai employeur ne vous fait jamais payer pour travailler." },
  { w: 2,
    re: /(frais (de |d')?(deblocage|retrait|activation|livraison|dossier|gas|reseau|verification|traitement|douane)|pay(er|ez)? (d'abord|avant|first)|paiement (d'abord|avant|en avance)|envoy(ez|er) (d'abord )?(\d|un |une |des )|send \d|deposit \d|depot (de )?garantie|(fee|fees) to (unlock|withdraw|claim|release)|unlock fee|withdrawal fee|(paie(z|r)?|payer|verse(z|r)?) (les |des )?frais.{0,40}(debloqu|retrait|liber|withdraw|release|recuper|reclam|gain|colis|livraison|douane)|(debloqu|retirer|liberer|recuperer).{0,40}(paie(z|r)?|payer|verse(z|r)?) (les |des )?frais|(pay|payez|paye|verse)\w*.{0,25}(compliance|conformite|taxe|tax|tva|impot|commission)|(taxe|tax|commission|compliance|conformite) (de |of )?\d+ ?%|(release|liberer|debloquer|unlock|liberation).{0,25}(funds|fonds|retrait|withdrawal|argent).{0,40}(pay|payez|paye|verse|fee|frais)|(augment|increas|top ?up|recharg).{0,20}(depot|deposit|solde|balance)|(depot|deposit) (supplementaire|additionnel|additional)|virement (bancaire )?d'abord|que le virement|uniquement (le )?(virement|crypto)|seulement (le )?(virement|crypto)|ne fais que (le )?virement|only (bank transfer|crypto)|paiement (par virement )?avant (l')?(envoi|expedition|livraison)|avant (l')?(envoi|expedition)|avance (de )?\d+ ?%|acompte|virement (avant|d'abord)|premier arrive premier servi|first come first served|(avance|paiement|payer).{0,15}(demande|exige|obligatoire|requis))/,
    titre: "On vous demande de payer ou d'envoyer de l'argent d'abord",
    aide: "Demander des frais pour « débloquer » un gain ou une commande est une arnaque classique : l'argent promis n'arrive jamais." },
  { w: 2,
    re: /(seeker.{0,40}(moins cher|pas cher|cheap|discount|promo|solde|-\s?\d\d ?%|\d\d ?% off|prix casse|presque gratuit|en stock|dispo tout de suite|moitie prix|half price|a moitie|neuf (sous )?(blister|scelle)|paiement (par crypto|en crypto|d'abord|avant)|crypto (uniquement|only)|envoie (l'|le )?(argent|paiement)|expedie apres|je (te )?l'expedie)|(moins cher|pas cher|cheap|promo|solde|discount).{0,40}seeker|revendeur|reseller|(je vends|vends|a vendre|for sale|selling).{0,30}seeker|(paiement|payment|payer|pay).{0,20}(par crypto|en crypto|crypto only|crypto uniquement|usdt|western union|mandat|carte cadeau|gift ?card|virement d'abord)|seeker.{0,40}(deballe|jamais (utilise|ouvert|servi|allume))|seeker.{0,15}\b(a|for|at)\b \d{2,3} ?(balles|boules|eur|€|euros?|\$)|(affaire|bon plan|deal|occasion|bargain).{0,30}seeker|seeker.{0,30}(affaire|bon plan|bargain)|je le laisse a \d{2,3}|(vends|vendu|a vendre).{0,25}seeker.{0,30}\d{2,3} ?(€|euros?)|(envoie|envoyez|send).{0,20}(l'argent|the money|le paiement).{0,40}(expedi|ship|envoi|send you))/,
    titre: "Un Seeker « moins cher » ou vendu avec un paiement risqué",
    aide: "Commandez uniquement sur la boutique officielle de Solana Mobile. Un Seeker acheté ailleurs n'est pas couvert par la garantie, et beaucoup d'annonces sont des arnaques." },
  { w: 2, info: true,
    re: /((ton|votre|your|ta) (seeker|compte|wallet|portefeuille|appareil|device|account|telephone).{0,20}(est |et |is |was |has been |a ete )?(bloqu|blokk|lock|block|gel|froz|suspend|desactiv|compromis|hack|pirat|en danger|a risque))/,
    titre: "On vous dit que votre appareil ou votre compte est bloqué ou en danger",
    aide: "Un faux message d'alerte sert à vous faire cliquer ou donner vos mots. Ne répondez pas et vérifiez directement dans l'app officielle." },
  { w: 1,
    re: /(clique(z)? (ici|sur (ce|le) lien|sur le bouton)|click here|click (the|this|on the) link|lien ci-dessous|link below|lien en bio|link in bio|tap (here|the link)|cliquez (ci-dessous|maintenant)|cliqu\w+ pour|click to|rends[- ]toi sur|rendez[- ]vous sur (notre|ce|le) (page|site|lien))/,
    titre: "On vous pousse à cliquer sur un lien",
    aide: "Ne cliquez pas sur un lien reçu d'un inconnu. Tapez vous-même l'adresse du site officiel." },
  { w: 2,
    re: /(\bkyc\b|verif(ier|iez|iez pas|ication) (de |d')?(votre |ton )?(identite|compte)|verify (your )?(account|identity)|confirm(er|ez|e)? (votre |ton |your )?(identite|identity|compte|account)|piece d'identite|carte d'identite|passeport|passport|selfie|(votre|your) (device|appareil|seeker|compte|account).{0,25}(verification|verified|verifie|a verifier|needs? verif))/,
    titre: "On vous demande de vérifier votre identité ou votre compte",
    aide: "Les faux « contrôles » servent à voler vos papiers ou à vous mener vers un faux site. Un portefeuille Seeker ne demande jamais de pièce d'identité." },
  { w: 2,
    re: /((trader|coach|mentor|gestionnaire|account manager|expert|conseiller|courtier|broker).{0,30}(crypto|trading|invest|placement)|(crypto|trading|invest).{0,30}(trader|coach|mentor|gestionnaire|account manager|expert|conseiller|broker)|groupe (de )?signaux|signals? (group|channel)|\bpump\b)/,
    titre: "Un « expert » propose de faire fructifier votre argent",
    aide: "Les faux traders et « coachs » vous font déposer de l'argent sur une plateforme qui ne rend jamais rien." },
  { w: 2,
    re: /((doubl(ez|er|e) (votre|vos|ton|your)|double your|\bx ?(2|3|5|10|20|50|100)\b)|rendement (garanti|quotidien|journalier)|gains? garantis?|profits? garantis?|resultats? garantis?|guaranteed|sans (aucun )?risque|risk[- ]?free|no risk|revenu passif|passive income|\d+ ?% (par jour|par semaine|par mois|per day|daily|weekly|a day))/,
    titre: "Promesse de gains garantis ou d'argent multiplié",
    aide: "Aucun placement n'est garanti. Un gain promis « sans risque » ou « garanti » est le signe d'une arnaque." },
  { w: 2,
    re: /(mise a jour (obligatoire|urgente|de securite|necessaire)|(update|upgrade) (required|now|your (wallet|app|seed vault))|nouvelle version (du|de la|de votre) (wallet|portefeuille|seed vault|app)|\.apk\b|installer (cette|l') ?(app|application) (depuis|hors|via)|telecharg(er|ez) (cette|l'|notre|la|le) ?(app|application|fichier|mise a jour)|\b(installez|telechargez|install|download)\b.{0,30}\b(cette|this|notre|la|the|my|mon|l'|le|un|une)\b ?(app|application|appli|logiciel|software|fichier|file|programme|outil|tool|extension)|fichier joint|attached file|pour (securiser|reparer|proteger|sauvegarder|debloquer).{0,25}(wallet|portefeuille|seeker|compte|appareil|telephone)|\b(installe|telecharge|lance|lancez|install|download)\b.{0,30}\b(sur|via|depuis|from|using|with)\b.{0,10}\b(mon|ce|this|my|ma|le|notre)\b.{0,6}(lien|link|site|page)|(outil|tool|patch|correctif|extension|utilitaire|logiciel).{0,25}(recuperation|recovery|reparation|repair|securite|security|verification|verifier|restaurer|restore)|(installe|installez|installer|install) (l'|the |cette |cet |this )?(extension|plugin|module)|(telecharge|installe)(z)? (cet|ce) (outil|logiciel|fichier|programme|utilitaire))/,
    titre: "On vous fait installer une app, un fichier ou une « mise à jour » depuis un message",
    aide: "Installez vos applis et mises à jour uniquement depuis le dApp Store, le Google Play Store ou les réglages du téléphone. Jamais depuis un lien ou un fichier reçu." },
  { w: 2,
    re: /(ne (le |m'en |en )?(dites?|dis) (rien|a personne)|n'en parlez? (a personne|pas)|ne dis rien|don't tell|do not tell|tell no ?one|(personne|nobody|no one).{0,25}(ne doit|ne dois|must not|should not|ne sait|ne saura|doit savoir|must know)|restez? (entre nous|discret)|c'est (confidentiel|secret)|keep (this|it) (secret|private|between us|confidential)|confidenti(el|al)|strictement (secret|prive)|ne (pas |)(en )?parl(ez|er) a (votre|ta|ton|vos) (famille|banque|conseiller|entourage|ami)|investissement secret)/,
    titre: "On vous demande de garder le secret",
    aide: "Les arnaqueurs vous isolent pour que personne ne vous ouvre les yeux. Un vrai projet ne vous demande jamais de cacher quelque chose à vos proches ou à votre banque." },
  { w: 2,
    re: /((si vous ne|si tu ne|if you (don't|do not)|unless you).{0,40}(repond|respond|reply|valid|confirm|verif|agiss|reagi|act|fait|payez|paye).{0,50}(ferm|bloqu|suspend|supprim|desactiv|perdu|lock|clos|delet|lost|gel|froz)|(votre|ton|your|ta) (compte|wallet|portefeuille|seeker|account|appareil).{0,25}(sera|va etre|will be|is going to be)\s(definitivement|permanently|bloque|ferme|supprime|desactive|suspendu|closed|locked|deleted|suspended|gele|frozen)|(sera|seront|will be) (definitivement|permanently) (gele|frozen|ferme|supprime|bloque|perdu|closed|deleted|locked|lost)|(gele|frozen) (definitivement|permanently)|(sinon|or else|otherwise|or)\b.{0,30}(sera|will be|va etre|is going to be) (bloque|supprime|desactive|suspendu|ferme|disabled|deactivated|suspended|locked|deleted|closed)|must (verify|confirm|act|respond)\b.{0,25}(or|sinon)\b)/,
    titre: "On vous menace si vous ne réagissez pas tout de suite",
    aide: "Les arnaqueurs menacent de fermer ou de bloquer votre compte pour vous faire agir sans réfléchir. Un vrai service ne vous menace jamais dans un message. Vérifiez par le site officiel, tapé à la main." },
  { w: 2,
    re: /(\bpre-?sale\b|prevente|vente privee|private sale|early (buyers|investors|access)|liste blanche|\bico\b|\bido\b|(token|jeton).{0,30}(launch|lancement)|get \d+x|\bx\d+ (at|au) (launch|lancement)|\d+x (at|au) (launch|lancement)|(seeker id|\.skr|genesis|domaine|domain|token|compte|account|wallet|portefeuille|seeker|appareil|device).{0,40}(va |vont |will |is about to |sera |seront )(etre |be )?(desactiv|expire|supprim|bloqu|perd|release|deactivat|disabl|remov|lock|lost|reinitialis)|expire (dans|in) \d+ ?(h|heures|jours|days|hours)|\b(reactiv|renouvel|renew)\w*[- ](le|la|votre|your|it|now|ici|maintenant))/,
    titre: "Une prévente ou une « expiration » pour vous faire agir vite",
    aide: "Les fausses préventes promettent des gains énormes, et les fausses « expirations » menacent de vous retirer quelque chose. Ni l'un ni l'autre ne viennent d'un message : vérifiez toujours dans l'app officielle." },
  { w: 1,
    re: /(qr ?code|scann(ez|er|e) (ce|le|this))/,
    titre: "On vous demande de scanner un QR code",
    aide: "Un QR code peut cacher un faux site ou une demande de signature. Ne scannez pas un QR code reçu d'un inconnu." },
  { w: 1,
    re: /(urgent|urgence|immediatement|tout de suite|au plus vite|asap|immediately|dans les? (\d+) ?(h|heures|minutes)|within \d+|derniere chance|last chance|dernier (avertissement|rappel|message)|final (warning|notice)|expire|sous peine|avant (minuit|ce soir|demain|la fin|la cloture|la fermeture|le \d)|bientot (restreint|suspendu|ferme|bloque|supprime)|compte (sera |va etre |a ete |est )?(suspendu|bloque|restreint|compromis|desactive|ferme|supprime)|account (will be |has been |is )?(suspended|locked|restricted|compromised|disabled|closed)|(wallet|portefeuille) (sera |va etre |est )?(definitivement )?(bloque|compromis|locked|compromised|ferme|supprime)|agissez vite|act (now|fast)|il faut (agir|reagir|repondre)|agir (maintenant|vite|immediatement|rapidement)|offre limitee|limited (time|spots|offer)|places limitees|se termine (ce soir|aujourd'hui|bientot|demain)|prend fin|ends (tonight|today|soon)|aujourd'hui seulement|only today|repon(ds|dez) vite|reply (fast|quickly|now)|trop tard|too late|definitivement (ferme|supprime|bloque|perdu)|(date limite|deadline)|avant (la |le )?(date|fin|echeance)|stock limite)/,
    titre: "Le message vous met la pression",
    aide: "L'urgence sert à vous empêcher de réfléchir. Un vrai projet ne vous presse jamais : prenez le temps de vérifier." },
  { w: 1,
    re: /(message prive|\bmp\b|\bdm\b|en prive|ecri(s|t|vez)[- ]moi|salon prive|private (chat|room|channel)|chat prive|contact(e|ez)[- ]moi|repond(ez|s)[- ]moi|repondez a ce message|reply (to me|to this)|contact me|text me|write me|message me|(passe|passez|contact\w*|ecri\w*|write|message|add|ajout\w*|join|rejoin\w*|rejoign\w*)\b.{0,25}\b(telegram|whatsapp|discord|signal)\b|(mon|my) (telegram|whatsapp|discord|signal)\b|t\.me\/|avez[- ]vous (bien )?recu mon (message|mail|email))/,
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
  // Une simple question (« comment sauvegarder ma phrase ? ») ou un avertissement
  // (« ne donnez jamais vos 24 mots »), sans demande adressée à vous
  const simpleQuestion = (QUESTION.test(t) || AVERTISSEMENT.test(t) || PERSONNEL.test(t)) && !DEMANDE.test(t);
  for (const r of REGLES) {
    if (r.info && simpleQuestion) continue;
    if (r.re.test(t)) signaux.push({ w: r.w, titre: r.titre, aide: r.aide });
  }
  if (ADRESSE.test(texte) && /(envoy|send|transf|depos|virement|paye)/.test(t))
    signaux.push({ w: 2, titre: "On vous demande d'envoyer des fonds à une adresse", aide: "Une transaction sur Solana ne s'annule pas. N'envoyez jamais de crypto à une adresse reçue d'un inconnu." });
  if (MELANGE.test(texte.normalize("NFKD").replace(INVISIBLES, "")))
    signaux.push({ w: 2, titre: "Des lettres d'un autre alphabet sont déguisées dans un mot", aide: "Certaines lettres de ce message viennent de l'alphabet russe ou grec, mais ressemblent à des lettres normales. C'est une ruse pour tromper les filtres ou imiter un vrai nom, un vrai site." });
  signaux.push(...analyserLiens(texte));
  const score = signaux.reduce((s, x) => s + x.w, 0);
  let niveau = "ok";
  if (signaux.some((x) => x.w === 3) || score >= 5) niveau = "high";
  else if (signaux.some((x) => x.w === 2) || score >= 2) niveau = "mid";
  else if (score >= 1) niveau = "low";
  return { signaux: signaux.sort((a, b) => b.w - a.w), niveau };
}

const TEXTES = {
  seed: ["Stop : on dirait une phrase de récupération", "Si ce sont vos vrais mots, ne les collez nulle part, même ici. Nous avons effacé le texte. Si vous les avez déjà donnés à quelqu'un ou collés sur un site, déplacez vos fonds vers un nouveau portefeuille au plus vite."],
  high: ["Très suspect", "Ne répondez pas, ne cliquez sur rien, ne signez rien. Ce message contient des signaux typiques d'arnaque."],
  mid: ["À éviter", "Ce message contient au moins un signal d'arnaque. Ne cliquez pas et vérifiez par le site officiel, tapé à la main."],
  low: ["À surveiller", "Un signal faible. Ce n'est pas forcément une arnaque, mais vérifiez avant d'agir."],
  ok: ["Aucun signal connu", "Attention : notre outil ne repère que les arnaques courantes, et les arnaqueurs inventent sans cesse de nouvelles formules. Les règles restent les mêmes : ne donnez jamais vos 24 mots, ne signez rien que vous ne comprenez pas, et méfiez-vous de tout contact que vous n'avez pas demandé."],
};
// --- FIN LOGIQUE ---

if (typeof module !== "undefined") module.exports = { analyser, ressembleAPhrase, TEXTES };

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
