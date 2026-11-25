from rest_framework import serializers

from .models import User
from .utils import normalize_phone


class PhoneField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        try:
            return normalize_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "phone", "name"]


class RegisterSerializer(serializers.Serializer):
    phone = PhoneField()
    name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_phone(self, value):
        if User.objects.filter(phone=value).exists():
            raise serializers.ValidationError("An account with this phone number already exists.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
            name=validated_data.get("name", ""),
        )


class LoginSerializer(serializers.Serializer):
    phone = PhoneField()
    password = serializers.CharField(write_only=True)
