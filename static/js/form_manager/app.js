import { store } from './core/Store.js';
import { actions } from './core/actions.js';
import { FormCanvas } from './previewer/FormCanvas.js';
import { QuestionWidget } from './previewer/QuestionWidget.js';
import { PropertyEditor } from './builder/PropertyEditor.js';
import { FormGenerator } from './generator/FormGenerator.js';

/**
 * 套件註冊入口
 */

const register = (tag, cls) => {
    if (!customElements.get(tag)) customElements.define(tag, cls);
};

// 註冊預覽器與填寫器組件
register('form-canvas', FormCanvas);
register('question-widget', QuestionWidget);
register('form-generator', FormGenerator);

// 註冊建置器組件
register('property-editor', PropertyEditor);

// 初始化核心行為
store.registerActions(actions);

console.log('[FormManager] Builder, Previewer & Generator Registered');