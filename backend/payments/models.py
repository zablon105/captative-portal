from django.conf import settings
from django.db import models, transaction


class Payment(models.Model):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    STATUS_CHOICES = [(PENDING, "Pending"), (SUCCESS, "Success"), (FAILED, "Failed")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payments")
    package = models.ForeignKey("packages.Package", on_delete=models.PROTECT, related_name="payments")
    phone = models.CharField(max_length=15)
    amount = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    merchant_request_id = models.CharField(max_length=100, blank=True)
    checkout_request_id = models.CharField(max_length=100, blank=True, db_index=True)
    mpesa_receipt = models.CharField(max_length=50, blank=True)
    result_desc = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment #{self.pk} {self.phone} {self.status}"

    def mark_success(self, receipt=""):
        """Idempotent: safe if M-Pesa calls the callback more than once."""
        from hotspot.services import create_session_for_payment

        with transaction.atomic():
            payment = Payment.objects.select_for_update().get(pk=self.pk)
            if payment.status == self.SUCCESS:
                return
            payment.status = self.SUCCESS
            payment.mpesa_receipt = receipt
            payment.result_desc = "Payment received"
            payment.save()
            create_session_for_payment(payment)
        self.refresh_from_db()

    def mark_failed(self, reason=""):
        if self.status == self.PENDING:
            self.status = self.FAILED
            self.result_desc = (reason or "Payment failed")[:255]
            self.save()
