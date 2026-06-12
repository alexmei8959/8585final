import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.postgres.search import SearchVectorField
from Dreamstream.model_manager import UanModel, UanModelManager

# Create your models here.
User = get_user_model()


# 夢境檔
class dream(UanModel, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, help_text='uuid')
    create_date = models.DateTimeField(auto_now_add=True, verbose_name='建立日期', help_text='建立日期')
    create_user = models.CharField(max_length=50, null=False, verbose_name='建立者', help_text='建立者')
    last_modified_date = models.DateTimeField(auto_now=True, verbose_name='修改日期', help_text='修改日期')
    last_modified_user = models.CharField(max_length=50, null=False, verbose_name='修改者', help_text='修改者')

    title = models.CharField(max_length=120, verbose_name="標題", help_text="標題")
    parent = models.ForeignKey(
        "self", null=True, blank=True,
        related_name="children",
        on_delete=models.CASCADE,
        db_index=True,
    )
    is_folder = models.BooleanField(default=False, verbose_name="是否為主題", help_text="是否為主題")
    folder_enable = models.BooleanField(null=False, default=True, verbose_name='主題是否開放', help_text='主題是否開放')

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='dreams')
    dream_date = models.DateField(null=True, blank=True, verbose_name='做夢的日期', help_text='做夢的日期')
    dream_type = models.CharField(max_length=50, null=True, blank=True, verbose_name='類別', help_text='類別')
    dream_content = models.JSONField(null=True, blank=True, verbose_name='夢的內容', help_text='夢的內容')
    # search_vector = SearchVectorField(null=True)
    # dream_reviewer = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, verbose_name='審核者', help_text='審核者', related_name='dreams_reviewed')
    # dream_review_date = models.DateTimeField(null=True, blank=True, verbose_name='審核日期', help_text='審核日期')

    class Meta:
        verbose_name = '夢境檔'
        indexes = [
            models.Index(fields=['is_folder', 'folder_enable'], name='dream_folder_idx'),
            models.Index(fields=['is_folder', '-dream_date'], name='dream_date_idx'),
            models.Index(fields=['is_folder', '-create_date'], name='dream_create_idx'),
        ]

    objects = UanModelManager()


# 夢境回應檔
class dream_reply(UanModel, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, help_text='uuid')
    create_date = models.DateTimeField(auto_now_add=True, verbose_name='建立日期', help_text='建立日期')
    create_user = models.CharField(max_length=50, null=False, verbose_name='建立者', help_text='建立者')
    last_modified_date = models.DateTimeField(auto_now=True, verbose_name='修改日期', help_text='修改日期')
    last_modified_user = models.CharField(max_length=50, null=False, verbose_name='修改者', help_text='修改者')

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)
    dream = models.ForeignKey(dream, null=False, on_delete=models.CASCADE, related_name='replies')
    reply_date = models.DateTimeField(null=False, verbose_name='回應的日期', help_text='回應的日期')
    reply_content = models.JSONField(null=False, verbose_name='回應的內容', help_text='回應的內容')

    class Meta:
        verbose_name = '夢境回應檔'

    objects = UanModelManager()


# 夢境關注檔
class dream_follow(UanModel, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, help_text='uuid')
    create_date = models.DateTimeField(auto_now_add=True, verbose_name='建立日期', help_text='建立日期')
    create_user = models.CharField(max_length=50, null=False, verbose_name='建立者', help_text='建立者')
    last_modified_date = models.DateTimeField(auto_now=True, verbose_name='修改日期', help_text='修改日期')
    last_modified_user = models.CharField(max_length=50, null=False, verbose_name='修改者', help_text='修改者')

    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE)
    dream = models.ForeignKey(dream, null=False, on_delete=models.CASCADE, related_name='follows')

    class Meta:
        verbose_name = '夢境關注檔'
        constraints = [
            models.UniqueConstraint(fields=['user', 'dream'], name='unique_dream_follow')
        ]

    objects = UanModelManager()

# 定義夢境圖片上傳路徑
def dream_image_path(instance, filename):
    """
    文件將上傳到 MEDIA_ROOT/dreams/<dream_id>/<filename>
    instance: dream_vision 模型的一個實例
    filename: 用戶上傳的原始文件名
    """
    # 確保 instance.dream 不是 None 並且 instance.dream.id 存在
    if instance.dream and instance.dream.id:
        return f'dreams/{instance.dream.id}/{filename}'
    # 提供一個備用路徑，以防 dream 或 dream.id 不可用
    return f'dreams/unknown_dream/{filename}'


# 夢境圖片檔
class dream_image(UanModel, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, help_text='uuid')
    create_date = models.DateTimeField(auto_now_add=True, verbose_name='建立日期', help_text='建立日期')
    create_user = models.CharField(max_length=50, null=False, verbose_name='建立者', help_text='建立者')
    last_modified_date = models.DateTimeField(auto_now=True, verbose_name='修改日期', help_text='修改日期')
    last_modified_user = models.CharField(max_length=50, null=False, verbose_name='修改者', help_text='修改者')

    dream = models.ForeignKey(dream, null=False, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to=dream_image_path, null=True, blank=True, verbose_name='夢境圖片', help_text='夢境圖片')

    class Meta:
        verbose_name = '夢境圖片檔'

    objects = UanModelManager()


# 夢境標籤檔
class dream_hashtag(UanModel, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, help_text='uuid')
    create_date = models.DateTimeField(auto_now_add=True, verbose_name='建立日期', help_text='建立日期')
    create_user = models.CharField(max_length=50, null=False, verbose_name='建立者', help_text='建立者')
    last_modified_date = models.DateTimeField(auto_now=True, verbose_name='修改日期', help_text='修改日期')
    last_modified_user = models.CharField(max_length=50, null=False, verbose_name='修改者', help_text='修改者')

    dream = models.ForeignKey(dream, null=False, on_delete=models.CASCADE, related_name='hashtags')
    hashtag = models.CharField(max_length=50, null=False, verbose_name='標籤', help_text='標籤')

    class Meta:
        verbose_name = '夢境標籤檔'
        constraints = [
            models.UniqueConstraint(fields=['dream', 'hashtag'], name='unique_dream_hashtag')
        ]
        indexes = [
            models.Index(fields=['hashtag']),
        ]

    objects = UanModelManager()

