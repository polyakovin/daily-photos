const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const { automaticPhotoRoots } = require('../src/electron/photo-search-roots');

test('macOS auto search never scans the filesystem root or unrelated user folders', () => {
  const existing = new Set([
    '/Users/test/Pictures',
    '/Volumes/CAMERA/DCIM',
    '/Volumes/CAMERA/Music',
    '/Volumes/ARCHIVE/Photos'
  ]);
  const roots = automaticPhotoRoots({
    platform: 'darwin',
    homePath: '/Users/test',
    picturesPath: '/Users/test/Pictures',
    exists: (candidate) => existing.has(candidate),
    list: (candidate) => candidate === '/Volumes' ? ['CAMERA', 'ARCHIVE'] : []
  });

  assert.deepEqual(roots, [
    '/Users/test/Pictures',
    '/Volumes/CAMERA/DCIM',
    '/Volumes/ARCHIVE/Photos'
  ]);
  assert.equal(roots.includes(path.parse('/').root), false);
  assert.equal(roots.some((root) => root.includes('/Music')), false);
});

test('Windows auto search uses Pictures, OneDrive pictures, and photo folders on drives', () => {
  const existing = new Set([
    'C:\\Users\\test\\Pictures',
    'C:\\Users\\test\\OneDrive\\Pictures',
    'E:\\DCIM'
  ].map((candidate) => path.win32.resolve(candidate)));
  const roots = automaticPhotoRoots({
    platform: 'win32',
    homePath: 'C:\\Users\\test',
    picturesPath: 'C:\\Users\\test\\Pictures',
    environment: { OneDrive: 'C:\\Users\\test\\OneDrive' },
    exists: (candidate) => existing.has(path.win32.resolve(candidate)),
    list: () => []
  });

  assert.deepEqual(roots, [...existing]);
});
