from django.contrib import admin

from .models import HotspotSession


@admin.register(HotspotSession)
class HotspotSessionAdmin(admin.ModelAdmin):
    list_display = ["user", "package", "started_at", "expires_at"]
    search_fields = ["user__phone"]
