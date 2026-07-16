const LATEST_RELEASE_API = 'https://api.github.com/repos/polyakovin/daily-photos/releases/latest';
const METRIKA_COUNTER_ID = 110791700;

function trackMetrikaGoal(target, params) {
  if (typeof window.ym !== 'function') return;
  window.ym(METRIKA_COUNTER_ID, 'reachGoal', target, params);
}

function handleMetrikaGoalClick(event) {
  const trigger = event.target.closest?.('[data-metrika-goal]');
  if (!trigger) return;

  trackMetrikaGoal(trigger.dataset.metrikaGoal, {
    cta_location: trigger.dataset.metrikaPlacement || 'unknown',
    platform: detectDownloadPlatform(navigator)
  });
}

function isMobileDevice(navigatorObject, windowObject = window) {
  const userAgent = navigatorObject.userAgent || '';
  const platform = navigatorObject.userAgentData?.platform
    || navigatorObject.platform
    || userAgent;

  return navigatorObject.userAgentData?.mobile === true
    || /android|iphone|ipad|ipod|mobile/i.test(userAgent)
    || (navigatorObject.maxTouchPoints > 1 && /macintel/i.test(platform))
    || windowObject.matchMedia?.('(max-width: 720px)').matches === true;
}

function detectDownloadPlatform(navigatorObject) {
  const userAgent = navigatorObject.userAgent || '';
  const platform = navigatorObject.userAgentData?.platform
    || navigatorObject.platform
    || userAgent;

  if (/iphone|ipad|ipod/i.test(userAgent)) return 'other';
  if (/mac/i.test(platform) && !(navigatorObject.maxTouchPoints > 1 && /macintel/i.test(platform))) return 'macos';
  if (/win/i.test(platform)) return 'windows';
  return 'other';
}

function selectDownloadAsset(assets, platform) {
  if (!Array.isArray(assets)) return null;

  const extension = platform === 'macos' ? '.dmg' : platform === 'windows' ? '.exe' : '';
  if (!extension) return null;

  const candidates = assets.filter((asset) => (
    typeof asset?.name === 'string'
    && typeof asset?.browser_download_url === 'string'
    && asset.name.toLowerCase().endsWith(extension)
  ));

  const preferredMarker = platform === 'macos' ? 'universal' : 'x64';
  return candidates.find((asset) => asset.name.toLowerCase().includes(preferredMarker))
    || candidates[0]
    || null;
}

function downloadPresentation(platform) {
  if (platform === 'macos') {
    return {
      buttonText: 'Скачать для macOS',
      note: 'DMG · Apple Silicon и Intel',
      ariaLabel: 'Скачать «Фото дня» для macOS'
    };
  }
  if (platform === 'windows') {
    return {
      buttonText: 'Скачать для Windows',
      note: 'EXE · Windows x64',
      ariaLabel: 'Скачать «Фото дня» для Windows'
    };
  }
  return null;
}

async function enhanceDownloadLinks() {
  if (isMobileDevice(navigator)) {
    for (const button of document.querySelectorAll('[data-download]')) {
      button.hidden = true;
    }
    for (const notice of document.querySelectorAll('[data-mobile-availability]')) {
      notice.hidden = false;
    }

    const note = document.querySelector('#downloadPlatformNote');
    if (note) {
      note.textContent = 'Доступно только на компьютере · macOS и Windows';
      note.classList.add('is-mobile-availability');
    }
    return;
  }

  const platform = detectDownloadPlatform(navigator);
  const presentation = downloadPresentation(platform);
  if (!presentation) return;

  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) return;

    const release = await response.json();
    const asset = selectDownloadAsset(release.assets, platform);
    if (!asset) return;

    for (const button of document.querySelectorAll('[data-download]')) {
      button.href = asset.browser_download_url;
      button.setAttribute('aria-label', presentation.ariaLabel);
      const label = button.querySelector('[data-download-text]');
      if (label) label.textContent = presentation.buttonText;
    }

    const note = document.querySelector('#downloadPlatformNote');
    if (note) note.textContent = presentation.note;
  } catch {
    // Сохраняем рабочую ссылку на страницу последнего релиза.
  }
}

document.addEventListener('DOMContentLoaded', enhanceDownloadLinks);
document.addEventListener('click', handleMetrikaGoalClick);
