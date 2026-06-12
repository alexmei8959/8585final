from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views, viewsets

app_name = "dreams"

router = DefaultRouter()
router.register(r"dream", viewsets.DreamViewSet, basename="_dream")
router.register(r"dream-reply", viewsets.DreamReplyViewSet, basename="_dream_reply")
router.register(r"dream-folder", viewsets.DreamFolderViewSet, basename="_dream_Folder")
router.register(r"follow", viewsets.DreamFollowViewSet, basename="_dream_follow")
router.register(r"image", viewsets.DreamImageViewSet, basename="_dream_image")
urlpatterns = [
    path("", include(router.urls)),
    path("dream_list/", views.dreamlist, name="dream-list"),  # 夢境管理
    path("dream_list_v2/", views.dreamlist_v2, name="dream-list_v2"),  # 夢境管理v2
    path("dream_reply/", views.dream_reply, name="dream-reply"),  # 夢境回應
    path("dream_folder/", views.dream_folder, name="dream-folder"),  # 主題管理
    path("dream_liff/", views.dream_liff, name="dream-liff"),  # 給linebot使用的表單
    path("line_callback/", views.line_callback, name="line_callback"),  # 回應line訊息
]
