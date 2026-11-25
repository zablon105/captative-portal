from rest_framework import serializers

from accounts.serializers import PhoneField

from .models import Payment


class InitiatePaymentSerializer(serializers.Serializer):
    package_id = serializers.IntegerField()
    phone = PhoneField()


class PaymentSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source="package.name", read_only=True)
    session = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "package_name",
            "amount",
            "phone",
            "status",
            "mpesa_receipt",
            "result_desc",
            "created_at",
            "session",
        ]

    def get_session(self, obj):
        session = getattr(obj, "session", None)
        if session is None:
            return None
        return {
            "started_at": session.started_at,
            "expires_at": session.expires_at,
        }
