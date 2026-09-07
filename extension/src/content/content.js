// ZeroFeed Content Script: Feed Blocker
(function () {
  const BLOCK_RULES = {
    'youtube.com': [
      '#primary:has(ytd-rich-grid-renderer)',
      'ytd-rich-grid-renderer',
      'ytd-reel-shelf-renderer',
      '#related',
    ],
    'twitter.com': [
      '[data-testid="primaryColumn"] [aria-label="Timeline: Your Home Timeline"]',
    ],
    'x.com': [
      '[data-testid="primaryColumn"] [aria-label="Timeline: Your Home Timeline"]',
    ],
    'linkedin.com': [
      '.scaffold-finite-scroll',
      '.feed-shared-update-v2',
    ],
  };

  const hostname = window.location.hostname;
  const matchedDomain = Object.keys(BLOCK_RULES).find((domain) => hostname.includes(domain));

  if (!matchedDomain) return;

  const selectors = BLOCK_RULES[matchedDomain];
  const style = document.createElement('style');
  style.textContent = `${selectors.join(', ')} { display: none !important; }`;
  (document.head || document.documentElement).appendChild(style);

  console.log(`[ZeroFeed] Focus Guard active on ${matchedDomain}. Feed elements hidden.`);
})();
