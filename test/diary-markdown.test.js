const assert = require('node:assert/strict');
const test = require('node:test');
const {
  AUTO_LINK_PATTERN,
  parseDiaryAutoLink
} = require('../src/renderer/diary-markdown');

test('распознаёт текстовые HTTP-ссылки и адреса с www', () => {
  assert.deepEqual(parseDiaryAutoLink('https://example.com/path?q=день'), {
    text: 'https://example.com/path?q=день',
    href: 'https://example.com/path?q=день',
    trailing: ''
  });
  assert.deepEqual(parseDiaryAutoLink('www.example.com/photos'), {
    text: 'www.example.com/photos',
    href: 'https://www.example.com/photos',
    trailing: ''
  });
  assert.equal(parseDiaryAutoLink('ftp://example.com'), null);
});

test('оставляет знаки предложения за пределами текстовой ссылки', () => {
  assert.deepEqual(parseDiaryAutoLink('https://example.com/photo).'), {
    text: 'https://example.com/photo',
    href: 'https://example.com/photo',
    trailing: ').'
  });
  assert.deepEqual(parseDiaryAutoLink('https://example.com/photo_(day).'), {
    text: 'https://example.com/photo_(day)',
    href: 'https://example.com/photo_(day)',
    trailing: '.'
  });
});

test('шаблон целиком захватывает ссылку с Markdown-символами в пути', () => {
  const pattern = new RegExp(AUTO_LINK_PATTERN, 'gi');
  assert.deepEqual(
    [...'Фото: https://example.com/my_photo_(day), готово'.matchAll(pattern)].map((match) => match[0]),
    ['https://example.com/my_photo_(day),']
  );
});
