export const actions = {
    LOAD_DATA(state, payload) {
        const data = JSON.parse(JSON.stringify(payload));

        // 優先順序: data.name (DataTable外層) > data.meta.name (JSON內層) > 舊欄位 > 預設值
        state.meta = {
            name: data.name || (data.meta && data.meta.name) || data.template_name || "未命名模板"
        };
        state.header = data.header || { title_name: "", title_en_name: "", fields: [] };
        state.footer = data.footer || { fields: [] };
        state.questions = data.questions || {};
        state.order = data.order || Object.keys(state.questions).sort((a, b) => parseInt(a) - parseInt(b));
        state.ui.selectedId = "header"; 
        state.id = data.id || null;
    },

    SELECT_QUESTION(state, id) {
        state.ui.selectedId = id;
    },

    UPDATE_META(state, data) {
        state.meta = { ...state.meta, ...data };
    },

    UPDATE_HEADER(state, data) {
        state.header = { ...state.header, ...data };
    },

    UPDATE_FOOTER(state, data) {
        state.footer = { ...state.footer, ...data };
    },

    ADD_QUESTION(state) {
        const keys = Object.keys(state.questions).map(k => parseInt(k)).filter(k => !isNaN(k));
        const nextId = (keys.length > 0 ? Math.max(...keys) + 1 : 1).toString();
        
        state.questions[nextId] = {
            question: "新題目",
            ui_type: "radio_group",
            options: [{ label: "選項 1" }]
        };
        state.order.push(nextId);
        state.ui.selectedId = nextId;
    },

    UPDATE_QUESTION(state, { id, data, path }) {
        // 如果有 path (巢狀更新), 則使用 path, 否則使用 id (平面更新)
        let target;
        if (path) {
            target = this._findQuestionByPath(state.questions, path);
        } else {
            target = state.questions[id];
        }

        if (target) {
            // 邊界檢查：類型切換清理
            if (data.ui_type && data.ui_type !== target.ui_type) {
                if (data.ui_type === 'input') {
                    delete target.options;
                    delete target.input_values; // 清理舊結構
                } else {
                    delete target.suffix;
                    if (!target.options) target.options = [{ label: "選項 1" }];
                }
            }

            // 特殊處理 input_values 的合併 (避免覆蓋其他選項的輸入值)
            if (data.input_values && typeof data.input_values === 'object') {
                target.input_values = { ...(target.input_values || {}), ...data.input_values };
                // 移除 data 中的 input_values 避免下方 Object.assign 再次覆蓋
                const { input_values, ...rest } = data;
                Object.assign(target, rest);
            } else if (target.ui_type === 'table' && data.value && typeof data.value === 'object') {
                // Table 專屬更新：合併 row 資料
                target.value = { ...(target.value || {}), ...data.value };
            } else {
                Object.assign(target, data);
            }
        }
    },

    ADD_TABLE_COLUMN(state, { path }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q) {
            if (!q.config) q.config = { headers: [], columns: [], rows: [] };
            const nextIdx = (q.config.columns || []).length + 1;
            const newLabel = `新欄位 ${nextIdx}`;
            q.config.columns.push({ label: newLabel, type: "text" });
            q.config.headers.push(newLabel);
        }
    },

    DELETE_TABLE_COLUMN(state, { path, index }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q && q.config && q.config.columns) {
            q.config.columns.splice(index, 1);
            q.config.headers.splice(index, 1);
        }
    },

    UPDATE_TABLE_COLUMN(state, { path, index, data }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q && q.config && q.config.columns) {
            const oldLabel = q.config.columns[index].label;
            q.config.columns[index] = { ...q.config.columns[index], ...data };
            if (data.label) {
                q.config.headers[index] = data.label;
            }
        }
    },

    ADD_TABLE_ROW(state, { path }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q) {
            if (!q.config) q.config = { headers: [], columns: [], rows: [] };
            const nextIdx = (q.config.rows || []).length + 1;
            q.config.rows.push({ id: `row_${Date.now()}`, label: `新列 ${nextIdx}` });
        }
    },

    DELETE_TABLE_ROW(state, { path, index }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q && q.config && q.config.rows) {
            q.config.rows.splice(index, 1);
        }
    },

    UPDATE_TABLE_ROW(state, { path, index, data }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q && q.config && q.config.rows) {
            q.config.rows[index] = { ...q.config.rows[index], ...data };
        }
    },

    _findQuestionByPath(questions, path) {
        // path 格式範例: "4.sub_questions.0"
        const parts = path.split('.');
        let current = questions[parts[0]];
        for (let i = 1; i < parts.length; i++) {
            if (current && current[parts[i]]) {
                current = current[parts[i]];
            } else {
                return null;
            }
        }
        return current;
    },

    ADD_OPTION(state, { path }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q && q.options) {
            q.options.push({ label: `選項 ${q.options.length + 1}` });
        }
    },

    DELETE_OPTION(state, { path, index }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q && q.options) {
            q.options.splice(index, 1);
        }
    },

    ADD_SUB_QUESTION(state, { path }) {
        const q = this._findQuestionByPath(state.questions, path);
        if (q) {
            if (!q.sub_questions) q.sub_questions = [];
            q.sub_questions.push({
                question: "新子題目",
                ui_type: "radio_group",
                options: [{ label: "選項 1" }]
            });
        }
    },

    DELETE_QUESTION(state, { path }) {
        const parts = path.split('.');
        if (parts.length === 1) {
            // 平面刪除
            delete state.questions[path];
            state.order = state.order.filter(id => id !== path);
        } else {
            // 巢狀刪除: "4.sub_questions.0"
            const index = parseInt(parts.pop()); // 0
            parts.pop(); // "sub_questions"
            const parentPath = parts.join('.'); // "4"
            const parent = this._findQuestionByPath(state.questions, parentPath);
            if (parent && parent.sub_questions) {
                parent.sub_questions.splice(index, 1);
            }
        }
        state.ui.selectedId = null;
    }
};