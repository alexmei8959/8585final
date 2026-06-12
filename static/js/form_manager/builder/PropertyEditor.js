import { store } from '../core/Store.js';

export class PropertyEditor extends HTMLElement {
    connectedCallback() {
        this.unsubscribe = store.subscribe('STATE_CHANGED', (e) => {
            const state = store.state;
            const selectedIdChanged = this._lastSelectedId !== state.ui.selectedId;
            const isFocusInside = this.contains(document.activeElement);
            
            // 簡單判斷：如果是切換題目，一定要重繪
            if (selectedIdChanged) {
                this._lastSelectedId = state.ui.selectedId;
                this.render();
                return;
            }

            // 如果焦點不在編輯器內（例如點擊了外部按鈕 LOAD_DATA），且資料有變動，則重繪以更新顯示
            // 這裡使用簡單的參考比對，因為 LOAD_DATA 會產生新的物件
            if (!isFocusInside) {
                const metaChanged = this._lastMeta !== state.meta;
                const headerChanged = this._lastHeader !== state.header;
                const footerChanged = this._lastFooter !== state.footer;
                // questions 比較複雜，這裡簡化處理：若非 typing (focus inside)，且 selectedId 沒變但資料變了(外部更新)，嘗試重繪
                // 為求保險，針對 meta/header/footer 變更且無焦點時重繪，解決 LOAD_DATA "暫存" 問題
                if (metaChanged || headerChanged || footerChanged) {
                    this.render();
                }
            }
        });
        this.render();
    }

    disconnectedCallback() {
        if(this.unsubscribe) this.unsubscribe();
    }

    findQuestion(questions, targetId) {
        if (questions[targetId]) return { q: questions[targetId], path: targetId };
        for (const id in questions) {
            if (questions[id].sub_questions) {
                for (let i = 0; i < questions[id].sub_questions.length; i++) {
                    const result = this._findInSub(questions[id].sub_questions[i], `${id}.sub_questions.${i}`, targetId);
                    if (result) return result;
                }
            }
        }
        return null;
    }

    _findInSub(q, currentPath, targetId) {
        if (currentPath === targetId) return { q, path: currentPath };
        if (q.sub_questions) {
            for (let i = 0; i < q.sub_questions.length; i++) {
                const res = this._findInSub(q.sub_questions[i], `${currentPath}.sub_questions.${i}`, targetId);
                if (res) return res;
            }
        }
        return null;
    }

    render() {
        const state = store.state;
        const { selectedId } = state.ui;

        // 快照當前資料參考，用於下次比對
        this._lastMeta = state.meta;
        this._lastHeader = state.header;
        this._lastFooter = state.footer;
        
        if (selectedId === 'header') return this.renderHeaderSettings();
        if (selectedId === 'footer') return this.renderFooterSettings();

        const result = selectedId ? this.findQuestion(store.state.questions, selectedId) : null;
        if (!result) {
            this.innerHTML = `<div class="p-4 text-center text-muted"><p>請點選畫布上的元件進行編輯</p></div>`;
            return;
        }
        return this.renderQuestionSettings(result.q, result.path);
    }

    renderHeaderSettings() {
        const { meta, header } = store.state;
        this.innerHTML = `
            <div class="card-header border-bottom p-3 bg-light">
                <h6 class="mb-0 fw-bold">頁首與全域設定</h6>
            </div>
            <div class="card-body p-3 overflow-auto">
                <div class="mb-3">
                    <label class="form-label small fw-bold text-primary">表單名稱</label>
                    <input type="text" class="form-control form-control-sm" id="meta-name" value="${meta.name}">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">表單標題 (中)</label>
                    <input type="text" class="form-control form-control-sm" id="title-name" value="${header.title_name||''}">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">表單標題 (英)</label>
                    <input type="text" class="form-control form-control-sm" id="title-en" value="${header.title_en_name||''}">
                </div>
                
                <hr class="border-dashed">
                <h6 class="small fw-bold mb-2 d-flex justify-content-between">
                    頁首設定
                    <button class="btn btn-link btn-sm p-0" id="btn-add-h-field" style="font-size:10px">+ 新增</button>
                </h6>
                <div class="d-flex flex-column gap-2" id="header-fields">
                    ${(header.fields || []).map((f, i) => `
                        <div class="input-group input-group-sm">
                            <div class="input-group-text">
                                <input class="form-check-input mt-0 h-field-check" type="checkbox" data-idx="${i}" ${f.enabled?'checked':''}>
                            </div>
                            <input type="text" class="form-control h-field-val" data-idx="${i}" value="${f.label}">
                            <button class="btn btn-ghost-danger h-field-del" data-idx="${i}"><i class="ri-close-line"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        this.bindHeaderEvents();
    }

    renderFooterSettings() {
        const { footer } = store.state;
        this.innerHTML = `
            <div class="card-header border-bottom p-3 bg-light">
                <h6 class="mb-0 fw-bold">頁尾設定</h6>
            </div>
            <div class="card-body p-3">
                <h6 class="small fw-bold mb-2 d-flex justify-content-between">
                    頁尾欄位
                    <button class="btn btn-link btn-sm p-0" id="btn-add-f-field" style="font-size:10px">+ 新增</button>
                </h6>
                <div class="d-flex flex-column gap-2" id="footer-fields">
                    ${(footer.fields || []).map((f, i) => `
                        <div class="input-group input-group-sm">
                            <div class="input-group-text">
                                <input class="form-check-input mt-0 f-field-check" type="checkbox" data-idx="${i}" ${f.enabled?'checked':''}>
                            </div>
                            <input type="text" class="form-control f-field-val" data-idx="${i}" value="${f.label}">
                            <button class="btn btn-ghost-danger f-field-del" data-idx="${i}"><i class="ri-close-line"></i></button>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        this.bindFooterEvents();
    }

    renderQuestionSettings(q, path) {
        const displayId = path.includes('sub_questions') 
            ? `子題目 ${parseInt(path.split('.').pop()) + 1}` 
            : `題目 ${path}`;

        this.innerHTML = `
            <div class="card-header border-bottom p-3 bg-light d-flex justify-content-between align-items-center">
                <h6 class="mb-0 fw-bold text-uppercase">題目屬性</h6>
                <span class="badge bg-soft-info text-info">${displayId}</span>
            </div>
            <div class="card-body p-3 overflow-auto custom-scrollbar" style="max-height: calc(100vh - 160px);">
                <div class="mb-3">
                    <label class="form-label small fw-bold">題目內容</label>
                    <textarea class="form-control form-control-sm" id="prop-question" rows="2">${q.question || ''}</textarea>
                </div>

                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label small fw-bold">類型</label>
                        <select class="form-select form-select-sm" id="prop-type">
                            <option value="radio_group" ${q.ui_type==='radio_group'?'selected':''}>單選</option>
                            <option value="checkbox_group" ${q.ui_type==='checkbox_group'?'selected':''}>多選</option>
                            <option value="input" ${q.ui_type==='input'?'selected':''}>簡答</option>
                            <option value="date" ${q.ui_type==='date'?'selected':''}>日期</option>
                            <option value="table" ${q.ui_type==='table'?'selected':''}>表格</option>
                            <option value="section_header" ${q.ui_type==='section_header'?'selected':''}>區段標題</option>
                        </select>
                    </div>
                    ${q.ui_type !== 'section_header' ? `
                    <div class="col-6">
                        <label class="form-label small fw-bold">設定</label>
                        <div class="form-check form-switch mt-1">
                            <input class="form-check-input" type="checkbox" id="prop-required" ${q.required?'checked':''}>
                            <label class="form-check-label small">必填</label>
                        </div>
                    </div>` : ''}
                </div>

                ${q.ui_type === 'input' ? `
                    <div class="mb-3">
                        <label class="form-label small fw-bold">結尾符號 (Suffix)</label>
                        <input type="text" class="form-control form-control-sm" id="prop-suffix" value="${q.suffix||''}" placeholder="例如：。">
                    </div>
                ` : (q.ui_type === 'date' || q.ui_type === 'section_header' ? '' : (q.ui_type === 'table' ? `
                    <div class="mb-4">
                        <label class="form-label small fw-bold d-flex justify-content-between align-items-center">
                            欄位管理 (Columns)
                            <button class="btn btn-soft-primary btn-sm py-0" id="btn-add-table-col" style="font-size: 10px;">+ 新增欄位</button>
                        </label>
                        <div id="table-cols-container" class="d-flex flex-column gap-2 mt-2">
                            ${(q.config?.columns || []).map((col, i) => `
                                <div class="card p-2 border shadow-none mb-0 bg-light-subtle">
                                    <div class="d-flex gap-2 align-items-center mb-1">
                                        <input type="text" class="form-control form-control-sm prop-table-col-label" data-idx="${i}" value="${col.label || ''}" placeholder="欄位名稱">
                                        <button class="btn btn-icon btn-sm btn-ghost-danger prop-table-col-del" data-idx="${i}"><i class="ri-close-line"></i></button>
                                    </div>
                                    <div class="row g-1">
                                        <div class="col-7">
                                            <select class="form-select form-select-xs prop-table-col-type" data-idx="${i}">
                                                <option value="text" ${col.type==='text'?'selected':''}>文字</option>
                                                <option value="date" ${col.type==='date'?'selected':''}>日期</option>
                                                <option value="checkbox_group" ${col.type==='checkbox_group'?'selected':''}>多選</option>
                                            </select>
                                        </div>
                                        <div class="col-5">
                                            <div class="form-check small mt-1">
                                                <input class="form-check-input prop-table-col-readonly" type="checkbox" data-idx="${i}" ${col.readonly?'checked':''}>
                                                <label class="form-check-label" style="font-size:10px">唯讀</label>
                                            </div>
                                        </div>
                                    </div>
                                    ${col.type === 'checkbox_group' ? `
                                        <div class="mt-2 ps-2 border-start border-2 border-primary">
                                            <label class="small text-muted mb-1" style="font-size:10px">選項 (用逗號分隔)</label>
                                            <input type="text" class="form-control form-control-xs prop-table-col-opts" data-idx="${i}" value="${(col.options||[]).map(o=>o.label).join(',')}" placeholder="選項1,選項2...">
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label small fw-bold d-flex justify-content-between align-items-center">
                            列管理 (Rows)
                            <button class="btn btn-soft-primary btn-sm py-0" id="btn-add-table-row" style="font-size: 10px;">+ 新增列</button>
                        </label>
                        <div id="table-rows-container" class="d-flex flex-column gap-2 mt-2">
                            ${(q.config?.rows || []).map((row, i) => `
                                <div class="input-group input-group-sm">
                                    <span class="input-group-text p-1" style="font-size:10px">${i+1}</span>
                                    <input type="text" class="form-control prop-table-row-label" data-idx="${i}" value="${row.label || ''}">
                                    <button class="btn btn-ghost-danger prop-table-row-del" data-idx="${i}"><i class="ri-close-line"></i></button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="mb-3">
                        <label class="form-label small fw-bold d-flex justify-content-between align-items-center">
                            選項管理
                            <button class="btn btn-soft-primary btn-sm py-0" id="btn-add-opt" style="font-size: 10px;">+ 新增選項</button>
                        </label>
                        <div id="options-container" class="d-flex flex-column gap-2">
                            ${(q.options || []).map((opt, i) => `
                                <div class="card p-2 border shadow-none mb-0 bg-light-subtle">
                                    <div class="d-flex gap-2">
                                        <input type="text" class="form-control form-control-sm prop-opt-val" data-idx="${i}" value="${opt.label || ''}">
                                        <button class="btn btn-icon btn-sm btn-ghost-danger prop-opt-del" data-idx="${i}"><i class="ri-close-line"></i></button>
                                    </div>
                                    <div class="form-check mt-1">
                                        <input class="form-check-input prop-opt-hasinput" type="checkbox" data-idx="${i}" ${opt.has_input?'checked':''}>
                                        <label class="form-check-label small text-muted">允許填空</label>
                                    </div>
                                    ${opt.has_input ? `
                                        <div class="mt-1 ps-2 border-start border-2 border-info">
                                            <input type="text" class="form-control form-control-xs mb-1 prop-opt-inputlabel" data-idx="${i}" value="${opt.input_label||''}" placeholder="前綴說明">
                                            <input type="text" class="form-control form-control-xs prop-opt-inputsuffix" data-idx="${i}" value="${opt.input_suffix||''}" placeholder="單位">
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `))}

                <hr class="border-dashed my-4">
                <div class="d-grid gap-2">
                    <button class="btn btn-soft-primary btn-sm" id="btn-add-subq"><i class="ri-node-tree me-1 align-middle"></i> 新增子題目</button>
                    <button class="btn btn-soft-danger btn-sm" id="btn-delete-q"><i class="ri-delete-bin-line me-1 align-middle"></i> 刪除此題目</button>
                </div>
            </div>`;
        this.bindQuestionEvents(q, path);
    }

    bindHeaderEvents() {
        this.querySelector('#meta-name')?.addEventListener('input', (e) => store.dispatch('UPDATE_META', { name: e.target.value }));
        this.querySelector('#title-name')?.addEventListener('input', (e) => store.dispatch('UPDATE_HEADER', { title_name: e.target.value }));
        this.querySelector('#title-en')?.addEventListener('input', (e) => store.dispatch('UPDATE_HEADER', { title_en_name: e.target.value }));
        
        this.querySelectorAll('.h-field-val').forEach(el => {
            el.addEventListener('input', (e) => {
                const fields = [...store.state.header.fields];
                fields[e.target.dataset.idx].label = e.target.value;
                store.dispatch('UPDATE_HEADER', { fields });
            });
        });

        this.querySelectorAll('.h-field-check').forEach(el => {
            el.addEventListener('change', (e) => {
                const fields = [...store.state.header.fields];
                fields[e.target.dataset.idx].enabled = e.target.checked;
                store.dispatch('UPDATE_HEADER', { fields });
            });
        });

        this.querySelector('#btn-add-h-field')?.addEventListener('click', () => {
            const fields = [...(store.state.header.fields || [])];
            fields.push({ label: "新欄位", enabled: true });
            store.dispatch('UPDATE_HEADER', { fields });
            this.render();
        });

        this.querySelectorAll('.h-field-del').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = e.target.closest('button').dataset.idx;
                const fields = [...store.state.header.fields];
                fields.splice(idx, 1);
                store.dispatch('UPDATE_HEADER', { fields });
                this.render();
            });
        });
    }

    bindFooterEvents() {
        this.querySelectorAll('.f-field-val').forEach(el => {
            el.addEventListener('input', (e) => {
                const fields = [...store.state.footer.fields];
                fields[e.target.dataset.idx].label = e.target.value;
                store.dispatch('UPDATE_FOOTER', { fields });
            });
        });

        this.querySelectorAll('.f-field-check').forEach(el => {
            el.addEventListener('change', (e) => {
                const fields = [...store.state.footer.fields];
                fields[e.target.dataset.idx].enabled = e.target.checked;
                store.dispatch('UPDATE_FOOTER', { fields });
            });
        });

        this.querySelector('#btn-add-f-field')?.addEventListener('click', () => {
            const fields = [...(store.state.footer.fields || [])];
            fields.push({ label: "新頁尾欄位", enabled: true });
            store.dispatch('UPDATE_FOOTER', { fields });
            this.render();
        });

        this.querySelectorAll('.f-field-del').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = e.target.closest('button').dataset.idx;
                const fields = [...store.state.footer.fields];
                fields.splice(idx, 1);
                store.dispatch('UPDATE_FOOTER', { fields });
                this.render();
            });
        });
    }

    bindQuestionEvents(q, path) {
        this.querySelector('#prop-question')?.addEventListener('input', (e) => store.dispatch('UPDATE_QUESTION', { path, data: { question: e.target.value } }));
        this.querySelector('#prop-suffix')?.addEventListener('input', (e) => store.dispatch('UPDATE_QUESTION', { path, data: { suffix: e.target.value } }));
        this.querySelector('#prop-type')?.addEventListener('change', (e) => {
            store.dispatch('UPDATE_QUESTION', { path, data: { ui_type: e.target.value } });
            this.render();
        });
        this.querySelector('#prop-required')?.addEventListener('change', (e) => store.dispatch('UPDATE_QUESTION', { path, data: { required: e.target.checked } }));

        this.querySelectorAll('.prop-opt-val').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const options = [...q.options];
                options[idx] = { ...options[idx], label: e.target.value };
                store.dispatch('UPDATE_QUESTION', { path, data: { options } });
            });
        });

        this.querySelectorAll('.prop-opt-inputlabel').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const options = [...q.options];
                options[idx] = { ...options[idx], input_label: e.target.value };
                store.dispatch('UPDATE_QUESTION', { path, data: { options } });
            });
        });

        this.querySelectorAll('.prop-opt-inputsuffix').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const options = [...q.options];
                options[idx] = { ...options[idx], input_suffix: e.target.value };
                store.dispatch('UPDATE_QUESTION', { path, data: { options } });
            });
        });

        this.querySelectorAll('.prop-opt-hasinput').forEach(el => {
            el.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const options = [...q.options];
                options[idx] = { ...options[idx], has_input: e.target.checked };
                if (!e.target.checked) {
                    delete options[idx].input_label;
                    delete options[idx].input_suffix;
                }
                store.dispatch('UPDATE_QUESTION', { path, data: { options } });
                this.render();
            });
        });

        this.querySelector('#btn-add-opt')?.addEventListener('click', () => { store.dispatch('ADD_OPTION', { path }); this.render(); });
        this.querySelectorAll('.prop-opt-del').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.idx);
                store.dispatch('DELETE_OPTION', { path, index });
                this.render();
            });
        });

        this.querySelector('#btn-add-subq')?.addEventListener('click', () => { store.dispatch('ADD_SUB_QUESTION', { path }); this.render(); });
        this.querySelector('#btn-delete-q')?.addEventListener('click', () => {
            if (confirm('確定要刪除此題目（及其所有子題目）嗎？')) store.dispatch('DELETE_QUESTION', { path });
        });

        // --- Table Specific Events ---
        this.querySelector('#btn-add-table-col')?.addEventListener('click', () => {
            store.dispatch('ADD_TABLE_COLUMN', { path });
            this.render();
        });

        this.querySelectorAll('.prop-table-col-del').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.idx);
                store.dispatch('DELETE_TABLE_COLUMN', { path, index });
                this.render();
            });
        });

        this.querySelectorAll('.prop-table-col-label').forEach(el => {
            el.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.idx);
                store.dispatch('UPDATE_TABLE_COLUMN', { path, index, data: { label: e.target.value } });
            });
        });

        this.querySelectorAll('.prop-table-col-type').forEach(el => {
            el.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.idx);
                store.dispatch('UPDATE_TABLE_COLUMN', { path, index, data: { type: e.target.value } });
                this.render();
            });
        });

        this.querySelectorAll('.prop-table-col-readonly').forEach(el => {
            el.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.idx);
                store.dispatch('UPDATE_TABLE_COLUMN', { path, index, data: { readonly: e.target.checked } });
            });
        });

        this.querySelectorAll('.prop-table-col-opts').forEach(el => {
            el.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.idx);
                const options = e.target.value.split(',').filter(s => s.trim()).map(s => ({ label: s.trim() }));
                store.dispatch('UPDATE_TABLE_COLUMN', { path, index, data: { options } });
            });
        });

        this.querySelector('#btn-add-table-row')?.addEventListener('click', () => {
            store.dispatch('ADD_TABLE_ROW', { path });
            this.render();
        });

        this.querySelectorAll('.prop-table-row-del').forEach(el => {
            el.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('button').dataset.idx);
                store.dispatch('DELETE_TABLE_ROW', { path, index });
                this.render();
            });
        });

        this.querySelectorAll('.prop-table-row-label').forEach(el => {
            el.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.idx);
                store.dispatch('UPDATE_TABLE_ROW', { path, index, data: { label: e.target.value } });
            });
        });
    }
}
