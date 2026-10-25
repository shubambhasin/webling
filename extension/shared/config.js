// Settings that change between local dev and a real release.
(() => {
  const WL = (globalThis.WL ||= {});
  WL.config = {
    // The presence server (server/), as a wss:// URL. Empty turns presence off. The dev harness sets
    // ws://localhost:8787 for itself.
    presenceUrl: '',
    // Where share cards send people.
    shareUrl: 'https://webling.vercel.app',
    // Most other weblings drawn on one page; the count chip still shows everyone.
    maxGhosts: 12,
    // Draw a light outline around pets (for dark pages that set it, like the landing page).
    halo: false,
  };
})();
