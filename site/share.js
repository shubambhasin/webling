// Share a link: the system share sheet where there is one (phones), otherwise copy it. The button says
// what happened for a moment.
function shareLink(button, url, text) {
  const done = (label) => {
    const was = button.dataset.label || (button.dataset.label = button.textContent);
    button.textContent = label;
    clearTimeout(button.shareTimer);
    button.shareTimer = setTimeout(() => (button.textContent = was), 2000);
  };
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    return navigator.share({ url, text }).catch(() => {});
  }
  return navigator.clipboard.writeText(url).then(() => done('Link copied ✓'), () => {
    prompt('Copy this link:', url);
  });
}
