import { store } from '../core/Store.js';
import { QuestionWidget } from './QuestionWidget.js';

export class FormCanvas extends HTMLElement {
    constructor() {
        super();
        // 僅保留必要的識別類別，其餘移至 CSS
        this.classList.add('v2-form-canvas');
    }

    connectedCallback() {
        this.render();
        this.unsubscribe = store.subscribe('STATE_CHANGED', () => this.render());
        
        // 全域點擊監聽 (委派)
        this.addEventListener('click', (e) => {
            const header = e.target.closest('.builder-header');
            const footer = e.target.closest('.builder-footer');
            if (header) store.dispatch('SELECT_QUESTION', 'header');
            else if (footer) store.dispatch('SELECT_QUESTION', 'footer');
        });
    }

    disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
    }

    render() {
        if (store.state.ui.loading) {
            this.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div></div>';
            return;
        }

        const { header, order, questions, footer, ui } = store.state;

        // --- 頁首渲染 ---
        const headerActive = ui.selectedId === 'header' ? 'border border-primary border-dashed rounded' : '';
        const headerFieldsHtml = (header.fields || []).filter(f => f.enabled).map(f => `
            <div class="col-3">
                <div class="d-flex align-items-end h-100">
                    <span class="small text-muted fw-bold text-nowrap me-1">${f.label}：</span>
                    <span class="border-bottom flex-grow-1" style="min-height: 20px;">&nbsp;</span>
                </div>
            </div>
        `).join('');

        let headerHtml = `
            <div class="builder-header p-3 mb-4 transition-all cursor-pointer ${headerActive}" data-id="header">
                <div class="text-center mb-4">
                    <h4 class="fw-bold mb-1">${header.title_name || '請設定公司或組織名稱'}</h4>
                    <div class="text-muted small">${header.title_en_name || 'Company or organization english Name'}</div>
                </div>
                <div class="row g-3 justify-content-start">
                    ${headerFieldsHtml}
                </div>
            </div>`;

        // --- 題目渲染 ---
        const listContainer = document.createElement('div');
        listContainer.className = 'question-list';
        
        order.forEach(qid => {
            const qData = questions[qid];
            if (qData) {
                const widget = document.createElement('question-widget');
                widget.dataset.id = qid;
                widget.setAttribute('readonly', ''); // 預覽器模式為唯讀
                widget.data = qData; 
                listContainer.appendChild(widget);
            }
        });

        // --- 頁尾渲染 ---
        const footerActive = ui.selectedId === 'footer' ? 'border border-primary border-dashed rounded' : '';
        const footerHtml = `
            <div class="builder-footer mt-5 p-3 transition-all cursor-pointer ${footerActive}" data-id="footer">
                <div class="border-top pt-3 d-flex justify-content-between text-muted small">
                    ${(footer.fields || []).filter(f => f.enabled).map(f => `<span>${f.label}</span>`).join('')}
                </div>
            </div>`;

        // --- 新增題目快捷按鈕 ---
        const addBtn = document.createElement('div');
        addBtn.className = 'text-center mt-4';
        addBtn.innerHTML = `
            <button class="btn btn-soft-primary btn-sm rounded-pill px-4 shadow-sm" id="btn-canvas-add-q">
                <i class="ri-add-line align-middle me-1"></i> 在此處新增題目
            </button>`;
        addBtn.querySelector('button').addEventListener('click', () => store.dispatch('ADD_QUESTION'));

        this.innerHTML = headerHtml;
        this.appendChild(listContainer);
        this.appendChild(addBtn);
        this.insertAdjacentHTML('beforeend', footerHtml);
    }
}
