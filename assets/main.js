/* =====================================================================
   bayzl — shared logic for the landing-page variants (waitlist form,
   ingredient tooltips on touch, scroll reveals). Each page loads its own
   background script separately (bg-dust.js, bg-slices.js).

   CONFIG — paste your deployed Google Apps Script Web App URL below to
   connect the waitlist form to a Google Sheet. Leave it empty to run in
   demo mode (shows a success state, sends nothing). See README.md.
   ===================================================================== */
const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbxo6848fA-Ha-dFl9SZgPHUoTMDUeicscTcBu5QxBKrLmskbefb-rzRLWY90CfIrBN8Tw/exec";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* -------------------- email capture -------------------- */
function wireForm(formId, successId){
  const form = document.getElementById(formId);
  const success = document.getElementById(successId);
  if(!form) return;
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const input = form.querySelector('input[type="email"]');
    if(!input.checkValidity()){ input.reportValidity(); return; }
    const email = input.value.trim();
    const btn = form.querySelector("button");
    const originalLabel = btn.textContent;
    btn.disabled = true; btn.textContent = "Joining…";
    try{
      if(FORM_ENDPOINT){
        // Google Apps Script web apps don't send CORS headers, so the
        // response can't be read from here — "no-cors" lets the POST go
        // through anyway (fire-and-forget). Form-encoded body keeps this a
        // "simple request" so the browser skips the CORS preflight, which
        // Apps Script doesn't handle and would otherwise reject.
        await fetch(FORM_ENDPOINT, {
          method:"POST",
          mode:"no-cors",
          headers:{ "Content-Type":"application/x-www-form-urlencoded" },
          body: new URLSearchParams({ email, source: window.location.href })
        });
      }
      form.setAttribute("hidden","");
      if(success){ success.hidden = false; success.style.opacity = 1; success.style.transform = "none"; }
    }catch(err){
      btn.disabled = false; btn.textContent = originalLabel;
      alert("Something went wrong — please try again.");
    }
  });
}
wireForm("join", "success-hero");
wireForm("join2", "success-final");

/* -------------------- hero mockup: appear together with its shadow once the image has loaded -------------------- */
(function heroMockup(){
  const wrap = document.querySelector(".product-wrap");
  const img = wrap && wrap.querySelector("img");
  if(!img) return;
  const show = ()=> wrap.classList.remove("is-loading");
  if(img.complete) show();
  else{ img.addEventListener("load", show); img.addEventListener("error", show); }
  setTimeout(show, 3000); // failsafe: never leave the mockup hidden
})();

/* -------------------- ingredient tooltips: tap-to-toggle on touch -------------------- */
if(window.matchMedia("(hover: none)").matches){
  const chips = document.querySelectorAll(".chip");
  chips.forEach((chip)=>{
    chip.addEventListener("click", (e)=>{
      e.stopPropagation();
      const wasOpen = chip.classList.contains("is-open");
      chips.forEach((c)=>c.classList.remove("is-open"));
      if(!wasOpen) chip.classList.add("is-open");
    });
  });
  document.addEventListener("click", ()=>chips.forEach((c)=>c.classList.remove("is-open")));
}

/* -------------------- scroll reveals (GSAP) -------------------- */
if(!reduceMotion && window.gsap){
  gsap.registerPlugin(ScrollTrigger);

  gsap.set(".reveal", { opacity:0, y:18 });
  gsap.to(".hero .reveal", { opacity:1, y:0, duration:1, ease:"power3.out", stagger:0.12, delay:0.15 });

  gsap.utils.toArray(".section .reveal").forEach((el)=>{
    if(el.closest(".hero")) return;
    gsap.to(el, {
      opacity:1, y:0, duration:0.9, ease:"power3.out",
      scrollTrigger:{ trigger:el, start:"top 85%" }
    });
  });

  // Failsafe: if the ticker never advances (backgrounded tab, throttled rAF),
  // reveal everything so critical content is never left hidden.
  setTimeout(()=>{
    if(gsap.globalTimeline.totalProgress() === 0){
      gsap.set(".reveal", { clearProps:"opacity,transform" });
    }
  }, 2500);
}
