import logging
from datetime import date

from django.conf import settings
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from model_utils import Choices

from accounts.models import userprofile
from .models import dream, dream_reply, dream_follow, dream_hashtag, dream_image
from .serializers import DreamSerializer, DreamReplySerializer, DreamFollowSerializer, DreamImageSerializer

logger = logging.getLogger("django")


class DreamViewSet(viewsets.ModelViewSet):
    queryset = dream.objects.select_related("user", "user__userprofile", "parent").prefetch_related("follows", "replies", "hashtags", "images", "children").all()
    serializer_class = DreamSerializer
    permission_classes = [IsAuthenticated]

    # CRUD要加此段
    def list(self, request, **kwargs) -> dict or None:
        try:
            dDream = self.__query_by_args(request, **request.query_params)
            serializer = self.serializer_class(dDream["items"], many=True, context={'request': request})
            result = dict()
            result["data"] = serializer.data
            result["draw"] = dDream["draw"]
            result["recordsTotal"] = dDream["total"]
            result["recordsFiltered"] = dDream["count"]
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

    def __query_by_args(self, request, **kwargs) -> dict:
        from accounts.models import groupinfo

        ORDER_COLUMN_CHOICES = Choices(
            ("0", "title"),
            ("1", "dream_date"),
            ("2", "dream_type"),
            ("3", "is_folder"),
            ("4", "create_date"),
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

        # Mutiple column order
        order_column_1 = ""
        if (kwargs.get("order[1][column]", None)) is not None:
            order_column_1 = kwargs.get("order[1][column]", None)[0]
            order_column_1 = ORDER_COLUMN_CHOICES[order_column_1]
            order_1 = kwargs.get("order[1][dir]", None)[0]
            if order_1 == "desc":
                order_column_1 = "-" + order_column_1

        queryset = self.queryset

        # 根據使用者群組權限過濾可見的主題
        user = request.user
        user_groups = user.groups.all()
        allowed_folder_ids = []

        for group in user_groups:
            group_info = groupinfo.objects.filter(group=group).first()
            if group_info and group_info.allow_folders:
                allowed_folder_ids.extend(group_info.allow_folders)

        # 只顯示允許的 folders 及其子夢境
        if allowed_folder_ids:
            queryset = queryset.filter(
                Q(id__in=allowed_folder_ids, is_folder=True) |  # 主題本身
                Q(parent_id__in=allowed_folder_ids, is_folder=False)  # 主題下的夢境
            )
        else:
            # 如果沒有任何允許的 folder，返回空集
            queryset = queryset.none()

        parent_id = kwargs.get("parent", None)
        if parent_id:
            parent_value = parent_id[0] if isinstance(parent_id, list) else parent_id
            queryset = queryset.filter(parent_id=parent_value)

        is_folder = kwargs.get("is_folder", None)
        if is_folder is not None:
            folder_value = is_folder[0] if isinstance(is_folder, list) else is_folder
            is_folder_value = folder_value == "true"
            queryset = queryset.filter(is_folder=is_folder_value)

        if search_value:
            queryset = queryset.filter(
                Q(title__icontains=search_value)
                | Q(dream_type__icontains=search_value)
                | Q(create_user__icontains=search_value)
                | Q(user__first_name__icontains=search_value)
            )

        total = queryset.count()
        count = queryset.count()

        if (kwargs.get("order[1][column]", None)) is None:
            queryset = queryset.order_by(order_column)[start : start + length]
        else:
            queryset = queryset.order_by(order_column, order_column_1)[
                start : start + length
            ]
        return {"items": queryset, "count": count, "total": total, "draw": draw}

    def perform_create(self, serializer):
        """創建時處理 hashtags 並驗證主題權限"""
        from accounts.models import groupinfo
        from rest_framework.exceptions import ValidationError

        logger.info(f"[Dream] perform_create 被調用，user={self.request.user.first_name}")

        # 驗證主題權限
        parent_id = serializer.validated_data.get('parent_id')
        if parent_id:
            # 檢查 1: 主題必須存在且 folder_enable=True
            parent = dream.objects.filter(id=parent_id, is_folder=True, folder_enable=True).first()
            if not parent:
                raise ValidationError({"parent": "所選主題不開放分享"})

            # 檢查 2: 使用者的群組必須有此主題的權限
            user_groups = self.request.user.groups.all()
            allowed = False

            for group in user_groups:
                group_info = groupinfo.objects.filter(group=group).first()
                if group_info and group_info.allow_folders:
                    if str(parent_id) in group_info.allow_folders:
                        allowed = True
                        break

            if not allowed:
                raise ValidationError({"parent": "您沒有權限分享到此主題"})

        hashtags_data = self.request.data.pop('hashtags', [])
        logger.info(f"[Dream] hashtags_data={hashtags_data}")

        instance = serializer.save()
        logger.info(f"[Dream] 夢境已建立，id={instance.id}, title={instance.title}")

        # 創建 hashtags
        for tag in hashtags_data:
            if tag:
                obj, created = dream_hashtag.objects.get_or_create(
                    dream=instance,
                    hashtag=tag
                )
                logger.info(f"[Dream] hashtag '{tag}' {'已建立' if created else '已存在'}")

        # 觸發搜索索引更新
        try:
            from . import search
            search.index_dream(instance)
            logger.info(f"[Dream] 搜索索引已更新")
        except Exception as e:
            logger.warning(f"[Dream] 搜索索引更新失敗 {instance.id}: {e}")

    def perform_update(self, serializer):
        """更新時處理 hashtags 並驗證主題權限"""
        from accounts.models import groupinfo
        from rest_framework.exceptions import ValidationError

        logger.info(f"[Dream] perform_update 被調用，dream_id={serializer.instance.id}")

        # 驗證主題權限（如果修改了 parent）
        parent_id = serializer.validated_data.get('parent_id')
        if parent_id:
            # 檢查 1: 主題必須存在且 folder_enable=True
            parent = dream.objects.filter(id=parent_id, is_folder=True, folder_enable=True).first()
            if not parent:
                raise ValidationError({"parent": "所選主題不開放分享"})

            # 檢查 2: 使用者的群組必須有此主題的權限
            user_groups = self.request.user.groups.all()
            allowed = False

            for group in user_groups:
                group_info = groupinfo.objects.filter(group=group).first()
                if group_info and group_info.allow_folders:
                    if str(parent_id) in group_info.allow_folders:
                        allowed = True
                        break

            if not allowed:
                raise ValidationError({"parent": "您沒有權限分享到此主題"})

        hashtags_data = self.request.data.pop('hashtags', None)
        logger.info(f"[Dream] hashtags_data={hashtags_data}")

        instance = serializer.save()
        logger.info(f"[Dream] 夢境已更新，id={instance.id}")

        if hashtags_data is not None:
            # 刪除舊標籤
            old_count = instance.hashtags.count()
            instance.hashtags.all().delete()
            logger.info(f"[Dream] 已刪除 {old_count} 個舊標籤")

            # 創建新標籤
            for tag in hashtags_data:
                if tag:
                    obj, created = dream_hashtag.objects.get_or_create(
                        dream=instance,
                        hashtag=tag
                    )
                    logger.info(f"[Dream] hashtag '{tag}' {'已建立' if created else '已存在'}")

        # 觸發搜索索引更新
        try:
            from . import search
            search.index_dream(instance)
            logger.info(f"[Dream] 搜索索引已更新")
        except Exception as e:
            logger.warning(f"[Dream] 搜索索引更新失敗 {instance.id}: {e}")

    @action(detail=False, methods=["post"], permission_classes=[AllowAny], authentication_classes=[])
    def liff_submit(self, request):
        """
        為什麼不覆寫DreamViewSet的create而要用liff_submit?
        因為 permission_classes 衝突，LIFF 來自 LINE沒有 Django session必須 AllowAny，破壞了原本的保護
        """
        try:
            body = request.data
            line_user_id = body.get('line_user_id') or 'LINE'

            # 取得使用者
            profile = userprofile.objects.filter(line_user_id=line_user_id).first()
            user = profile.user if profile else None

            raw_form_data = body.get('form_data', {})
            parsed_data = {}
            dream_date = None
            title = "未確定的主題"
            # 解析 form_data
            for key, item in raw_form_data.items():
                if not key == "questions":
                    continue

                for q_key, q_item in item.items():
                    question = q_item.get("question")
                    value = q_item.get("value")
                    ui_type = q_item.get("ui_type")

                    # 特殊處理 主題
                    if "主題（若不確定可留空）" in question and value:
                        title = value

                    # 特殊處理 date
                    if ui_type == "date" and value:
                        try:
                            dream_date = date.fromisoformat(value)
                        except Exception:
                            pass

                    # checkbox_group 統一為 list
                    if ui_type == "checkbox_group":
                        parsed_data[question] = value or []
                    else:
                        parsed_data[question] = value

            d = dream(
                title=title,
                is_folder=False,
                user = user,
                dream_date=dream_date,
                dream_type=parsed_data.get("特定的禱告主題與方向？"),
                dream_content=parsed_data,
                create_user=user.first_name if user else 'LINE',
                last_modified_user=user.first_name if user else 'LINE',
            )
            d.save()
            return Response({'status': 'ok', 'id': str(d.id)}, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception('liff_submit error')
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def ui(self, request):
        from accounts.models import groupinfo

        parent_id = request.query_params.get("parent")
        search_value = request.query_params.get("search", "")

        queryset = self.queryset

        # 根據使用者群組權限過濾可見的主題（單次查詢）
        user = request.user
        user_groups = user.groups.all()
        allowed_folder_ids = []

        group_infos = groupinfo.objects.filter(group__in=user_groups)
        for group_info in group_infos:
            if group_info.allow_folders:
                allowed_folder_ids.extend(group_info.allow_folders)

        # 只顯示允許的 folders 及其子夢境
        if allowed_folder_ids:
            queryset = queryset.filter(
                Q(id__in=allowed_folder_ids, is_folder=True) |
                Q(parent_id__in=allowed_folder_ids, is_folder=False)
            )
        else:
            queryset = queryset.none()

        if parent_id:
            queryset = queryset.filter(parent_id=parent_id)

        if search_value:
            dreams_qs = self._search_dreams(queryset, search_value)
            response_data = {
                "folders": [],
                "dreams": self.serializer_class(dreams_qs, many=True, context={'request': request}).data,
            }
            return Response(response_data, status=status.HTTP_200_OK)

        sort = request.query_params.get("sort", "dream_date")
        filter_by = request.query_params.get("filter", "all")
        folder_id = request.query_params.get("folder")  # 主題過濾
        folders = queryset.filter(is_folder=True, folder_enable=True).order_by("title")
        dreams_qs = queryset.filter(is_folder=False)

        if filter_by == "followed":
            followed_sub = dream_follow.objects.filter(
                dream=OuterRef("pk"), user=request.user
            )
            dreams_qs = dreams_qs.filter(Exists(followed_sub))
        elif filter_by == "mine":
            dreams_qs = dreams_qs.filter(user=request.user)
        elif filter_by == "interpreted":
            dreams_qs = dreams_qs.filter(
                Q(dream_content__禱告方向__isnull=True) |
                Q(dream_content__禱告方向="")
            )

        # 按主題過濾
        if folder_id:
            dreams_qs = dreams_qs.filter(parent_id=folder_id)

        if sort == "follow_count":
            dreams = dreams_qs.annotate(_fc=Count("follows")).order_by("-_fc", "-dream_date")[:200]
        elif sort == "reply_count":
            dreams = dreams_qs.annotate(_rc=Count("replies")).order_by("-_rc", "-dream_date")[:200]
        elif sort == "create_date":
            dreams = dreams_qs.order_by("-create_date", "title")[:200]
        else:
            dreams = dreams_qs.order_by("-dream_date", "title")[:200]

        response_data = {
            "folders": self.serializer_class(folders, many=True, context={'request': request}).data,
            "dreams": self.serializer_class(dreams, many=True, context={'request': request}).data,
        }

        # 根目錄時加入全系統夢境總數（供前端統計顯示用）
        if not parent_id:
            response_data["total_dreams"] = self.queryset.filter(is_folder=False).count()

        return Response(response_data, status=status.HTTP_200_OK)

    def _search_dreams(self, queryset, search_value):
        """優先用 Meilisearch 全文搜尋；不可用時降級至 DB icontains。"""
        from dreams.search import search as meili_search
        try:
            ids = meili_search(search_value)
            if not ids:
                return []
            # 從 DB 取回完整物件，依 Meili 相關性順序排序
            id_order = {uid: i for i, uid in enumerate(ids)}
            qs = queryset.filter(id__in=ids, is_folder=False)
            return sorted(qs, key=lambda d: id_order.get(str(d.id), len(ids)))
        except Exception as e:
            logger.warning("Meilisearch search failed, falling back to DB: %s", e)
            return queryset.filter(
                Q(title__icontains=search_value)
                | Q(dream_type__icontains=search_value)
                | Q(create_user__icontains=search_value)
                | Q(user__first_name__icontains=search_value)
            ).filter(is_folder=False).order_by("-dream_date", "title")[:200]

    @action(detail=False, methods=["get"])
    def hashtags(self, request):
        """搜尋 hashtag 建議（用於自動完成）"""
        query = request.query_params.get("q", "").strip()
        exclude_str = request.query_params.get("exclude", "").strip()

        # 解析要排除的 hashtag（逗號分隔）
        exclude_list = [tag.strip() for tag in exclude_str.split(",") if tag.strip()]

        # 基礎查詢
        qs = dream_hashtag.objects.values("hashtag").annotate(
            count=Count("hashtag")
        )

        # 排除已選擇的 hashtag
        if exclude_list:
            qs = qs.exclude(hashtag__in=exclude_list)

        if not query:
            # 沒有搜尋詞時回傳最常用的 5 個
            tags = qs.order_by("-count")[:5]
        else:
            # 有搜尋詞時用 icontains 過濾
            tags = qs.filter(hashtag__icontains=query).order_by("-count")[:20]

        result = [t["hashtag"] for t in tags]
        return Response(result, status=status.HTTP_200_OK)


class DreamFollowViewSet(viewsets.GenericViewSet):
    serializer_class = DreamFollowSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        dream_id = request.data.get("dream")
        if not dream_id:
            return Response({"detail": "dream 欄位必填。"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dream_obj = dream.objects.get(pk=dream_id, is_folder=False)
        except dream.DoesNotExist:
            return Response({"detail": "夢境不存在。"}, status=status.HTTP_404_NOT_FOUND)

        follow_obj = dream_follow.objects.filter(user=request.user, dream=dream_obj).first()
        if follow_obj:
            follow_obj.delete()
            followed = False
        else:
            dream_follow.objects.create(user=request.user, dream=dream_obj)
            followed = True

        follow_count = dream_obj.follows.count()
        return Response({"followed": followed, "follow_count": follow_count}, status=status.HTTP_200_OK)


class DreamReplyViewSet(viewsets.ModelViewSet):
    queryset = dream_reply.objects.select_related("user", "dream").all()
    serializer_class = DreamReplySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        dream_id = self.request.query_params.get("dream")
        if dream_id:
            qs = qs.filter(dream_id=dream_id)
        return qs.order_by("reply_date")

    def perform_create(self, serializer):
        serializer.save(reply_date=timezone.now())


class DreamFolderViewSet(viewsets.ModelViewSet):
    """主題管理（is_folder=True 的 dream 記錄）"""
    queryset = dream.objects.filter(is_folder=True).select_related("user").prefetch_related("children").all()
    serializer_class = DreamSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='allowed', url_name='allowed')
    def get_allowed_folders(self, request):
        """取得使用者可查看的所有主題（用於列表篩選，不檢查 folder_enable）"""
        from accounts.models import groupinfo

        user = request.user
        user_groups = user.groups.all()
        allowed_folder_ids = []

        for group in user_groups:
            group_info = groupinfo.objects.filter(group=group).first()
            if group_info and group_info.allow_folders:
                allowed_folder_ids.extend(group_info.allow_folders)

        # 取得所有允許的主題（不檢查 folder_enable）
        if allowed_folder_ids:
            folders = dream.objects.filter(
                id__in=allowed_folder_ids,
                is_folder=True
            ).order_by('title')
        else:
            folders = dream.objects.none()

        serializer = self.serializer_class(folders, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def list(self, request, **kwargs) -> dict or None:
        try:
            dFolder = self.__query_by_args(request, **request.query_params)
            serializer = self.serializer_class(dFolder["items"], many=True, context={'request': request})
            result = dict()
            result["data"] = serializer.data
            result["draw"] = dFolder["draw"]
            result["recordsTotal"] = dFolder["total"]
            result["recordsFiltered"] = dFolder["count"]
            return Response(
                result, status=status.HTTP_200_OK, template_name=None, content_type=None
            )

        except Exception as e:
            logger.exception("[DreamFolder] list 錯誤")
            return Response(
                str(e),
                status=status.HTTP_404_NOT_FOUND,
                template_name=None,
                content_type=None,
            )

    def __query_by_args(self, request, **kwargs) -> dict:
        from accounts.models import groupinfo

        ORDER_COLUMN_CHOICES = Choices(
            ("0", "title"),
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

        queryset = self.queryset

        # 因為管理介面與使用者權限共用，故在管理時加傳參數以利區分
        is_manage = request.query_params.get("is_manage") == 'true'

        if not is_manage:
            # 根據使用者群組權限過濾可見的主題
            user = request.user
            user_groups = user.groups.all()
            allowed_folder_ids = []

            for group in user_groups:
                group_info = groupinfo.objects.filter(group=group).first()
                if group_info and group_info.allow_folders:
                    allowed_folder_ids.extend(group_info.allow_folders)

            # 只顯示允許的 folders（且必須 folder_enable=True 才能分享）
            if allowed_folder_ids:
                queryset = queryset.filter(
                    id__in=allowed_folder_ids,
                    folder_enable=True  # 只顯示開放的主題
                )
            else:
                queryset = queryset.none()

        if search_value:
            queryset = queryset.filter(Q(title__icontains=search_value))

        total = queryset.count()
        count = queryset.count()

        queryset = queryset.order_by(order_column)[start : start + length]
        return {"items": queryset, "count": count, "total": total, "draw": draw}

    def perform_create(self, serializer):
        """建立主題時強制設定 is_folder=True"""
        logger.info(f"[DreamFolder] perform_create 被調用，user={self.request.user.first_name}")
        serializer.save(is_folder=True)

    def perform_update(self, serializer):
        """更新主題時確保 is_folder=True"""
        logger.info(f"[DreamFolder] perform_update 被調用，folder_id={serializer.instance.id}")
        serializer.save(is_folder=True)

    def destroy(self, request, *args, **kwargs):
        """刪除主題前檢查是否有子夢境"""
        instance = self.get_object()

        # 檢查是否有子夢境（parent 指向此 folder 的 dream）
        children_count = dream.objects.filter(parent=instance).count()

        if children_count > 0:
            logger.warning(f"[DreamFolder] 無法刪除主題 {instance.id}，尚有 {children_count} 個子夢境")
            return Response(
                {"detail": f"此主題下還有 {children_count} 個夢境，無法刪除。請先移除或轉移所有夢境。"},
                status=status.HTTP_400_BAD_REQUEST
            )

        logger.info(f"[DreamFolder] 刪除主題 {instance.id} - {instance.title}")
        return super().destroy(request, *args, **kwargs)


class DreamImageViewSet(viewsets.ModelViewSet):
    """處理夢境圖片上傳（限制每個夢境最多一張圖片）"""
    queryset = dream_image.objects.select_related("dream").all()
    serializer_class = DreamImageSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        logger.info(f"[DreamImage] 收到圖片上傳請求，user={request.user.first_name}")
        logger.info(f"[DreamImage] request.data keys: {list(request.data.keys())}")
        logger.info(f"[DreamImage] request.FILES keys: {list(request.FILES.keys())}")

        dream_id = request.data.get('dream')
        logger.info(f"[DreamImage] dream_id={dream_id}")

        if not dream_id:
            logger.warning("[DreamImage] dream 欄位缺失")
            return Response({"detail": "dream 欄位必填。"}, status=status.HTTP_400_BAD_REQUEST)

        # 檢查該夢境是否已有圖片（限制一張）
        existing = dream_image.objects.filter(dream_id=dream_id).first()
        if existing:
            logger.info(f"[DreamImage] 找到現有圖片 id={existing.id}，執行更新")
            # 更新現有圖片
            serializer = self.get_serializer(existing, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            logger.info(f"[DreamImage] 更新成功，圖片路徑={existing.image.name if existing.image else 'None'}")
            return Response(serializer.data)

        logger.info("[DreamImage] 建立新圖片記錄")
        response = super().create(request, *args, **kwargs)
        logger.info(f"[DreamImage] 建立成功，response status={response.status_code}")
        return response

    def perform_create(self, serializer):
        logger.info("[DreamImage] perform_create 被調用")
        instance = serializer.save()
        logger.info(f"[DreamImage] 圖片已儲存，id={instance.id}, path={instance.image.name if instance.image else 'None'}")
        logger.info(f"[DreamImage] MEDIA_ROOT={settings.MEDIA_ROOT if hasattr(settings, 'MEDIA_ROOT') else 'Not set'}")

    def perform_update(self, serializer):
        logger.info("[DreamImage] perform_update 被調用")
        instance = serializer.save()
        logger.info(f"[DreamImage] 圖片已更新，id={instance.id}, path={instance.image.name if instance.image else 'None'}")

