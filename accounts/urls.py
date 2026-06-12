from django.urls import path, include
from django.shortcuts import render
from rest_framework.routers import DefaultRouter
from .views import *
from . import views, viewsets

app_name = "accounts"

router = DefaultRouter()
router.register(r"users", viewsets.userViewSet)
router.register(r'permission', viewsets.permissionViewSet, basename="_permission")
router.register(r'group', viewsets.groupViewSet, basename="_group")
router.register(r'notification', viewsets.notificationViewSet, basename="_notification")
urlpatterns = [
    path("", include(router.urls)),
    path("signup/", CustomSignupView.as_view(), name="signup"),  # 註冊會員
    path("signup_success/", lambda request: render(request, "accounts/signup_success.html"), name="signup_success"),  # 註冊成功頁面
    path("login/", CustomLoginView.as_view(), name="login"),
    path("logout/", NormalLogoutView.as_view(), name="logout"),
    path("change_password/", ChangePasswordView.as_view(), name="change_password"),  # 變更密碼
    path("password_reset/", CustomPasswordResetView.as_view(), name="password_reset"),  # 忘記密碼step1
    path("password_reset_done/", CustomPasswordResetDoneView.as_view(), name="password_reset_done"),  # 忘記密碼step2
    path("password_reset_confirm/", CustomPasswordResetConfirmView.as_view(), name="password_reset_confirm"),  # 忘記密碼step3
    path("password_reset_complete/", CustomPasswordResetCompleteView.as_view(), name="password_reset_complete"),  # 忘記密碼step4
    path('password_first_time_set_confirm/', FirstTimePasswordSetConfirmView.as_view(), name='password_first_time_set_confirm'),  # 帳號創立初次設定密碼
    path('otplogin/', OTPLoginView.as_view(), name='otp_login'),  # 多因素認證
    path("user_list/", views.userlist, name="user-list"),  # 使用者管理
    path('notification_list/', views.notification_list, name='notification-list'),  # 通知訊息
    path('auth_group_list/', views.auth_group_list, name='auth_group-list'),  # 群組人員權限管理
]
