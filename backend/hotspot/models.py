from django.conf import settings
from django.db import models
from django.utils import timezone


class HotspotSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sessions")
    package = models.ForeignKey("packages.Package", on_delete=models.PROTECT)
    payment = models.OneToOneField("payments.Payment", on_delete=models.CASCADE, related_name="session")
    mac_address = models.CharField(max_length=17, blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-started_at"]

    @property
    def is_active(self):
        return self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.user} until {self.expires_at:%Y-%m-%d %H:%M}"
