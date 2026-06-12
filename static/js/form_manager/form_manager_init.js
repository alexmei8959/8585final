/**
 * Form Manager Initializer (V2 ESM)
 */
import { store } from './core/Store.js';

function init(retryCount = 0) {
    const $ = window.jQuery;

    // 檢查依賴是否就緒
    if (!$) {
        if (retryCount < 50) {
            setTimeout(() => init(retryCount + 1), 50);
            return;
        }
        console.error('[Init] jQuery not found after retries');
        return;
    }

    if (!$.fn.DataTable) {
        if (retryCount < 50) {
            setTimeout(() => init(retryCount + 1), 50);
            return;
        }
        console.error('[Init] DataTables plugin not found after retries');
        return;
    }

    console.log(`[Init] Dependencies ready (retries: ${retryCount}). Initializing...`);

    const modalEl = document.getElementById('FormBuilderModal');
    if (!modalEl) {
        console.error('[Init] FormBuilderModal not found');
        return;
    }

    const modalInstance = (window.bootstrap && window.bootstrap.Modal)
        ? window.bootstrap.Modal.getOrCreateInstance(modalEl)
        : null;

    // 監聽 Modal 關閉事件，重置 UI 狀態
    modalEl.addEventListener('hidden.bs.modal', () => {
        store.dispatch('SELECT_QUESTION', null);
    });

    // 1. 初始化 DataTable
    const $table = $('#form_templates-datatable');
    const jsonUrl = $table.data('json-url');
    const baseUrl = '/form_manager/_form_template/';
    if ($table.length) {
        const dt = $table.DataTable({
            language: { url: jsonUrl },
            serverSide: true,
            ajax: baseUrl,
            columns: [
                { data: 'id', visible: false },
                { data: 'name' },
                {
                    "data": null,
                    "title": "操作",
                    "orderable": false,
                    "render": function(data, type, row) {
                        return `
                            <div class="dropdown d-inline-block">
                                <button class="btn btn-soft-secondary btn-sm dropdown" type="button" data-bs-toggle="dropdown">
                                    <i class="ri-more-fill"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li><a class="dropdown-item btn btn-sm btn-soft-info edit-btn" data-id="${row.id}"><i class="ri-pencil-fill align-bottom me-2 text-primary"></i> 修改</a></li>
                                    <li class="dropdown-item btn btn-sm btn-soft-danger del-btn" data-id="${row.id}">
                                        <i class="ri-delete-bin-fill align-bottom me-2 text-danger"></i> 刪除
                                    </li>
                                </ul>
                            </div>`;
                    }
                }
            ]
        });

        const refreshTable = () => dt.ajax.reload(null, false);

        // 2. 綁定按鈕 - 新增
        document.getElementById('btn-create-new')?.addEventListener('click', () => {
            const defaultData = {
                name: "新模板",
                meta: { name: "新模板" },
                header: { title_name: "新表單", title_en_name: "New form", fields: [] },
                questions: {},
                footer: { fields: [] }
            };
            store.dispatch('LOAD_DATA', defaultData);
            if (modalInstance) modalInstance.show();
        });

        // 3. 綁定按鈕 - 儲存
        document.getElementById('btn-save-form')?.addEventListener('click', async () => {
            try {
                const state = store.state;
                const id = state.id;
                const method = id ? 'PUT' : 'POST';
                const url = id ? `${baseUrl}${id}/` : baseUrl;

                const payload = {
                    name: state.meta.name,
                    json: JSON.parse(JSON.stringify(state))
                };

                const res = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': (typeof getCookie === 'function' ? getCookie('csrftoken') : document.cookie.match(/csrftoken=([\w-]+)/)?.[1])
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) throw new Error('Save Failed');

                if (modalInstance) modalInstance.hide();
                refreshTable();
            } catch (e) {
                console.error(e);
                alert('儲存失敗');
            }
        });

        // 4. 事件委派
        $table.on('click', '.edit-btn', function() {
            const tr = $(this).closest('tr');
            const data = dt.row(tr).data();
            // 深拷貝資料，避免直接修改 DataTable 暫存物件
            const formState = data.json ? JSON.parse(JSON.stringify(data.json)) : {};
            formState.id = data.id;
            formState.name = data.name;

            store.dispatch('LOAD_DATA', formState);
            if (modalInstance) modalInstance.show();
        });

        // 刪除
        let deleteId = null;
        $table.on('click', '.del-btn', function () {
            const tr = $(this).closest('tr');
            let data = dt.row(tr).data();

            // DataTable responsive 防呆
            if (data === undefined) {
                const datanum = dt.row($(this))['0'][0];
                data = dt.row(tr).context[0].aoData[datanum]._aData;
            }

            deleteId = data.id;

            // 塞 DeleteModal 資訊
            document.getElementById('delete_modal_title').textContent = '刪除模板'
            document.getElementById('delid').textContent = data.name;

            // 顯示 Delete Modal
            const deleteModalEl = document.getElementById('DeleteModal');
            bootstrap.Modal.getOrCreateInstance(deleteModalEl).show();
        });

        document.getElementById('DeleteModal')?.addEventListener('click', async (e) => {

            const target = e.target;
            if (!(target instanceof HTMLElement)) return;
            if (target.id !== 'delete') return;
            if (!deleteId) return;

            try {
                const res = await fetch(`${baseUrl}${deleteId}/`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken')
                    }
                });

                if (!res.ok) throw new Error('Delete failed');

                bootstrap.Modal.getInstance(document.getElementById('DeleteModal'))?.hide();

                deleteId = null;
                refreshTable();

            } catch (err) {
                console.error(err);
                alert('刪除失敗');
            }
        });

    } else {
        console.error('[Init] Table #form_templates-datatable not found in DOM');
    }
}

// 啟動初始化程序
init();
