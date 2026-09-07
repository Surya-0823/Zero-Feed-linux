// ZeroFeed Manifest V3 Background Service Worker
const BACKEND_URL = 'http://localhost:4000';

chrome.runtime.onInstalled.addListener(() => {
  console.log('ZeroFeed Extension installed and background worker active.');
  chrome.storage.local.set({
    policyStatus: 'ACTIVE',
    lastSync: new Date().toISOString(),
    blockedRules: ['youtube_home', 'youtube_shorts', 'twitter_feed', 'linkedin_feed']
  });
});
