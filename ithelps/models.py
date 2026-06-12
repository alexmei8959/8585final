from django.db import models
from django.utils import timezone

# 1. 建立一個軟刪除專用的管理器
class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        # 預設過濾掉 is_deleted=True 的資料
        return super().get_queryset().filter(is_deleted=False)


class Ithelp(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE, null=True, blank=True, verbose_name="使用者")
    username = models.CharField(max_length=255)
    description = models.TextField()
    STATUS_CHOICES = [
        ('待處理', '待處理'),
        ('處理中', '處理中'),
        ('已完成', '已完成'),
    ]
    status = models.CharField(
        max_length=50, 
        choices=STATUS_CHOICES, 
        default='待處理'
    )
    resolution_notes = models.TextField(blank=True, null=True)
    handler_name = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now_add=True, null=True)

    # 2. 新增軟刪除標記與時間
    is_deleted = models.BooleanField(default=False, verbose_name="是否已刪除")
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name="刪除時間")

    # 設定管理器
    objects = SoftDeleteManager()            # 預設管理器 (只抓沒刪除的)
    all_objects = models.Manager()           # 備用管理器 (抓全部，含已刪除)

    # 3. 改寫 delete 方法
    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()

    class Meta:
        managed = True  # ⭐ 不動既有資料表
        db_table = "ithelps"

    def __str__(self):
        return f"[{self.status}] {self.username}"


class IthelpFile(models.Model):
    ithelp = models.ForeignKey(
        Ithelp,
        on_delete=models.CASCADE,
        related_name="files",
    )
    file_path = models.FileField(upload_to='ithelp-files/', max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        managed = True
        db_table = "ithelp_files"

    def __str__(self):
        return self.file_path
