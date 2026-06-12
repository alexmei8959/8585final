// 從 cookie 取 csrftoken
function getCsrfToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === 'csrftoken=') {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

let csrf_token = getCsrfToken();

// 變更頭像 Modal：暫存已選取的上傳檔案
let _pendingAvatarFile = null;

document.addEventListener('DOMContentLoaded', function () {
    // footer
    const yearSpans = document.querySelectorAll('[data-year]');
    const currentYear = new Date().getFullYear();
    yearSpans.forEach(span => {
        span.textContent = currentYear;
    });

    // 變更密碼
    document.getElementById('changePasswordBtn').addEventListener('click', function () {
        var oldPassword = document.getElementById('old_password').value;
        var newPassword = document.getElementById('new_password').value;
        var reNewPassword = document.getElementById('re_new_password').value;

        fetch('/accounts/change_password/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrf_token
            },
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword,
                re_new_password: reNewPassword
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log(data);
            if (data.message !== 'success') {
                throw new Error(data.message);
            }
            bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
            Swal.fire({
                icon: 'success',
                title: '變更成功！',
                text: '變更密碼成功。',
                showConfirmButton: true,
            });
        })
        .catch(error => {
            Swal.fire({
                icon: 'error',
                title: '變更失敗！',
                text: error.message,
                showConfirmButton: true,
            });
        });
    });

    // 點選變更密碼連結時清空欄位
    document.getElementById('changePasswordLink').addEventListener('click', function () {
        document.getElementById('old_password').value = '';
        document.getElementById('new_password').value = '';
        document.getElementById('re_new_password').value = '';
    });

    // 登出
    const btn = document.getElementById("logout-btn");
    if (btn) {
        btn.addEventListener("click", function () {
            window.location.href = "/accounts/logout";
        });
    }

    // --- 變更頭像 Modal ---

    // 點擊預設頭像選項
    document.addEventListener('click', function (e) {
        const item = e.target.closest('.avatar-selection-item');
        if (!item) return;
        document.querySelectorAll('.avatar-selection-item').forEach(el => el.classList.remove('border-primary', 'border-3'));
        item.classList.add('border-primary', 'border-3');
        const path = item.dataset.avatarPath;
        document.getElementById('selectedAvatarPath').value = path;
        document.getElementById('avatarPreviewInModal').src = '/static/' + path;
        // 清除已選取的上傳檔案
        document.getElementById('avatarFileInputModal').value = '';
        _pendingAvatarFile = null;
    });

    // 上傳自訂圖片 → 即時預覽
    document.getElementById('avatarFileInputModal').addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        // 清除預設頭像選取狀態
        document.querySelectorAll('.avatar-selection-item').forEach(el => el.classList.remove('border-primary', 'border-3'));
        document.getElementById('selectedAvatarPath').value = '';
        _pendingAvatarFile = file;
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('avatarPreviewInModal').src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // 存檔
    document.getElementById('saveNewAvatarBtn').addEventListener('click', function () {
        document.getElementById('avatarModalError').textContent = '';
        const selectedPath = document.getElementById('selectedAvatarPath').value;

        if (!_pendingAvatarFile && !selectedPath) {
            document.getElementById('avatarModalError').textContent = '請選擇一個頭像或上傳自訂圖片';
            return;
        }

        if (_pendingAvatarFile) {
            // 上傳自訂圖片 → POST to userViewSet change_avatar (multipart)
            const formData = new FormData();
            formData.append('avatar', _pendingAvatarFile);
            fetch('/accounts/users/change_avatar/', {
                method: 'POST',
                headers: { 'X-CSRFToken': csrf_token },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.message && data.message.includes('success')) {
                    location.reload();
                } else {
                    document.getElementById('avatarModalError').textContent = data.error || data.message || '發生錯誤';
                }
            })
            .catch(() => {
                document.getElementById('avatarModalError').textContent = '發生錯誤，請稍後再試';
            });
        } else {
            // 選擇預設頭像 → 先 fetch 成 Blob，再轉 File 走 multipart（與自訂上傳同一後端路徑）
            // selectedPath 只有相對 static 路徑（e.g. images/avatars/11.png），需補 /static/
            fetch('/static/' + selectedPath)
            .then(function (res) {
                if (!res.ok) throw new Error('無法取得預設頭像');
                return res.blob();
            })
            .then(function (blob) {
                const fileName = selectedPath.split('/').pop() || 'preset_avatar.png';
                const file = new File([blob], fileName, { type: blob.type });
                const formData = new FormData();
                formData.append('avatar', file);
                return fetch('/accounts/users/change_avatar/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrf_token },
                    body: formData
                });
            })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.message && data.message.includes('success')) {
                    location.reload();
                } else {
                    document.getElementById('avatarModalError').textContent = data.error || data.message || '發生錯誤';
                }
            })
            .catch(function () {
                document.getElementById('avatarModalError').textContent = '發生錯誤，請稍後再試';
            });
        }
    });

    // Modal 開啟時：重置上傳狀態、標記目前頭像
    document.getElementById('changeAvatarModal').addEventListener('show.bs.modal', function () {
        document.getElementById('avatarFileInputModal').value = '';
        _pendingAvatarFile = null;
        const currentSrc = document.getElementById('avatarPreviewInModal').src;
        if (currentSrc) {
            const currentPath = currentSrc.replace(window.location.origin + '/static/', '');
            document.querySelectorAll('.avatar-selection-item').forEach(el => {
                if (el.dataset.avatarPath === currentPath) {
                    el.classList.add('border-primary', 'border-3');
                    document.getElementById('selectedAvatarPath').value = currentPath;
                }
            });
        }
    });
});
