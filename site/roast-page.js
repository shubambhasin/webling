// The shared roast page (/r/<host>, made by api/roast.mjs): share it, or roast another site.
(() => {
  const share = document.getElementById('share');
  if (share) share.onclick = () => shareLink(share, share.dataset.url, share.dataset.text);

  const form = document.getElementById('roast');
  form.onsubmit = (e) => {
    e.preventDefault();
    const host = WL.voice.hostOf(document.getElementById('roast-input').value);
    document.getElementById('roast-error').hidden = !!host;
    if (!host) return;
    // a random take; the vibe carries over from the roast you came from
    const q = new URLSearchParams({ t: Math.floor(Math.random() * 1000) });
    if (form.dataset.vibe) q.set('v', form.dataset.vibe);
    location.href = `/r/${host}?${q}`;
  };
})();
