'use strict';

const STORAGE_KEY = 'qingye.savedTabs';
const SESSION_KEY = 'qingye.lastSession';
const MAX_GROUP_TABS = 4;
const MAX_SAVED_ITEMS = 6;
const GROUP_TONES = ['tone-sage', 'tone-cream', 'tone-mist'];

async function getAllTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => {
    const url = tab.url || '';
    return !/^chrome:\/\//.test(url)
      && !/^chrome-extension:\/\//.test(url)
      && !/^edge:\/\//.test(url)
      && !/^about:/.test(url)
      && !/^brave:\/\//.test(url);
  });
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname || '未知页面';
  } catch {
    return '本地文件';
  }
}

function domainInitial(hostname) {
  const clean = hostname.replace(/^www\./, '');
  const first = clean.charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(first) ? first : '页';
}

function groupTabs(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    const hostname = getHostname(tab.url);
    if (!map.has(hostname)) map.set(hostname, []);
    map.get(hostname).push(tab);
  }

  return [...map.entries()]
    .map(([hostname, items]) => ({
      hostname,
      items,
      hiddenCount: Math.max(items.length - MAX_GROUP_TABS, 0)
    }))
    .sort((a, b) => b.items.length - a.items.length || a.hostname.localeCompare(b.hostname, 'zh-CN'));
}

function normalizeSearchInput(input) {
  const value = input.trim();
  if (!value) return '';
  if (/^(https?:\/\/|chrome:\/\/)/i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

async function openUrl(url) {
  if (!url) return;
  await chrome.tabs.create({ url });
}

async function getSavedTabs() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function setSavedTabs(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

async function saveTab(tab) {
  const items = await getSavedTabs();
  const exists = items.some((item) => item.url === tab.url);
  if (exists) return;
  items.unshift({
    id: String(Date.now()),
    title: tab.title || tab.url,
    url: tab.url,
    savedAt: new Date().toISOString()
  });
  await setSavedTabs(items);
}

async function removeSaved(id) {
  const items = await getSavedTabs();
  await setSavedTabs(items.filter((item) => item.id !== id));
}

async function focusTab(tabId, windowId) {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

async function closeTabs(ids) {
  if (!ids.length) return;
  await chrome.tabs.remove(ids);
}

function shortUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

function getFaviconUrl(tab) {
  if (tab.favIconUrl) return tab.favIconUrl;
  try {
    const { origin } = new URL(tab.url);
    return `${origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function cleanTitle(title, url) {
  if (!title) return url;
  return title.replace(/^\(\d+\)\s*/, '').trim();
}

function updateStats(totalTabs, groups, saved) {
  document.getElementById('savedCount').textContent = String(saved);
  document.getElementById('groupHint').textContent = `${groups} 个站点 · ${totalTabs} 个标签`;
  document.getElementById('savedHint').textContent = saved > MAX_SAVED_ITEMS ? `仅展示前 ${MAX_SAVED_ITEMS} 条` : '暂存区';
}

async function renderSaved() {
  const list = document.getElementById('savedList');
  const empty = document.getElementById('savedEmpty');
  const template = document.getElementById('savedTemplate');
  const items = await getSavedTabs();
  const visibleItems = items.slice(0, MAX_SAVED_ITEMS);

  list.innerHTML = '';
  if (!items.length) {
    empty.style.display = 'block';
    return items;
  }

  empty.style.display = 'none';
  for (const item of visibleItems) {
    const node = template.content.firstElementChild.cloneNode(true);
    const link = node.querySelector('.saved-link');
    link.href = item.url;
    link.textContent = item.title;
    node.querySelector('.reopen-btn').addEventListener('click', async () => {
      await chrome.tabs.create({ url: item.url });
    });
    node.querySelector('.remove-saved-btn').addEventListener('click', async () => {
      await removeSaved(item.id);
      await render();
    });
    list.appendChild(node);
  }
  return items;
}

async function focusGroup(group) {
  await saveCurrentSession();
  const currentTabs = await getAllTabs();
  const keepIds = new Set(group.items.map((item) => item.id));
  const closeIds = currentTabs.filter((tab) => !keepIds.has(tab.id)).map((tab) => tab.id);
  await closeTabs(closeIds);
}

async function renderGroups(tabs) {
  const groupsWrap = document.getElementById('groups');
  const groupTemplate = document.getElementById('groupTemplate');
  const tabTemplate = document.getElementById('tabTemplate');
  const groups = groupTabs(tabs);
  groupsWrap.innerHTML = '';

  for (const [index, group] of groups.entries()) {
    const node = groupTemplate.content.firstElementChild.cloneNode(true);
    const toneClass = GROUP_TONES[index % GROUP_TONES.length];
    node.classList.add(toneClass);
    node.querySelector('.group-title').textContent = group.hostname.replace(/^www\./, '');
    node.querySelector('.group-meta').textContent = `${group.items.length} 个标签`;
    node.querySelector('.group-badge').textContent = domainInitial(group.hostname);

    node.querySelector('.focus-group-btn').addEventListener('click', async () => {
      await focusGroup(group);
      await render();
    });

    node.querySelector('.close-group-btn').addEventListener('click', async () => {
      await closeTabs(group.items.map((item) => item.id));
      await render();
    });

    const list = node.querySelector('.tab-list');
    for (const tab of group.items.slice(0, MAX_GROUP_TABS)) {
      const tabNode = tabTemplate.content.firstElementChild.cloneNode(true);
      tabNode.querySelector('.tab-title').textContent = cleanTitle(tab.title, tab.url);
      tabNode.querySelector('.tab-url').textContent = shortUrl(tab.url);
      const favicon = tabNode.querySelector('.tab-favicon');
      const faviconUrl = getFaviconUrl(tab);
      if (faviconUrl) {
        favicon.src = faviconUrl;
      } else {
        favicon.style.display = 'none';
      }
      favicon.addEventListener('error', () => {
        favicon.style.display = 'none';
      });
      tabNode.querySelector('.tab-main').addEventListener('click', async () => {
        await focusTab(tab.id, tab.windowId);
      });
      tabNode.querySelector('.save-btn').addEventListener('click', async () => {
        await saveTab(tab);
        await render();
      });
      tabNode.querySelector('.close-btn').addEventListener('click', async () => {
        await closeTabs([tab.id]);
        await render();
      });
      list.appendChild(tabNode);
    }

    if (group.hiddenCount > 0) {
      const more = document.createElement('div');
      more.className = 'group-more';
      more.textContent = `还有 ${group.hiddenCount} 个没展开`;
      list.appendChild(more);
    }

    groupsWrap.appendChild(node);
  }

  return groups;
}

async function closeDuplicateTabs() {
  const tabs = await getAllTabs();
  const urlMap = new Map();
  const toClose = [];

  for (const tab of tabs) {
    const normalized = normalizeUrl(tab.url);
    if (!urlMap.has(normalized)) {
      urlMap.set(normalized, tab.id);
    } else {
      toClose.push(tab.id);
    }
  }

  await closeTabs(toClose);
}

async function closeAllWebTabs() {
  const tabs = await getAllTabs();
  await closeTabs(tabs.map((tab) => tab.id));
}

async function saveCurrentSession() {
  const tabs = await getAllTabs();
  const payload = tabs.map((tab) => ({ title: tab.title || tab.url, url: tab.url }));
  await chrome.storage.local.set({
    [SESSION_KEY]: {
      savedAt: new Date().toISOString(),
      tabs: payload
    }
  });
}

async function restoreLastSession() {
  const result = await chrome.storage.local.get([SESSION_KEY]);
  const session = result[SESSION_KEY];
  if (!session || !Array.isArray(session.tabs) || !session.tabs.length) return;

  for (const item of session.tabs) {
    if (!item?.url) continue;
    await chrome.tabs.create({ url: item.url, active: false });
  }
}

async function render() {
  const tabs = await getAllTabs();
  const [groups, saved] = await Promise.all([
    renderGroups(tabs),
    renderSaved()
  ]);
  updateStats(tabs.length, groups.length, saved.length);
}

document.getElementById('refreshBtn').addEventListener('click', render);
document.getElementById('searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('searchInput');
  const url = normalizeSearchInput(input.value);
  if (!url) return;
  await openUrl(url);
  input.value = '';
});
document.querySelectorAll('.quick-link').forEach((button) => {
  button.addEventListener('click', async () => {
    await openUrl(button.dataset.url || '');
  });
});
document.getElementById('saveSessionBtn').addEventListener('click', async () => {
  await saveCurrentSession();
  await render();
});
document.getElementById('restoreSessionBtn').addEventListener('click', async () => {
  await restoreLastSession();
  await render();
});
document.getElementById('closeDuplicatesBtn').addEventListener('click', async () => {
  await closeDuplicateTabs();
  await render();
});
document.getElementById('closeAllBtn').addEventListener('click', async () => {
  await closeAllWebTabs();
  await render();
});

render();
