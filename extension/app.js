'use strict';

const STORAGE_KEY = 'qingye.savedTabs';

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

function groupTabs(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    let hostname = '本地文件';
    try {
      hostname = new URL(tab.url).hostname || '未知页面';
    } catch {}
    if (!map.has(hostname)) map.set(hostname, []);
    map.get(hostname).push(tab);
  }
  return [...map.entries()]
    .map(([hostname, items]) => ({ hostname, items }))
    .sort((a, b) => b.items.length - a.items.length || a.hostname.localeCompare(b.hostname, 'zh-CN'));
}

async function getSavedTabs() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
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

function cleanTitle(title, url) {
  if (!title) return url;
  return title.replace(/^\(\d+\)\s*/, '').trim();
}

function updateStats(totalTabs, groups, saved) {
  document.getElementById('totalTabs').textContent = String(totalTabs);
  document.getElementById('totalGroups').textContent = String(groups);
  document.getElementById('savedCount').textContent = String(saved);
  document.getElementById('groupHint').textContent = `共 ${groups} 组，先从最大的开始砍。`;
}

async function renderSaved() {
  const list = document.getElementById('savedList');
  const empty = document.getElementById('savedEmpty');
  const template = document.getElementById('savedTemplate');
  const items = await getSavedTabs();

  list.innerHTML = '';
  if (!items.length) {
    empty.style.display = 'block';
    return items;
  }

  empty.style.display = 'none';
  for (const item of items) {
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

async function renderGroups(tabs) {
  const groupsWrap = document.getElementById('groups');
  const groupTemplate = document.getElementById('groupTemplate');
  const tabTemplate = document.getElementById('tabTemplate');
  const groups = groupTabs(tabs);
  groupsWrap.innerHTML = '';

  for (const group of groups) {
    const node = groupTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.group-title').textContent = group.hostname;
    node.querySelector('.group-meta').textContent = `${group.items.length} 个标签`;

    node.querySelector('.close-group-btn').addEventListener('click', async () => {
      await closeTabs(group.items.map((item) => item.id));
      await render();
    });

    const list = node.querySelector('.tab-list');
    for (const tab of group.items) {
      const tabNode = tabTemplate.content.firstElementChild.cloneNode(true);
      tabNode.querySelector('.tab-title').textContent = cleanTitle(tab.title, tab.url);
      tabNode.querySelector('.tab-url').textContent = shortUrl(tab.url);
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

async function render() {
  const tabs = await getAllTabs();
  const [groups, saved] = await Promise.all([
    renderGroups(tabs),
    renderSaved()
  ]);
  updateStats(tabs.length, groups.length, saved.length);
}

document.getElementById('refreshBtn').addEventListener('click', render);
document.getElementById('closeDuplicatesBtn').addEventListener('click', async () => {
  await closeDuplicateTabs();
  await render();
});
document.getElementById('closeAllBtn').addEventListener('click', async () => {
  await closeAllWebTabs();
  await render();
});

render();
