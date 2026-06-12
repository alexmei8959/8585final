import re
from accounts.models import userstatus, userprofile, notification
from commons.models import menu, menugroup
from django.db.models import Q


def menus(request):
    """
    返回選單資料
    並要在TEMPLATE內加上accounts.context_processors.menus
    """
    qsMenu = []
    current_menu = None
    if request.user.is_authenticated:

        qsMenu = request.session.get('menus', [])
        # 如果找不到 session 中的 menus，則重新從資料庫撈取資料
        if not qsMenu:
            if request.user.is_superuser:
                qsMenu = menu.objects.filter(~Q(menu_2st_sort=0)).order_by(
                    "menu_1st_sort", "menu_2st_sort"
                ).values('menu_1st', 'menu_1st_icon', 'menu_1st_sort', 'menu_2st', 'menu_2st_url', 'menu_2st_sort')
            else:
                # 查詢他在哪個group
                role_id = userprofile.objects.filter(user_id=request.user.id).first().role_id
                qsMenugroup = menugroup.objects.filter(role_id=role_id).first()

                # 列出group裡面所有的選單名稱
                menu_id: dict = qsMenugroup.menu_id
                menu_id_list: list = list(menu_id.values())
                qsMenu = menu.objects.filter(id__in=menu_id_list).order_by(
                    "menu_1st_sort", "menu_2st_sort"
                ).values('menu_1st', 'menu_1st_icon', 'menu_1st_sort', 'menu_2st', 'menu_2st_url', 'menu_2st_sort')
                # 將該 user 有權限的網址存入 session
                allowed_urls: list = list(qsMenu.filter(~Q(menu_2st_url='')).values_list('menu_2st_url', flat=True))
                request.session['allowed_urls'] = allowed_urls

        # 將該 user 有權限的 menu 存入 session
        request.session['menus'] = list(qsMenu)

        # 根據 request.path 取得current url
        path = request.path
        for item in qsMenu:
            if path in item.get('menu_2st_url', ''):
                current_menu = item
                break

    return {"menus": qsMenu, "current_menu": current_menu}


def notifications(request):
    if not request.user.is_authenticated:
        return {"user_notifications": [], "unread_notification_count": 0}

    qs = (
        notification.objects
        .filter(user=request.user)
        .select_related("notifier")
        .order_by("-create_date")[:5]
    )
    unread_count = notification.objects.filter(user=request.user, is_read=False).count()

    return {
        "user_notifications": qs,
        "unread_notification_count": unread_count,
    }
