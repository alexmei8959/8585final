(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────────────────
    const cfg = document.getElementById('ds-config');
    if (!cfg) return;

    const DREAM_API    = cfg.dataset.dreamApi;
    const DREAM_UI_API = cfg.dataset.dreamUiApi;
    const REPLY_URL    = cfg.dataset.replyUrl;
    const CSRF         = cfg.dataset.csrf;
    const USER_ID      = cfg.dataset.userId;          // 字串
    const USER_ROLE    = cfg.dataset.userRole;         // '0','1','2','3'
    const FOLLOW_API     = '/dreams/follow/toggle/';
    const HASHTAG_API    = '/dreams/dream/hashtags/';

    let searchTimer     = null;
    let hashtagTimer    = null;
    let shareModal      = null;
    let deleteModal     = null;
    let pendingDeleteId = null;
    let currentSort     = 'dream_date';
    let currentFilter   = 'all';
    let currentFolder   = '';  // 當前選擇的主題 ID

    // 渲染時快取所有 dream 資料，供 edit/delete 使用
    let dreamCache = {};
    let foldersCache = [];  // 快取主題列表

    // ── Utilities ─────────────────────────────────────────────────────────────

    function esc(text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    }

    /** 頭像 HTML：有圖用 img，無圖 fallback icon */
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

    /** 套用關注按鈕的 UI 狀態；count 傳 undefined 時保留現有數字 */
    function _applyFollowUI(btn, on, count) {
        btn.classList.toggle('ds-followed', on);
        btn.setAttribute('aria-pressed', String(on));
        btn.setAttribute('aria-label', on ? '取消關注' : '關注');
        btn.querySelector('i').className = (on ? 'ri-heart-fill' : 'ri-heart-line');
        btn.querySelector('span').textContent = on ? '已關注' : '關注';

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
        // 本人，或管理員(role 0/1) 可修改任何人的夢境
        const isOwner = item.user !== null && item.user !== undefined && String(item.user) === USER_ID;
        const isAdmin = USER_ROLE === '0' || USER_ROLE === '1';
        return isOwner || isAdmin;

    }

    function canDeleteDream(item) {
        // 本人，或管理員(role 0/1) 可刪除任何人的夢境
        const isOwner = item.user !== null && item.user !== undefined && String(item.user) === USER_ID;
        const isAdmin = USER_ROLE === '0' || USER_ROLE === '1';
        return isOwner || isAdmin;
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const CONTENT_FIELDS = [
        { key: '內容',            icon: 'ri-book-open-line' },
        { key: '個人解讀/夢語言解釋', icon: 'ri-translate-2' },
        { key: '禱告方向',         icon: 'ri-lightbulb-flash-line' },
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
</button></li>`
            : '';

        const deleteItem = showDelete
            ? `<li><button class="dropdown-item ds-dropdown-item ds-dropdown-danger ds-delete-btn" data-id="${safeId}">
    <i class="ri-delete-bin-line" aria-hidden="true"></i>刪除
</button></li>`
            : '';

        return `<div class="dropdown ds-post-menu">
    <button class="ds-menu-toggle" data-bs-toggle="dropdown" aria-expanded="false" aria-label="更多選項">
        <i class="ri-more-2-fill" aria-hidden="true"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end ds-dropdown-menu">
        ${editItem}${deleteItem}
    </ul>
</div>`;
    }

    function buildPostCard(item) {
        const id          = item.id;
        const safeId      = esc(id);
        const author      = esc(item.user_username || item.create_user || '匿名');
        const title       = esc(item.title || '（無主題）');
        const dateLabel   = item.dream_date
            ? fmtDate(item.dream_date)
            : fmtRelative(item.create_date);
        const followed    = !!item.is_followed;
        const followCount = item.follow_count || 0;
        const replyCount  = item.reply_count  || 0;
        const { panel, btn } = buildExpandPanel(item.dream_content, safeId);
        const menuHtml    = buildMenuHtml(item, safeId);

        // 禱告方向 badge
        const dreamTypeBadge = item.dream_type
            ? `<span class="ds-dream-type-badge">${esc(item.dream_type)}</span>`
            : '';

        // 展開前預覽：取 dream_content['內容'] 前 50 字
        let previewHtml = '';
        const dc = item.dream_content;
        if (dc && typeof dc === 'object' && dc['內容']) {
            const raw     = String(dc['內容']);
            const preview = raw.length > 50 ? raw.slice(0, 50) + '...' : raw;
            previewHtml   = `<p class="ds-post-preview">${esc(preview)}</p>`;
        }

        // Hashtags 顯示
        let hashtagsHtml = '';
        if (item.hashtags && item.hashtags.length > 0) {
            const tags = item.hashtags.map(function(tag) {
                return `<span class="ds-hashtag">#${esc(tag)}</span>`;
            }).join(' ');
            hashtagsHtml = `<div class="ds-hashtags">${tags}</div>`;
        }

        // 圖片顯示
        let imageHtml = '';
        if (item.image_url) {
            imageHtml = `<div class="ds-post-image">
                <a href="${esc(item.image_url)}" class="glightbox" data-gallery="dream-${safeId}">
                    <img src="${esc(item.image_url)}" alt="夢境圖片" loading="lazy">
                </a>
            </div>`;
        }

        return `<article class="ds-post-card" data-id="${safeId}">
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
        ${imageHtml}
        ${hashtagsHtml}
        ${panel}
        ${btn}
    </div>
    <div class="ds-post-divider" aria-hidden="true"></div>
    <div class="ds-post-actions" role="group" aria-label="夢境動作">
        <button class="ds-action-btn ds-follow-btn${followed ? ' ds-followed' : ''}"
                data-id="${safeId}" aria-pressed="${followed}"
                aria-label="${followed ? '取消關注' : '關注'}">
            <i class="${followed ? 'ri-heart-fill' : 'ri-heart-line'}" aria-hidden="true"></i>
            <span>${followed ? '已關注' : '關注'}</span>
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

    /**
     * 載入使用者可查看的所有主題（用於篩選下拉選單）
     * 使用 /dreams/folder/allowed/ API，不檢查 folder_enable
     */
    function loadAllowedFolders() {
        console.log('[loadAllowedFolders] 開始載入...');
        fetch('/dreams/dream-folder/allowed/', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function (res) {
            console.log('[loadAllowedFolders] Response status:', res.status);
            return res.json();
        })
        .then(function (folders) {
            console.log('[loadAllowedFolders] 收到資料:', folders);
            console.log('[loadAllowedFolders] 資料數量:', folders ? folders.length : 0);
            foldersCache = folders || [];
            console.log('[loadAllowedFolders] foldersCache 已更新，數量:', foldersCache.length);
            updateFolderSelect();
        })
        .catch(function (err) {
            console.error('[loadAllowedFolders] 載入失敗:', err);
        });
    }

    function renderFeed(data) {
        const list   = document.getElementById('ds-feed-list');
        const dreams = data.dreams || [];

        // 更新快取
        dreamCache = {};
        dreams.forEach(function (d) { dreamCache[d.id] = d; });

        if (dreams.length === 0) {
            list.innerHTML = `<div class="ds-feed-empty">
    <i class="ri-moon-line ds-empty-icon" aria-hidden="true"></i>
    <p>目前沒有夢境，成為第一個分享的人吧！</p>
</div>`;
            return;
        }
        list.innerHTML = dreams.map(buildPostCard).join('');

        // 初始化 glightbox 圖片燈箱
        if (typeof GLightbox !== 'undefined') {
            GLightbox({
                selector: '.glightbox',
                touchNavigation: true,
                loop: false,
                autoplayVideos: false
            });
        }
    }

    // ── Load Feed ─────────────────────────────────────────────────────────────

    function loadFeed(searchVal) {
        const list = document.getElementById('ds-feed-list');
        const folderTitle = currentFolder
            ? (foldersCache.find(function(f) { return f.id === currentFolder; }) || {}).title || ''
            : '';
        const loadingLabel = folderTitle ? `正在載入「${esc(folderTitle)}」夢境...` : '正在載入夢境...';
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
            list.innerHTML = `<div class="ds-feed-error">
    <i class="ri-error-warning-line ds-error-icon" aria-hidden="true"></i>
    <p>載入失敗，請重新整理頁面。</p>
</div>`;
        });
    }

    // ── Event Delegation ─────────────────────────────────────────────────────

    function initFeedDelegation() {
        document.getElementById('ds-feed-list').addEventListener('click', function (e) {

            // 關注
            const followBtn = e.target.closest('.ds-follow-btn');
            if (followBtn) {
                if (followBtn.dataset.pending) return;  // 防止連點
                const id      = followBtn.dataset.id;
                const wasOn   = followBtn.classList.contains('ds-followed');
                const nowOn   = !wasOn;

                // 樂觀更新
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
                    _applyFollowUI(followBtn, wasOn);  // 回滾
                })
                .finally(function () {
                    delete followBtn.dataset.pending;
                });
                return;
            }

            // 展開 / 收起
            const expandBtn = e.target.closest('.ds-expand-btn');
            if (expandBtn) {
                const panel     = document.getElementById('ds-expand-' + expandBtn.dataset.expandId);
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

            // 修改
            const editBtn = e.target.closest('.ds-edit-btn');
            if (editBtn) { openEditModal(editBtn.dataset.id); return; }

            // 刪除
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

        const sortBar = document.getElementById('ds-sort-bar');

        // 放大鏡 → 展開搜尋列並聚焦
        searchToggle.addEventListener('click', function () {
            searchBar.hidden = false;
            sortBar.hidden = true;
            searchInput.focus();
        });

        // X 按鈕 → 收起搜尋列、清除並重新載入
        searchClose.addEventListener('click', function () {
            searchBar.hidden = true;
            sortBar.hidden = false;
            searchInput.value = '';
            loadFeed('');
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                searchBar.hidden = true;
                sortBar.hidden = false;
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
        console.log('[updateFolderSelect] 開始更新，foldersCache 數量:', foldersCache.length);
        console.log('[updateFolderSelect] jQuery 可用:', typeof $ !== 'undefined');
        console.log('[updateFolderSelect] foldersCache 內容:', JSON.stringify(foldersCache));

        const select = $('#ds-folder-select');
        console.log('[updateFolderSelect] select.length:', select.length);

        if (!select.length) {
            console.log('[updateFolderSelect] 找不到 #ds-folder-select 元素');
            return;
        }

        // 清空並重建選項
        select.empty();
        select.append('<option value="">（清除篩選）</option>');
        console.log('[updateFolderSelect] 已清空並加入預設選項');

        foldersCache.forEach(function (folder) {
            console.log('[updateFolderSelect] 新增選項:', folder.title, folder.id);
            const option = new Option(folder.title, folder.id);
            select.append(option);
        });

        console.log('[updateFolderSelect] 總選項數:', select.find('option').length);

        // 初始化 select2
        if (!select.data('select2')) {
            console.log('[updateFolderSelect] 初始化 Select2');
            select.select2({
                placeholder: '請選擇主題',
                allowClear: true,
                dropdownParent: $('#FolderChooseModal')
            });
        } else {
            console.log('[updateFolderSelect] Select2 已存在，觸發 change');
            select.trigger('change.select2');
        }

        // 設定當前選中的主題
        if (currentFolder) {
            select.val(currentFolder).trigger('change');
        } else {
            select.val('').trigger('change');
        }
        console.log('[updateFolderSelect] 更新完成');
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

    // ── Folders（禱告方向下拉）────────────────────────────────────────────────

    function loadFolders() {
        console.log('[loadFolders] 開始載入分享表單主題...');
        // 使用 DreamFolderViewSet.list() API，會自動過濾 folder_enable=True 的主題
        fetch('/dreams/dream-folder/?draw=1&start=0&length=1000&search[value]=&order[0][column]=0&order[0][dir]=asc', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function (res) {
            console.log('[loadFolders] Response status:', res.status);
            return res.json();
        })
        .then(function (data) {
            console.log('[loadFolders] 收到資料:', data);
            const select  = document.getElementById('ds-input-parent');
            const current = select.value;          // 修改模式下保留已選值
            const folders = data.data || [];       // DataTables 格式：data.data
            console.log('[loadFolders] 主題數量:', folders.length);

            // 保留 placeholder，重建 options
            select.innerHTML = '<option value="" disabled>請選擇主題方向...</option>';
            folders.forEach(function (f) {
                console.log('[loadFolders] 新增選項:', f.title, f.id);
                const opt = document.createElement('option');
                opt.value       = f.id;
                opt.textContent = f.title;
                select.appendChild(opt);
            });

            // 還原已選值（修改模式）
            if (current) select.value = current;
            console.log('[loadFolders] 載入完成');
        })
        .catch(function (err) {
            console.error('[loadFolders] 載入失敗:', err);
        });
    }

    // ── Hashtag Autocomplete ──────────────────────────────────────────────────

    /**
     * 解析輸入框的所有 hashtag
     * @param {string} value - 輸入框的完整值
     * @returns {object} { completed: 已完成的 hashtag 陣列, current: 當前正在輸入的 hashtag（不含#） }
     */
    function parseHashtags(value) {
        // 用空格分隔
        const parts = value.split(' ');
        const completed = [];
        let current = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            if (i === parts.length - 1) {
                // 最後一段
                if (part.startsWith('#')) {
                    const tag = part.substring(1);
                    if (value.endsWith(' ')) {
                        // 字串以空格結尾，表示這個 hashtag 已完成
                        if (tag) completed.push(tag);
                    } else {
                        // 正在輸入中
                        current = tag;
                    }
                }
            } else {
                // 非最後一段，都是已完成的
                if (part.startsWith('#')) {
                    const tag = part.substring(1);
                    if (tag) completed.push(tag);
                }
            }
        }

        return { completed: completed, current: current };
    }

    /**
     * 更新 hashtag 建議清單
     * @param {string} query - 搜尋關鍵字（不含 #）
     * @param {array} excludeList - 要排除的 hashtag 陣列
     */
    function updateHashtagSuggestions(query, excludeList) {
        const dropdown = document.getElementById('ds-hashtag-dropdown');
        excludeList = excludeList || [];

        const params = new URLSearchParams();
        params.set('q', query);
        if (excludeList.length > 0) {
            params.set('exclude', excludeList.join(','));
        }

        fetch(`${HASHTAG_API}?${params.toString()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(function(tags) {
            // 清空並重建下拉選單
            dropdown.innerHTML = '';

            if (tags.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            tags.forEach(function(tag) {
                const item = document.createElement('div');
                item.className = 'ds-hashtag-item';
                item.textContent = '#' + tag;
                item.dataset.tag = tag;
                dropdown.appendChild(item);
            });

            dropdown.style.display = 'block';
        })
        .catch(function(err) {
            console.error('[Hashtag] 載入建議失敗:', err);
            dropdown.style.display = 'none';
        });
    }

    /**
     * 隱藏 hashtag 下拉選單
     */
    function hideHashtagDropdown() {
        const dropdown = document.getElementById('ds-hashtag-dropdown');
        dropdown.style.display = 'none';
    }

    /**
     * 插入選中的 hashtag 到輸入框
     * @param {string} tag - 要插入的標籤（不含 #）
     * @param {HTMLInputElement} input - 輸入框元素
     */
    function insertHashtag(tag, input) {
        const value = input.value;
        const parsed = parseHashtags(value);

        // 重建字串：已完成的 + 新選中的
        const allTags = parsed.completed.concat([tag]);
        input.value = allTags.map(function(t) { return '#' + t; }).join(' ') + ' ';

        // 觸發 input 事件以更新下拉（顯示剩餘可選標籤）
        input.focus();
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }

    // ── Image Compression ─────────────────────────────────────────────────────

    function compressImage(file, maxWidth, quality) {
        maxWidth = maxWidth || 800;
        quality = quality || 0.85;

        return new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = function(e) {
                const img = new Image();
                img.onerror = reject;
                img.onload = function() {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        function(blob) {
                            if (!blob) { reject(new Error('圖片壓縮失敗')); return; }
                            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ── Dropzone ───────────────────────────────────────────────────────────────

    let dzInstance = null;       // Dropzone 實例
    let dzPendingFile = null;    // 使用者選取但尚未上傳的 File 物件

    function initDropzone() {
        Dropzone.autoDiscover = false;

        dzInstance = new Dropzone('#ds-dropzone', {
            url: '/dreams/image/',          // 僅佔位，實際由 submitDream 控制
            autoProcessQueue: false,        // 手動上傳
            maxFiles: 1,
            acceptedFiles: 'image/*',
            addRemoveLinks: true,
            dictRemoveFile: '移除',
            dictDefaultMessage: '',         // 用 HTML 裡的 dz-message
            dictMaxFilesExceeded: '只能上傳一張圖片',
            thumbnailWidth: 200,
            thumbnailHeight: 200,
            createImageThumbnails: true,
        });

        dzInstance.on('addedfile', function(file) {
            // 超過1張時移除舊的
            if (dzInstance.files.length > 1) {
                dzInstance.removeFile(dzInstance.files[0]);
            }
            dzPendingFile = file;
            // 若原本有既有圖片，清除 flag（改為上傳新圖）
            document.getElementById('ds-remove-image-flag').value = '';
        });

        dzInstance.on('removedfile', function() {
            dzPendingFile = null;
            // 若有既有圖片 ID，標記需要刪除
            const existingId = document.getElementById('ds-existing-image-id').value;
            if (existingId) {
                document.getElementById('ds-remove-image-flag').value = existingId;
            }
        });

        dzInstance.on('error', function(file, msg) {
            console.error('[Dropzone] 錯誤:', msg);
        });
    }

    function resetDropzone() {
        if (dzInstance) {
            dzInstance.removeAllFiles(true);
        }
        dzPendingFile = null;
        document.getElementById('ds-existing-image-id').value = '';
        document.getElementById('ds-remove-image-flag').value = '';
    }

    /** 修改模式下：將既有圖片 URL 顯示為 Dropzone mock file */
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
        document.getElementById('ds-remove-image-flag').value = '';
    }

    // ── Share / Edit Modal ────────────────────────────────────────────────────

    function resetShareModal() {
        document.getElementById('ds-share-form').reset();
        document.getElementById('ds-edit-id').value = '';
        document.getElementById('ds-modal-title-text').textContent = '分享夢境';
        document.getElementById('ds-modal-icon').className = 'ri-quill-pen-line me-2';
        resetDropzone();
        const err = document.getElementById('ds-share-error');
        err.hidden = true;
        err.textContent = '';
    }

    function openEditModal(id) {
        const item = dreamCache[id];
        if (!item) return;

        // 切換為「修改」模式
        document.getElementById('ds-edit-id').value = id;
        document.getElementById('ds-modal-title-text').textContent = '修改夢境';
        document.getElementById('ds-modal-icon').className = 'ri-edit-line me-2';

        // 預填欄位
        document.getElementById('ds-input-title').value  = item.title || '';
        document.getElementById('ds-input-date').value   = item.dream_date || '';
        document.getElementById('ds-input-parent').value = item.parent || '';
        const dc = (item.dream_content && typeof item.dream_content === 'object') ? item.dream_content : {};
        document.getElementById('ds-input-content').value        = dc['內容'] || '';
        document.getElementById('ds-input-interpretation').value = dc['個人解讀/夢語言解釋'] || '';
        document.getElementById('ds-input-revelation').value     = dc['禱告方向'] || '';

        // Hashtags：從陣列轉為 # 開頭格式
        const hashtags = (item.hashtags || []).map(function(t) { return '#' + t; }).join(' ');
        document.getElementById('ds-input-hashtags').value = hashtags;

        // 圖片（修改模式）：將既有圖片載入 Dropzone
        resetDropzone();
        if (item.image_url) {
            loadExistingImageToDropzone(item.image_url, item.image_id);
        }

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

        // 解析 hashtags：提取所有 # 開頭的詞
        const hashtagsInput = document.getElementById('ds-input-hashtags').value;
        const hashtags = hashtagsInput.match(/#[\u4e00-\u9fa5\w]+/g) || [];
        const cleanedHashtags = hashtags.map(function(t) { return t.substring(1); }); // 移除 #

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

        // 讀取 Dropzone 狀態（在 Promise chain 前捕捉，避免 Safari 問題）
        const pendingFile = dzPendingFile;
        const removeImageId = document.getElementById('ds-remove-image-flag').value;

        setShareSubmitting(true);

        // 先提交 JSON 資料
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

            // 情境 1：使用者點「移除」後儲存 → 呼叫 DELETE 刪除既有圖片
            if (removeImageId && !pendingFile) {
                return fetch(`/dreams/image/${removeImageId}/`, {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': CSRF, 'X-Requested-With': 'XMLHttpRequest' },
                }).then(function(res) {
                    if (!res.ok && res.status !== 204) throw new Error('圖片刪除失敗');
                    return { ok: true };
                });
            }

            // 情境 2：使用者選了新圖片 → 壓縮後上傳
            if (pendingFile) {
                return compressImage(pendingFile, 800, 0.85)
                    .then(function(compressedFile) {
                        const formData = new FormData();
                        formData.append('image', compressedFile);
                        formData.append('dream', dreamId);
                        return fetch('/dreams/image/', {
                            method: 'POST',
                            headers: { 'X-CSRFToken': CSRF, 'X-Requested-With': 'XMLHttpRequest' },
                            body: formData,
                        });
                    })
                    .then(function(res) {
                        if (!res.ok) return res.json().then(function(e) { throw e; });
                        return res.json();
                    });
            }

            // 情境 3：圖片無異動
            return Promise.resolve({ ok: true });
        })
        .then(function () {
            shareModal.hide();
            resetShareModal();
            loadFeed(document.getElementById('ds-search-input').value.trim());
        })
        .catch(function (err) {
            console.error('[錯誤] 分享失敗:', err);
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
        if (!el) return; // Modal 不存在時跳過初始化
        shareModal = new bootstrap.Modal(el);

        const openTrigger = document.getElementById('ds-share-open');
        if (openTrigger) {
            openTrigger.addEventListener('click', function () { shareModal.show(); });
            openTrigger.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shareModal.show(); }
            });
        }

        // Dropzone 初始化（Modal 第一次開啟後 DOM 已就緒）
        initDropzone();

        // Hashtag 自動完成
        const hashtagInput = document.getElementById('ds-input-hashtags');
        const hashtagDropdown = document.getElementById('ds-hashtag-dropdown');
        let selectedIndex = -1;

        hashtagInput.addEventListener('input', function (e) {
            clearTimeout(hashtagTimer);
            const value = this.value;
            selectedIndex = -1; // 重置選中索引

            // 檢查是否包含 #
            if (value.includes('#')) {
                hashtagTimer = setTimeout(function () {
                    const parsed = parseHashtags(value);
                    // completed: 已完成的 hashtag 要排除
                    // current: 當前正在輸入的 hashtag 用於搜尋
                    updateHashtagSuggestions(parsed.current, parsed.completed);
                }, 300);
            } else {
                hideHashtagDropdown();
            }
        });

        // 鍵盤導航
        hashtagInput.addEventListener('keydown', function (e) {
            const items = hashtagDropdown.querySelectorAll('.ds-hashtag-item');
            if (items.length === 0 || hashtagDropdown.style.display === 'none') return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateDropdownSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateDropdownSelection(items);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                const tag = items[selectedIndex].dataset.tag;
                insertHashtag(tag, this);
            } else if (e.key === 'Escape') {
                hideHashtagDropdown();
            }
        });

        // 點擊選擇
        hashtagDropdown.addEventListener('click', function (e) {
            const item = e.target.closest('.ds-hashtag-item');
            if (!item) return;
            const tag = item.dataset.tag;
            insertHashtag(tag, hashtagInput);
        });

        // 點擊外部關閉下拉
        document.addEventListener('click', function (e) {
            if (!hashtagInput.contains(e.target) && !hashtagDropdown.contains(e.target)) {
                hideHashtagDropdown();
            }
        });

        function updateDropdownSelection(items) {
            items.forEach(function (item, idx) {
                item.classList.toggle('active', idx === selectedIndex);
            });
            // 滾動到可見位置
            if (selectedIndex >= 0) {
                items[selectedIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        el.addEventListener('show.bs.modal', function() {
            loadFolders();
        });

        el.addEventListener('hidden.bs.modal', resetShareModal);

        document.getElementById('ds-share-form').addEventListener('submit', function (e) {
            e.preventDefault();
            submitDream();
        });
    }

    // ── Delete Modal ──────────────────────────────────────────────────────────

    function openDeleteConfirm(id) {
        const item = dreamCache[id];
        pendingDeleteId = id;
        const titleEl = document.querySelector('.ds-delete-dream-title');
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

            // 從 DOM 移除卡片
            const card = document.querySelector(`.ds-post-card[data-id="${CSS.escape(id)}"]`);
            if (card) card.remove();

            // 若列表已清空
            const list = document.getElementById('ds-feed-list');
            if (!list.querySelector('.ds-post-card')) {
                list.innerHTML = `<div class="ds-feed-empty">
    <i class="ri-moon-line ds-empty-icon" aria-hidden="true"></i>
    <p>目前沒有夢境，成為第一個分享的人吧！</p>
</div>`;
            }
        })
        .catch(function () {
            // 用 Bootstrap toast 或 alert 皆可；此處用簡單提示
            const list = document.getElementById('ds-feed-list');
            const notice = document.createElement('div');
            notice.className = 'ds-feed-error';
            notice.innerHTML = '<i class="ri-error-warning-line ds-error-icon"></i><p>刪除失敗，請稍後再試。</p>';
            list.prepend(notice);
            setTimeout(function () { notice.remove(); }, 4000);
        });
    }

    function initDeleteModal() {
        const el = document.getElementById('ds-delete-modal');
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
        // 從 URL 帶入的 folder 參數設為初始值
        const initFolder = cfg.dataset.initFolder || '';
        if (initFolder) currentFolder = initFolder;

        initFeedDelegation();
        initSearch();
        initSort();
        initFilter();
        initShareModal();
        initDeleteModal();
        loadAllowedFolders();  // 載入篩選用的主題列表
        loadFeed('');
    });

})();
