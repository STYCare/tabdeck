'use strict';

const STORAGE_KEY = 'qingye.savedTabs';
const SESSION_KEY = 'qingye.lastSession';
const QUICK_LINKS_KEY = 'qingye.quickLinks';
const MAX_GROUP_TABS = 4;
const MAX_SAVED_ITEMS = 6;
const MAX_SEARCH_RESULTS = 6;
const GROUP_TONES = ['tone-sage', 'tone-cream', 'tone-mist'];
const BRAND = {
  zh: '清页',
  en: 'TabDeck'
};
const DEFAULT_QUICK_LINKS = [
  { name: 'Google', url: 'https://www.google.com' },
  { name: 'GitHub', url: 'https://github.com' },
  { name: 'YouTube', url: 'https://www.youtube.com' },
  { name: 'Bookmarks', url: 'chrome://bookmarks/' }
];

const DICTS = {
  zh: {
    searchPlaceholder: '搜索已打开标签、网页或直接输入网址',
    searchButton: '搜索',
    currentTabs: '标签概览',
    refresh: '刷新',
    saveSession: '保存会话',
    restoreSession: '恢复会话',
    dedupe: '去重',
    closeAll: '全部关闭',
    saved: '稍后处理',
    savedCountSuffix: '条',
    savedEmpty: '还没有保存的标签。现在还算清爽。',
    focusThis: '专注这个',
    closeGroup: '关闭这组',
    saveForLater: '稍后',
    closeTab: '关闭',
    open: '打开',
    remove: '移除',
    savedZone: '暂存区',
    showTopSaved: `仅展示前 ${MAX_SAVED_ITEMS} 条`,
    groupHint: (groups, tabs) => `${groups} 个站点 · ${tabs} 个标签`,
    groupHintFiltered: (groups, tabs) => `筛到 ${groups} 个站点 · ${tabs} 个标签`,
    opened: '已打开',
    openedCount: (count) => `已开 ${count} 个`,
    noSearchMatch: '没搜到已打开的标签。回车可以直接搜网页。',
    hiddenTabs: (count) => `还有 ${count} 个没展开`,
    groupMeta: (count) => `${count} 个标签`,
    quickLinksLabel: '常用入口',
    editQuickLinks: '编辑快捷入口',
    resetQuickLinks: '恢复默认',
    quickLinksPrompt: '按“名称,网址”每行一条，例如\nGoogle,https://www.google.com',
    quickLinksSaved: '快捷入口已更新',
    quickLinksReset: '已恢复默认快捷入口',
    keepOnlyPrompt: (count) => `你现在开着 ${count} 个清页页面。要只保留这一个吗？`,
    keepOnlyAction: '关闭其他清页',
    dismissPrompt: '先不管',
    tabsCount: (count) => `${count} 个页面`
  },
  en: {
    searchPlaceholder: 'Search open tabs, the web, or enter a URL',
    searchButton: 'Search',
    currentTabs: 'Workspace',
    refresh: 'Refresh',
    saveSession: 'Save Session',
    restoreSession: 'Restore Session',
    dedupe: 'Deduplicate',
    closeAll: 'Close All',
    saved: 'Read Later',
    savedCountSuffix: 'items',
    savedEmpty: 'Nothing saved yet. Still pretty clean.',
    focusThis: 'Keep Only This',
    closeGroup: 'Close Group',
    saveForLater: 'Later',
    closeTab: 'Close',
    open: 'Open',
    remove: 'Remove',
    savedZone: 'Saved',
    showTopSaved: `Showing top ${MAX_SAVED_ITEMS}`,
    groupHint: (groups, tabs) => `${groups} domains · ${tabs} tabs`,
    groupHintFiltered: (groups, tabs) => `${groups} domains · ${tabs} matching tabs`,
    opened: 'Open',
    openedCount: (count) => `${count} open`,
    noSearchMatch: 'No open tabs matched. Press Enter to search the web.',
    hiddenTabs: (count) => `${count} more hidden`,
    groupMeta: (count) => `${count} tabs`,
    quickLinksLabel: 'Quick Links',
    editQuickLinks: 'Edit Links',
    resetQuickLinks: 'Reset Default',
    quickLinksPrompt: 'One per line as “name,url”, for example:\nGoogle,https://www.google.com',
    quickLinksSaved: 'Quick links updated',
    quickLinksReset: 'Quick links reset to defaults',
    keepOnlyPrompt: (count) => `You have ${count} TabDeck pages open. Keep just this one?`,
    keepOnlyAction: 'Close other TabDeck pages',
    dismissPrompt: 'Not now',
    tabsCount: (count) => `${count} pages`
  }
};

let currentQuery = '';
let latestTabs = [];
let latestSearchMatches = [];
let activeSuggestionIndex = -1;
let currentLang = 'zh';
let t = DICTS.zh;
let currentKeepOnlyGroup = null;
const CURRENT_NEW_TAB_URL = chrome.runtime.getURL('index.html');
const CHROME_NEW_TAB_URL = 'chrome://newtab/';

function detectLang() {
  const lang = (chrome.i18n?.getUILanguage?.() || navigator.language || 'zh').toLowerCase();
  return lang.startsWith('zh') ? 'zh' : 'en';
}

function setLang() {
  currentLang = detectLang();
  t = DICTS[currentLang] || DICTS.zh;
}

function applyStaticTexts() {
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  document.title = BRAND[currentLang];
  document.getElementById('searchInput').placeholder = t.searchPlaceholder;
  document.getElementById('searchSubmitBtn').textContent = t.searchButton;
  document.getElementById('currentTabsLabel').textContent = t.currentTabs;
  document.getElementById('refreshBtn').textContent = t.refresh;
  document.getElementById('saveSessionBtn').textContent = t.saveSession;
  document.getElementById('restoreSessionBtn').textContent = t.restoreSession;
  document.getElementById('closeDuplicatesBtn').textContent = t.dedupe;
  document.getElementById('closeAllBtn').textContent = t.closeAll;
  document.getElementById('savedTitle').textContent = t.saved;
  document.getElementById('savedCountSuffix').textContent = t.savedCountSuffix;
  document.getElementById('savedEmpty').textContent = t.savedEmpty;
  document.getElementById('quickLinksLabel').setAttribute('aria-label', t.quickLinksLabel);
  document.getElementById('editQuickLinksBtn').textContent = t.editQuickLinks;
  document.getElementById('resetQuickLinksBtn').textContent = t.resetQuickLinks;
  document.getElementById('keepOnlyActionBtn').textContent = t.keepOnlyAction;
  document.getElementById('dismissPromptBtn').textContent = t.dismissPrompt;
}

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
    return new URL(url).hostname || (currentLang === 'zh' ? '未知页面' : 'Unknown');
  } catch {
    return currentLang === 'zh' ? '本地文件' : 'Local file';
  }
}

function normalizeHostname(hostname) {
  return hostname.replace(/^www\./, '');
}

function domainInitial(hostname) {
  const clean = normalizeHostname(hostname);
  const first = clean.charAt(0).toUpperCase();
  return /[A-Z0-9]/.test(first) ? first : (currentLang === 'zh' ? '页' : 'T');
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightMatch(text, query) {
  const safeText = escapeHtml(text || '');
  const trimmed = query.trim();
  if (!trimmed) return safeText;
  const escapedQuery = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'ig');
  return safeText.replace(regex, '<mark>$1</mark>');
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

function tabScore(tab, query) {
  const title = (tab.title || '').toLowerCase();
  const url = (tab.url || '').toLowerCase();
  const host = normalizeHostname(getHostname(tab.url)).toLowerCase();
  let score = 0;
  if (title.startsWith(query)) score += 6;
  if (host.startsWith(query)) score += 5;
  if (title.includes(query)) score += 3;
  if (host.includes(query)) score += 3;
  if (url.includes(query)) score += 2;
  return score;
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
    .sort((a, b) => tabScore(b, trimmed) - tabScore(a, trimmed))
    .slice(0, MAX_SEARCH_RESULTS);
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
    .sort((a, b) => b.items.length - a.items.length || a.hostname.localeCompare(b.hostname, currentLang === 'zh' ? 'zh-CN' : 'en'));
}

async function getDuplicateNewTabPages() {
  const tabs = await chrome.tabs.query({});
  return tabs.filter((tab) => {
    const url = tab.url || '';
    return url === CURRENT_NEW_TAB_URL
      || url.startsWith(`${CURRENT_NEW_TAB_URL}#`)
      || url.startsWith(`${CURRENT_NEW_TAB_URL}?`)
      || url === CHROME_NEW_TAB_URL;
  });
}

function renderKeepOnlyBanner(duplicatePages) {
  const banner = document.getElementById('keepOnlyBanner');
  const text = document.getElementById('keepOnlyText');
  const meta = document.getElementById('keepOnlyMeta');

  if (!duplicatePages || duplicatePages.length <= 1) {
    banner.hidden = true;
    currentKeepOnlyGroup = null;
    return;
  }

  currentKeepOnlyGroup = duplicatePages;
  text.textContent = t.keepOnlyPrompt(duplicatePages.length);
  meta.textContent = t.tabsCount(duplicatePages.length);
  banner.hidden = false;
}

async function openUrl(url) {
  if (!url) return;
  await chrome.tabs.create({ url });
}

async function focusSearchMatch(index) {
  const tab = latestSearchMatches[index];
  if (!tab) return;
  const input = document.getElementById('searchInput');
  await focusTab(tab.id, tab.windowId);
  input.value = '';
  currentQuery = '';
  latestSearchMatches = [];
  activeSuggestionIndex = -1;
  await render();
}

async function getSavedTabs() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

async function setSavedTabs(items) {
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
}

async function getQuickLinks() {
  const result = await chrome.storage.local.get([QUICK_LINKS_KEY]);
  return Array.isArray(result[QUICK_LINKS_KEY]) && result[QUICK_LINKS_KEY].length
    ? result[QUICK_LINKS_KEY]
    : DEFAULT_QUICK_LINKS;
}

async function setQuickLinks(items) {
  await chrome.storage.local.set({ [QUICK_LINKS_KEY]: items });
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
    ? t.groupHintFiltered(groups, totalTabs)
    : t.groupHint(groups, totalTabs);
  document.getElementById('savedHint').textContent = saved > MAX_SAVED_ITEMS ? t.showTopSaved : t.savedZone;
}

function renderSuggestions(matches, query) {
  const wrap = document.getElementById('searchSuggestions');
  if (!wrap) return;
  wrap.innerHTML = '';

  if (!query.trim() || !matches.length) {
    wrap.classList.remove('show');
    activeSuggestionIndex = -1;
    return;
  }

  const hostCounts = matches.reduce((map, tab) => {
    const host = normalizeHostname(getHostname(tab.url));
    map.set(host, (map.get(host) || 0) + 1);
    return map;
  }, new Map());

  if (activeSuggestionIndex >= matches.length) activeSuggestionIndex = 0;
  if (activeSuggestionIndex < 0) activeSuggestionIndex = 0;

  matches.forEach((tab, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'suggestion-item';
    if (index === activeSuggestionIndex) button.classList.add('active');

    const favicon = getFaviconUrl(tab);
    const host = normalizeHostname(getHostname(tab.url));
    const hostCount = hostCounts.get(host) || 1;
    button.innerHTML = `
      <img class="suggestion-favicon" src="${favicon}" alt="">
      <span class="suggestion-text">
        <span class="suggestion-title">${highlightMatch(cleanTitle(tab.title, tab.url), query)}</span>
        <span class="suggestion-url">${highlightMatch(shortUrl(tab.url), query)}</span>
      </span>
      <span class="suggestion-state">${hostCount > 1 ? t.openedCount(hostCount) : t.opened}</span>
    `;

    const img = button.querySelector('.suggestion-favicon');
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });

    button.addEventListener('mouseenter', () => {
      activeSuggestionIndex = index;
      renderSuggestions(matches, query);
    });

    button.addEventListener('click', async () => {
      await focusSearchMatch(index);
    });

    wrap.appendChild(button);
  });

  wrap.classList.add('show');
}

async function renderQuickLinks() {
  const nav = document.getElementById('quickLinksLabel');
  const existing = [...nav.querySelectorAll('.quick-link.dynamic-link')];
  existing.forEach((node) => node.remove());

  const quickLinks = await getQuickLinks();
  const resetBtn = document.getElementById('resetQuickLinksBtn');
  quickLinks.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'quick-link dynamic-link';
    button.dataset.url = item.url;
    button.textContent = item.name;
    button.addEventListener('click', async () => {
      await openUrl(item.url);
    });
    nav.insertBefore(button, resetBtn);
  });
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
    node.querySelector('.reopen-btn').textContent = t.open;
    node.querySelector('.remove-saved-btn').textContent = t.remove;
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
    empty.textContent = t.noSearchMatch;
    groupsWrap.appendChild(empty);
    return groups;
  }

  for (const [index, group] of groups.entries()) {
    const node = groupTemplate.content.firstElementChild.cloneNode(true);
    const toneClass = GROUP_TONES[index % GROUP_TONES.length];
    node.classList.add(toneClass);
    const host = normalizeHostname(group.hostname);
    node.querySelector('.group-title').textContent = host;
    node.querySelector('.group-meta').textContent = t.groupMeta(group.items.length);

    const groupFavicon = node.querySelector('.group-favicon');
    const groupBadge = node.querySelector('.group-badge');
    const sampleTab = group.items[0];
    const groupIconUrl = getFaviconUrl(sampleTab);
    if (groupIconUrl) {
      groupFavicon.src = groupIconUrl;
      groupFavicon.style.display = 'block';
      groupBadge.style.display = 'none';
    } else {
      groupFavicon.style.display = 'none';
      groupBadge.style.display = 'grid';
      groupBadge.textContent = domainInitial(group.hostname);
    }
    groupFavicon.addEventListener('error', () => {
      groupFavicon.style.display = 'none';
      groupBadge.style.display = 'grid';
      groupBadge.textContent = domainInitial(group.hostname);
    });

    node.querySelector('.focus-group-btn').textContent = t.focusThis;
    node.querySelector('.close-group-btn').textContent = t.closeGroup;
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
      tabNode.querySelector('.tab-title').innerHTML = highlightMatch(cleanTitle(tab.title, tab.url), currentQuery);
      tabNode.querySelector('.tab-url').innerHTML = highlightMatch(shortUrl(tab.url), currentQuery);
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
      tabNode.querySelector('.save-btn').textContent = t.saveForLater;
      tabNode.querySelector('.close-btn').textContent = t.closeTab;
      tabNode.querySelector('.save-btn').title = t.saveForLater;
      tabNode.querySelector('.close-btn').title = t.closeTab;
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
      more.textContent = t.hiddenTabs(group.hiddenCount);
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

async function promptEditQuickLinks() {
  const current = await getQuickLinks();
  const seed = current.map((item) => `${item.name},${item.url}`).join('\n');
  const result = window.prompt(t.quickLinksPrompt, seed);
  if (result === null) return;
  const parsed = result
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',');
      const name = (parts.shift() || '').trim();
      const url = parts.join(',').trim();
      return { name, url };
    })
    .filter((item) => item.name && item.url);

  if (!parsed.length) return;
  await setQuickLinks(parsed);
  await renderQuickLinks();
  window.alert(t.quickLinksSaved);
}

async function resetQuickLinks() {
  await setQuickLinks(DEFAULT_QUICK_LINKS);
  await renderQuickLinks();
  window.alert(t.quickLinksReset);
}

async function keepOnlyCurrentGroup() {
  if (!currentKeepOnlyGroup || currentKeepOnlyGroup.length <= 1) return;

  const currentWindow = await chrome.windows.getCurrent();
  const keepTab = currentKeepOnlyGroup.find((tab) => tab.active && tab.windowId === currentWindow.id)
    || currentKeepOnlyGroup.find((tab) => tab.active)
    || currentKeepOnlyGroup[0];

  const closeIds = currentKeepOnlyGroup
    .filter((tab) => tab.id !== keepTab.id)
    .map((tab) => tab.id)
    .filter(Boolean);

  if (closeIds.length > 0) {
    await closeTabs(closeIds);
  }

  dismissKeepOnlyBanner();
  await render();
}

function dismissKeepOnlyBanner() {
  currentKeepOnlyGroup = null;
  document.getElementById('keepOnlyBanner').hidden = true;
}

async function render() {
  latestTabs = await getAllTabs();
  const filteredTabs = filterTabsByQuery(latestTabs, currentQuery);
  latestSearchMatches = getSearchMatches(latestTabs, currentQuery);
  renderSuggestions(latestSearchMatches, currentQuery);
  const duplicatePages = await getDuplicateNewTabPages();
  renderKeepOnlyBanner(duplicatePages);
  const [groups, saved] = await Promise.all([
    renderGroups(filteredTabs),
    renderSaved(),
    renderQuickLinks()
  ]);
  updateStats(filteredTabs.length, groups.length, saved.length);
}

setLang();
applyStaticTexts();

document.getElementById('refreshBtn').addEventListener('click', render);
document.getElementById('searchInput').addEventListener('input', async (event) => {
  currentQuery = event.target.value;
  activeSuggestionIndex = -1;
  await render();
});
document.getElementById('searchInput').addEventListener('keydown', async (event) => {
  if (event.key === 'Escape') {
    event.target.value = '';
    currentQuery = '';
    activeSuggestionIndex = -1;
    await render();
    return;
  }

  if (event.key === 'ArrowDown' && latestSearchMatches.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % latestSearchMatches.length;
    renderSuggestions(latestSearchMatches, currentQuery);
    return;
  }

  if (event.key === 'ArrowUp' && latestSearchMatches.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = activeSuggestionIndex <= 0 ? latestSearchMatches.length - 1 : activeSuggestionIndex - 1;
    renderSuggestions(latestSearchMatches, currentQuery);
    return;
  }

  if (event.key === 'Enter' && latestSearchMatches.length > 0) {
    event.preventDefault();
    const index = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
    await focusSearchMatch(index);
  }
});
document.getElementById('searchInput').addEventListener('focus', () => {
  renderSuggestions(latestSearchMatches, currentQuery);
});
document.getElementById('searchInput').addEventListener('blur', () => {
  setTimeout(() => {
    document.getElementById('searchSuggestions').classList.remove('show');
  }, 120);
});
document.getElementById('searchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('searchInput');
  const raw = input.value.trim();
  if (!raw) return;

  if (latestSearchMatches.length > 0) {
    const index = activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0;
    await focusSearchMatch(index);
  } else {
    const url = normalizeSearchInput(raw);
    if (!url) return;
    await openUrl(url);
    input.value = '';
    currentQuery = '';
    activeSuggestionIndex = -1;
    await render();
  }
});
document.getElementById('editQuickLinksBtn').addEventListener('click', promptEditQuickLinks);
document.getElementById('resetQuickLinksBtn').addEventListener('click', resetQuickLinks);
document.getElementById('keepOnlyActionBtn').addEventListener('click', keepOnlyCurrentGroup);
document.getElementById('dismissPromptBtn').addEventListener('click', dismissKeepOnlyBanner);
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
