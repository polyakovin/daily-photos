const fs = require('fs');
const path = require('path');

const PHOTO_DIRECTORY_NAMES = ['DCIM', 'Pictures', 'Photos', 'Images', 'Фото', 'Фотографии'];

function directoryExists(directory) {
  if (!directory) return false;
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

function listDirectories(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function addPhotoDirectories(candidates, parent, exists, pathApi) {
  for (const name of PHOTO_DIRECTORY_NAMES) {
    const candidate = pathApi.join(parent, name);
    if (exists(candidate)) candidates.push(candidate);
  }
}

function automaticPhotoRoots({
  platform = process.platform,
  homePath,
  picturesPath,
  environment = process.env,
  exists = directoryExists,
  list = listDirectories
} = {}) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  const candidates = [];
  if (picturesPath && exists(picturesPath)) candidates.push(picturesPath);

  if (platform === 'darwin') {
    const volumesRoot = '/Volumes';
    for (const volume of list(volumesRoot)) {
      addPhotoDirectories(candidates, pathApi.join(volumesRoot, volume), exists, pathApi);
    }
  } else if (platform === 'win32') {
    for (const oneDrive of [environment.OneDrive, environment.OneDriveConsumer]) {
      if (oneDrive) addPhotoDirectories(candidates, oneDrive, exists, pathApi);
    }
    for (let code = 67; code <= 90; code += 1) {
      addPhotoDirectories(candidates, `${String.fromCharCode(code)}:\\`, exists, pathApi);
    }
  } else {
    const userName = homePath ? pathApi.basename(homePath) : '';
    const mountRoots = [userName && pathApi.join('/media', userName), userName && pathApi.join('/run/media', userName), '/mnt'];
    for (const mountRoot of mountRoots.filter(Boolean)) {
      for (const volume of list(mountRoot)) {
        addPhotoDirectories(candidates, pathApi.join(mountRoot, volume), exists, pathApi);
      }
    }
  }

  return [...new Set(candidates.map((candidate) => pathApi.resolve(candidate)))];
}

module.exports = {
  PHOTO_DIRECTORY_NAMES,
  automaticPhotoRoots
};
