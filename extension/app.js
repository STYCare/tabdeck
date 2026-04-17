'use strict';

const STORAGE_KEY = 'qingye.savedTabs';
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
    dedupeGroup: (count) => `关闭 ${count} 个重复项`,
    duplicateCount: (count) => `${count} 个重复项`,
    closeAll: '全部关闭',
    confirmTitleCloseAll: '关闭全部标签',
    confirmBodyCloseAll: (count) => `将关闭当前全部 ${count} 个网页标签。<br><br>这是不可撤销操作。`,
    cancel: '取消',
    confirm: '确定',
    saved: '稍后处理',
    savedCountSuffix: '条',
    savedEmpty: '还没有保存的标签。现在还算清爽。',
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
    moreLinks: '更多',
    quickLinksPrompt: '按“名称,网址”每行一条，例如\nGoogle,https://www.google.com',
    quickLinksSaved: '快捷入口已更新',
    quickLinksReset: '已恢复默认快捷入口',
    keepOnlyPrompt: (count) => `你现在开着 <strong>${count}</strong> 个清页页面。要只保留这一个吗？`,
    keepOnlyAction: '关闭其他清页'
  },
  en: {
    searchPlaceholder: 'Search open tabs, the web, or enter a URL',
    searchButton: 'Search',
    currentTabs: 'Tab Deck',
    refresh: 'Refresh',
    dedupeGroup: (count) => `Close ${count} duplicate${count === 1 ? '' : 's'}`,
    duplicateCount: (count) => `${count} duplicate${count === 1 ? '' : 's'}`,
    closeAll: 'Close All',
    confirmTitleCloseAll: 'Close All Tabs',
    confirmBodyCloseAll: (count) => `This will close all ${count} open web tabs.<br><br>This cannot be undone.`,
    cancel: 'Cancel',
    confirm: 'Continue',
    saved: 'Read Later',
    savedCountSuffix: 'items',
    savedEmpty: 'Nothing saved yet. Still pretty clean.',
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
    moreLinks: 'More',
    quickLinksPrompt: 'One per line as “name,url”, for example:\nGoogle,https://www.google.com',
    quickLinksSaved: 'Quick links updated',
    quickLinksReset: 'Quick links reset to defaults',
    keepOnlyPrompt: (count) => `You have <strong>${count}</strong> TabDeck pages open. Keep just this one?`,
    keepOnlyAction: 'Close Extras'
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
  document.getElementById('searchSubmitBtn').setAttribute('aria-label', t.searchButton);
  document.getElementById('searchSubmitBtn').setAttribute('title', t.searchButton);
  document.getElementById('currentTabsLabel').textContent = t.currentTabs;
  document.getElementById('refreshBtn').setAttribute('aria-label', t.refresh);
  document.getElementById('refreshBtn').setAttribute('title', t.refresh);
  document.getElementById('closeAllBtn').setAttribute('aria-label', t.closeAll);
  document.getElementById('closeAllBtn').setAttribute('title', t.closeAll);
  document.getElementById('savedTitle').textContent = t.saved;
  document.getElementById('confirmModalCloseBtn').setAttribute('aria-label', t.cancel);
  document.getElementById('confirmModalCancelBtn').textContent = t.cancel;
  document.getElementById('confirmModalConfirmBtn').textContent = t.confirm;
  document.getElementById('savedCountSuffix').textContent = t.savedCountSuffix;
  document.getElementById('savedEmpty').textContent = t.savedEmpty;
  document.getElementById('quickLinksLabel').setAttribute('aria-label', t.quickLinksLabel);
  document.getElementById('toggleMoreLinksBtn').setAttribute('aria-label', t.moreLinks);
  document.getElementById('keepOnlyActionBtn').textContent = t.keepOnlyAction;
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

function formatHostnameLabel(hostname, sampleTitle = '', sampleUrl = '') {
  const clean = normalizeHostname(hostname).toLowerCase();
  const lowerUrl = String(sampleUrl || '').toLowerCase();
  const namedHosts = {
    'github.com': 'GitHub',
    'youtube.com': 'YouTube',
    'colab.research.google.com': 'Google Colab',
    'mail.google.com': 'Gmail',
    'docs.google.com': 'Google Docs',
    'drive.google.com': 'Google Drive',
    'calendar.google.com': 'Google Calendar',
    '127.0.0.1': 'Localhost',
    'localhost': 'Localhost'
  };

  if (clean === 'google.com') {
    if (/\/search(?:[/?#]|$)/.test(lowerUrl)) return 'Google Search';
    return 'Google';
  }

  if ((clean === 'chromewebstore.google.com' || clean === 'chrome.google.com') && lowerUrl.includes('/webstore')) {
    return 'Chrome Web Store';
  }

  if (namedHosts[clean]) return namedHosts[clean];

  const isLocalIp = /^(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(clean);
  if (isLocalIp) {
    const title = cleanTitle(sampleTitle, '').replace(/\s*[—|-]\s*.*$/, '').trim();
    return title || (currentLang === 'zh' ? '局域网设备' : 'Local Device');
  }

  const parts = clean.split('.').filter(Boolean);
  if (!parts.length) return hostname;

  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return core
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatGroupTitle(group) {
  const sample = group.items?.[0] || {};
  return formatHostnameLabel(group.hostname, sample.title || '', sample.url || '');
}

function domainInitial(hostname, sampleTitle = '', sampleUrl = '') {
  const label = formatHostnameLabel(hostname, sampleTitle, sampleUrl);
  const first = label.charAt(0).toUpperCase();
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
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;
  const tabs = await chrome.tabs.query({});

  return tabs.filter((tab) => {
    const url = tab.url || '';
    return url === newtabUrl || url === 'chrome://newtab/';
  });
}

function renderKeepOnlyBanner(duplicatePages) {
  const wrap = document.getElementById('keepOnlyWrap');
  const banner = document.getElementById('keepOnlyBanner');
  const text = document.getElementById('keepOnlyText');

  if (!duplicatePages || duplicatePages.length <= 1) {
    currentKeepOnlyGroup = null;
    wrap.hidden = true;
    banner.style.display = 'none';
    return;
  }

  currentKeepOnlyGroup = duplicatePages;
  text.innerHTML = t.keepOnlyPrompt(duplicatePages.length);
  wrap.hidden = false;
  banner.style.display = 'flex';
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

function getQuickLinkInitial(name) {
  const label = String(name || '').trim();
  const first = label.charAt(0).toUpperCase();
  return first || '•';
}

function getQuickLinkIconUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome:') return '';
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function buildQuickLinkButton(item, className = 'quick-link-icon dynamic-link') {
  const button = document.createElement('button');
  button.className = className;
  button.dataset.url = item.url;
  button.title = item.name;
  button.setAttribute('aria-label', item.name);

  const iconUrl = getQuickLinkIconUrl(item.url);
  if (iconUrl) {
    const img = document.createElement('img');
    img.className = 'quick-link-favicon';
    img.src = iconUrl;
    img.alt = '';
    img.addEventListener('error', () => {
      img.remove();
      const fallback = document.createElement('span');
      fallback.className = 'quick-link-fallback';
      fallback.textContent = getQuickLinkInitial(item.name);
      button.appendChild(fallback);
    }, { once: true });
    button.appendChild(img);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'quick-link-fallback';
    fallback.textContent = getQuickLinkInitial(item.name);
    button.appendChild(fallback);
  }

  button.addEventListener('click', async () => {
    await openUrl(item.url);
  });

  return button;
}

async function renderQuickLinks() {
  const mainWrap = document.getElementById('quickLinksMain');
  const moreWrap = document.getElementById('quickLinksMoreWrap');
  const moreMenu = document.getElementById('quickLinksMoreMenu');
  mainWrap.innerHTML = '';
  moreMenu.innerHTML = '';

  const quickLinks = await getQuickLinks();
  const primaryLinks = quickLinks.slice(0, 3);
  const extraLinks = quickLinks.slice(3);

  primaryLinks.forEach((item) => {
    mainWrap.appendChild(buildQuickLinkButton(item));
  });

  const moreItems = [...extraLinks];
  moreItems.push({ name: t.editQuickLinks, action: 'edit' });
  moreItems.push({ name: t.resetQuickLinks, action: 'reset' });

  moreWrap.hidden = moreItems.length === 0;
  moreItems.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'quick-link quick-link-menu-item';
    button.textContent = item.name;

    if (item.action === 'edit') {
      button.addEventListener('click', async () => {
        moreMenu.classList.remove('show');
        await promptEditQuickLinks();
      });
    } else if (item.action === 'reset') {
      button.addEventListener('click', async () => {
        moreMenu.classList.remove('show');
        await resetQuickLinks();
      });
    } else {
      button.dataset.url = item.url;
      button.addEventListener('click', async () => {
        moreMenu.classList.remove('show');
        await openUrl(item.url);
      });
    }

    moreMenu.appendChild(button);
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
    node.querySelector('.reopen-btn').setAttribute('aria-label', t.open);
    node.querySelector('.remove-saved-btn').setAttribute('aria-label', t.remove);
    node.querySelector('.reopen-btn').title = t.open;
    node.querySelector('.remove-saved-btn').title = t.remove;
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

function getDuplicateInfo(items) {
  const urlMap = new Map();
  const duplicateIds = [];
  const duplicateMap = new Map();
  const uniqueItems = [];

  for (const item of items) {
    const normalized = normalizeUrl(item.url);
    const bucket = urlMap.get(normalized) || [];
    bucket.push(item);
    urlMap.set(normalized, bucket);
  }

  for (const bucket of urlMap.values()) {
    uniqueItems.push(bucket[0]);
    if (bucket.length > 1) {
      duplicateIds.push(...bucket.slice(1).map((tab) => tab.id));
      duplicateMap.set(normalizeUrl(bucket[0].url), bucket.length);
    }
  }

  return {
    duplicateCount: duplicateIds.length,
    duplicateIds,
    duplicateMap,
    uniqueItems
  };
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
    const duplicateInfo = getDuplicateInfo(group.items);
    const pillsWrap = node.querySelector('.group-pills');
    node.querySelector('.group-title').textContent = formatGroupTitle(group);
    node.querySelector('.group-meta').textContent = t.groupMeta(group.items.length);
    pillsWrap.innerHTML = '';
    if (duplicateInfo.duplicateCount > 0) {
      const duplicatePill = document.createElement('button');
      duplicatePill.type = 'button';
      duplicatePill.className = 'group-pill group-pill-duplicate group-pill-action';
      duplicatePill.setAttribute('title', t.dedupeGroup(duplicateInfo.duplicateCount));
      duplicatePill.setAttribute('aria-label', t.dedupeGroup(duplicateInfo.duplicateCount));
      duplicatePill.innerHTML = `${escapeHtml(t.duplicateCount(duplicateInfo.duplicateCount))}<span class="group-pill-close" aria-hidden="true">×</span>`;
      duplicatePill.addEventListener('click', async () => {
        const confirmed = window.confirm(
          currentLang === 'zh'
            ? `将关闭这一组里 ${duplicateInfo.duplicateCount} 个重复标签，并保留每个页面 1 个。\n\n确定继续吗？`
            : `This will close ${duplicateInfo.duplicateCount} duplicate tabs in this group and keep one copy of each page.\n\nContinue?`
        );
        if (!confirmed) return;
        await closeTabs(duplicateInfo.duplicateIds);
        await render();
      });
      pillsWrap.appendChild(duplicatePill);
    }

    const groupFavicon = node.querySelector('.group-favicon');
    const groupBadge = node.querySelector('.group-badge');
    const sampleTab = group.items[0];
    const sampleTitle = sampleTab?.title || '';
    const groupIconUrl = getFaviconUrl(sampleTab);
    if (groupIconUrl) {
      groupFavicon.src = groupIconUrl;
      groupFavicon.style.display = 'block';
      groupBadge.style.display = 'none';
    } else {
      groupFavicon.style.display = 'none';
      groupBadge.style.display = 'grid';
      groupBadge.textContent = domainInitial(group.hostname, sampleTitle, sampleTab?.url || '');
    }
    groupFavicon.addEventListener('error', () => {
      groupFavicon.style.display = 'none';
      groupBadge.style.display = 'grid';
      groupBadge.textContent = domainInitial(group.hostname, sampleTitle, sampleTab?.url || '');
    });

    const closeGroupBtn = node.querySelector('.close-group-btn');
    closeGroupBtn.setAttribute('aria-label', t.closeGroup);
    closeGroupBtn.setAttribute('title', t.closeGroup);

    closeGroupBtn.addEventListener('click', async () => {
      await closeTabs(group.items.map((item) => item.id));
      await render();
    });

    const list = node.querySelector('.tab-list');
    for (const tab of duplicateInfo.uniqueItems.slice(0, MAX_GROUP_TABS)) {
      const tabNode = tabTemplate.content.firstElementChild.cloneNode(true);
      const normalizedUrl = normalizeUrl(tab.url);
      const duplicateCopies = duplicateInfo.duplicateMap.get(normalizedUrl) || 0;
      const cleanTabTitle = cleanTitle(tab.title, tab.url);
      const titleHtml = highlightMatch(cleanTabTitle, currentQuery);
      tabNode.querySelector('.tab-title').innerHTML = duplicateCopies > 1
        ? `${titleHtml} <span class="tab-duplicate-count">(${duplicateCopies}×)</span>`
        : titleHtml;
      tabNode.querySelector('.tab-url').innerHTML = highlightMatch(shortUrl(tab.url), currentQuery);
      if (duplicateCopies > 1) {
        tabNode.classList.add('tab-item-duplicate');
      }
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
      tabNode.querySelector('.save-btn').setAttribute('aria-label', t.saveForLater);
      tabNode.querySelector('.close-btn').setAttribute('aria-label', t.closeTab);
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

    const hiddenUniqueCount = Math.max(duplicateInfo.uniqueItems.length - MAX_GROUP_TABS, 0);
    if (hiddenUniqueCount > 0 && !currentQuery.trim()) {
      const more = document.createElement('div');
      more.className = 'group-more';
      more.textContent = t.hiddenTabs(hiddenUniqueCount);
      list.appendChild(more);
    }

    groupsWrap.appendChild(node);
  }

  return groups;
}

async function closeAllWebTabs() {
  const tabs = await getAllTabs();
  await closeTabs(tabs.map((tab) => tab.id));
}

function openConfirmModal({ title, bodyHtml, confirmText, onConfirm }) {
  const shell = document.getElementById('confirmModal');
  const titleNode = document.getElementById('confirmModalTitle');
  const bodyNode = document.getElementById('confirmModalBody');
  const confirmBtn = document.getElementById('confirmModalConfirmBtn');
  const cancelBtn = document.getElementById('confirmModalCancelBtn');
  const closeBtn = document.getElementById('confirmModalCloseBtn');
  const backdrop = shell.querySelector('[data-close-modal]');

  let resolved = false;
  const cleanup = () => {
    shell.hidden = true;
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
    closeBtn.onclick = null;
    backdrop.onclick = null;
    document.onkeydown = null;
  };

  return new Promise((resolve) => {
    const cancel = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(false);
    };

    const confirm = async () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      if (onConfirm) await onConfirm();
      resolve(true);
    };

    titleNode.textContent = title;
    bodyNode.innerHTML = bodyHtml;
    confirmBtn.textContent = confirmText || t.confirm;
    shell.hidden = false;

    confirmBtn.onclick = confirm;
    cancelBtn.onclick = cancel;
    closeBtn.onclick = cancel;
    backdrop.onclick = cancel;
    document.onkeydown = (event) => {
      if (event.key === 'Escape') cancel();
    };
  });
}

async function confirmCloseAllTabs() {
  const tabs = await getAllTabs();
  if (!tabs.length) {
    window.alert(currentLang === 'zh' ? '当前没有可关闭的标签。' : 'There are no tabs to close right now.');
    return false;
  }

  return openConfirmModal({
    title: t.confirmTitleCloseAll,
    bodyHtml: t.confirmBodyCloseAll(tabs.length),
    confirmText: t.confirm,
  });
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

function toggleMoreLinksMenu() {
  const menu = document.getElementById('quickLinksMoreMenu');
  menu.classList.toggle('show');
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

  const remaining = await getDuplicateNewTabPages();
  renderKeepOnlyBanner(remaining);
  await render();
}

function dismissKeepOnlyBanner() {
  currentKeepOnlyGroup = null;
  const wrap = document.getElementById('keepOnlyWrap');
  const banner = document.getElementById('keepOnlyBanner');
  wrap.hidden = true;
  banner.style.display = 'none';
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
document.getElementById('toggleMoreLinksBtn').addEventListener('click', toggleMoreLinksMenu);
document.getElementById('keepOnlyActionBtn').addEventListener('click', keepOnlyCurrentGroup);
document.getElementById('closeAllBtn').addEventListener('click', async () => {
  if (!await confirmCloseAllTabs()) return;
  await closeAllWebTabs();
  await render();
});

document.addEventListener('click', (event) => {
  const moreWrap = document.getElementById('quickLinksMoreWrap');
  const moreMenu = document.getElementById('quickLinksMoreMenu');
  if (!moreWrap.contains(event.target)) {
    moreMenu.classList.remove('show');
  }
});

render();
