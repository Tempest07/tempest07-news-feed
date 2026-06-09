const STORAGE = {
  apiBase: "tempest-news-api",
  keywords: "tempest-news-keywords",
  sources: "tempest-news-sources",
  read: "tempest-news-read",
  saved: "tempest-news-saved",
  pageSize: "tempest-news-page-size",
};

const state = {
  apiBase: localStorage.getItem(STORAGE.apiBase) || window.TEMPEST_CONFIG?.newsApiBase || "",
  keywords: readJson(STORAGE.keywords, []),
  selectedSources: readJson(STORAGE.sources, []),
  sourcesInitialized: localStorage.getItem(STORAGE.sources) !== null,
  readIds: new Set(readJson(STORAGE.read, [])),
  savedIds: new Set(readJson(STORAGE.saved, [])),
  sources: [],
  items: [],
  page: 1,
  pageSize: Number(localStorage.getItem(STORAGE.pageSize)) || 20,
};

const elements = {
  feedList: document.querySelector("#feedList"),
  sourceFilters: document.querySelector("#sourceFilters"),
  keywordTags: document.querySelector("#keywordTags"),
  keywordInput: document.querySelector("#keywordInput"),
  searchInput: document.querySelector("#searchInput"),
  timeRange: document.querySelector("#timeRange"),
  readFilter: document.querySelector("#readFilter"),
  resultSummary: document.querySelector("#resultSummary"),
  updateTime: document.querySelector("#updateTime"),
  pagination: document.querySelector("#pagination"),
  pageSummary: document.querySelector("#pageSummary"),
  previousPage: document.querySelector("#previousPage"),
  nextPage: document.querySelector("#nextPage"),
  settingsModal: document.querySelector("#settingsModal"),
  apiBaseInput: document.querySelector("#apiBaseInput"),
  pageSizeInput: document.querySelector("#pageSizeInput"),
  sideApiStatus: document.querySelector("#sideApiStatus"),
  sideApiDetail: document.querySelector("#sideApiDetail"),
};

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeApiBase(value) {
  return value.trim().replace(/\/+$/, "").replace(/\/api\/news$/, "");
}

function openSettings() {
  elements.apiBaseInput.value = state.apiBase;
  elements.pageSizeInput.value = String(state.pageSize);
  elements.settingsModal.hidden = false;
  elements.apiBaseInput.focus();
}

function closeSettings() {
  elements.settingsModal.hidden = true;
}

document.querySelector("#openSettings").addEventListener("click", openSettings);
document.querySelector("#closeSettings").addEventListener("click", closeSettings);
elements.settingsModal.addEventListener("click", (event) => {
  if (event.target === elements.settingsModal) closeSettings();
});
document.querySelector("#saveSettings").addEventListener("click", () => {
  state.apiBase = normalizeApiBase(elements.apiBaseInput.value);
  state.pageSize = Number(elements.pageSizeInput.value);
  localStorage.setItem(STORAGE.apiBase, state.apiBase);
  localStorage.setItem(STORAGE.pageSize, String(state.pageSize));
  closeSettings();
  loadFeed();
});

document.querySelector("#refreshButton").addEventListener("click", () => loadFeed(true));
document.querySelector("#addKeyword").addEventListener("click", addKeyword);
elements.keywordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") addKeyword();
});
document.querySelector("#clearKeywords").addEventListener("click", () => {
  state.keywords = [];
  writeJson(STORAGE.keywords, state.keywords);
  renderKeywords();
  renderFeed();
});
document.querySelector("#toggleSources").addEventListener("click", () => {
  state.selectedSources = state.selectedSources.length === state.sources.length ? [] : state.sources.map((source) => source.id);
  state.sourcesInitialized = true;
  writeJson(STORAGE.sources, state.selectedSources);
  renderSources();
  renderFeed();
});
document.querySelector("#markPageRead").addEventListener("click", () => {
  getVisiblePage().forEach((item) => state.readIds.add(item.id));
  persistSets();
  renderFeed();
});

[elements.searchInput, elements.timeRange, elements.readFilter].forEach((element) => {
  element.addEventListener(element.tagName === "INPUT" ? "input" : "change", () => {
    state.page = 1;
    renderFeed();
  });
});
elements.previousPage.addEventListener("click", () => {
  state.page = Math.max(1, state.page - 1);
  renderFeed();
  scrollToFeed();
});
elements.nextPage.addEventListener("click", () => {
  state.page += 1;
  renderFeed();
  scrollToFeed();
});

function addKeyword() {
  const keyword = elements.keywordInput.value.trim();
  if (!keyword || state.keywords.some((item) => item.toLowerCase() === keyword.toLowerCase())) return;
  state.keywords.push(keyword);
  elements.keywordInput.value = "";
  writeJson(STORAGE.keywords, state.keywords);
  renderKeywords();
  renderFeed();
}

function removeKeyword(keyword) {
  state.keywords = state.keywords.filter((item) => item !== keyword);
  writeJson(STORAGE.keywords, state.keywords);
  renderKeywords();
  renderFeed();
}

function renderKeywords() {
  elements.keywordTags.innerHTML = state.keywords.map((keyword) => `
    <span class="keyword-tag">${escapeHtml(keyword)}<button data-remove-keyword="${escapeAttribute(keyword)}" aria-label="删除关键词">×</button></span>
  `).join("");
  elements.keywordTags.querySelectorAll("[data-remove-keyword]").forEach((button) => {
    button.addEventListener("click", () => removeKeyword(button.dataset.removeKeyword));
  });
}

function renderSources() {
  if (!state.sources.length) {
    elements.sourceFilters.innerHTML = '<span class="check-row">没有可用来源</span>';
    return;
  }
  elements.sourceFilters.innerHTML = state.sources.map((source) => `
    <label class="check-row">
      <input type="checkbox" value="${escapeAttribute(source.id)}" ${state.selectedSources.includes(source.id) ? "checked" : ""}>
      <span>${escapeHtml(source.name)}</span>
      <span>${source.itemCount ?? ""}</span>
    </label>
  `).join("");
  elements.sourceFilters.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      state.selectedSources = [...elements.sourceFilters.querySelectorAll("input:checked")].map((item) => item.value);
      state.sourcesInitialized = true;
      writeJson(STORAGE.sources, state.selectedSources);
      state.page = 1;
      renderFeed();
    });
  });
}

async function loadFeed(forceRefresh = false) {
  if (!state.apiBase) {
    openSettings();
    return;
  }

  elements.feedList.innerHTML = '<div class="empty-state">正在从新闻来源获取内容...</div>';
  elements.updateTime.textContent = "正在更新";

  try {
    const suffix = forceRefresh ? "?refresh=1" : "";
    const response = await fetch(`${state.apiBase}/api/news${suffix}`);
    if (!response.ok) throw new Error(`Worker 返回 ${response.status}`);
    const data = await response.json();
    state.items = data.items || [];
    state.sources = (data.sources || []).map((source) => ({
      ...source,
      itemCount: state.items.filter((item) => item.sourceId === source.id).length,
    }));
    state.selectedSources = state.selectedSources.filter((id) => state.sources.some((source) => source.id === id));
    if (!state.sourcesInitialized) {
      state.selectedSources = state.sources.map((source) => source.id);
      state.sourcesInitialized = true;
    }
    writeJson(STORAGE.sources, state.selectedSources);
    elements.updateTime.textContent = `更新于 ${formatTime(data.fetchedAt)}`;
    elements.sideApiStatus.textContent = "Operational";
    elements.sideApiDetail.textContent = `${state.sources.length} sources connected.`;
    renderSources();
    renderFeed();
  } catch (error) {
    elements.feedList.innerHTML = `<div class="error-state">无法连接 News Worker。<br>${escapeHtml(error.message)}<br>请检查右上角设置中的地址，以及 Worker 是否已经部署。</div>`;
    elements.updateTime.textContent = "连接失败";
    elements.sideApiStatus.textContent = "Offline";
    elements.sideApiDetail.textContent = "Check Worker address and deployment.";
  }
}

function getFilteredItems() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const hours = Number(elements.timeRange.value);
  const readFilter = elements.readFilter.value;
  const cutoff = hours ? Date.now() - hours * 60 * 60 * 1000 : 0;

  return state.items.filter((item) => {
    if (!state.selectedSources.includes(item.sourceId)) return false;
    const haystack = `${item.title} ${item.description}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (state.keywords.length && !state.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) return false;
    if (cutoff && new Date(item.publishedAt).getTime() < cutoff) return false;
    if (readFilter === "read" && !state.readIds.has(item.id)) return false;
    if (readFilter === "unread" && state.readIds.has(item.id)) return false;
    if (readFilter === "saved" && !state.savedIds.has(item.id)) return false;
    return true;
  });
}

function getVisiblePage() {
  const filtered = getFilteredItems();
  const start = (state.page - 1) * state.pageSize;
  return filtered.slice(start, start + state.pageSize);
}

function renderFeed() {
  const filtered = getFilteredItems();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const visible = getVisiblePage();

  elements.resultSummary.textContent = `${filtered.length} 条结果 · ${state.items.length} 条已加载`;
  elements.pagination.hidden = filtered.length <= state.pageSize;
  elements.pageSummary.textContent = `${state.page} / ${totalPages}`;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;

  if (!visible.length) {
    elements.feedList.innerHTML = '<div class="empty-state">没有符合当前筛选条件的新闻。可以清空关键词或选择更多来源。</div>';
    return;
  }

  elements.feedList.innerHTML = visible.map((item) => {
    const isRead = state.readIds.has(item.id);
    const isSaved = state.savedIds.has(item.id);
    return `
      <article class="news-item ${isRead ? "" : "unread"}">
        <div class="news-meta">
          <span class="source-pill">${escapeHtml(item.sourceName)}</span>
          <time>${formatDate(item.publishedAt)}</time>
        </div>
        <h2><a href="${escapeAttribute(item.url)}" target="_blank" rel="noopener noreferrer" data-open-item="${escapeAttribute(item.id)}">${highlight(item.title)}</a></h2>
        ${item.description ? `<p>${highlight(item.description)}</p>` : ""}
        <div class="news-actions">
          <button class="tiny-button ${isRead ? "active" : ""}" data-toggle-read="${escapeAttribute(item.id)}">${isRead ? "已读" : "标为已读"}</button>
          <button class="tiny-button ${isSaved ? "active" : ""}" data-toggle-saved="${escapeAttribute(item.id)}">${isSaved ? "已收藏" : "收藏"}</button>
        </div>
      </article>
    `;
  }).join("");

  elements.feedList.querySelectorAll("[data-open-item]").forEach((link) => {
    link.addEventListener("click", () => {
      state.readIds.add(link.dataset.openItem);
      persistSets();
      link.closest(".news-item").classList.remove("unread");
    });
  });
  elements.feedList.querySelectorAll("[data-toggle-read]").forEach((button) => {
    button.addEventListener("click", () => toggleSet(state.readIds, button.dataset.toggleRead));
  });
  elements.feedList.querySelectorAll("[data-toggle-saved]").forEach((button) => {
    button.addEventListener("click", () => toggleSet(state.savedIds, button.dataset.toggleSaved));
  });
}

function toggleSet(set, id) {
  set.has(id) ? set.delete(id) : set.add(id);
  persistSets();
  renderFeed();
}

function persistSets() {
  writeJson(STORAGE.read, [...state.readIds].slice(-2000));
  writeJson(STORAGE.saved, [...state.savedIds].slice(-1000));
}

function highlight(value = "") {
  let output = escapeHtml(value);
  const terms = [...state.keywords, elements.searchInput.value.trim()].filter(Boolean);
  terms.forEach((term) => {
    const safeTerm = escapeRegExp(escapeHtml(term));
    output = output.replace(new RegExp(`(${safeTerm})`, "gi"), "<mark>$1</mark>");
  });
  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "刚刚" : new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function scrollToFeed() {
  elements.resultSummary.scrollIntoView({ behavior: "smooth", block: "start" });
}

renderKeywords();
if (state.apiBase) {
  loadFeed();
} else {
  openSettings();
}
