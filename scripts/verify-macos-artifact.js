#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { listPackage } = require('@electron/asar');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PACKAGE = require(path.join(PROJECT_ROOT, 'package.json'));
const RELEASE_ROOT = path.resolve(
  process.env.PHOTO_DAY_RELEASE_ROOT || path.join(PROJECT_ROOT, 'release')
);
const ARTIFACT_STEM = `daily-photos-${PACKAGE.version}-mac-universal`;
const ZIP_PATH = path.join(RELEASE_ROOT, `${ARTIFACT_STEM}.zip`);
const DMG_PATH = path.join(RELEASE_ROOT, `${ARTIFACT_STEM}.dmg`);
const REQUIRED_ASAR_FILES = [
  '/src/electron/main.js',
  '/src/electron/preload.js',
  '/src/renderer/app.js',
  '/src/renderer/map.js',
  '/src/renderer/theme.js',
  '/src/server/index.js'
];
const REQUIRED_UNPACKED_SCRIPTS = [
  'generate-photo-previews.sh',
  'images-to-webp.sh'
];

function fail(message) {
  throw new Error(message);
}

function command(commandName, args, { allowFailure = false, env = process.env } = {}) {
  const result = spawnSync(commandName, args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env
  });
  if (result.error) fail(`${commandName}: ${result.error.message}`);
  if (!allowFailure && result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`${commandName} завершился с кодом ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim()
  };
}

function findApp(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  if (!app) fail(`В ${directory} не найден .app`);
  return path.join(directory, app.name);
}

function executablePath(appPath) {
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  const name = command('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleExecutable', plist]).output;
  const executable = path.join(appPath, 'Contents', 'MacOS', name);
  if (!fs.existsSync(executable)) fail(`Не найден executable ${executable}`);
  return executable;
}

function verifyContents(appPath) {
  const executable = executablePath(appPath);
  const architectures = command('lipo', ['-archs', executable]).output.split(/\s+/);
  for (const architecture of ['arm64', 'x86_64']) {
    if (!architectures.includes(architecture)) {
      fail(`В executable отсутствует архитектура ${architecture}: ${architectures.join(', ')}`);
    }
  }

  const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
  if (!fs.existsSync(asarPath)) fail('В приложении отсутствует app.asar');
  const asarFiles = new Set(listPackage(asarPath));
  for (const filename of REQUIRED_ASAR_FILES) {
    if (!asarFiles.has(filename)) fail(`В app.asar отсутствует ${filename}`);
  }

  const unpackedScripts = path.join(
    appPath,
    'Contents',
    'Resources',
    'app.asar.unpacked',
    'scripts'
  );
  for (const filename of REQUIRED_UNPACKED_SCRIPTS) {
    const script = path.join(unpackedScripts, filename);
    if (!fs.existsSync(script)) fail(`В packaged app отсутствует ${script}`);
  }
  console.log(`✓ Universal app (${architectures.join(' + ')}) и обязательные packaged-ресурсы`);
}

function verifySignature(appPath, { requireSigning }) {
  const strict = command('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
    allowFailure: true
  });
  const details = command('codesign', ['-dv', '--verbose=4', appPath], {
    allowFailure: true
  });
  const developerId = /Authority=Developer ID Application:/i.test(details.output);

  if (!requireSigning) {
    if (strict.status === 0 && developerId) {
      console.log('✓ Подпись Developer ID валидна');
    } else {
      console.log('! Локальная сборка не имеет валидной Developer ID подписи');
    }
    return;
  }

  if (strict.status !== 0) fail(`Невалидная code signature:\n${strict.output}`);
  if (!developerId) fail(`Приложение подписано не Developer ID Application:\n${details.output}`);
  command('spctl', ['--assess', '--verbose=4', '--type', 'exec', appPath]);
  command('xcrun', ['stapler', 'validate', appPath]);
  console.log('✓ Developer ID, Gatekeeper и notarization ticket');
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForTarget(port, child, output, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(`Packaged app завершился до smoke-проверки:\n${output.join('')}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page');
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch {
      // Electron ещё запускается.
    }
    await delay(150);
  }
  fail(`Packaged app не открыл CDP target за ${Math.round(timeoutMs / 1000)} секунд:\n${output.join('')}`);
}

function connectCdp(webSocketDebuggerUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketDebuggerUrl);
    const pending = new Map();
    const eventWaiters = new Map();
    let sequence = 0;

    socket.addEventListener('open', () => {
      resolve({
        close: () => socket.close(),
        command(method, params = {}) {
          sequence += 1;
          const id = sequence;
          return new Promise((commandResolve, commandReject) => {
            pending.set(id, { resolve: commandResolve, reject: commandReject });
            socket.send(JSON.stringify({ id, method, params }));
          });
        },
        once(method, timeoutMs = 10000) {
          return new Promise((eventResolve, eventReject) => {
            const timer = setTimeout(() => {
              eventWaiters.delete(method);
              eventReject(new Error(`Не получено CDP-событие ${method}`));
            }, timeoutMs);
            eventWaiters.set(method, (params) => {
              clearTimeout(timer);
              eventResolve(params);
            });
          });
        }
      });
    }, { once: true });
    socket.addEventListener('error', () => reject(new Error('Не удалось подключиться к CDP')));
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }
      const waiter = eventWaiters.get(message.method);
      if (waiter) {
        eventWaiters.delete(message.method);
        waiter(message.params);
      }
    });
  });
}

async function terminate(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  const deadline = Date.now() + 5000;
  while (child.exitCode === null && Date.now() < deadline) await delay(100);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function smokePackagedApp(appPath, temporaryRoot) {
  const executable = executablePath(appPath);
  const profile = path.join(temporaryRoot, 'smoke-profile');
  fs.mkdirSync(profile, { recursive: true });
  const port = await reservePort();
  const output = [];
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`
  ], {
    cwd: temporaryRoot,
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => output.push(String(chunk)));
  child.stderr.on('data', (chunk) => output.push(String(chunk)));

  let cdp = null;
  try {
    const target = await waitForTarget(port, child, output);
    cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.command('Runtime.enable');
    const readyDeadline = Date.now() + 15000;
    while (Date.now() < readyDeadline) {
      const ready = await cdp.command('Runtime.evaluate', {
        expression: `document.readyState === 'complete'
          && Boolean(globalThis.PhotoDayTheme)
          && Boolean(globalThis.PhotoDayMap)
          && Boolean(globalThis.photoDayDesktop)`,
        returnByValue: true
      });
      if (ready.result?.value === true) break;
      await delay(150);
    }
    const evaluation = await cdp.command('Runtime.evaluate', {
      expression: `(async () => {
        const themeResponse = await fetch('/theme.js', { cache: 'no-store' });
        const mapResponse = await fetch('/map.js', { cache: 'no-store' });
        const button = document.querySelector('#themeButton');
        const settings = document.querySelector('#archiveSettingsButton');
        const before = document.documentElement.dataset.theme;
        button?.click();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const after = document.documentElement.dataset.theme;
        return {
          readyState: document.readyState,
          title: document.title,
          themeStatus: themeResponse.status,
          mapStatus: mapResponse.status,
          themeApi: typeof globalThis.PhotoDayTheme?.applyTheme === 'function',
          mapApi: typeof globalThis.PhotoDayMap?.InteractiveMap === 'function',
          desktopBridge: Boolean(globalThis.photoDayDesktop),
          electronClass: document.body.classList.contains('is-electron'),
          settingsVisible: Boolean(settings) && getComputedStyle(settings).display !== 'none',
          themeChanged: Boolean(button) && before !== after
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    if (evaluation.exceptionDetails) {
      fail(`Renderer smoke завершился исключением: ${evaluation.exceptionDetails.text}`);
    }
    const state = evaluation.result?.value;
    const expected = {
      readyState: 'complete',
      themeStatus: 200,
      mapStatus: 200,
      themeApi: true,
      mapApi: true,
      desktopBridge: true,
      electronClass: true,
      settingsVisible: true,
      themeChanged: true
    };
    for (const [field, value] of Object.entries(expected)) {
      if (state?.[field] !== value) {
        fail(`Packaged renderer: ${field}=${JSON.stringify(state?.[field])}, ожидалось ${JSON.stringify(value)}`);
      }
    }
    console.log(`✓ Packaged Electron smoke: ${state.title}, preload/IPC, theme и map assets`);
  } finally {
    cdp?.close();
    await terminate(child);
  }
}

async function main() {
  if (process.platform !== 'darwin') fail('Проверка macOS-артефакта запускается только на macOS.');
  const requireSigning = process.argv.includes('--require-signing');
  const allowUnsigned = process.argv.includes('--allow-unsigned');
  const skipLaunch = process.argv.includes('--skip-launch')
    || process.env.PHOTO_DAY_SKIP_GUI_SMOKE === '1';
  if (requireSigning === allowUnsigned) {
    fail('Укажите ровно один режим: --require-signing или --allow-unsigned.');
  }
  for (const artifact of [ZIP_PATH, DMG_PATH]) {
    if (!fs.existsSync(artifact)) fail(`Не найден артефакт ${artifact}`);
  }

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-day-artifact-'));
  const zipRoot = path.join(temporaryRoot, 'zip');
  const mountRoot = path.join(temporaryRoot, 'dmg');
  const installedRoot = path.join(temporaryRoot, 'Applications');
  fs.mkdirSync(zipRoot);
  fs.mkdirSync(mountRoot);
  fs.mkdirSync(installedRoot);
  let mounted = false;
  try {
    command('ditto', ['-x', '-k', ZIP_PATH, zipRoot]);
    const zipApp = findApp(zipRoot);
    verifyContents(zipApp);
    verifySignature(zipApp, { requireSigning });

    command('hdiutil', ['verify', DMG_PATH]);
    command('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mountRoot, DMG_PATH]);
    mounted = true;
    const dmgApp = findApp(mountRoot);
    const installedApp = path.join(installedRoot, path.basename(dmgApp));
    command('ditto', [dmgApp, installedApp]);
    verifyContents(installedApp);
    verifySignature(installedApp, { requireSigning });
    console.log('✓ DMG смонтирован, приложение установлено во временный Applications-каталог');

    if (skipLaunch) {
      console.log('! GUI smoke пропущен через --skip-launch/PHOTO_DAY_SKIP_GUI_SMOKE');
    } else {
      await smokePackagedApp(installedApp, temporaryRoot);
    }
    console.log(`macOS artifact verification passed (${requireSigning ? 'release' : 'local'} mode).`);
  } finally {
    if (mounted) {
      command('hdiutil', ['detach', mountRoot], { allowFailure: true });
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Artifact verification failed: ${error.message}`);
  process.exitCode = 1;
});
