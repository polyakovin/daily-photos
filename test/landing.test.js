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
  assert.doesNotMatch(html, /Organic Maps|Obsidian/);
  assert.match(html, /Добавить место/);
  assert.match(html, /Расставить без места · 12/);
  assert.match(html, /landing\.css\?v=7/);
  assert.match(html, /https:\/\/tile\.openstreetmap\.org\/2\/0\/1\.png/);
  assert.match(html, /© OpenStreetMap/);
  assert.ok(
    html.indexOf('class="mode mode-map"') > html.indexOf('class="mode mode-random"'),
    'карта должна быть последним режимом'
  );

  assert.match(styles, /\.mode-map\s*\{/);
  assert.match(styles, /\.map-demo-canvas\s*\{/);
  assert.match(styles, /\.map-demo-tiles\s*\{/);
  assert.match(styles, /\.map-photo-fan\s*\{/);
  assert.doesNotMatch(styles, /\.map-land(?:\s|\-|\.|\{)/);

  for (const relativePath of [
    'docs/screenshots/map-rome.jpg',
    'docs/screenshots/map-tunis.jpg',
    'docs/screenshots/map-kandy.jpg',
    'docs/screenshots/map-karachi.jpg'
  ]) {
    assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, relativePath);
  }
});
