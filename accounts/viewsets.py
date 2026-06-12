import os
import json
import random
from datetime import timezone

from django.conf import settings
from django.contrib.auth.models import Permission, Group
from django.db import transaction
from django.db.models import Q
from django.contrib.auth.hashers import make_password, check_password
from django.utils.crypto import get_random_string
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from guardian.shortcuts import assign_perm, remove_perm, get_perms
from model_utils import Choices
from commons.tools import SendEmail
from .views import generate_password_reset_token
from .models import User, userstatus, userprofile, notification
from .serializers import userSerializer, GroupSerializer, PermissionSerializer, NotificationSerializer


class userViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = userSerializer

    # CRUD要加此段
    def list(self, request, **kwargs):
        try:
            users = self.__query_by_args(request, **request.query_params)
            serializer = userSerializer(users["items"], many=True)
            result = dict()
            result["data"] = serializer.data
            result["draw"] = users["draw"]
            result["recordsTotal"] = users["total"]
            result["recordsFiltered"] = users["count"]
            return Response(
                result, status=status.HTTP_200_OK, template_name=None, content_type=None
            )

        except Exception as e:
            return Response(
                e,
                status=status.HTTP_404_NOT_FOUND,
                template_name=None,
                content_type=None,
            )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        import hashlib

        data = json.dumps(request.data)
        data = json.loads(data)

        try:
            raw_password = get_random_string(
                length=8,
                allowed_chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            )
            data["password"] = make_password(raw_password)
            data["is_active"] = False

            # 將 username 存到 first_name，username 改為 hash
            email = data.get("email", "")
            display_name = data.get("username", "")
            if email:
                data["username"] = hashlib.sha256(email.encode('utf-8')).hexdigest()[:30]
                data["first_name"] = display_name

            with transaction.atomic():
                _serializer = self.serializer_class(data=data)
                if _serializer.is_valid():
                    user = _serializer.save()

                    # join userstatus
                    userstatus.objects.create(
                        user=user,
                        password1=user.password,
                    )

                    # 根據性別隨機選擇頭像
                    dir_path = f'images/avatars/'
                    avatar_dir = os.path.join(settings.BASE_DIR, 'static', dir_path)
                    files = [f for f in os.listdir(avatar_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))]
                    random_avatar = random.choice(files)

                    # 將 is_otp 字串轉為布林值
                    is_otp_value = data.get("is_otp", False)
                    if isinstance(is_otp_value, str):
                        is_otp_value = is_otp_value.lower() in ['true', '1', 'yes']

                    # join userprofile
                    userprofile.objects.create(
                        user=user,
                        role_id = data["role_id"],
                        is_otp= is_otp_value,
                        org = "台北靈糧堂",
                        avatar=f"{dir_path}{random_avatar}",
                    )

                    # 設定群組（必填）
                    group_id = data.get("group_id")
                    if group_id:
                        user.groups.set([group_id])

                    # 寄送帳號開通密碼設定信
                    sHost = str(request.META['HTTP_HOST'])
                    if '127.0.0.1' in sHost or 'locahost' in sHost:
                        domain_name = 'http://127.0.0.1:8000'
                    else:
                        domain_name = request.scheme + "://" + sHost

                    # 產生簽名 token（發信時）
                    safe_token = generate_password_reset_token(user)
                    pwdreset_url = f"{domain_name}/accounts/password_first_time_set_confirm/?token={safe_token}"
                    context: dict = {
                        "user_email": request.data["email"],
                        "user": user.first_name,  # 使用 first_name（顯示名稱）
                        "pwdreset_url": pwdreset_url,
                    }
                    SendEmail("user_create").send(**context)

                    return Response(
                        data=_serializer.data, status=status.HTTP_201_CREATED
                    )  # NOQA
                else:
                    return Response(
                        data=_serializer.errors, status=status.HTTP_400_BAD_REQUEST
                    )  # NOQA
        except Exception as e:
            # 需檢查電話號碼或email是否已存在
            str_e = str(e)
            if "unique" in str_e:
                error_msg = "此Email已存在!"
            else:
                error_msg = str_e
            return Response(data=error_msg, status=status.HTTP_400_BAD_REQUEST)

    # 改寫Update
    def update(self, request, *args, **kwargs):
        import hashlib

        data = json.dumps(request.data)
        data = json.loads(data)

        user = User.objects.filter(id=data["user_id"]).get()
        qsUserStatus = userstatus.objects.filter(user=user).first()

        # 如果有提交 username，將其存到 first_name
        if "username" in data:
            data["first_name"] = data["username"]
            # username 保持 hash 不變，除非 email 變更
            if "email" in data and data["email"] != user.email:
                data["username"] = hashlib.sha256(data["email"].encode('utf-8')).hexdigest()[:30]
            else:
                data["username"] = user.username

        # 判斷是否真的提交了新密碼（明文）
        # 管理者不知道使用者密碼，不填就保留原本的
        raw_password = data.get("password", "")
        is_new_password = bool(raw_password) and "pbkdf2" not in raw_password

        if is_new_password:
            # 新密碼不能與前三次歷史紀錄重複
            for hist in [qsUserStatus.password1, qsUserStatus.password2, qsUserStatus.password3]:
                if hist is not None and check_password(raw_password, hist):
                    return Response(
                        data="密碼與前三次歷史紀錄重複", status=status.HTTP_400_BAD_REQUEST
                    )
            data["password"] = make_password(raw_password)
        else:
            # 未提交新密碼 → 保留 DB 中現有的 hash，不讓 serializer 動到 password
            data["password"] = user.password

        try:
            instance = self.get_object()
            _serializer = self.serializer_class(instance, data=data)

            with transaction.atomic():
                if _serializer.is_valid():
                    _serializer.save()

                    # 更新 userprofile
                    profile = userprofile.objects.filter(user=user).first()
                    if profile:
                        profile_fields = ['role_id', 'sex', 'phone', 'is_otp', 'org']
                        for field in profile_fields:
                            if field in data:
                                value = data[field]
                                # is_otp 字串轉布林值
                                if field == 'is_otp' and isinstance(value, str):
                                    value = value.lower() in ['true', '1', 'yes']
                                setattr(profile, field, value)
                        profile.save()

                    # 更新群組
                    group_id = data.get("group_id")
                    if group_id:
                        user.groups.set([group_id])
                    else:
                        user.groups.clear()

                    # 變更密碼時輪移歷史紀錄
                    if is_new_password:
                        qsUserStatus.password3 = qsUserStatus.password2
                        qsUserStatus.password2 = qsUserStatus.password1
                        qsUserStatus.password1 = user.password
                        qsUserStatus.save()

                    return Response(
                        data=_serializer.data, status=status.HTTP_201_CREATED
                    )

        except Exception as e:
            str_e = str(e)
            if "Duplicate" in str_e:
                error_msg = "此電話號碼或Email已存在!"
            else:
                error_msg = str_e
            return Response(data=error_msg, status=status.HTTP_400_BAD_REQUEST)

    # 變更頭像
    @action(detail=False, methods=["POST"], url_path="change_avatar", url_name="change_avatar")
    def chage_avatar(self, request):
        avatar_file = request.FILES.get('avatar')
        if not avatar_file:
            return Response(
                {'error': '頭像檔案未提供 (No avatar file provided.)', 'avatar': ['This field is required.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            profile, created = userprofile.objects.get_or_create(user=request.user)
            profile.avatar = avatar_file
            profile.save()

            avatar_url = None
            if profile.avatar:
                avatar_url = request.build_absolute_uri(profile.avatar.url)

            return Response({
                'message': '頭像更新成功 (Avatar updated successfully).',
                'avatar_url': avatar_url
            }, status=status.HTTP_200_OK)

        except Exception as e:
            # Log the exception e for debugging
            print(f"Error updating avatar: {e}")
            return Response({'error': f'更新頭像時發生錯誤: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny], authentication_classes=[])
    def line_check(self, request):
        line_user_id = request.query_params.get('line_user_id')
        if not line_user_id:
            return Response({'error': 'line_user_id 必填'}, status=status.HTTP_400_BAD_REQUEST)
        bound = userprofile.objects.filter(line_user_id=line_user_id).exists()
        return Response({'bound': bound})

    @action(detail=False, methods=['post'], permission_classes=[AllowAny], authentication_classes=[])
    def line_bind(self, request):
        line_user_id = request.data.get('line_user_id')
        phone = (request.data.get('phone') or '').strip()
        email = (request.data.get('email') or '').strip()

        if not line_user_id:
            return Response({'error': 'line_user_id 必填'}, status=status.HTTP_400_BAD_REQUEST)
        if not phone and not email:
            return Response({'error': '請輸入電話或 Email'}, status=status.HTTP_400_BAD_REQUEST)

        profile = None
        if phone:
            profile = userprofile.objects.filter(phone=phone).first()
        if not profile and email:
            try:
                user = User.objects.get(email=email)
                profile = userprofile.objects.filter(user=user).first()
            except User.DoesNotExist:
                pass

        if not profile:
            return Response({'error': '查無此帳號，請確認電話或 Email'}, status=status.HTTP_404_NOT_FOUND)
        if profile.line_user_id and profile.line_user_id != line_user_id:
            return Response({'error': '此帳號已綁定其他 LINE 帳號'}, status=status.HTTP_409_CONFLICT)

        profile.line_user_id = line_user_id
        profile.save()
        return Response({'status': 'ok'})

    def __query_by_args(self, request, **kwargs):
        ORDER_COLUMN_CHOICES = Choices(
            ("0", "id"),
            ("1", "first_name"),
            ("2", "email"),
            ("3", "userprofile__role_id"),
            ("4", "userprofile__org"),
        )
        draw: int = int(kwargs.get("draw", None)[0])
        length: int = int(kwargs.get("length", None)[0])
        start: int = int(kwargs.get("start", None)[0])
        search_value: str = kwargs.get("search[value]", None)[0]
        order_column: str = kwargs.get("order[0][column]", None)[0]
        order: str = kwargs.get("order[0][dir]", None)[0]

        order_column = ORDER_COLUMN_CHOICES[order_column]
        # django orm '-' -> desc
        if order == "desc":
            order_column = "-" + order_column

        queryset = User.objects.filter(~Q(username="admin")).select_related("userstatus", "userprofile")

        user_role_id = request.session.get("user_role_id")
        if user_role_id is not None:
            queryset = queryset.filter(userprofile__role_id__gte=user_role_id)
        total = queryset.count()

        if search_value:
            queryset = queryset.filter(
                Q(first_name__icontains=search_value)
                | Q(email__icontains=search_value)
                | Q(userprofile__org__icontains=search_value)
                | Q(groups__name__icontains=search_value)
            ).distinct()

        count = queryset.count()
        queryset = queryset.order_by(order_column)[start : start + length]
        return {"items": queryset, "count": count, "total": total, "draw": draw}


class notificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return notification.objects.filter(user=self.request.user).select_related('notifier')

    def list(self, request, **kwargs):
        try:
            result = self.__query_by_args(request.user, **request.query_params)
            serializer = NotificationSerializer(result["items"], many=True)
            return Response({
                "data": serializer.data,
                "draw": result["draw"],
                "recordsTotal": result["total"],
                "recordsFiltered": result["count"],
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(str(e), status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["POST"], url_path="mark_read", url_name="mark_read")
    def mark_read(self, request, pk=None):
        obj = self.get_object()
        obj.is_read = True
        obj.save()
        return Response({"message": "success"})

    @action(detail=False, methods=["POST"], url_path="mark_all_read", url_name="mark_all_read")
    def mark_all_read(self, request):
        notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, last_modified_date=timezone.now()
        )
        return Response({"message": "success"})

    def __query_by_args(self, user, **kwargs):
        ORDER_COLUMN_CHOICES = Choices(
            ("0", "create_date"),
            ("1", "notifier__username"),
            ("2", "message"),
            ("3", "is_read"),
        )
        draw = int(kwargs.get("draw", None)[0])
        length = int(kwargs.get("length", None)[0])
        start = int(kwargs.get("start", None)[0])
        search_value = kwargs.get("search[value]", None)[0]
        order_column = kwargs.get("order[0][column]", None)[0]
        order = kwargs.get("order[0][dir]", None)[0]

        order_column = ORDER_COLUMN_CHOICES[order_column]
        if order == "desc":
            order_column = "-" + order_column

        queryset = notification.objects.filter(user=user).select_related('notifier')
        total = queryset.count()

        if search_value:
            queryset = queryset.filter(
                Q(notifier__username__icontains=search_value) |
                Q(message__icontains=search_value)
            )

        count = queryset.count()
        queryset = queryset.order_by(order_column)[start:start + length]
        return {"items": queryset, "count": count, "total": total, "draw": draw}


class permissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer

    # CRUD要加此段
    def list(self, request, **kwargs) -> dict or None:
        try:
            dPermission = self.__query_by_args(**request.query_params)
            serializer = PermissionSerializer(dPermission["items"], many=True)
            result = dict()
            result["data"] = serializer.data
            result["draw"] = dPermission["draw"]
            result["recordsTotal"] = dPermission["total"]
            result["recordsFiltered"] = dPermission["count"]
            return Response(
                result, status=status.HTTP_200_OK, template_name=None, content_type=None
            )

        except Exception as e:
            return Response(
                e,
                status=status.HTTP_404_NOT_FOUND,
                template_name=None,
                content_type=None,
            )

    def __query_by_args(self, **kwargs) -> dict:
        ORDER_COLUMN_CHOICES = Choices(
            ("0", "id"),
            ("1", "name"),
            ("2", "content_type_id"),
            ("3", "codename"),
        )

        draw: int = int(kwargs.get("draw", None)[0])
        length: int = int(kwargs.get("length", None)[0])
        start: int = int(kwargs.get("start", None)[0])
        search_value: str = kwargs.get("search[value]", None)[0]
        order_column: str = kwargs.get("order[0][column]", None)[0]
        order: str = kwargs.get("order[0][dir]", None)[0]

        order_column = ORDER_COLUMN_CHOICES[order_column]
        # django orm '-' -> desc
        if order == "desc":
            order_column = "-" + order_column

        queryset = Permission.objects.select_related("content_type").all()

        # datatable搜尋關鍵字
        if search_value:
            queryset = queryset.filter(
                Q(name__icontains=search_value)
                | Q(codename__icontains=search_value)
            )

        # 取出queryset總數量
        total: int = queryset.count()
        count: int = queryset.count()

        # 根據datatable要求數量篩選
        queryset = queryset.order_by(order_column)[start:start + length]

        return {"items": queryset, "count": count, "total": total, "draw": draw}


class groupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer

    # CRUD要加此段
    def list(self, request, **kwargs) -> dict or None:
        try:
            dGroup = self.__query_by_args(**request.query_params)
            # items 已經是處理好的字典列表，直接使用
            result = dict()
            result["data"] = dGroup["items"]
            result["draw"] = dGroup["draw"]
            result["recordsTotal"] = dGroup["total"]
            result["recordsFiltered"] = dGroup["count"]
            return Response(
                result, status=status.HTTP_200_OK, template_name=None, content_type=None
            )

        except Exception as e:
            return Response(
                str(e),
                status=status.HTTP_404_NOT_FOUND,
                template_name=None,
                content_type=None,
            )

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        from .models import groupinfo

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()

        # 處理主題 folders
        folder_ids = request.data.getlist('folders[]')
        if folder_ids:
            group_info, created = groupinfo.objects.get_or_create(
                group=group,
                defaults={'token': get_random_string(length=16)}
            )
            group_info.allow_folders = [str(fid) for fid in folder_ids if fid]
            group_info.save()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        from dreams.models import dream
        from .models import groupinfo

        instance = self.get_object()
        update_type = request.data.get('update_type')

        # 原有的更新邏輯
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()

        # 更新群組主題 (groupinfo.allow_folders)
        if update_type == "folders":
            folder_ids = request.data.getlist('folders[]')
            # 取得 groupinfo，不存在則建立
            group_info, created = groupinfo.objects.get_or_create(
                group=group,
                defaults={'token': get_random_string(length=16)}
            )
            # 儲存為 UUID 字串列表
            group_info.allow_folders = [str(fid) for fid in folder_ids if fid]
            group_info.save()

        # 更新群組人員 (auth_user_groups)
        elif update_type == "users":
            user_ids = request.data.getlist('group_users[]')
            users = User.objects.filter(id__in=[uid for uid in user_ids if uid])
            group.user_set.set(users)

        # 更新群組註冊設定 (groupinfo.is_join)
        elif update_type == "join_settings":
            is_join_value = request.data.get('is_join', 'false')
            if isinstance(is_join_value, bool):
                is_join = is_join_value
            else:
                is_join = str(is_join_value).lower() == 'true'

            # 取得或建立 groupinfo
            group_info, created = groupinfo.objects.get_or_create(
                group=group,
                defaults={'token': get_random_string(length=16)}
            )

            # 每次產生新的token
            group_info.token = get_random_string(length=16)
            group_info.is_join = is_join
            group_info.save()

            # 返回註冊連結
            if is_join:
                from django.conf import settings
                domain = request.get_host()
                scheme = 'https' if request.is_secure() else 'http'
                signup_url = f"{scheme}://{domain}/accounts/signup/?token={group_info.token}"
                return Response({
                    "status": "success",
                    "is_join": is_join,
                    "token": group_info.token,
                    "signup_url": signup_url
                })

        return Response(serializer.data)

    def __query_by_args(self, **kwargs) -> dict:
        ORDER_COLUMN_CHOICES = Choices(
            ("0", "id"),
            ("1", "name"),
        )

        draw: int = int(kwargs.get("draw", None)[0])
        length: int = int(kwargs.get("length", None)[0])
        start: int = int(kwargs.get("start", None)[0])
        search_value: str = kwargs.get("search[value]", None)[0]
        order_column: str = kwargs.get("order[0][column]", None)[0]
        order: str = kwargs.get("order[0][dir]", None)[0]

        order_column = ORDER_COLUMN_CHOICES[order_column]
        # django orm '-' -> desc
        if order == "desc":
            order_column = "-" + order_column

        queryset = Group.objects.prefetch_related('permissions', 'user_set').all()

        # datatable搜尋關鍵字
        if search_value:
            queryset = queryset.filter(
                Q(name__icontains=search_value)
            )

        # 取出queryset總數量
        total: int = queryset.count()
        count: int = queryset.count()

        # 根據datatable要求數量篩選
        queryset = queryset.order_by(order_column)[start:start + length]

        # 這裡轉成 datatable 需要的格式
        from dreams.models import dream
        from .models import groupinfo

        items = []
        for group in queryset:
            # 取得該群組的 groupinfo
            group_info = groupinfo.objects.filter(group=group).first()
            folder_ids = group_info.allow_folders if group_info and group_info.allow_folders else []

            # 根據 folder_ids 取得對應的 dream folders
            folders = dream.objects.filter(id__in=folder_ids, is_folder=True)

            items.append({
                "id": group.id,
                "name": group.name,
                "users": [
                    {
                        "id": u.id,
                        "username": u.first_name or u.username,
                        "first_name": u.first_name,
                        "email": u.email,
                    }
                    for u in group.user_set.all()
                ],
                "folders": [
                    {
                        "id": str(f.id),
                        "title": f.title,
                    }
                    for f in folders
                ],
                "groupinfo": {
                    "is_join": group_info.is_join if group_info else False,
                    "token": group_info.token if group_info else None,
                } if group_info else None
            })

        return {"items": items, "count": count, "total": total, "draw": draw}