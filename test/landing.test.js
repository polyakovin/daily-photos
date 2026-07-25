const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.join(__dirname, '..');

test('лендинг показывает карту посещённых мест как отдельный режим', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(projectRoot, 'docs', 'landing.css'), 'utf8');

  assert.match(html, /02 — Семь взглядов/);
  assert.match(html, /class="mode mode-map"/);
  assert.match(html, /Соберите географию своей жизни/);
  assert.match(html, /Organic Maps и Obsidian/);
  assert.match(html, /Добавить место/);
  assert.match(html, /Расставить без места · 1/);
  assert.match(html, /landing\.css\?v=6/);

  assert.match(styles, /\.mode-map\s*\{/);
  assert.match(styles, /\.map-demo-canvas\s*\{/);
  assert.match(styles, /\.map-photo-fan\s*\{/);

  for (const relativePath of [
    'docs/screenshots/random.jpg',
    'docs/screenshots/week.jpg',
    'docs/screenshots/calendar.jpg'
  ]) {
    assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, relativePath);
  }
});
