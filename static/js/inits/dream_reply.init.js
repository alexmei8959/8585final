(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────────────────
    const cfg = document.getElementById('ds-reply-config');
    if (!cfg) return;

    const DREAM_ID  = cfg.dataset.dreamId;
    const DREAM_API = cfg.dataset.dreamApi;
    const REPLY_API = cfg.dataset.replyApi;
    const LIST_URL  = cfg.dataset.listUrl;
    const CSRF      = cfg.dataset.csrf;
    const USER_ID   = cfg.dataset.userId;
    const USER_ROLE = cfg.dataset.userRole;

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
        const d = new Date(str.includes('T') ? str : str + 'T00:00:00');
        if (isNaN(d)) return str;
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    }

    function fmtDateTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d)) return iso;
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} `
             + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    // ── 權限 ──────────────────────────────────────────────────────────────────

    function canDeleteReply(reply) {
        const isOwner = reply.user !== null && reply.user !== undefined && String(reply.user) === USER_ID;
        const isAdmin = USER_ROLE === '0' || USER_ROLE === '1';
        return isOwner || isAdmin;
    }

    // ── Render dream card ─────────────────────────────────────────────────────

    const CONTENT_FIELDS = [
        { key: '內容',            label: '夢的內容',      icon: 'ri-book-open-line' },
        { key: '領受',            label: '領受',          icon: 'ri-lightbulb-flash-line' },
        { key: '個人解讀/夢語言解釋', label: '個人解讀／夢語言解釋', icon: 'ri-translate-2' },
    ];

    function buildDreamCard(dream) {
        const author    = esc(dream.user_username || dream.create_user || '匿名');
        const avatarHtml = buildAvatarHtml(dream.user_avatar, dream.user_username);
        const title     = esc(dream.title || '（無主題）');
        const dreamDate = fmtDate(dream.dream_date);

        const sections = CONTENT_FIELDS
            .filter(function (f) {
                return dream.dream_content && typeof dream.dream_content === 'object' && dream.dream_content[f.key];
            })
            .map(function (f) {
                return `<div class="ds-dream-section">
    <h3><i class="${f.icon} me-1" aria-hidden="true"></i>${esc(f.label)}</h3>
    <p>${esc(dream.dream_content[f.key])}</p>
</div>`;
            }).join('');

        return `<div class="ds-timeline-item ds-timeline-dream">
    <div class="ds-timeline-dot"></div>
    <div class="ds-timeline-card">
        <div class="ds-dream-main-header">
            <div class="ds-dream-author-row">
                <div class="ds-timeline-avatar">${avatarHtml}</div>
                <div>
                    <h2 class="ds-dream-topic">${title}</h2>
                    <div class="ds-dream-meta">${author}${dreamDate ? ' · ' + dreamDate : ''}</div>
                </div>
            </div>
        </div>
        ${sections || '<p class="text-muted small">（尚無內容）</p>'}
    </div>
</div>`;
    }

    // ── Render reply item ──────────────────────────────────────────────────────

    function buildReplyItem(reply) {
        const author     = esc(reply.user_username || reply.create_user || '匿名');
        const avatarHtml = buildAvatarHtml(reply.user_avatar, reply.user_username);
        const dateTime   = fmtDateTime(reply.reply_date || reply.create_date);
        const content  = reply.reply_content && typeof reply.reply_content === 'object'
            ? (reply.reply_content['content'] || '')
            : '';
        const deleteBtn = canDeleteReply(reply)
            ? `<button class="ds-reply-delete-btn" data-id="${esc(reply.id)}" aria-label="刪除此回應">
    <i class="ri-delete-bin-line" aria-hidden="true"></i>
</button>`
            : '';

        return `<div class="ds-timeline-item" data-reply-id="${esc(reply.id)}">
    <div class="ds-timeline-dot"></div>
    <div class="ds-timeline-card">
        <div class="ds-reply-card-header">
            <div class="ds-reply-author-row">
                <div class="ds-timeline-avatar ds-timeline-avatar-sm">${avatarHtml}</div>
                <div class="ds-reply-meta">${author} · ${dateTime}</div>
            </div>
            ${deleteBtn}
        </div>
        <p class="ds-reply-content">${esc(content)}</p>
    </div>
</div>`;
    }

    // ── Render reply form ──────────────────────────────────────────────────────

    function buildReplyForm() {
        return `<div class="ds-timeline-item ds-timeline-form" id="ds-reply-form-item">
    <div class="ds-timeline-dot ds-timeline-dot-form"></div>
    <div class="ds-timeline-card">
        <div class="ds-reply-meta">新增回應</div>
        <form id="ds-reply-form" class="ds-reply-form" novalidate>
            <textarea id="ds-reply-textarea" class="ds-reply-textarea" rows="4"
                      placeholder="寫下你的回應..." required></textarea>
            <p id="ds-reply-error" class="ds-form-error" hidden></p>
            <div class="ds-reply-actions">
                <button type="submit" class="ds-reply-button" id="ds-reply-submit">
                    <span id="ds-reply-btn-text">送出回應</span>
                    <span id="ds-reply-spinner"
                          class="spinner-border spinner-border-sm d-none"
                          role="status" aria-hidden="true"></span>
                </button>
            </div>
        </form>
    </div>
</div>`;
    }

    // ── Render empty state ────────────────────────────────────────────────────

    function buildNoReplies() {
        return `<div class="ds-timeline-item ds-no-replies">
    <div class="ds-timeline-dot ds-timeline-dot-muted"></div>
    <div class="ds-timeline-card ds-timeline-card-muted">
        <p class="text-muted mb-0">目前還沒有回應，成為第一個回應的人！</p>
    </div>
</div>`;
    }

    // ── Render page ───────────────────────────────────────────────────────────

    function renderPage(dream, replies) {
        const timeline = document.getElementById('ds-timeline');

        // 更新副標題
        const subtitle = document.getElementById('ds-reply-subtitle');
        if (subtitle) subtitle.textContent = `共 ${replies.length} 則回應`;

        let html = buildDreamCard(dream);
        html += replies.length > 0
            ? replies.map(buildReplyItem).join('')
            : buildNoReplies();
        html += buildReplyForm();

        timeline.innerHTML = html;

        // 綁定刪除按鈕（事件委派）
        timeline.addEventListener('click', function (e) {
            const btn = e.target.closest('.ds-reply-delete-btn');
            if (btn) deleteReply(btn.dataset.id);
        });

        // 綁定回應表單
        document.getElementById('ds-reply-form').addEventListener('submit', function (e) {
            e.preventDefault();
            submitReply(dream.id);
        });
    }

    // ── Load ──────────────────────────────────────────────────────────────────

    function loadPage() {
        if (!DREAM_ID) {
            document.getElementById('ds-timeline').innerHTML =
                '<p class="text-danger p-3">未指定夢境 ID。</p>';
            return;
        }

        Promise.all([
            fetch(`${DREAM_API}${DREAM_ID}/`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
            fetch(`${REPLY_API}?dream=${encodeURIComponent(DREAM_ID)}`, { headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
        ])
        .then(function (responses) {
            if (!responses[0].ok) throw new Error('夢境不存在或無權限');
            return Promise.all([responses[0].json(), responses[1].json()]);
        })
        .then(function (results) {
            const dream   = results[0];
            const replies = Array.isArray(results[1]) ? results[1] : (results[1].results || []);
            renderPage(dream, replies);
        })
        .catch(function (err) {
            document.getElementById('ds-timeline').innerHTML =
                `<div class="ds-reply-error p-4 text-danger">
    <i class="ri-error-warning-line me-2"></i>${esc(err.message || '載入失敗，請重新整理頁面。')}
</div>`;
        });
    }

    // ── Submit reply ──────────────────────────────────────────────────────────

    function setSubmitting(on) {
        const btn     = document.getElementById('ds-reply-submit');
        const btnText = document.getElementById('ds-reply-btn-text');
        const spinner = document.getElementById('ds-reply-spinner');
        if (!btn) return;
        btn.disabled = on;
        btnText.classList.toggle('d-none', on);
        spinner.classList.toggle('d-none', !on);
    }

    function showReplyError(msg) {
        const err = document.getElementById('ds-reply-error');
        if (!err) return;
        err.textContent = msg;
        err.hidden = false;
    }

    function submitReply(dreamId) {
        const textarea = document.getElementById('ds-reply-textarea');
        const content  = textarea ? textarea.value.trim() : '';
        if (!content) { showReplyError('請輸入回應內容。'); textarea && textarea.focus(); return; }

        const errEl = document.getElementById('ds-reply-error');
        if (errEl) { errEl.hidden = true; errEl.textContent = ''; }

        setSubmitting(true);

        const payload = {
            dream:         dreamId,
            reply_content: { content: content },
        };
        if (USER_ID) payload.user = parseInt(USER_ID, 10) || USER_ID;

        fetch(REPLY_API, {
            method:  'POST',
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
        .then(function (newReply) {
            if (textarea) textarea.value = '';
            // 將新回應插入表單前（動態追加，不必完整 reload）
            const formItem = document.getElementById('ds-reply-form-item');
            const noReplies = document.querySelector('.ds-no-replies');
            if (noReplies) noReplies.remove();
            if (formItem) formItem.insertAdjacentHTML('beforebegin', buildReplyItem(newReply));

            // 更新回應數
            const subtitle = document.getElementById('ds-reply-subtitle');
            if (subtitle) {
                const count = document.querySelectorAll('[data-reply-id]').length;
                subtitle.textContent = `共 ${count} 則回應`;
            }
        })
        .catch(function (err) {
            let msg = '送出失敗，請稍後再試。';
            if (err && typeof err === 'object') {
                const first = Object.values(err)[0];
                if (Array.isArray(first)) msg = first[0];
                else if (typeof first === 'string') msg = first;
            }
            showReplyError(msg);
        })
        .finally(function () { setSubmitting(false); });
    }

    // ── Delete reply ──────────────────────────────────────────────────────────

    function deleteReply(replyId) {
        if (!window.confirm('確定要刪除這則回應嗎？')) return;

        fetch(`${REPLY_API}${replyId}/`, {
            method:  'DELETE',
            headers: { 'X-CSRFToken': CSRF, 'X-Requested-With': 'XMLHttpRequest' },
        })
        .then(function (res) {
            if (!res.ok && res.status !== 204) throw new Error('HTTP ' + res.status);
            const item = document.querySelector(`[data-reply-id="${CSS.escape(replyId)}"]`);
            if (item) item.remove();

            // 更新回應數，若已清空則顯示 no-replies
            const subtitle = document.getElementById('ds-reply-subtitle');
            const count    = document.querySelectorAll('[data-reply-id]').length;
            if (subtitle) subtitle.textContent = `共 ${count} 則回應`;
            if (count === 0) {
                const formItem = document.getElementById('ds-reply-form-item');
                if (formItem) formItem.insertAdjacentHTML('beforebegin', buildNoReplies());
            }
        })
        .catch(function () {
            alert('刪除失敗，請稍後再試。');
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', function () {
        loadPage();
    });

})();
