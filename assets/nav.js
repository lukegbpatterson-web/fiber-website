/* Shared across every bayzl variant page: the hidden page switcher in the footer
   (click "Nature's blueprint for better eating." to reveal links to pages 1, 2, 3)
   and the footer year. */
(function(){
  const btn = document.querySelector(".tag-btn");
  const panel = document.getElementById("page-switch");
  if(!btn || !panel) return;

  function setOpen(open){
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if(open && window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      gsap.fromTo(panel.children,
        { opacity:0, y:-4 },
        { opacity:1, y:0, duration:.3, ease:"power2.out", stagger:.06 });
    }
  }
  btn.addEventListener("click", ()=> setOpen(panel.hidden));
  document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") setOpen(false); });
})();

const yearEl = document.getElementById("year");
if(yearEl) yearEl.textContent = new Date().getFullYear();
