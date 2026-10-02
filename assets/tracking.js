/* Meta Pixel (PageView on load) + Google Analytics 4.
   fbq()/gtag() calls queue up immediately, but the two third-party scripts are only fetched once the
   page's load event has fired, so they never compete with the hero image for bandwidth (LCP).
   The Lead events are fired from main.js only after the server confirms the email was saved. */
(function(){
  var cfg = window.BAYZL || {};
  var scripts = [];

  // ---- Meta Pixel: standard base-code queue stub, minus the immediate script insert ----
  if(cfg.META_PIXEL_ID && /^\d+$/.test(cfg.META_PIXEL_ID)){
    !function(f,n){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window);
    fbq('init', cfg.META_PIXEL_ID);
    fbq('track', 'PageView');
    scripts.push('https://connect.facebook.net/en_US/fbevents.js');
  }

  // ---- Google Analytics 4 ----
  if(cfg.GA4_ID){
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', cfg.GA4_ID);
    scripts.push('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.GA4_ID));
  }

  function inject(){
    scripts.forEach(function(src){
      var s = document.createElement('script');
      s.async = true; s.src = src;
      document.head.appendChild(s);
    });
  }
  if(document.readyState === 'complete') inject();
  else window.addEventListener('load', inject);
})();
