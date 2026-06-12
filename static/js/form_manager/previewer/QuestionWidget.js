import { store } from '../core/Store.js';

export class QuestionWidget extends HTMLElement {
    set data(value) {
        this._data = value;
        this.render();
    }

    connectedCallback() {
        this.addEventListener('click', (e) => {
            e.stopPropagation();
            store.dispatch('SELECT_QUESTION', this.dataset.id);
        });
        
        this.checkSelected();
        this.unsubscribe = store.subscribe('STATE_CHANGED', () => this.checkSelected());
    }
    
    disconnectedCallback() {
        if(this.unsubscribe) this.unsubscribe();
    }

    checkSelected() {
        const isSelected = store.state.ui.selectedId === this.dataset.id;
        if (isSelected) this.classList.add('selected');
        else this.classList.remove('selected');
    }

    render() {
        if (!this._data) return;
        const q = this._data;
        const qid = this.dataset.id;
        const isReadonly = this.hasAttribute('readonly');
        const isSectionHeader = q.ui_type === 'section_header';
        
        const displayId = (isSectionHeader || qid.includes('sub_questions')) 
            ? (qid.includes('sub_questions') ? (parseInt(qid.split('.').pop()) + 1) : '') 
            : qid;

        const numberHtml = displayId ? `<span class="fw-bold me-2 text-primary opacity-50 small">${displayId}.</span>` : '';
        const titleClass = isSectionHeader ? 'h5 fw-bold text-primary mb-0' : 'fw-bold text-dark flex-grow-1';

        this.innerHTML = `
            <div class="question-item ${isSectionHeader ? 'p-0 mt-4 mb-2' : 'p-3 mb-2'} rounded border border-transparent transition-all">
                <div class="d-flex align-items-baseline ${isSectionHeader ? '' : 'mb-2'}">
                    ${numberHtml}
                    <span class="${titleClass}">${q.question || ''} ${(!isSectionHeader && q.required) ? '<span class="text-danger">*</span>' : ''}</span>
                </div>
                ${!isSectionHeader ? `
                <div class="ms-4">
                    ${this.renderInput(q, isReadonly)}
                </div>` : ''}
                <div class="sub-questions-container"></div>
            </div>
        `;

        if (q.sub_questions && q.sub_questions.length > 0) {
            const container = this.querySelector('.sub-questions-container');
            container.className = 'ms-5 mt-2 border-start ps-3 border-dashed';
            q.sub_questions.forEach((subQ, idx) => {
                const subWidget = document.createElement('question-widget');
                subWidget.dataset.id = `${qid}.sub_questions.${idx}`;
                if (isReadonly) subWidget.setAttribute('readonly', '');
                subWidget.data = subQ;
                container.appendChild(subWidget);
            });
        }

        // --- 監聽並同步回 Store ---
        if (!isReadonly && !isSectionHeader) {
            this.querySelectorAll('input').forEach(input => {
                // 關鍵：確保該 input 屬於當前 Widget，而非深層嵌套的子 Widget
                if (input.closest('question-widget') !== this) return;

                const eventType = (input.type === 'text' || input.type === 'date') ? 'input' : 'change';
                input.addEventListener(eventType, (e) => {
                    e.stopPropagation();
                    this.syncToStore(e);
                });
            });
        }
    }

    syncToStore(e) {
        const qid = this.dataset.id;
        const q = this._data;
        if (!q || q.ui_type === 'section_header') return;
        // ... rest remains same

        // 決定是平面更新還是路徑更新 (支援巢狀結構)
        const updatePayload = {
            id: qid,
            data: {},
            path: qid.includes('.') ? qid : null
        };

        // 若是由 input 事件觸發（文字輸入），只更新 input_values
        if (e && (e.type === 'input' || e.target.type === 'text' || e.target.type === 'date')) {
            const target = e.target;
            
            // 純文字簡答題 or 日期題
            if (q.ui_type === 'input' || q.ui_type === 'date') {
                updatePayload.data = { value: target.value };
                store.dispatch('UPDATE_QUESTION', updatePayload);
                return;
            }

            // 選項後的填空
            const label = target.dataset.optionLabel;
            const rowId = target.dataset.rowId;
            const colLabel = target.dataset.colLabel;

            if (rowId && colLabel) {
                // Table 內文字輸入
                console.log(`[Sync] Table Input - Row: ${rowId}, Col: ${colLabel}, Val: ${target.value}`);
                updatePayload.data = { value: { [rowId]: { [colLabel]: target.value } } };
            } else if (label) {
                console.log(`[Sync] Updating input_value for option "${label}":`, target.value);
                updatePayload.data = { input_values: { [label]: target.value } };
            }
            store.dispatch('UPDATE_QUESTION', updatePayload);
            return;
        }

        // 若是由 change 事件觸發（勾選），更新 value (選項狀態)
        let val = null;
        const target = e.target;
        const rowId = target.dataset.rowId;
        const colLabel = target.dataset.colLabel;

        if (rowId && colLabel) {
            // Table 內勾選 (假設是 checkbox_group)
            const checkedInputs = Array.from(this.querySelectorAll(`.form-check-input[data-row-id="${rowId}"][data-col-label="${colLabel}"]:checked`));
            const selectedLabels = checkedInputs.map(i => i.value);
            console.log(`[Sync] Table Check - Row: ${rowId}, Col: ${colLabel}, Val:`, selectedLabels);
            updatePayload.data = { value: { [rowId]: { [colLabel]: selectedLabels } } };
        } else {
            const checkedInputs = Array.from(this.querySelectorAll('.form-check-input:checked'));
            const selectedLabels = checkedInputs.map(i => i.value);
            val = q.ui_type === 'checkbox_group' ? selectedLabels : (selectedLabels[0] || null);
            console.log(`[Sync] Updating selection QID ${qid}:`, val);
            updatePayload.data = { value: val };
        }

        store.dispatch('UPDATE_QUESTION', updatePayload);
    }

    renderInput(q, isReadonly) {
        if (q.ui_type === 'table') {
            return this.renderTable(q, isReadonly);
        }
        const disabledAttr = isReadonly ? 'disabled' : '';
        const nameAttr = `name="q_${this.dataset.id.replace(/\./g, '_')}"`;
        
        const value = q.value;
        const input_values = q.input_values || {}; // 確保是物件

        if (q.ui_type === 'input') {
            // 純簡答題，value 存字串
            const displayVal = value || ''; 
            return `
                <div class="d-flex align-items-end">
                    <input type="text" ${nameAttr} value="${displayVal}" class="form-control border-0 border-bottom rounded-0 px-0 bg-transparent" ${disabledAttr} placeholder="（請填寫）">
                    ${q.suffix ? `<span class="ms-2 small text-muted">${q.suffix}</span>` : ''}
                </div>`;
        }

        if (q.ui_type === 'date') {
            const displayVal = value || '';
            return `
                <div class="d-flex align-items-end">
                    <input type="date" ${nameAttr} value="${displayVal}" class="form-control border-0 border-bottom rounded-0 px-0 bg-transparent" ${disabledAttr}>
                </div>`;
        }
        
        const type = q.ui_type === 'radio_group' ? 'radio' : 'checkbox';
        const selectedValues = Array.isArray(value) ? value.map(v => String(v)) : (value ? [String(value)] : []);

        return `
            <div class="row g-2">
                ${(q.options || []).map((opt, i) => {
                    const isChecked = selectedValues.includes(String(opt.label)) ? 'checked' : '';
                    // 根據 label 取得對應的輸入值
                    let optInputValue = (input_values && input_values[opt.label]) || '';
                    
                    // Fallback: 若無新版 input_values 但有舊版 input_value 且此選項被選取，則顯示舊值 (相容性)
                    if (!optInputValue && isChecked && q.input_value && (!input_values || Object.keys(input_values).length === 0)) {
                         optInputValue = q.input_value;
                    }
                    
                    return `
                    <div class="col-auto">
                        <div class="form-check">
                            <input class="form-check-input" type="${type}" ${nameAttr} value="${opt.label}" ${isChecked} ${disabledAttr}>
                            <label class="form-check-label d-inline-flex align-items-center">
                                ${opt.label}
                                ${opt.has_input ? `
                                    <div class="ms-2 d-inline-flex align-items-center gap-1">
                                        ${opt.input_label ? `<small class="text-muted">${opt.input_label}</small>` : ''}
                                        <input type="text" 
                                               data-option-label="${opt.label}"
                                               value="${optInputValue}" 
                                               class="form-control form-control-sm border-bottom border-0 rounded-0 px-1 py-0" 
                                               style="width: 60px;" 
                                               ${disabledAttr}>
                                        ${opt.input_suffix ? `<small class="text-muted">${opt.input_suffix}</small>` : ''}
                                    </div>` : ''}
                            </label>
                        </div>
                    </div>`}).join('')}
            </div>`;
    }

    renderTable(q, isReadonly) {
        const config = q.config || { headers: [], columns: [], rows: [] };
        const data = q.value || {};
        const disabledAttr = isReadonly ? 'disabled' : '';
        const hasRows = (config.rows || []).length > 0;

        return `
            <div class="table-responsive">
                <table class="table table-bordered table-sm align-middle small">
                    <thead class="bg-light text-center">
                        <tr>
                            ${hasRows ? '<th style="width: 80px;"></th>' : ''}
                            ${(config.headers || []).map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${(config.rows || []).map(row => {
                            const rowData = data[row.id] || {};
                            return `
                            <tr>
                                ${hasRows ? `<td class="bg-light fw-bold text-center">${row.label}</td>` : ''}
                                ${(config.columns || []).map(col => {
                                    const cellVal = rowData[col.label];
                                    return `<td>${this.renderTableCell(row.id, col, cellVal, disabledAttr)}</td>`;
                                }).join('')}
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderTableCell(rowId, col, value, disabledAttr) {
        if (col.readonly) {
            return `<div class="px-2 py-1">${value || ''}</div>`;
        }

        if (col.type === 'text') {
            return `<input type="text" data-row-id="${rowId}" data-col-label="${col.label}" value="${value || ''}" class="form-control form-control-sm border-0 bg-transparent" ${disabledAttr}>`;
        }

        if (col.type === 'date') {
            return `<input type="date" data-row-id="${rowId}" data-col-label="${col.label}" value="${value || ''}" class="form-control form-control-sm border-0 bg-transparent" ${disabledAttr}>`;
        }

        if (col.type === 'checkbox_group') {
            const selected = Array.isArray(value) ? value : [];
            return `
                <div class="d-flex flex-wrap gap-2 px-1">
                    ${(col.options || []).map(opt => {
                        const isChecked = selected.includes(opt.label) ? 'checked' : '';
                        return `
                        <div class="form-check form-check-inline me-0 small">
                            <input class="form-check-input" type="checkbox" data-row-id="${rowId}" data-col-label="${col.label}" value="${opt.label}" ${isChecked} ${disabledAttr}>
                            <label class="form-check-label">${opt.label}</label>
                        </div>`;
                    }).join('')}
                </div>
            `;
        }

        return value || '';
    }
}
