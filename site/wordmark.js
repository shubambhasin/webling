// The pixel wordmark: <canvas class="wordmark" data-text="WEBLING" data-cell="6"> gets drawn on load.
// Also used by the store art (store/).
function drawWordmark(c) {
  const FONT = {
    W: ['1...1', '1...1', '1...1', '1.1.1', '1.1.1', '1.1.1', '.1.1.'],
    E: ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
    B: ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'],
    L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
    I: ['111', '.1.', '.1.', '.1.', '.1.', '.1.', '111'],
    N: ['1...1', '11..1', '11..1', '1.1.1', '1..11', '1..11', '1...1'],
    G: ['.111.', '1...1', '1....', '1.111', '1...1', '1...1', '.111.'],
  };
  const text = c.dataset.text, cell = Number(c.dataset.cell), dpr = Math.max(1, Math.round(devicePixelRatio || 1));
  const glyphs = [...text].map((ch) => FONT[ch]);
  const cols = glyphs.reduce((s, g) => s + g[0].length + 1, 0);
  c.width = (cols + 1) * cell * dpr;
  c.height = 8 * cell * dpr;
  c.style.width = `${(cols + 1) * cell}px`;
  const g = c.getContext('2d');
  const paint = (dx, dy, color) => {
    g.fillStyle = color;
    let x = 0;
    for (const glyph of glyphs) {
      glyph.forEach((row, y) => [...row].forEach((on, i) => {
        if (on === '1') g.fillRect(Math.round((x + i + dx) * cell * dpr), Math.round((y + dy) * cell * dpr), cell * dpr, cell * dpr);
      }));
      x += glyph[0].length + 1;
    }
  };
  paint(0.5, 0.5, '#ff5fa2');
  paint(0, 0, '#f4efff');
}

document.querySelectorAll('canvas.wordmark').forEach(drawWordmark);
