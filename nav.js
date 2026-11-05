// Sur téléphone, fait défiler la barre d'onglets jusqu'à la page en cours
const nav = document.querySelector(".nav");
const actif = nav?.querySelector('[aria-current="page"]');
if (nav && actif && nav.scrollWidth > nav.clientWidth) {
  nav.scrollLeft = actif.offsetLeft - nav.offsetLeft - (nav.clientWidth - actif.offsetWidth) / 2;
}
const bord = () => nav?.classList.toggle("nav-fin", nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 4);
nav?.addEventListener("scroll", bord, { passive: true });
bord();
