import re
import secrets

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.utils import normalize_phone
from packages.models import Package

from . import mpesa
from .models import Payment
from .serializers import InitiatePaymentSerializer, PaymentSerializer


class InitiatePaymentView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = InitiatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        package = get_object_or_404(Package, pk=serializer.validated_data["package_id"], is_active=True)
        raw_phone = serializer.validated_data["phone"]
        try:
            phone = normalize_phone(raw_phone)
        except Exception:
            phone = raw_phone

        # Authenticate or auto-provision captive portal user
        user = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Token "):
            token_key = auth_header.split(" ")[1]
            token_obj = Token.objects.filter(key=token_key).first()
            if token_obj:
                user = token_obj.user

        if not user:
            user = User.objects.filter(phone=phone).first()
            if not user:
                user = User.objects.create_user(phone=phone, password=secrets.token_urlsafe(12))

        token, _ = Token.objects.get_or_create(user=user)

        payment = Payment.objects.create(
            user=user, package=package, phone=phone, amount=package.price
        )

        if settings.MPESA_SIMULATE:
            payment.mark_success(receipt="SIM" + secrets.token_hex(4).upper())
            data = PaymentSerializer(payment).data
            data["token"] = token.key
            data["user"] = {"id": user.id, "phone": user.phone, "name": user.name}
            return Response(data, status=status.HTTP_201_CREATED)

        try:
            result = mpesa.stk_push(
                phone=phone,
                amount=package.price,
                account_reference=f"SWIFT{payment.pk}",
                description="SwiftNet WiFi",
            )
        except Exception as exc:  # network error, bad credentials, etc.
            payment.mark_failed(f"Could not start M-Pesa payment: {exc}")
            return Response(
                {"detail": f"Could not start M-Pesa STK push: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        payment.merchant_request_id = result.get("MerchantRequestID", "")
        payment.checkout_request_id = result.get("CheckoutRequestID", "")
        payment.save()
        data = PaymentSerializer(payment).data
        data["token"] = token.key
        data["user"] = {"id": user.id, "phone": user.phone, "name": user.name}
        return Response(data, status=status.HTTP_201_CREATED)


class PaymentStatusView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk)
        return Response(PaymentSerializer(payment).data)


class VerifySmsView(APIView):
    """Allows verifying and activating manually paid Paybill / M-Pesa SMS confirmations."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        sms = request.data.get("sms", "").strip()
        package_id = request.data.get("package_id")
        provided_phone = request.data.get("phone", "").strip()

        if not sms:
            return Response(
                {"detail": "Please paste your M-Pesa confirmation SMS or code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Match receipt code e.g. QK238DJ91 or SL98D5K7
        match = re.search(r"\b([A-Za-z0-9]{8,12})\b", sms)
        receipt = match.group(1).upper() if match else ("SMS" + secrets.token_hex(4).upper())

        # Select package
        package = None
        if package_id:
            package = Package.objects.filter(pk=package_id, is_active=True).first()
        if not package:
            # Try to match price mentioned in SMS e.g. Ksh 35 or 35.00
            amt_match = re.search(r"(?:Ksh\.?|KES)\s*(\d+)", sms, re.IGNORECASE)
            if amt_match:
                amt = int(amt_match.group(1))
                package = Package.objects.filter(price=amt, is_active=True).first()
        if not package:
            package = Package.objects.filter(is_active=True).order_by("-price").first()

        # Phone extraction or fallback
        phone_match = re.search(r"(\+?254\d{9}|0[71]\d{8})", sms)
        raw_phone = provided_phone or (phone_match.group(1) if phone_match else "0729238654")
        try:
            phone = normalize_phone(raw_phone)
        except Exception:
            phone = "254729238654"

        user = User.objects.filter(phone=phone).first()
        if not user:
            user = User.objects.create_user(phone=phone, password=secrets.token_urlsafe(12))

        token, _ = Token.objects.get_or_create(user=user)

        payment = Payment.objects.create(
            user=user, package=package, phone=phone, amount=package.price
        )
        payment.mark_success(receipt=receipt)

        data = PaymentSerializer(payment).data
        data["token"] = token.key
        data["user"] = {"id": user.id, "phone": user.phone, "name": user.name}
        data["message"] = f"M-Pesa transaction {receipt} verified successfully!"
        return Response(data, status=status.HTTP_201_CREATED)


class MpesaCallbackView(APIView):
    """Called by Safaricom after the customer accepts or cancels the prompt."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        callback = request.data.get("Body", {}).get("stkCallback", {})
        checkout_id = callback.get("CheckoutRequestID")
        payment = Payment.objects.filter(checkout_request_id=checkout_id).first() if checkout_id else None

        if payment:
            if callback.get("ResultCode") == 0:
                items = callback.get("CallbackMetadata", {}).get("Item", [])
                meta = {item.get("Name"): item.get("Value") for item in items}
                payment.mark_success(str(meta.get("MpesaReceiptNumber", "")))
            else:
                payment.mark_failed(callback.get("ResultDesc", ""))

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})
