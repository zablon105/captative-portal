from django.core.management.base import BaseCommand
from django.utils import timezone

from hotspot.models import HotspotSession
from hotspot.services import deauthorize_on_router


class Command(BaseCommand):
    help = "Disconnect expired hotspot sessions from the router"

    def handle(self, *args, **options):
        now = timezone.now()
        expired_sessions = HotspotSession.objects.filter(expires_at__lte=now)
        count = 0
        for session in expired_sessions:
            deauthorize_on_router(session)
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Cleaned up {count} expired session(s)."))
