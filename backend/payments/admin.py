from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["id", "phone", "package", "amount", "status", "mpesa_receipt", "created_at"]
    list_filter = ["status"]
    search_fields = ["phone", "mpesa_receipt", "checkout_request_id"]
