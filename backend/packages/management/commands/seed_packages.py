from django.core.management.base import BaseCommand

from packages.models import Package

SAMPLE_PACKAGES = [
    ("1 Hour Unlimited", "1 Hr Unlimited Highspeed", 5, 60),
    ("3 Hours Unlimited", "3 Hrs Unlimited Fast WiFi", 10, 180),
    ("6 Hours Unlimited", "6 Hrs Nonstop Streaming", 15, 360),
    ("12 Hours Unlimited", "12 Hrs Half-Day Pass", 20, 720),
    ("24 Hours Unlimited", "24 Hrs Unlimited Daypass", 35, 1440),
    ("7 Days Unlimited Superpass", "7 Days Weekly Unlimited", 150, 10080),
    ("30 Days Monthly Unlimited", "30 Days Unlimited High-Speed Connection", 500, 43200),
]


class Command(BaseCommand):
    help = "Create SwiftNet sample hotspot packages"

    def handle(self, *args, **options):
        # Update or create the SwiftNet packages
        created = 0
        updated = 0
        for name, description, price, minutes in SAMPLE_PACKAGES:
            pkg, was_created = Package.objects.update_or_create(
                name=name,
                defaults={"description": description, "price": price, "duration_minutes": minutes, "is_active": True},
            )
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Done. {created} package(s) created, {updated} updated."))
