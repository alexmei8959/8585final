import uuid

from django.db import models

from Dreamstream.model_manager import UanModel


class form_template(UanModel, models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, help_text='uuid')
    create_date = models.DateTimeField(auto_now_add=True, verbose_name='建立日期', help_text='建立日期')
    create_user = models.CharField(max_length=50, null=False, verbose_name='建立者', help_text='建立者')
    last_modified_date = models.DateTimeField(auto_now=True, verbose_name='修改日期', help_text='修改日期')
    last_modified_user = models.CharField(max_length=50, null=False, verbose_name='修改者', help_text='修改者')

    name = models.CharField(max_length=100, verbose_name="模板名稱", help_text="模板名稱")
    json = models.JSONField(verbose_name="模板架構", help_text="模板架構")

    class Meta:
        verbose_name = '模板'

    def __str__(self):
        return self.name
