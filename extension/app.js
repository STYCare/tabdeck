'use strict';

const STORAGE_KEY = 'qingye.savedTabs';
const SESSION_KEY = 'qingye.lastSession';
const MAX_GROUP_TABS = 4;
const MAX_SAVED_ITEMS = 6;
const MAX_SEARCH_RESULTS = 6;
const GROUP_TONES = ['tone-sage', 'tone-cream', 'tone-mist'];

let currentQuery = '';
let latestTabs = [];
let latestSearchMatches = [];

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

function normalizeSearchInput(input) {
  const value = input.trim();
  if (!value) return '';
  if (/^(https?:\/\/|chrome:\/\/)/i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

function getSearchableText(tab) {
  return [tab.title || '', tab.url || '', getHostname(tab.url)]
    .join(' ')
    .toLowerCase();
}

function filterTabsByQuery(tabs, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return tabs;
  return tabs.filter((tab) => getSearchableText(tab).includes(trimmed));
}

function getSearchMatches(tabs, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return tabs
    .filter((tab) => getSearchableText(tab).includes(trimmed))
    .sort((a, b) => {
      const aTitle = (tabScore(a, trimmed));
      const bTitle = (tabScore(b, trimmed));
      return bTitle - aTitle;
    })
    .slice(0, MAX_SEARCH_RESULTS);
}

function tabScore(tab, query) {
  const title = (tab.title || '').toLowerCase();
  const url = (tab.url || '').toLowerCase();
  let score = 0;
  if (title.startsWith(query)) score += 5;
  if (title.includes(query)) score += 3;
  if (url.includes(query)) score += 2;
  return score;
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
  document.getElementById('groupHint').textContent = currentQuery
    ? `筛到 ${groups} 个站点 · ${totalTabs} 个标签`
    : `${groups} 个站点 · ${totalTabs} 个标签`;
  document.getElementById('savedHint').textContent = saved > MAX_SAVED_ITEMS ? `仅展示前 ${MAX_SAVED_ITEMS} 条` : '暂存区';
}

function renderSuggestions(matches, query) {
  const wrap = document.getElementById('searchSuggestions');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!query.trim() || !matches.length) {
    wrap.classList.remove('show');
    return;
  }

  for (const tab of matches) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-item';

    const favicon = getFaviconUrl(tab);
    button.innerHTML = `
      <img class="suggestion-favicon" src="${favicon}" alt="">
      <span class="suggestion-text">
        <span class="suggestion-title">${cleanTitle(tab.title, tab.url)}</span>
        <span class="suggestion-url">${shortUrl(tab.url)}</span>
      </span>
      <span class="suggestion-state">已打开</span>
    `;

    const img = button.querySelector('.suggestion-favicon');
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });

    button.addEventListener('click', async () => {
      await focusTab(tab.id, tab.windowId);
      const input = document.getElementById('searchInput');
      input.value = '';
      currentQuery = '';
      latestSearchMatches = [];
      await render();
    });

    wrap.appendChild(button);
  }

  wrap.classList.add('show');
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

  if (!groups.length && currentQuery.trim()) {
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = '没搜到已打开的标签。回车可以直接搜网页。';
    groupsWrap.appendChild(empty);
    return groups;
  }

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

    if (group.hiddenCount > 0 && !currentQuery.trim()) {
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
  latestTabs = await getAllTabs();
  const filteredTabs = filterTabsByQuery(latestTabs, currentQuery);
  latestSearchMatches = getSearchMatches(latestTabs, currentQuery);
  renderSuggestions(latestSearchMatches, currentQuery);
  const [groups, saved] = await Promise.all([
    renderGroups(filteredTabs),
    renderSaved()
  ]);
  updateStats(filteredTabs.length, groups.length, saved.length);
}

document.getElementById('refreshBtn').addEventListener('click', render);
document.getElementById('searchInput').addEventListener('input', async (event) => {
  currentQuery = event.target.value;
  await render();
});
document.getElementById('searchInput').addEventListener('keydown', async (event) => {
  if (event.key === 'Escape') {
    event.target.value = '';
    currentQuery = '';
    await render();
    return;
  }

  if (event.key === 'Enter' && latestSearchMatches.length > 0) {
    event.preventDefault();
    const first = latestSearchMatches[0];
    await focusTab(first.id, first.windowId);
    event.target.value = '';
    currentQuery = '';
    await render();
  }
});
document.getElementById('searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('searchInput');
  const raw = input.value.trim();
  if (!raw) return;

  if (latestSearchMatches.length > 0) {
    const first = latestSearchMatches[0];
    await focusTab(first.id, first.windowId);
  } else {
    const url = normalizeSearchInput(raw);
    if (!url) return;
    await openUrl(url);
  }

  input.value = '';
  currentQuery = '';
  await render();
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
