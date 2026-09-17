import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appConfigUrl = new URL('../app.json', import.meta.url);

test('uses the Photo Day artwork for iOS and Android launcher icons', async () => {
  const config = JSON.parse(await readFile(appConfigUrl, 'utf8')).expo;
  assert.equal(config.icon, './assets/icon.png');
  assert.deepEqual(config.android.adaptiveIcon, {
    backgroundColor: '#0c2921',
    backgroundImage: './assets/android-icon-background.png',
    foregroundImage: './assets/android-icon-foreground.png'
  });

  const icon = await pngHeader(new URL('../assets/icon.png', import.meta.url));
  const background = await pngHeader(new URL('../assets/android-icon-background.png', import.meta.url));
  const foreground = await pngHeader(new URL('../assets/android-icon-foreground.png', import.meta.url));
  assert.deepEqual(icon, { bitDepth: 8, colorType: 2, height: 1024, width: 1024 });
  assert.deepEqual(background, { bitDepth: 8, colorType: 2, height: 1024, width: 1024 });
  assert.deepEqual(foreground, { bitDepth: 8, colorType: 6, height: 1024, width: 1024 });
});

async function pngHeader(url: URL) {
  const value = await readFile(url);
  assert.equal(value.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    bitDepth: value[24],
    colorType: value[25],
    height: value.readUInt32BE(20),
    width: value.readUInt32BE(16)
  };
}
