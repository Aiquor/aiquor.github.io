import '@/styles/globals.css';

// Keep decorative WebGL out of the page's initial interaction bundle.
function scheduleBackground() {
  if (!document.getElementById('background-root')) return;
  if (document.hidden) {
    document.addEventListener('visibilitychange', scheduleBackground, { once: true });
    return;
  }
  const mount = () => {
    void import('./background').catch(() => {
      // The cream page remains usable if the optional background cannot load.
    });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(mount, { timeout: 1500 });
  } else {
    setTimeout(mount, 200);
  }
}

if (document.readyState === 'complete') scheduleBackground();
else window.addEventListener('load', scheduleBackground, { once: true });
