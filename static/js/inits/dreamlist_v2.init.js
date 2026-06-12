(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────────────────
    const cfg = document.getElementById('ds-config');
    if (!cfg) return;

    const DREAM_API    = cfg.dataset.dreamApi;
    const DREAM_UI_API = cfg.dataset.dreamUiApi;
    const REPLY_URL    = cfg.dataset.replyUrl;
    const CSRF         = cfg.dataset.csrf;
    const USER_ID      = cfg.dataset.userId;
    const USER_ROLE    = cfg.dataset.userRole;
    const FOLLOW_API   = '/dreams/follow/toggle/';
    const HASHTAG_API  = '/dreams/dream/hashtags/';

    let searchTimer     = null;
    let hashtagTimer    = null;
    let shareModal      = null;
    let deleteModal     = null;
    let pendingDeleteId = null;
    let currentSort     = 'dream_date';
    let currentFilter   = 'all';
    let currentFolder   = '';
    let currentView     = localStorage.getItem('ds-view-mode') || 'grid'; // 'grid' | 'list' | 'table'

    let dreamCache  = {};
    let foldersCache = [];
    let lastFeedData = null;

    // ── Utilities ─────────────────────────────────────────────────────────────

    function esc(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    function buildAvatarHtml(avatarUrl, username) {
        if (avatarUrl) {
            return `<img src="${esc(avatarUrl)}" alt="${esc(username || '')}" class="ds-avatar-img">`;
        }
        return '<i class="ri-user-3-line" aria-hidden="true"></i>';
    }

    function fmtDate(str) {
        if (!str) return '';
        const d = new Date(str + 'T00:00:00');
        if (isNaN(d)) return str;
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }

    function fmtRelative(iso) {
        if (!iso) return '';
        const d       = new Date(iso);
        const diffMin = Math.floor((Date.now() - d) / 60000);
        if (diffMin < 1)  return '剛剛';
        if (diffMin < 60) return `${diffMin} 分鐘前`;
        const diffHr  = Math.floor(diffMin / 60);
        if (diffHr  < 24) return `${diffHr} 小時前`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7)  return `${diffDay} 天前`;
        return fmtDate(iso.slice(0, 10));
    }

    function _applyFollowUI(btn, on, count) {
        btn.classList.toggle('ds-followed', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? '取消關注' : '關注');
        btn.querySelector('i').className = (on ? 'ri-heart-fill' : 'ri-heart-line');
        const textEl = btn.querySelector('.ds-follow-label');
        if (textEl) textEl.textContent = on ? '已關注' : '關注';

        if (count !== undefined) {
            let countEl = btn.querySelector('.ds-follow-count');
            if (count > 0) {
                if (!countEl) {
                    countEl = document.createElement('span');
                    countEl.className = 'ds-follow-count';
                    btn.appendChild(countEl);
                }
                countEl.textContent = count;
            } else if (countEl) {
                countEl.remove();
            }
        }
    }

    // ── 權限判斷 ──────────────────────────────────────────────────────────────

    function canEditDream(item) {
        const isOwner = item.user !== null && item.user !== undefined && String(item.user) === USER_ID;
        const isAdmin = USER_ROLE === '0' || USER_ROLE === '1';
        return isOwner || isAdmin;
    }

    function canDeleteDream(item) {
        const isOwner = item.user !== null && item.user !== undefined && String(item.user) === USER_ID;
        const isAdmin = USER_ROLE === '0' || USER_ROLE === '1';
        return isOwner || isAdmin;
    }

    // ── View Toggle ───────────────────────────────────────────────────────────

    function isMobile() {
        return window.innerWidth <= 576;
    }

    function setView(view) {
        // 手機強制條列
        if (isMobile()) view = 'list';
        currentView = view;
        // 只在非手機時記憶選擇
        if (!isMobile()) localStorage.setItem('ds-view-mode', view);
        document.querySelectorAll('.ds-view-btn').forEach(function (btn) {
            btn.classList.toggle('ds-view-active', btn.dataset.view === view);
        });
        const container = document.querySelector('.ds-feed-container');
        if (container) container.setAttribute('data-view', view);
    }

    function initViewToggle() {
        document.querySelectorAll('.ds-view-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (this.dataset.view === currentView) return;
                setView(this.dataset.view);
                if (lastFeedData) renderFeed(lastFeedData);
            });
        });

        // 視窗大小改變時重新套用（如旋轉螢幕）
        let resizeTimer = null;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                const desired = isMobile() ? 'list' : (localStorage.getItem('ds-view-mode') || 'grid');
                if (desired !== currentView) {
                    setView(desired);
                    if (lastFeedData) renderFeed(lastFeedData);
                }
            }, 200);
        });
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const CONTENT_FIELDS = [
        { key: '內容',             icon: 'ri-book-open-line' },
        { key: '個人解讀/夢語言解釋', icon: 'ri-translate-2' },
        { key: '禱告方向',          icon: 'ri-lightbulb-flash-line' },
    ];

    function buildExpandPanel(dreamContent, safeId) {
        if (!dreamContent || typeof dreamContent !== 'object') return { panel: '', btn: '' };
        const sections = CONTENT_FIELDS
            .filter(function (f) { return dreamContent[f.key]; })
            .map(function (f) {
                return `<div class="ds-content-section">
    <div class="ds-content-label"><i class="${f.icon}" aria-hidden="true"></i>${esc(f.key)}</div>
    <p class="ds-content-text">${esc(dreamContent[f.key])}</p>
</div>`;
            }).join('');
        if (!sections) return { panel: '', btn: '' };
        return {
            panel: `<div class="ds-post-expand-panel" id="ds-expand-${safeId}">${sections}</div>`,
            btn:   `<button class="ds-expand-btn" data-expand-id="${safeId}"
        aria-expanded="false" aria-controls="ds-expand-${safeId}">
    <span class="ds-expand-label">查看內容</span>
    <i class="ri-arrow-down-s-line ds-expand-icon" aria-hidden="true"></i>
</button>`,
        };
    }

    function buildMenuHtml(item, safeId) {
        const showEdit   = canEditDream(item);
        const showDelete = canDeleteDream(item);
        if (!showEdit && !showDelete) return '';
        const editItem = showEdit
            ? `<li><button class="dropdown-item ds-dropdown-item ds-edit-btn" data-id="${safeId}">
    <i class="ri-edit-line" aria-hidden="true"></i>修改
</button></li>` : '';
        const deleteItem = showDelete
            ? `<li><button class="dropdown-item ds-dropdown-item ds-dropdown-danger ds-delete-btn" data-id="${safeId}">
    <i class="ri-delete-bin-line" aria-hidden="true"></i>刪除
</button></li>` : '';
        return `<div class="dropdown ds-post-menu">
    <button class="ds-menu-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-label="更多選項">
        <i class="ri-more-2-fill" aria-hidden="true"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end ds-dropdown-menu">
        ${editItem}${deleteItem}
    </ul>
</div>`;
    }

    // 條列 (list) 模式卡片 ── 橫向全寬版
    function buildListCard(item) {
        const id          = item.id;
        const safeId      = esc(id);
        const author      = esc(item.user_username || item.create_user || '匿名');
        const title       = esc(item.title || '（無主題）');
        const dateLabel   = item.dream_date ? fmtDate(item.dream_date) : fmtRelative(item.create_date);
        const followed    = !!item.is_followed;
        const followCount = item.follow_count || 0;
        const replyCount  = item.reply_count  || 0;
        const menuHtml    = buildMenuHtml(item, safeId);
        const { panel, btn } = buildExpandPanel(item.dream_content, safeId);

        const dreamTypeBadge = item.dream_type
            ? `<span class="ds-dream-type-badge">${esc(item.dream_type)}</span>`
            : '';

        let previewHtml = '';
        const dc = item.dream_content;
        if (dc && typeof dc === 'object' && dc['內容']) {
            const raw     = String(dc['內容']);
            const preview = raw.length > 80 ? raw.slice(0, 80) + '...' : raw;
            previewHtml   = `<p class="ds-post-preview">${esc(preview)}</p>`;
        }

        let hashtagsHtml = '';
        if (item.hashtags && item.hashtags.length > 0) {
            const tags = item.hashtags.map(function (tag) {
                return `<span class="ds-hashtag">#${esc(tag)}</span>`;
            }).join(' ');
            hashtagsHtml = `<div class="ds-hashtags">${tags}</div>`;
        }

        let imageHtml = '';
        if (item.image_url) {
            imageHtml = `<div class="ds-list-thumb">
    <a href="${esc(item.image_url)}" class="glightbox" data-gallery="dream-${safeId}">
        <img src="${esc(item.image_url)}" alt="夢境圖片" loading="lazy">
    </a>
</div>`;
        }

        return `<article class="ds-post-card ds-list-card" data-id="${safeId}">
    <div class="ds-list-left">
        <div class="ds-post-avatar">${buildAvatarHtml(item.user_avatar, item.user_username)}</div>
        <div class="ds-post-meta">
            <div class="ds-post-author">${author}</div>
            <div class="ds-post-date">${dateLabel}</div>
        </div>
        ${menuHtml}
    </div>
    <div class="ds-list-body">
        <div class="ds-list-title-row">
            <h3 class="ds-post-title">${title}</h3>
            ${dreamTypeBadge}
        </div>
        ${previewHtml}
        ${hashtagsHtml}
        ${imageHtml}
        ${panel}
        ${btn}
    </div>
    <div class="ds-list-actions">
        <button class="ds-action-btn ds-follow-btn${followed ? ' ds-followed' : ''}"
                data-id="${safeId}" aria-pressed="${followed}"
                aria-label="${followed ? '取消關注' : '關注'}">
            <i class="${followed ? 'ri-heart-fill' : 'ri-heart-line'}" aria-hidden="true"></i>
            <span class="ds-follow-label">${followed ? '已關注' : '關注'}</span>
            ${followCount > 0 ? `<span class="ds-follow-count">${followCount}</span>` : ''}
        </button>
        <a class="ds-action-btn ds-reply-btn"
           href="${REPLY_URL}?dream=${encodeURIComponent(id)}"
           aria-label="回應這個夢境">
            <i class="ri-chat-1-line" aria-hidden="true"></i>
            <span>回應</span>
            ${replyCount > 0 ? `<span class="ds-reply-count">${replyCount}</span>` : ''}
        </a>
    </div>
</article>`;
    }

    // 格狀 (grid) 模式卡片 ── 緊湊版
    function buildGridCard(item) {
        const id          = item.id;
        const safeId      = esc(id);
        const author      = esc(item.user_username || item.create_user || '匿名');
        const title       = esc(item.title || '（無主題）');
        const dateLabel   = item.dream_date ? fmtDate(item.dream_date) : fmtRelative(item.create_date);
        const followed    = !!item.is_followed;
        const followCount = item.follow_count || 0;
        const replyCount  = item.reply_count  || 0;
        const menuHtml    = buildMenuHtml(item, safeId);

        const dreamTypeBadge = item.dream_type
            ? `<span class="ds-dream-type-badge">${esc(item.dream_type)}</span>`
            : '';

        let previewHtml = '';
        const dc = item.dream_content;
        if (dc && typeof dc === 'object' && dc['內容']) {
            const raw     = String(dc['內容']);
            const preview = raw.length > 45 ? raw.slice(0, 45) + '...' : raw;
            previewHtml   = `<p class="ds-post-preview">${esc(preview)}</p>`;
        }

        const { panel, btn } = buildExpandPanel(item.dream_content, safeId);

        let imageHtml = '';
        if (item.image_url) {
            imageHtml = `<div class="ds-grid-cover">
    <a href="${esc(item.image_url)}" class="glightbox" data-gallery="dream-${safeId}">
        <img src="${esc(item.image_url)}" alt="夢境圖片" loading="lazy">
    </a>
</div>`;
        }

        return `<article class="ds-post-card ds-grid-card" data-id="${safeId}">
    ${imageHtml}
    <div class="ds-post-header">
        <div class="ds-post-avatar">${buildAvatarHtml(item.user_avatar, item.user_username)}</div>
        <div class="ds-post-meta">
            <div class="ds-post-author">${author}</div>
            <div class="ds-post-date">${dateLabel}</div>
        </div>
        ${menuHtml}
    </div>
    <div class="ds-post-body">
        <h3 class="ds-post-title">${title}</h3>
        ${dreamTypeBadge}
        ${previewHtml}
        ${panel}
        ${btn}
    </div>
    <div class="ds-post-divider" aria-hidden="true"></div>
    <div class="ds-post-actions" role="group" aria-label="夢境動作">
        <button class="ds-action-btn ds-follow-btn${followed ? ' ds-followed' : ''}"
                data-id="${safeId}" aria-pressed="${followed}"
                aria-label="${followed ? '取消關注' : '關注'}">
            <i class="${followed ? 'ri-heart-fill' : 'ri-heart-line'}" aria-hidden="true"></i>
            ${followCount > 0 ? `<span class="ds-follow-count">${followCount}</span>` : ''}
        </button>
        <a class="ds-action-btn ds-reply-btn"
           href="${REPLY_URL}?dream=${encodeURIComponent(id)}"
           aria-label="回應這個夢境">
            <i class="ri-chat-1-line" aria-hidden="true"></i>
            ${replyCount > 0 ? `<span class="ds-reply-count">${replyCount}</span>` : ''}
        </a>
    </div>
</article>`;
    }

    // 清單 (table) 模式
    function buildTableRow(item, index) {
        const safeId      = esc(item.id);
        const author      = esc(item.user_username || item.create_user || '匿名');
        const title       = esc(item.title || '（無主題）');
        const dreamType   = item.dream_type
            ? `<span class="ds-dream-type-badge">${esc(item.dream_type)}</span>`
            : '<span class="ds-td-empty">—</span>';
        const dateLabel   = item.dream_date ? fmtDate(item.dream_date) : '—';
        const followed    = !!item.is_followed;
        const followCount = item.follow_count || 0;
        const replyCount  = item.reply_count  || 0;
        const menuHtml    = buildMenuHtml(item, safeId);

        return `<tr class="ds-table-row" data-id="${safeId}">
    <td class="ds-td-num">${index + 1}</td>
    <td class="ds-td-title">
        <button class="ds-td-title-btn" data-id="${safeId}" title="${title}">${title}</button>
    </td>
    <td class="ds-td-type">${dreamType}</td>
    <td class="ds-td-author">${author}</td>
    <td class="ds-td-date">${dateLabel}</td>
    <td class="ds-td-actions">
        <button class="ds-action-btn ds-follow-btn${followed ? ' ds-followed' : ''}"
                data-id="${safeId}" aria-pressed="${followed}"
                aria-label="${followed ? '取消關注' : '關注'}">
            <i class="${followed ? 'ri-heart-fill' : 'ri-heart-line'}" aria-hidden="true"></i>
            ${followCount > 0 ? `<span class="ds-follow-count">${followCount}</span>` : ''}
        </button>
        <a class="ds-action-btn ds-reply-btn"
           href="${REPLY_URL}?dream=${encodeURIComponent(item.id)}"
           aria-label="回應這個夢境">
            <i class="ri-chat-1-line" aria-hidden="true"></i>
            ${replyCount > 0 ? `<span class="ds-reply-count">${replyCount}</span>` : ''}
        </a>
        ${menuHtml}
    </td>
</tr>`;
    }

    function buildTableHtml(dreams) {
        const rows = dreams.map(buildTableRow).join('');
        return `<div class="ds-table-wrap">
<table class="ds-feed-table">
    <thead>
        <tr>
            <th class="ds-th-num">#</th>
            <th class="ds-th-title">主題</th>
            <th class="ds-th-type">主題方向</th>
            <th class="ds-th-author">作者</th>
            <th class="ds-th-date">做夢日期</th>
            <th class="ds-th-actions">操作</th>
        </tr>
    </thead>
    <tbody>${rows}</tbody>
</table>
</div>`;
    }

    function renderFeed(data) {
        const list   = document.getElementById('ds-feed-list');
        const dreams = data.dreams || [];

        dreamCache   = {};
        lastFeedData = data;
        dreams.forEach(function (d) { dreamCache[d.id] = d; });

        if (dreams.length === 0) {
            list.className = '';
            list.innerHTML = `<div class="ds-feed-empty">
    <i class="ri-moon-line ds-empty-icon" aria-hidden="true"></i>
    <p>目前沒有夢境，成為第一個分享的人吧！</p>
</div>`;
            return;
        }

        if (currentView === 'grid') {
            list.className = 'ds-feed-view-grid';
            list.innerHTML = dreams.map(buildGridCard).join('');
        } else if (currentView === 'table') {
            list.className = 'ds-feed-view-table';
            list.innerHTML = buildTableHtml(dreams);
        } else {
            list.className = 'ds-feed-view-list';
            list.innerHTML = dreams.map(buildListCard).join('');
        }

        if (typeof GLightbox !== 'undefined') {
            GLightbox({ selector: '.glightbox', touchNavigation: true, loop: false, autoplayVideos: false });
        }
    }

    // ── Load Feed ─────────────────────────────────────────────────────────────

    function loadFeed(searchVal) {
        const list = document.getElementById('ds-feed-list');
        const folderTitle = currentFolder
            ? (foldersCache.find(function (f) { return f.id === currentFolder; }) || {}).title || ''
            : '';
        const loadingLabel = folderTitle ? `正在載入「${esc(folderTitle)}」夢境...` : '正在載入夢境...';
        list.className = '';
        list.innerHTML = `<div class="ds-feed-loading">
    <div class="spinner-border ds-spinner" role="status"><span class="visually-hidden">載入中...</span></div>
    <p class="ds-loading-text">${loadingLabel}</p>
</div>`;

        const params = new URLSearchParams();
        if (searchVal) {
            params.set('search', searchVal);
        } else {
            params.set('sort', currentSort);
            if (currentFilter !== 'all') params.set('filter', currentFilter);
            if (currentFolder) params.set('folder', currentFolder);
        }

        fetch(`${DREAM_UI_API}?${params.toString()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })
        .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(renderFeed)
        .catch(function () {
            list.className = '';
            list.innerHTML = `<div class="ds-feed-error">
    <i class="ri-error-warning-line ds-error-icon" aria-hidden="true"></i>
    <p>載入失敗，請重新整理頁面。</p>
</div>`;
        });
    }

    // ── Event Delegation ─────────────────────────────────────────────────────

    function initFeedDelegation() {
        document.getElementById('ds-feed-list').addEventListener('click', function (e) {

            const followBtn = e.target.closest('.ds-follow-btn');
            if (followBtn) {
                if (followBtn.dataset.pending) return;
                const id    = followBtn.dataset.id;
                const wasOn = followBtn.classList.contains('ds-followed');
                const nowOn = !wasOn;

                _applyFollowUI(followBtn, nowOn);
                followBtn.dataset.pending = '1';

                fetch(FOLLOW_API, {
                    method:  'POST',
                    headers: {
                        'Content-Type':     'application/json',
                        'X-CSRFToken':      CSRF,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ dream: id }),
                })
                .then(function (res) {
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    return res.json();
                })
                .then(function (data) {
                    _applyFollowUI(followBtn, data.followed, data.follow_count);
                })
                .catch(function () {
                    _applyFollowUI(followBtn, wasOn);
                })
                .finally(function () {
                    delete followBtn.dataset.pending;
                });
                return;
            }

            const expandBtn = e.target.closest('.ds-expand-btn');
            if (expandBtn) {
                const panel      = document.getElementById('ds-expand-' + expandBtn.dataset.expandId);
                if (!panel) return;
                const willExpand = expandBtn.getAttribute('aria-expanded') !== 'true';
                panel.classList.toggle('ds-expanded', willExpand);
                expandBtn.setAttribute('aria-expanded', String(willExpand));
                expandBtn.querySelector('.ds-expand-icon').className =
                    (willExpand ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line') + ' ds-expand-icon';
                expandBtn.querySelector('.ds-expand-label').textContent =
                    willExpand ? '收起' : '查看內容';
                return;
            }

            const titleBtn = e.target.closest('.ds-td-title-btn');
            if (titleBtn) { openDetailModal(titleBtn.dataset.id); return; }

            const editBtn = e.target.closest('.ds-edit-btn');
            if (editBtn) { openEditModal(editBtn.dataset.id); return; }

            const deleteBtn = e.target.closest('.ds-delete-btn');
            if (deleteBtn) { openDeleteConfirm(deleteBtn.dataset.id); return; }
        });
    }

    // ── Search ────────────────────────────────────────────────────────────────

    function initSearch() {
        const searchToggle = document.getElementById('ds-search-toggle');
        const searchClose  = document.getElementById('ds-search-close');
        const searchBar    = document.getElementById('ds-search-bar');
        const searchInput  = document.getElementById('ds-search-input');
        const sortBar      = document.getElementById('ds-sort-bar');

        searchToggle.addEventListener('click', function () {
            searchBar.hidden = false;
            sortBar.hidden   = true;
            searchInput.focus();
        });

        searchClose.addEventListener('click', function () {
            searchBar.hidden = true;
            sortBar.hidden   = false;
            searchInput.value = '';
            loadFeed('');
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                searchBar.hidden = true;
                sortBar.hidden   = false;
                this.value = '';
                loadFeed('');
            }
        });

        searchInput.addEventListener('input', function () {
            clearTimeout(searchTimer);
            const val = this.value.trim();
            searchTimer = setTimeout(function () { loadFeed(val); }, 300);
        });
    }

    // ── Sort ─────────────────────────────────────────────────────────────────

    function initSort() {
        document.getElementById('ds-sort-bar').addEventListener('click', function (e) {
            const btn = e.target.closest('.ds-sort-btn');
            if (!btn) return;
            const sort = btn.dataset.sort;
            if (sort === currentSort) return;
            currentSort = sort;
            document.querySelectorAll('.ds-sort-btn').forEach(function (b) {
                b.classList.toggle('ds-sort-active', b.dataset.sort === sort);
            });
            loadFeed(document.getElementById('ds-search-input').value.trim());
        });
    }

    // ── Filter ────────────────────────────────────────────────────────────────

    function updateFolderSelect() {
        const select = $('#ds-folder-select');
        if (!select.length) return;
        select.empty();
        select.append('<option value="">（清除篩選）</option>');
        foldersCache.forEach(function (folder) {
            select.append(new Option(folder.title, folder.id));
        });
        if (!select.data('select2')) {
            select.select2({ placeholder: '請選擇主題', allowClear: true, dropdownParent: $('#FolderChooseModal') });
        } else {
            select.trigger('change.select2');
        }
        if (currentFolder) {
            select.val(currentFolder).trigger('change');
        } else {
            select.val('').trigger('change');
        }
    }

    function loadAllowedFolders() {
        fetch('/dreams/dream-folder/allowed/', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (res) { return res.json(); })
        .then(function (folders) {
            foldersCache = folders || [];
            updateFolderSelect();
        })
        .catch(function (err) { console.error('[loadAllowedFolders] 載入失敗:', err); });
    }

    function initFilter() {
        const toggleBtn = document.getElementById('ds-filter-toggle');
        document.querySelectorAll('.ds-filter-item').forEach(function (item) {
            item.addEventListener('click', function () {
                const filter = this.dataset.filter;
                if (filter === currentFilter && !currentFolder) return;
                currentFilter = filter;
                currentFolder = '';
                document.querySelectorAll('.ds-filter-item').forEach(function (b) {
                    b.classList.toggle('ds-filter-active', b.dataset.filter === filter);
                });
                toggleBtn.classList.toggle('ds-filter-on', filter !== 'all');
                loadFeed(document.getElementById('ds-search-input').value.trim());
            });
        });
    }

    // ── Folders（分享表單下拉）────────────────────────────────────────────────

    function loadFolders() {
        fetch('/dreams/dream-folder/?draw=1&start=0&length=1000&search[value]=&order[0][column]=0&order[0][dir]=asc', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function (res) { return res.json(); })
        .then(function (data) {
            const select  = document.getElementById('ds-input-parent');
            const current = select.value;
            const folders = data.data || [];
            select.innerHTML = '<option value="" disabled>請選擇主題方向...</option>';
            folders.forEach(function (f) {
                const opt = document.createElement('option');
                opt.value       = f.id;
                opt.textContent = f.title;
                select.appendChild(opt);
            });
            if (current) select.value = current;
        })
        .catch(function (err) { console.error('[loadFolders] 載入失敗:', err); });
    }

    // ── Hashtag Autocomplete ──────────────────────────────────────────────────

    function parseHashtags(value) {
        const parts     = value.split(' ');
        const completed = [];
        let current     = '';
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;
            if (i === parts.length - 1) {
                if (part.startsWith('#')) {
                    const tag = part.substring(1);
                    if (value.endsWith(' ')) { if (tag) completed.push(tag); }
                    else { current = tag; }
                }
            } else {
                if (part.startsWith('#')) {
                    const tag = part.substring(1);
                    if (tag) completed.push(tag);
                }
            }
        }
        return { completed: completed, current: current };
    }

    function updateHashtagSuggestions(query, excludeList) {
        const dropdown = document.getElementById('ds-hashtag-dropdown');
        excludeList    = excludeList || [];
        const params   = new URLSearchParams();
        params.set('q', query);
        if (excludeList.length > 0) params.set('exclude', excludeList.join(','));
        fetch(`${HASHTAG_API}?${params.toString()}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(function (tags) {
            dropdown.innerHTML = '';
            if (tags.length === 0) { dropdown.style.display = 'none'; return; }
            tags.forEach(function (tag) {
                const item = document.createElement('div');
                item.className    = 'ds-hashtag-item';
                item.textContent  = '#' + tag;
                item.dataset.tag  = tag;
                dropdown.appendChild(item);
            });
            dropdown.style.display = 'block';
        })
        .catch(function () { dropdown.style.display = 'none'; });
    }

    function hideHashtagDropdown() {
        document.getElementById('ds-hashtag-dropdown').style.display = 'none';
    }

    function insertHashtag(tag, input) {
        const parsed  = parseHashtags(input.value);
        const allTags = parsed.completed.concat([tag]);
        input.value   = allTags.map(function (t) { return '#' + t; }).join(' ') + ' ';
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ── Image Compression ─────────────────────────────────────────────────────

    function compressImage(file, maxWidth, quality) {
        maxWidth = maxWidth || 800;
        quality  = quality  || 0.85;
        return new Promise(function (resolve, reject) {
            const reader  = new FileReader();
            reader.onerror = reject;
            reader.onload  = function (e) {
                const img    = new Image();
                img.onerror  = reject;
                img.onload   = function () {
                    let width  = img.width;
                    let height = img.height;
                    if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
                    const canvas = document.createElement('canvas');
                    canvas.width  = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    canvas.toBlob(function (blob) {
                        if (!blob) { reject(new Error('圖片壓縮失敗')); return; }
                        resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                    }, 'image/jpeg', quality);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ── Dropzone ───────────────────────────────────────────────────────────────

    let dzInstance  = null;
    let dzPendingFile = null;

    function initDropzone() {
        Dropzone.autoDiscover = false;
        dzInstance = new Dropzone('#ds-dropzone', {
            url: '/dreams/image/', autoProcessQueue: false, maxFiles: 1,
            acceptedFiles: 'image/*', addRemoveLinks: true,
            dictRemoveFile: '移除', dictDefaultMessage: '',
            dictMaxFilesExceeded: '只能上傳一張圖片',
            thumbnailWidth: 200, thumbnailHeight: 200, createImageThumbnails: true,
        });
        dzInstance.on('addedfile', function (file) {
            if (dzInstance.files.length > 1) dzInstance.removeFile(dzInstance.files[0]);
            dzPendingFile = file;
            document.getElementById('ds-remove-image-flag').value = '';
        });
        dzInstance.on('removedfile', function () {
            dzPendingFile = null;
            const existingId = document.getElementById('ds-existing-image-id').value;
            if (existingId) document.getElementById('ds-remove-image-flag').value = existingId;
        });
        dzInstance.on('error', function (file, msg) { console.error('[Dropzone] 錯誤:', msg); });
    }

    function resetDropzone() {
        if (dzInstance) dzInstance.removeAllFiles(true);
        dzPendingFile = null;
        document.getElementById('ds-existing-image-id').value  = '';
        document.getElementById('ds-remove-image-flag').value  = '';
    }

    function loadExistingImageToDropzone(imageUrl, imageId) {
        if (!dzInstance || !imageUrl) return;
        dzInstance.removeAllFiles(true);
        dzPendingFile = null;
        const mockFile = { name: '現有圖片', size: 0, accepted: true, status: Dropzone.SUCCESS };
        dzInstance.files.push(mockFile);
        dzInstance.emit('addedfile', mockFile);
        dzInstance.emit('thumbnail', mockFile, imageUrl);
        dzInstance.emit('complete', mockFile);
        document.getElementById('ds-existing-image-id').value = imageId || '';
        document.getElementById('ds-remove-image-flag').value  = '';
    }

    // ── Share / Edit Modal ────────────────────────────────────────────────────

    function resetShareModal() {
        document.getElementById('ds-share-form').reset();
        document.getElementById('ds-edit-id').value = '';
        document.getElementById('ds-modal-title-text').textContent = '分享夢境';
        document.getElementById('ds-modal-icon').className = 'ri-quill-pen-line me-2';
        resetDropzone();
        const err = document.getElementById('ds-share-error');
        err.hidden    = true;
        err.textContent = '';
    }

    function openEditModal(id) {
        const item = dreamCache[id];
        if (!item) return;
        document.getElementById('ds-edit-id').value = id;
        document.getElementById('ds-modal-title-text').textContent = '修改夢境';
        document.getElementById('ds-modal-icon').className = 'ri-edit-line me-2';
        document.getElementById('ds-input-title').value  = item.title || '';
        document.getElementById('ds-input-date').value   = item.dream_date || '';
        document.getElementById('ds-input-parent').value = item.parent || '';
        const dc = (item.dream_content && typeof item.dream_content === 'object') ? item.dream_content : {};
        document.getElementById('ds-input-content').value        = dc['內容'] || '';
        document.getElementById('ds-input-interpretation').value = dc['個人解讀/夢語言解釋'] || '';
        document.getElementById('ds-input-revelation').value     = dc['禱告方向'] || '';
        const hashtags = (item.hashtags || []).map(function (t) { return '#' + t; }).join(' ');
        document.getElementById('ds-input-hashtags').value = hashtags;
        resetDropzone();
        if (item.image_url) loadExistingImageToDropzone(item.image_url, item.image_id);
        shareModal.show();
    }

    function setShareSubmitting(on) {
        const btn     = document.getElementById('ds-share-submit');
        const btnText = document.getElementById('ds-share-btn-text');
        const spinner = document.getElementById('ds-share-spinner');
        btn.disabled = on;
        btnText.classList.toggle('d-none', on);
        spinner.classList.toggle('d-none', !on);
    }

    function showShareError(msg) {
        const err = document.getElementById('ds-share-error');
        err.textContent = msg;
        err.hidden = false;
    }

    function submitDream() {
        const titleEl  = document.getElementById('ds-input-title');
        const parentEl = document.getElementById('ds-input-parent');
        const title    = titleEl.value.trim();
        const parentId = parentEl.value;

        if (!title)    { titleEl.focus();  showShareError('請輸入主題。');     return; }
        if (!parentId) { parentEl.focus(); showShareError('請選擇禱告方向。'); return; }

        const editId  = document.getElementById('ds-edit-id').value;
        const isEdit  = !!editId;
        const dateVal = document.getElementById('ds-input-date').value;

        const hashtagsInput    = document.getElementById('ds-input-hashtags').value;
        const hashtags         = hashtagsInput.match(/#[一-龥\w]+/g) || [];
        const cleanedHashtags  = hashtags.map(function (t) { return t.substring(1); });

        const selectedOption = parentEl.options[parentEl.selectedIndex];
        const payload = {
            title:         title,
            is_folder:     false,
            parent:        parentId,
            dream_type:    selectedOption ? selectedOption.textContent.trim() : '',
            dream_date:    dateVal || null,
            dream_content: {
                '內容':               document.getElementById('ds-input-content').value.trim(),
                '個人解讀/夢語言解釋': document.getElementById('ds-input-interpretation').value.trim(),
                '禱告方向':           document.getElementById('ds-input-revelation').value.trim(),
            },
            hashtags: cleanedHashtags,
        };
        if (!isEdit && USER_ID) payload.user = parseInt(USER_ID, 10) || USER_ID;

        const pendingFile   = dzPendingFile;
        const removeImageId = document.getElementById('ds-remove-image-flag').value;

        setShareSubmitting(true);

        fetch(isEdit ? `${DREAM_API}${editId}/` : DREAM_API, {
            method:  isEdit ? 'PATCH' : 'POST',
            headers: {
                'Content-Type':     'application/json',
                'X-CSRFToken':      CSRF,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify(payload),
        })
        .then(function (res) {
            if (!res.ok) return res.json().then(function (d) { throw d; });
            return res.json();
        })
        .then(function (data) {
            const dreamId = data.id || editId;

            if (removeImageId && !pendingFile) {
                return fetch(`/dreams/image/${removeImageId}/`, {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': CSRF, 'X-Requested-With': 'XMLHttpRequest' },
                }).then(function (res) {
                    if (!res.ok && res.status !== 204) throw new Error('圖片刪除失敗');
                    return { ok: true };
                });
            }

            if (pendingFile) {
                return compressImage(pendingFile, 800, 0.85)
                    .then(function (compressedFile) {
                        const formData = new FormData();
                        formData.append('image', compressedFile);
                        formData.append('dream', dreamId);
                        return fetch('/dreams/image/', {
                            method: 'POST',
                            headers: { 'X-CSRFToken': CSRF, 'X-Requested-With': 'XMLHttpRequest' },
                            body: formData,
                        });
                    })
                    .then(function (res) {
                        if (!res.ok) return res.json().then(function (e) { throw e; });
                        return res.json();
                    });
            }

            return Promise.resolve({ ok: true });
        })
        .then(function () {
            shareModal.hide();
            resetShareModal();
            loadFeed(document.getElementById('ds-search-input').value.trim());
        })
        .catch(function (err) {
            let msg = (isEdit ? '修改' : '分享') + '失敗，請稍後再試。';
            if (err && typeof err === 'object') {
                const first = Object.values(err)[0];
                if (Array.isArray(first)) msg = first[0];
                else if (typeof first === 'string') msg = first;
            }
            showShareError(msg);
        })
        .finally(function () { setShareSubmitting(false); });
    }

    function initShareModal() {
        const el = document.getElementById('ds-share-modal');
        if (!el) return;
        shareModal = new bootstrap.Modal(el);

        const openTrigger = document.getElementById('ds-share-open');
        if (openTrigger) {
            openTrigger.addEventListener('click', function () { shareModal.show(); });
            openTrigger.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shareModal.show(); }
            });
        }

        initDropzone();

        const hashtagInput    = document.getElementById('ds-input-hashtags');
        const hashtagDropdown = document.getElementById('ds-hashtag-dropdown');
        let selectedIndex     = -1;

        hashtagInput.addEventListener('input', function () {
            clearTimeout(hashtagTimer);
            const value = this.value;
            selectedIndex = -1;
            if (value.includes('#')) {
                hashtagTimer = setTimeout(function () {
                    const parsed = parseHashtags(value);
                    updateHashtagSuggestions(parsed.current, parsed.completed);
                }, 300);
            } else {
                hideHashtagDropdown();
            }
        });

        hashtagInput.addEventListener('keydown', function (e) {
            const items = hashtagDropdown.querySelectorAll('.ds-hashtag-item');
            if (items.length === 0 || hashtagDropdown.style.display === 'none') return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                items.forEach(function (item, idx) { item.classList.toggle('active', idx === selectedIndex); });
                if (selectedIndex >= 0) items[selectedIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                items.forEach(function (item, idx) { item.classList.toggle('active', idx === selectedIndex); });
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                insertHashtag(items[selectedIndex].dataset.tag, this);
            } else if (e.key === 'Escape') {
                hideHashtagDropdown();
            }
        });

        hashtagDropdown.addEventListener('click', function (e) {
            const item = e.target.closest('.ds-hashtag-item');
            if (!item) return;
            insertHashtag(item.dataset.tag, hashtagInput);
        });

        document.addEventListener('click', function (e) {
            if (!hashtagInput.contains(e.target) && !hashtagDropdown.contains(e.target)) {
                hideHashtagDropdown();
            }
        });

        el.addEventListener('show.bs.modal', function () { loadFolders(); });
        el.addEventListener('hidden.bs.modal', resetShareModal);
        document.getElementById('ds-share-form').addEventListener('submit', function (e) {
            e.preventDefault();
            submitDream();
        });
    }

    // ── Delete Modal ──────────────────────────────────────────────────────────

    function openDeleteConfirm(id) {
        const item  = dreamCache[id];
        pendingDeleteId = id;
        const titleEl   = document.querySelector('.ds-delete-dream-title');
        if (titleEl) titleEl.textContent = item ? `「${item.title}」` : '';
        deleteModal.show();
    }

    function deleteDream(id) {
        fetch(`${DREAM_API}${id}/`, {
            method:  'DELETE',
            headers: { 'X-CSRFToken': CSRF, 'X-Requested-With': 'XMLHttpRequest' },
        })
        .then(function (res) {
            if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
            delete dreamCache[id];
            const card = document.querySelector(`.ds-post-card[data-id="${CSS.escape(id)}"]`);
            if (card) card.remove();
            // 在 table 模式下移除的是 tr
            const row = document.querySelector(`.ds-table-row[data-id="${CSS.escape(id)}"]`);
            if (row) row.remove();
            const list = document.getElementById('ds-feed-list');
            if (!list.querySelector('.ds-post-card, .ds-table-row')) {
                list.className = '';
                list.innerHTML = `<div class="ds-feed-empty">
    <i class="ri-moon-line ds-empty-icon" aria-hidden="true"></i>
    <p>目前沒有夢境，成為第一個分享的人吧！</p>
</div>`;
            }
        })
        .catch(function () {
            const list   = document.getElementById('ds-feed-list');
            const notice = document.createElement('div');
            notice.className  = 'ds-feed-error';
            notice.innerHTML  = '<i class="ri-error-warning-line ds-error-icon"></i><p>刪除失敗，請稍後再試。</p>';
            list.prepend(notice);
            setTimeout(function () { notice.remove(); }, 4000);
        });
    }

    // ── Detail Modal ──────────────────────────────────────────────────────────

    let detailModal = null;

    function openDetailModal(id) {
        const item = dreamCache[id];
        if (!item) return;

        const dc = (item.dream_content && typeof item.dream_content === 'object') ? item.dream_content : {};

        document.getElementById('ds-detail-title').textContent    = item.title || '（無主題）';
        document.getElementById('ds-detail-date').textContent     = item.dream_date ? fmtDate(item.dream_date) : '—';
        document.getElementById('ds-detail-author').textContent   = item.user_username || item.create_user || '匿名';
        document.getElementById('ds-detail-type').textContent     = item.dream_type || '—';
        document.getElementById('ds-detail-content').textContent  = dc['內容'] || '（無內容）';

        const interpEl = document.getElementById('ds-detail-interp-wrap');
        const interpText = dc['個人解讀/夢語言解釋'] || '';
        interpEl.hidden = !interpText;
        document.getElementById('ds-detail-interp').textContent = interpText;

        const revelEl = document.getElementById('ds-detail-revel-wrap');
        const revelText = dc['禱告方向'] || '';
        revelEl.hidden = !revelText;
        document.getElementById('ds-detail-revel').textContent = revelText;

        const tagsEl  = document.getElementById('ds-detail-tags-wrap');
        const tags    = item.hashtags || [];
        tagsEl.hidden = tags.length === 0;
        document.getElementById('ds-detail-tags').innerHTML =
            tags.map(function (t) { return `<span class="ds-hashtag">#${esc(t)}</span>`; }).join(' ');

        const imgEl = document.getElementById('ds-detail-image-wrap');
        if (item.image_url) {
            imgEl.hidden = false;
            imgEl.innerHTML = `<a href="${esc(item.image_url)}" class="glightbox" data-gallery="detail-${esc(id)}">
    <img src="${esc(item.image_url)}" alt="夢境圖片" class="img-fluid rounded" style="max-height:320px;cursor:zoom-in;">
</a>`;
        } else {
            imgEl.hidden = true;
            imgEl.innerHTML = '';
        }

        if (typeof GLightbox !== 'undefined') {
            GLightbox({ selector: '#ds-detail-image-wrap .glightbox', touchNavigation: true, loop: false });
        }

        detailModal.show();
    }

    function initDetailModal() {
        const el = document.getElementById('ds-detail-modal');
        if (!el) return;
        detailModal = new bootstrap.Modal(el);
    }

    function initDeleteModal() {
        const el    = document.getElementById('ds-delete-modal');
        deleteModal = new bootstrap.Modal(el);
        document.getElementById('ds-delete-confirm').addEventListener('click', function () {
            const id = pendingDeleteId;
            pendingDeleteId = null;
            deleteModal.hide();
            if (id) deleteDream(id);
        });
        el.addEventListener('hidden.bs.modal', function () { pendingDeleteId = null; });
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        const initFolder = cfg.dataset.initFolder || '';
        if (initFolder) currentFolder = initFolder;

        setView(currentView);   // 套用初始 view 狀態（按鈕高亮 + container data-view）
        initViewToggle();
        initFeedDelegation();
        initSearch();
        initSort();
        initFilter();
        initShareModal();
        initDetailModal();
        initDeleteModal();
        loadAllowedFolders();
        loadFeed('');
    });

})();
