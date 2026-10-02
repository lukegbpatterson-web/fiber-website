/* bayzl waitlist: form, success state + survey, attribution capture, mobile sticky bar.
   No dependencies. Config comes from assets/config.js, the variant (A/B/C) from <html data-variant>. */
(function(){
  "use strict";
  var cfg = window.BAYZL || {};
  var VARIANT = document.documentElement.getAttribute("data-variant") || "";
  var ATTR_KEYS = ["utm_source", "utm_campaign", "utm_content", "fbclid"];
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var TIMEOUT_MS = 25000; // Apps Script cold starts can take several seconds

  /* -------- helpers -------- */
  function store(){ try{ return window.sessionStorage; }catch(e){ return null; } }
  function cookie(name){
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }
  function uuid(){
    if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function(x){ return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  }

  /* -------- attribution: read URL params, keep them for the session -------- */
  var attr = (function(){
    var s = store(), saved = {};
    try{ saved = JSON.parse((s && s.getItem("bayzl_attr")) || "{}") || {}; }catch(e){}
    var params = new URLSearchParams(window.location.search);
    ATTR_KEYS.forEach(function(k){
      var v = params.get(k);
      if(v) saved[k] = v.slice(0, 200);
    });
    try{ if(s) s.setItem("bayzl_attr", JSON.stringify(saved)); }catch(e){}
    return saved;
  })();

  function fbc(){
    var c = cookie("_fbc");
    if(c) return c;
    if(attr.fbclid) return "fb.1." + Date.now() + "." + attr.fbclid; // Meta's documented format
    return "";
  }

  /* -------- network -------- */
  // text/plain keeps this a "simple" CORS request (no preflight, which Apps Script can't answer),
  // and Apps Script's redirected response is readable cross-origin.
  function post(body, timeoutMs){
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, timeoutMs) : null;
    return fetch(cfg.FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
      keepalive: false
    }).then(function(r){
      if(timer) clearTimeout(timer);
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }, function(err){ if(timer) clearTimeout(timer); throw err; });
  }

  /* -------- state -------- */
  var wraps = Array.prototype.slice.call(document.querySelectorAll("[data-join-wrap]"));
  var joined = false;
  var eventId = "";        // the event_id of the row we saved (used by survey answers)
  var pending = { email: "", id: "" }; // reuse the same event_id if the user retries the same email

  var sticky = document.getElementById("sticky-cta");
  var stickyBtn = document.getElementById("sticky-btn");
  var heroWrap = wraps[0];

  function showJoined(sourceWrap, withSurvey){
    joined = true;
    wraps.forEach(function(w){
      w.querySelector("form").hidden = true;
      var j = w.querySelector("[data-joined]");
      j.hidden = false;
      var sv = j.querySelector("[data-survey]");
      if(sv) sv.hidden = !(withSurvey && w === sourceWrap);
    });
    if(sticky) sticky.hidden = true;
    var own = sourceWrap.querySelector("[data-joined]");
    if(own){ try{ own.focus({ preventScroll: true }); }catch(e){} }
  }

  /* -------- submit -------- */
  wraps.forEach(function(wrap){
    var form = wrap.querySelector("form");
    var input = form.querySelector("input[type=email]");
    var btn = form.querySelector("button[type=submit]");
    var err = form.querySelector(".field-error");
    var busy = false;

    function setError(msg){
      err.textContent = msg || "";
      if(msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    }
    input.addEventListener("input", function(){ setError(""); });

    form.addEventListener("submit", function(e){
      e.preventDefault();
      if(busy) return; // double-submit guard
      var email = input.value.trim();
      if(!EMAIL_RE.test(email) || email.length > 254){
        setError("That email doesn't look right");
        input.focus();
        return;
      }
      setError("");
      busy = true;
      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = "Joining…";
      btn.setAttribute("aria-busy", "true");

      if(pending.email !== email.toLowerCase()){ pending = { email: email.toLowerCase(), id: uuid() }; }
      var id = pending.id;

      post({
        action: "join",
        email: email,
        event_id: id,
        variant: VARIANT,
        utm_source: attr.utm_source || "",
        utm_campaign: attr.utm_campaign || "",
        utm_content: attr.utm_content || "",
        fbclid: attr.fbclid || "",
        fbp: cookie("_fbp"),
        fbc: fbc(),
        user_agent: navigator.userAgent,
        page_url: window.location.href
      }, TIMEOUT_MS).then(function(res){
        if(!res || res.ok !== true) throw new Error((res && res.error) || "bad response");
        eventId = res.event_id || id;
        if(!res.duplicate){
          // Only now, after the server confirmed the save: fire the Lead (deduplicated with the
          // server event through the shared event_id) and the GA4 count.
          try{ if(window.fbq) fbq("track", "Lead", { content_name: VARIANT }, { eventID: id }); }catch(e){}
          try{ if(window.gtag) gtag("event", "generate_lead", { variant: VARIANT }); }catch(e){}
        }
        showJoined(wrap, true);
      }).catch(function(){
        busy = false;
        btn.disabled = false;
        btn.textContent = label;
        btn.removeAttribute("aria-busy");
        setError("Something went wrong. Please try again.");
      });
    });
  });

  /* -------- optional survey (one tap each, saved to the same row) -------- */
  document.addEventListener("click", function(e){
    var opt = e.target.closest && e.target.closest(".opt");
    if(!opt || !eventId) return;
    var group = opt.closest(".opts");
    Array.prototype.forEach.call(group.querySelectorAll(".opt"), function(b){ b.setAttribute("aria-pressed", String(b === opt)); });
    var body = { action: "survey", event_id: eventId };
    body[opt.getAttribute("data-q")] = opt.getAttribute("data-v");
    post(body, TIMEOUT_MS).catch(function(){ /* optional; ignore */ });
    var survey = opt.closest("[data-survey]");
    var answered = survey.querySelectorAll(".opt[aria-pressed=true]").length;
    if(answered >= 2) survey.querySelector("[data-survey-thanks]").hidden = false;
  });

  /* -------- sticky bar: visible once both forms are off screen, until joined -------- */
  if(sticky && stickyBtn && heroWrap && "IntersectionObserver" in window){
    var visible = {};
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ visible[en.target.id || "x"] = en.isIntersecting; });
      var anyFormVisible = Object.keys(visible).some(function(k){ return visible[k]; });
      sticky.hidden = joined || anyFormVisible;
    });
    [document.getElementById("hero-form"), document.getElementById("final-form")].forEach(function(el){ if(el) io.observe(el); });
    stickyBtn.addEventListener("click", function(){
      var target = document.getElementById("hero-form");
      var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      var input = target.querySelector("input[type=email]");
      if(input) input.focus({ preventScroll: true });
    });
  }

  /* -------- ingredient tooltips: tap-to-toggle on touch (hover handles desktop in CSS) -------- */
  if(window.matchMedia && matchMedia("(hover: none)").matches){
    var chips = document.querySelectorAll(".chip");
    Array.prototype.forEach.call(chips, function(chip){
      chip.addEventListener("click", function(e){
        e.stopPropagation();
        var wasOpen = chip.classList.contains("is-open");
        Array.prototype.forEach.call(chips, function(c){ c.classList.remove("is-open"); });
        if(!wasOpen) chip.classList.add("is-open");
      });
    });
    document.addEventListener("click", function(){
      Array.prototype.forEach.call(chips, function(c){ c.classList.remove("is-open"); });
    });
  }

  /* -------- scroll reveals for the sections below the hero (hero reveals are pure CSS) -------- */
  var reveals = document.querySelectorAll(".section .reveal");
  if("IntersectionObserver" in window){
    var rio = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add("is-in"); rio.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    Array.prototype.forEach.call(reveals, function(el){ rio.observe(el); });
  }else{
    Array.prototype.forEach.call(reveals, function(el){ el.classList.add("is-in"); });
  }

  /* -------- hero background effect (Three.js, per variant) --------
     Loaded only after the page has finished loading, so it never competes with the hero image or the
     form. Skipped for reduced-motion and data-saver users. */
  var bg = document.documentElement.getAttribute("data-bg");
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function startBackground(){
    loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js")
      .then(function(){ return loadScript(bg); })
      .catch(function(){ /* decorative only */ });
  }
  if(bg && !reduceMotion && !saveData){
    var go = function(){ setTimeout(function(){ if(window.requestIdleCallback) requestIdleCallback(startBackground, { timeout: 2500 }); else startBackground(); }, 1500); };
    if(document.readyState === "complete") go(); else window.addEventListener("load", go);
  }

  var y = document.getElementById("year");
  if(y) y.textContent = new Date().getFullYear();
})();
