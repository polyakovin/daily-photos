const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parseConversionProtocolLine } = require('../src/server/conversion-progress');

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o755 });
}

test('ошибка одного файла не мешает заменить остальные, включая AVIF без libwebp в ffmpeg', (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-conversion-'));
  const archiveRoot = path.join(temporaryRoot, 'archive');
  const binaryRoot = path.join(temporaryRoot, 'bin');
  fs.mkdirSync(archiveRoot);
  fs.mkdirSync(binaryRoot);
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const goodSource = path.join(archiveRoot, 'готово фото.jpg');
  const avifSource = path.join(archiveRoot, 'готово avif.avif');
  const failedSource = path.join(archiveRoot, 'сломано фото.jpg');
  fs.writeFileSync(goodSource, 'valid image fixture');
  fs.writeFileSync(avifSource, 'valid avif fixture');
  fs.writeFileSync(failedSource, 'broken image fixture');

  writeExecutable(path.join(binaryRoot, 'cwebp'), `#!/usr/bin/env bash
input="\${@: -3:1}"
output="\${@: -1}"
if [[ "$input" == *сломано* ]]; then
  echo "decoder failed: $input" >&2
  exit 1
fi
cp -- "$input" "$output"
`);
  writeExecutable(path.join(binaryRoot, 'webpinfo'), `#!/usr/bin/env bash
[[ -s "\${@: -1}" ]]
`);
  writeExecutable(path.join(binaryRoot, 'exiftool'), '#!/usr/bin/env bash\nexit 0\n');
  writeExecutable(path.join(binaryRoot, 'gif2webp'), '#!/usr/bin/env bash\nexit 0\n');
  writeExecutable(path.join(binaryRoot, 'ffmpeg'), `#!/usr/bin/env bash
input=""
for ((index = 1; index <= $#; index += 1)); do
  argument="\${!index}"
  if [[ "$argument" == "libwebp" ]]; then
    echo "Unknown encoder 'libwebp'" >&2
    exit 88
  fi
  if [[ "$argument" == "-i" ]]; then
    ((index += 1))
    input="\${!index}"
  fi
done
cp -- "$input" "\${@: -1}"
`);

  const result = spawnSync('/bin/bash', [
    path.resolve(__dirname, '../scripts/images-to-webp.sh'),
    '--delete-source',
    '--skip-previews',
    archiveRoot
  ], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${binaryRoot}:/usr/bin:/bin` }
  });

  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(goodSource), false);
  assert.equal(fs.existsSync(path.join(archiveRoot, 'готово фото.webp')), true);
  assert.equal(fs.existsSync(avifSource), false);
  assert.equal(fs.existsSync(path.join(archiveRoot, 'готово avif.webp')), true);
  assert.equal(fs.existsSync(failedSource), true);
  assert.equal(fs.existsSync(path.join(archiveRoot, 'сломано фото.webp')), false);

  const fileEvents = result.stdout
    .split(/\r?\n/)
    .map(parseConversionProtocolLine)
    .filter((event) => event?.type === 'file');
  assert.equal(fileEvents.some((event) => event.status === 'replaced' && event.filePath === goodSource), true);
  assert.equal(fileEvents.some((event) => event.status === 'replaced' && event.filePath === avifSource), true);
  assert.equal(fileEvents.some((event) => event.status === 'failed' && event.filePath === failedSource), true);
});
