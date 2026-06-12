// 主題管理 - DataTable 初始化與 CRUD 操作
(function() {
    'use strict';

    const baseUrl = '/dreams/dream-folder/';
    let table;
    let currentId = 0;

    // 手機端卡片渲染函數
    function mobileCardRenderer(data, type, row) {
        if (type === 'display' && window.innerWidth <= 767) {
            return `
                <div class="card-row">
                    <div class="card-field">
                        <span class="card-label">主題名稱：</span>
                        <span class="card-value">${data.title || ''}</span>
                    </div>
                    <div class="card-field">
                        <span class="card-label">夢境數量：</span>
                        <span class="card-value">${data.children_count || 0}</span>
                    </div>
                    <div class="card-field">
                        <span class="card-label">開放否：</span>
                        <span class="card-value">${formatFolderEnable(data.folder_enable)}</span>
                    </div>
                    <div class="card-actions">
                        ${generateActionButtons()}
                    </div>
                </div>
            `;
        }
        return data;
    }

    // 格式化 folder_enable 欄位
    function formatFolderEnable(value) {
        if (value === true) {
            return '<span class="badge bg-success">開放</span>';
        } else {
            return '<span class="badge bg-secondary">不開放</span>';
        }
    }

    // 生成動作按鈕
    function generateActionButtons() {
        return `
            <div class="dropdown d-inline-block">
                <button class="btn btn-soft-secondary btn-sm dropdown" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="ri-more-fill align-middle"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li class="dropdown-item edit-item-btn" data-bs-toggle="modal" data-bs-target="#NewAndEditModal" title="修改">
                        <i class="ri-pencil-fill align-bottom me-2 text-muted"></i> 修改
                    </li>
                    <li class="dropdown-item remove-item-btn" data-bs-toggle="modal" data-bs-target="#DeleteModal" title="刪除">
                        <i class="ri-delete-bin-fill align-bottom me-2 text-muted"></i> 刪除
                    </li>
                </ul>
            </div>
        `;
    }

    // 初始化 DataTable
    function initDataTable() {
        table = $('#datatable').DataTable({
            'processing': true,
            'serverSide': true,
            'responsive': false,
            'language': { url: '/static/libs/datatable/zh-HANT.json' },
            'ajax': {
                url: baseUrl,
                type: 'GET',
                data: function(d) {
                    d.is_manage = 'true';
                    return d;
                }
            },
            'columns': [
                {
                    "data": "title",
                    "render": function(data, type, row) {
                        if (type === 'display' && window.innerWidth <= 767) {
                            return mobileCardRenderer(row, type, row);
                        }
                        return data || '';
                    }
                },
                {
                    "data": "children_count",
                    "render": function(data, type, row) {
                        if (window.innerWidth <= 767) return '';
                        return data || 0;
                    }
                },
                {
                    "data": "folder_enable",
                    "render": function(data, type, row) {
                        if (window.innerWidth <= 767) return '';
                        return formatFolderEnable(data);
                    }
                },
                {
                    "data": null,
                    "orderable": false,
                    "render": function(data, type, row) {
                        if (window.innerWidth <= 767) return '';
                        return generateActionButtons();
                    }
                }
            ],
            'order': [[0, 'asc']],
            'columnDefs': [
                {
                    'targets': [1, 2, 3],
                    'className': 'desktop-only'
                }
            ],
            'drawCallback': function(settings) {
                // 手機端隱藏表頭和桌面專用列
                if (window.innerWidth <= 767) {
                    $('#datatable thead').hide();
                    $('.desktop-only').hide();
                } else {
                    $('#datatable thead').show();
                    $('.desktop-only').show();
                }
            }
        });
    }

    // 點選修改或刪除
    function handleRowClick() {
        $('#datatable tbody').on('click', '.edit-item-btn, .remove-item-btn', function () {
            let data = table.row($(this).closest('tr')).data();
            if (data === undefined) {
                let datanum = table.row($(this))['0'][0];
                data = table.row($(this).closest('tr')).context[0].aoData[datanum]._aData;
            }
            currentId = data['id'];

            if ($(this).hasClass('edit-item-btn')) {
                // 修改
                $('#title').val(data['title']);

                // 設定 folder_enable 下拉選單的值
                $('#folder_enable').val(data['folder_enable'] === true ? 'true' : 'false');

                $('#type').val('EDIT');
                $('#modal_title').html('<i class="fas fa-edit modal-icon text-info"> 修改主題</i>');
            } else {
                // 刪除
                $('#delid').text(data['title']);
            }
        });
    }

    // 新增或修改存檔
    function handleFormSubmit() {
        $('form').on('submit', function (e) {
            e.preventDefault();

            const folderEnableValue = $('#folder_enable').val();

            // 檢查是否設定為「不開放」
            if (folderEnableValue === 'false') {
                // 顯示警告對話框
                Swal.fire({
                    title: '確認設定為不開放？',
                    html: '<p class="text-warning" style="font-size: 1.1em;">⚠️ 使用者將無法分享此主題</p>',
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: '確定不開放',
                    cancelButtonText: '取消',
                    reverseButtons: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        // 用戶確認，執行提交
                        submitForm();
                    }
                });
            } else {
                // 直接提交
                submitForm();
            }

            function submitForm() {
                let url = baseUrl;
                let method = $('#type').val() === 'NEW' ? 'POST' : 'PUT';
                if (method === 'PUT') url += currentId + '/';

                // 取得 CSRF token
                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

                // 處理表單數據，將 folder_enable 轉換為布林值
                let formData = $('form').serializeArray();
                let dataToSend = {};
                formData.forEach(function(item) {
                    if (item.name === 'folder_enable') {
                        dataToSend[item.name] = item.value === 'true';
                    } else {
                        dataToSend[item.name] = item.value;
                    }
                });

                $.ajax({
                    headers: {"X-CSRFToken": csrfToken},
                    url: url,
                    method: method,
                    data: dataToSend,
                    success: function () {
                        table.ajax.reload(null, false);
                        $("#NewAndEditModal").modal('hide');
                        Toast.fire({icon: 'success', title: '存檔成功'});
                    },
                    error: function (jqXHR) {
                        let errorMessage = '存檔失敗';
                        if (jqXHR.responseJSON) {
                            errorMessage = JSON.stringify(jqXHR.responseJSON);
                        } else if (jqXHR.responseText) {
                            errorMessage = jqXHR.responseText;
                        }
                        Toast.fire({icon: 'error', title: errorMessage});
                        console.log(jqXHR);
                    }
                });
            }
        });
    }

    // 刪除
    function handleDelete() {
        $('#DeleteModal').on('click', '#delete', function () {
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            $.ajax({
                headers: {"X-CSRFToken": csrfToken},
                url: baseUrl + currentId + '/',
                method: 'DELETE',
                success: function () {
                    table.ajax.reload(null, false);
                    $("#DeleteModal").modal('hide');
                    Toast.fire({icon: 'success', title: '刪除成功'});
                },
                error: function (jqXHR) {
                    let errorMessage = '刪除失敗';
                    if (jqXHR.responseJSON && jqXHR.responseJSON.detail) {
                        errorMessage = jqXHR.responseJSON.detail;
                    }
                    $("#DeleteModal").modal('hide');
                    Toast.fire({
                        icon: 'error',
                        title: errorMessage,
                        timer: 4000
                    });
                    console.log(jqXHR);
                }
            });
        });
    }

    // 新增按鈕
    function handleNewButton() {
        $('#new').on('click', function () {
            $('#title').val('');
            $('#folder_enable').val('true'); // 預設為開放
            $('#type').val('NEW');
            $('#modal_title').html('<i class="fa fa-plus modal-icon text-primary"> 新增主題</i>');
        });
    }

    // 響應式處理：視窗大小改變時重新繪製表格
    function handleResize() {
        let resizeTimer;
        $(window).on('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                if (table) {
                    table.draw(false);
                }
            }, 250);
        });
    }

    // DOM 載入完成後初始化
    $(document).ready(function () {
        initDataTable();
        handleRowClick();
        handleFormSubmit();
        handleDelete();
        handleNewButton();
        handleResize();
    });

})();
