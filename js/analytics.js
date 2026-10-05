// Set VITE_GA_MEASUREMENT_ID to connect these events to your GA4 property.
// Only event names and page paths are sent; never form contents or contact details.
const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
const enabled = /^G-[A-Z0-9]+$/.test(measurementId)
  && navigator.doNotTrack !== '1'
  && !navigator.globalPrivacyControl;

if (enabled) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: `${location.origin}${location.pathname}`,
    page_referrer: document.referrer ? new URL(document.referrer).origin : '',
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);
}

export function trackEvent(name, details = {}) {
  const parameters = { page_path: location.pathname, ...details };
  window.dispatchEvent(new CustomEvent('aiquor:analytics', { detail: { name, parameters } }));
  if (enabled && window.gtag) window.gtag('event', name, parameters);
}

document.querySelectorAll('a[href^="https://calendly.com/"]').forEach(link => {
  link.addEventListener('click', () => {
    const placement = link.closest('header') ? 'header' : link.closest('.hero') ? 'hero'
      : link.closest('.contact') ? 'contact' : 'content';
    trackEvent('booking_click', { placement });
  });
});
