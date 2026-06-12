import { store } from '../core/Store.js';
import { QuestionWidget } from '../previewer/QuestionWidget.js';

export class FormGenerator extends HTMLElement {
    constructor() {
        super();
        this.classList.add('v2-form-generator');
    }

    connectedCallback() {
        this._lastQuestions = null;
        this._lastOrder = null;
        this._lastHeaderSig = null; // 用於比對 Header 結構簽章
        this.render();
        
        this.unsubscribe = store.subscribe('STATE_CHANGED', (state) => {
            // 避免因數值更新導致的全畫面重繪（會讓 Input 失去焦點）
            const headerSig = JSON.stringify((state.header.fields || []).map(f => ({ l: f.label, e: f.enabled })));
            const questionsChanged = this._lastQuestions !== state.questions; // LOAD_DATA 會換物件
            const orderChanged = this._lastOrder !== state.order; // LOAD_DATA 會換陣列
            // 注意: 若只是 ADD_QUESTION 修改了 questions 內部屬性但沒換物件，這裡偵測不到。
            // 但通常 ADD_QUESTION 會伴隨 order 改變 (push)，所以 orderChanged 會抓到。
            
            // 另外檢查 questions 的 key 數量是否變更 (針對 ADD/DELETE 但物件 ref 沒變的情況)
            const qKeys = Object.keys(state.questions).sort().join(',');
            const lastQKeys = this._lastQKeys || '';

            if (questionsChanged || orderChanged || headerSig !== this._lastHeaderSig || qKeys !== lastQKeys) {
                // console.log("[FormGenerator] Structure changed, re-rendering");
                this.render();
            }
        });
    }

    disconnectedCallback() {
        if (this.unsubscribe) this.unsubscribe();
    }

    /**
     * API: 獲取當前表單填寫的所有資料
     */
    getFormData() {
        // 回傳完整結構，包含 header (內含填寫的個人資料)
        const { questions, order, meta, header, footer } = store.state;
        return {
            meta,
            header,
            footer,
            questions,
            order
        };
    }

    render() {
        const { header, order, questions, footer } = store.state;
        
        // 更新快照
        this._lastQuestions = questions;
        this._lastOrder = order;
        this._lastQKeys = Object.keys(questions).sort().join(',');
        this._lastHeaderSig = JSON.stringify((header.fields || []).map(f => ({ l: f.label, e: f.enabled })));

        // 頁首
        let html = `
            <div class="text-center mb-4">
                <h4 class="fw-bold mb-1">${header.title_name || ''}</h4>
                <div class="text-muted small">${header.title_en_name || ''}</div>
                <h2 class="fw-bold mt-3 text-dark">${store.state.meta.name || ''}</h2>
            </div>`;

        // 題目容器
        const formContainer = document.createElement('div');
        formContainer.id = "generated-form";
        formContainer.className = "form-generator-content d-flex flex-column gap-3";
        
        order.forEach(qid => {
            const qData = questions[qid];
            if (qData) {
                const widget = document.createElement('question-widget');
                widget.dataset.id = qid;
                widget.data = qData; 
                formContainer.appendChild(widget);
            }
        });

        // 頁尾
        const footerHtml = `
            <div class="mt-5 pt-4 border-top d-flex justify-content-between text-muted small">
                ${(footer.fields || []).filter(f => f.enabled).map(f => `<span>${f.label}</span>`).join('')}
            </div>`;

        this.innerHTML = html;
        this.appendChild(formContainer);
        this.insertAdjacentHTML('beforeend', footerHtml);
    }
}