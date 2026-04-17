'use strict';

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const realTabs = tabs.filter((tab) => {
      const url = tab.url || '';
      return !/^chrome:\/\//.test(url)
        && !/^chrome-extension:\/\//.test(url)
        && !/^edge:\/\//.test(url)
        && !/^about:/.test(url)
        && !/^brave:\/\//.test(url);
    });

    const count = realTabs.length;
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;
    const color = count <= 10 ? '#2f7d4a' : count <= 20 ? '#b7791f' : '#c53030';
    await chrome.action.setBadgeBackgroundColor({ color });
  } catch (error) {
    await chrome.action.setBadgeText({ text: '' });
  }
}

chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.tabs.onUpdated.addListener(updateBadge);

updateBadge();
