(function exposePhotoDayDiaryMarkdown(root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.PhotoDayDiaryMarkdown = api;
}(typeof globalThis === 'object' ? globalThis : this, () => {
  const AUTO_LINK_PATTERN = String.raw`(?:https?:\/\/|www\.)[^\s<>"']+`;
  const AUTO_LINK_PREFIX_PATTERN = /^(?:https?:\/\/|www\.)/i;
  const TRAILING_PUNCTUATION_PATTERN = /[.,!?;:…]+$/u;
  const BRACKET_PAIRS = Object.freeze([
    ['(', ')'],
    ['[', ']'],
    ['{', '}']
  ]);

  function characterCount(value, character) {
    return [...value].filter((current) => current === character).length;
  }

  function parseDiaryAutoLink(value) {
    const source = String(value || '');
    if (!AUTO_LINK_PREFIX_PATTERN.test(source)) return null;

    let text = source;
    let trailing = '';
    const punctuation = text.match(TRAILING_PUNCTUATION_PATTERN)?.[0] || '';
    if (punctuation) {
      text = text.slice(0, -punctuation.length);
      trailing = punctuation;
    }

    let trimmedBracket = true;
    while (trimmedBracket) {
      trimmedBracket = false;
      for (const [opening, closing] of BRACKET_PAIRS) {
        if (!text.endsWith(closing)) continue;
        if (characterCount(text, closing) <= characterCount(text, opening)) continue;
        text = text.slice(0, -1);
        trailing = `${closing}${trailing}`;
        trimmedBracket = true;
        break;
      }
    }

    const prefix = text.match(AUTO_LINK_PREFIX_PATTERN)?.[0] || '';
    if (text.length <= prefix.length) return null;

    return {
      text,
      href: /^www\./i.test(text) ? `https://${text}` : text,
      trailing
    };
  }

  return {
    AUTO_LINK_PATTERN,
    parseDiaryAutoLink
  };
}));
