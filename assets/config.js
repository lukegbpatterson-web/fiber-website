/* The one place for site-wide tracking/backend settings. Nothing secret lives here:
   the Meta Conversions API token stays in the Apps Script's Script Properties. */
window.BAYZL = {
  // Meta dataset / Pixel ID (public by design: it is visible in the page source of any site using the Pixel)
  META_PIXEL_ID: "1662330358569350",
  // Google Analytics 4 measurement ID
  GA4_ID: "G-0LE6VK6ZT3",
  // Apps Script web app that saves the waitlist row and sends the Conversions API event.
  // Redeploying as a new VERSION of the same deployment keeps this URL unchanged.
  FORM_ENDPOINT: "https://script.google.com/macros/s/AKfycbxo6848fA-Ha-dFl9SZgPHUoTMDUeicscTcBu5QxBKrLmskbefb-rzRLWY90CfIrBN8Tw/exec"
};
