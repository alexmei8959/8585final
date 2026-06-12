from django.contrib import admin
from .models import Ithelp, IthelpFile


class IthelpFileInline(admin.TabularInline):
    model = IthelpFile
    extra = 0


@admin.register(Ithelp)
class IthelpAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "username",
        "status",
        "handler_name",
        "location",
        "created_at",
    )
    list_filter = ("status", "location")
    search_fields = ("username", "description", "handler_name")
    inlines = [IthelpFileInline]
