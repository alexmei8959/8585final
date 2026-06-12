# 表單管理套件

本套件包含三個核心模組，用於表單的「建立」、「預覽」與「填寫」。

## 📂 模組說明

- `core/`: 核心邏輯與資料狀態管理 (Store/Actions)。
- `builder/`: **建置器**。提供屬性編輯面板 (`<property-editor>`)。
- `previewer/`: **預覽器**。提供靜態 A4 畫布展示 (`<form-canvas>`)，題目為唯讀狀態且可點選。
- `generator/`: **產生器**。提供實際填寫介面 (`<form-generator>`)，題目為活動狀態，支援資料收集。

---

## 🚀 如何單獨使用

本套件基於 Web Components，您可以根據需求在 HTML 中放置不同的標籤：

### 1. 僅需「表單預覽」 (例如：後端檢視已建立的模板)
```html
<!-- 在畫面上僅放置預覽畫布 -->
<form-canvas></form-canvas>

<script type="module" src="/static/js/form_manager/app.js"></script>
<script type="module">
    import { store } from '/static/js/form_manager/core/Store.js';
    store.dispatch('LOAD_DATA', yourData);
</script>
```

### 2. 僅需「問卷填寫」 (例如：給病患填寫的頁面)
```html
<!-- 在畫面上放置產生器 -->
<form-generator id="my-filler"></form-generator>

<script type="module" src="/static/js/form_manager/app.js"></script>
<script type="module">
    import { store } from '/static/js/form_manager/core/Store.js';
    store.dispatch('LOAD_DATA', yourTemplateData);
    
    // 獲取使用者填寫的結果
    const generator = document.getElementById('my-filler');
    const answers = generator.getFormData(); 
</script>
```

### 3. 同時使用「建置器」與「預覽器」 (標準編輯模式)
```html
<div class="d-flex">
    <form-canvas></form-canvas>
    <property-editor></property-editor>
</div>
```

---

## 🧩 資料操作 API

透過核心 Store 進行通訊：

- **載入資料**：`store.dispatch('LOAD_DATA', data)`
- **獲取狀態**：`store.state` (包含 meta, questions, order 等)
- **更新欄位**：`store.dispatch('UPDATE_QUESTION', { path, data })`

---
*Developed for KMUH OralHealth Project*
