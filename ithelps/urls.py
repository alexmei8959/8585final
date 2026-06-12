from django.urls import path
from . import views
# 1. 引入 Django 內建的視圖
from django.contrib.auth import views as auth_views

app_name = 'ithelps'

urlpatterns = [
    path('', views.repair_list, name='repair_list'),
    
    # 2. 加入登入與登出
    # template_name 指定登入頁面的位置（等一下要在 templates 建立）
    path('login/', auth_views.LoginView.as_view(template_name='registration/login.html'), name='login'),
    # next_page 指定登出後自動跳轉到登入頁面
    path('logout/', auth_views.LogoutView.as_view(next_page='login'), name='logout'),

    path('detail/<int:pk>/', views.repair_detail, name='repair_detail'),
    path('create/', views.repair_create, name='repair_create'),
    path('edit/<int:pk>/', views.repair_edit, name='repair_edit'),
    path('delete/<int:pk>/', views.repair_delete, name='repair_delete'),
    path('export/csv/', views.export_repairs_csv, name='export_repairs_csv'),
    path('trash-bin/', views.repair_trash_bin, name='repair_trash_bin'),
    path('repair/<int:pk>/restore/', views.repair_restore, name='repair_restore'),
    path('register/', views.register, name='register'),
]