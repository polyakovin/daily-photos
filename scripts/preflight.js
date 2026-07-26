#!/usr/bin/env node

const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REQUIRED_NODE = 'v24.15.0';
const REQUIRED_NPM = '11.12.1';
const REQUIRED_PACKAGES = {
  '@electron/asar': '3.4.1',
  electron: '37.10.3',
  'electron-builder': '26.15.3',
  'electron-updater': '6.8.9',
  exifr: '7.1.3'
};
const CONVERSION_PATH = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  process.env.PATH || ''
].join(path.delimiter);

const PNG_FIXTURE = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACXBIWXMAAAABAAAAAQBPJcTWAAAAF0lEQVR4nGP8x0AaYCFR/aiGUQ1DSAMAaw8BPJLkRBUAAAAASUVORK5CYII=';
const AVIF_FIXTURE = 'AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAAD5bWV0YQAAAAAAAAAvaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAFBpY3R1cmVIYW5kbGVyAAAAAA5waXRtAAAAAAABAAAAHmlsb2MAAAAARAAAAQABAAAAAQAAASEAAAAkAAAAKGlpbmYAAAAAAAEAAAAaaW5mZQIAAAAAAQAAYXYwMUNvbG9yAAAAAGppcHJwAAAAS2lwY28AAAAUaXNwZQAAAAAAAAAQAAAAEAAAABBwaXhpAAAAAAMICAgAAAAMYXYxQ4EADAAAAAATY29scm5jbHgAAgACAAIAAAAAF2lwbWEAAAAAAAAAAQABBAECgwQAAAAsbWRhdAoKAAAAAZ/41fIAgDIWEACXgBBAggAAEABcEytNbG+TY8nR6A==';
const HEIC_FIXTURE = 'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAXxtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAABoAABAAAAAAAAADcAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABodmMxAAAAAA5waXRtAAAAAAABAAAA/GlwcnAAAADcaXBjbwAAAHVodmNDAQNwAAAAAAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQApQgEBA3AAAAMAkAAAAwAAAwAeoCCBBZbqrprm4CGgwIAAAAyAAAADAIRiAAEABkQBwXPBiQAAABNjb2xybmNseAABAA0ABoAAAAAUaXNwZQAAAAAAAABAAAAAQAAAAChjbGFwAAAAEAAAAAEAAAAQAAAAAf///9AAAAAC////0AAAAAIAAAAQcGl4aQAAAAADCAgIAAAAGGlwbWEAAAAAAAAAAQABBYECAwWEAAAAP21kYXQAAAAzKAGvBjIWhzSJIPC/tQT///ZU/2X8l1qzWyeuEfpjx+S3kJGe9F97GFLlPHQg9JxTuc2A';

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: { ...process.env, PATH: CONVERSION_PATH },
    ...options
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`${command} завершился с кодом ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/).find(Boolean) || '';
}

function installedPackageVersion(name) {
  const manifest = path.join(PROJECT_ROOT, 'node_modules', name, 'package.json');
  if (!fs.existsSync(manifest)) fail(`Не установлен npm-пакет ${name}. Выполните npm ci.`);
  return JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
}

function checkRuntime() {
  assert.equal(
    process.version,
    REQUIRED_NODE,
    `Нужен Node ${REQUIRED_NODE.slice(1)}, сейчас ${process.version}. Выполните: nvm use`
  );
  const npmVersion = execFileSync('npm', ['--version'], {
    encoding: 'utf8',
    env: process.env
  }).trim();
  assert.equal(
    npmVersion,
    REQUIRED_NPM,
    `Нужен npm ${REQUIRED_NPM}, сейчас ${npmVersion}. После nvm use выполните npm --version.`
  );
  console.log(`✓ Node ${process.version.slice(1)}, npm ${npmVersion}`);

  for (const [name, expected] of Object.entries(REQUIRED_PACKAGES)) {
    const actual = installedPackageVersion(name);
    assert.equal(actual, expected, `${name}: ожидается ${expected}, установлен ${actual}. Выполните npm ci.`);
  }
  console.log(`✓ npm-зависимости: ${Object.entries(REQUIRED_PACKAGES).map(([name, version]) => `${name}@${version}`).join(', ')}`);
}

function checkExternalTools() {
  const versions = {
    cwebp: firstLine(run('cwebp', ['-version'])),
    gif2webp: firstLine(run('gif2webp', ['-version'])),
    webpinfo: firstLine(run('webpinfo', ['-version'])),
    ffmpeg: firstLine(run('ffmpeg', ['-version'])),
    exiftool: firstLine(run('exiftool', ['-ver'])),
    'heif-convert': firstLine(run('heif-convert', ['--version']))
  };
  console.log(`✓ Системные утилиты: ${Object.entries(versions).map(([name, version]) => `${name} (${version})`).join(', ')}`);
}

function checkRealConversions() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-preflight-'));
  const fixtures = [
    ['preflight-png.png', PNG_FIXTURE],
    ['preflight-avif.avif', AVIF_FIXTURE],
    ['preflight-heic.heic', HEIC_FIXTURE]
  ];
  try {
    for (const [filename, encoded] of fixtures) {
      fs.writeFileSync(path.join(temporaryRoot, filename), Buffer.from(encoded, 'base64'));
    }
    run('/bin/bash', [
      path.join(PROJECT_ROOT, 'scripts', 'images-to-webp.sh'),
      '--skip-previews',
      temporaryRoot
    ]);
    for (const [filename] of fixtures) {
      const output = path.join(temporaryRoot, `${path.parse(filename).name}.webp`);
      if (!fs.existsSync(output) || fs.statSync(output).size === 0) {
        fail(`Конвертация ${filename} не создала корректный WebP`);
      }
      run('webpinfo', ['-quiet', output]);
    }
    console.log('✓ Реальная конвертация PNG, AVIF и HEIC → WebP');
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function signingIdentityOutput() {
  if (process.platform !== 'darwin') return '';
  const result = spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
    encoding: 'utf8'
  });
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function notarizationCredentials() {
  const alternatives = [
    ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
    ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'],
    ['APPLE_KEYCHAIN_PROFILE']
  ];
  return alternatives.find((names) => names.every((name) => Boolean(process.env[name])));
}

function checkSigning({ required }) {
  if (process.platform !== 'darwin') {
    if (required) fail('Релизная macOS-сборка должна запускаться на macOS.');
    console.log('– Проверка подписи пропущена: текущая система не macOS');
    return;
  }
  const identityOutput = signingIdentityOutput();
  const hasInstalledIdentity = /Developer ID Application:/i.test(identityOutput);
  const hasImportedIdentity = Boolean(process.env.CSC_LINK);
  const hasSigning = hasInstalledIdentity || hasImportedIdentity;
  const notarization = notarizationCredentials();

  if (required && !hasSigning) {
    fail('Не найден Developer ID Application и не задан CSC_LINK. Релизная сборка остановлена.');
  }
  if (required && !notarization) {
    fail(
      'Не настроена notarization. Задайте APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER, '
      + 'APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID или APPLE_KEYCHAIN_PROFILE.'
    );
  }
  if (hasSigning) {
    console.log(`✓ Источник подписи: ${hasInstalledIdentity ? 'Developer ID Application в Keychain' : 'CSC_LINK'}`);
  } else {
    console.log('! Developer ID Application не найден: разрешена только локальная неподписанная сборка');
  }
  if (notarization) {
    console.log(`✓ Notarization credentials: ${notarization.join(', ')}`);
  } else {
    console.log('! Notarization не настроена: публикация macOS-релиза запрещена');
  }
}

function main() {
  const requireSigning = process.env.PHOTO_DAY_REQUIRE_SIGNING === '1';
  try {
    checkRuntime();
    checkExternalTools();
    checkRealConversions();
    checkSigning({ required: requireSigning });
    console.log(`Preflight завершён: ${requireSigning ? 'release' : 'local'} mode.`);
  } catch (error) {
    console.error(`Preflight failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  REQUIRED_NODE,
  REQUIRED_NPM,
  REQUIRED_PACKAGES,
  checkRealConversions,
  checkRuntime,
  checkSigning,
  notarizationCredentials
};
