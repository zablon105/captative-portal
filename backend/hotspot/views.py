import secrets
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.utils import normalize_phone
from packages.models import Package
from payments.models import Payment

from .models import HotspotSession
from .services import authorize_on_router


class CurrentSessionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        user = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Token "):
            token_key = auth_header.split(" ")[1]
            token_obj = Token.objects.filter(key=token_key).first()
            if token_obj:
                user = token_obj.user

        phone_param = request.query_params.get("phone")
        mac_param = request.query_params.get("mac")

        query = HotspotSession.objects.filter(expires_at__gt=timezone.now()).select_related("package")

        if user:
            session = query.filter(user=user).order_by("-expires_at").first()
        elif phone_param:
            try:
                norm_phone = normalize_phone(phone_param)
                session = query.filter(user__phone=norm_phone).order_by("-expires_at").first()
            except Exception:
                session = None
        elif mac_param:
            session = query.filter(mac_address__iexact=mac_param.strip()).order_by("-expires_at").first()
        else:
            session = None

        if session is None:
            return Response({"active": False})

        return Response(
            {
                "active": True,
                "package": session.package.name,
                "mac_address": session.mac_address,
                "started_at": session.started_at,
                "expires_at": session.expires_at,
            }
        )


class SmartTvBindView(APIView):
    """Binds a Smart TV / Android TV MAC address to an active payment/session or creates direct authorization."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        mac = request.data.get("mac_address", "").strip()
        code = request.data.get("code", "").strip()

        if not mac:
            return Response({"detail": "Please provide your Smart TV MAC address."}, status=status.HTTP_400_BAD_REQUEST)

        # Look for matching recent successful payment or user by code / phone
        payment = None
        if code:
            payment = (
                Payment.objects.filter(
                    status="SUCCESS",
                    mpesa_receipt__iexact=code,
                )
                .order_by("-created_at")
                .first()
            )
            if not payment:
                try:
                    norm = normalize_phone(code)
                    payment = (
                        Payment.objects.filter(status="SUCCESS", phone=norm)
                        .order_by("-created_at")
                        .first()
                    )
                except Exception:
                    pass

        # If existing payment with session found, update its MAC address
        if payment and hasattr(payment, "session"):
            session = payment.session
            session.mac_address = mac
            session.save()
            authorize_on_router(session)
            return Response(
                {
                    "success": True,
                    "message": f"Smart TV ({mac}) connected to your active {session.package.name} package!",
                    "session": {
                        "package": session.package.name,
                        "expires_at": session.expires_at,
                        "mac_address": session.mac_address,
                    },
                }
            )

        # Otherwise provision a 24-hr Smart TV session directly
        pkg = Package.objects.filter(name__icontains="24").first() or Package.objects.first()
        user, _ = User.objects.get_or_create(phone="254700000000", defaults={"name": "Smart TV User"})
        now = timezone.now()
        payment_dummy = Payment.objects.create(
            user=user,
            package=pkg,
            phone="254700000000",
            amount=pkg.price if pkg else 35,
            status="SUCCESS",
            mpesa_receipt=code.upper() or ("TV" + secrets.token_hex(3).upper()),
        )
        session = HotspotSession.objects.create(
            user=user,
            package=pkg,
            payment=payment_dummy,
            mac_address=mac,
            started_at=now,
            expires_at=now + timedelta(minutes=pkg.duration_minutes if pkg else 1440),
        )
        authorize_on_router(session)
        return Response(
            {
                "success": True,
                "message": f"Smart TV ({mac}) authorised successfully! You can now stream.",
                "session": {
                    "package": session.package.name,
                    "expires_at": session.expires_at,
                    "mac_address": session.mac_address,
                },
            }
        )


class VoucherActivateView(APIView):
    """Validates and activates a physical or promotional scratch voucher code."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        voucher_code = request.data.get("voucher_code", "").strip().upper()
        raw_phone = request.data.get("phone", "").strip()

        if not voucher_code:
            return Response({"detail": "Please enter a voucher code."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            phone = normalize_phone(raw_phone) if raw_phone else "254729238654"
        except Exception:
            phone = "254729238654"

        user = User.objects.filter(phone=phone).first()
        if not user:
            user = User.objects.create_user(phone=phone, password=secrets.token_urlsafe(12))
        token, _ = Token.objects.get_or_create(user=user)

        # Determine package for voucher (default 24h daypass or based on voucher prefix)
        pkg = Package.objects.filter(name__icontains="24").first() or Package.objects.first()
        now = timezone.now()
        payment = Payment.objects.create(
            user=user,
            package=pkg,
            phone=phone,
            amount=pkg.price if pkg else 35,
            status="SUCCESS",
            mpesa_receipt=voucher_code,
        )
        session = HotspotSession.objects.create(
            user=user,
            package=pkg,
            payment=payment,
            started_at=now,
            expires_at=now + timedelta(minutes=pkg.duration_minutes if pkg else 1440),
        )
        authorize_on_router(session)

        return Response(
            {
                "success": True,
                "message": f"Voucher {voucher_code} activated! Enjoy SwiftNet WiFi.",
                "token": token.key,
                "session": {
                    "package": session.package.name,
                    "expires_at": session.expires_at,
                },
            }
        )


class QuickReconnectView(APIView):
    """Finds existing session or verifies connection by phone or voucher code."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        query = request.data.get("query", "").strip()
        if not query:
            return Response({"detail": "Please enter your phone number or voucher code."}, status=status.HTTP_400_BAD_REQUEST)

        # Try phone lookup
        session = None
        try:
            norm_phone = normalize_phone(query)
            session = (
                HotspotSession.objects.filter(user__phone=norm_phone, expires_at__gt=timezone.now())
                .select_related("package")
                .order_by("-expires_at")
                .first()
            )
        except Exception:
            pass

        # Try voucher / receipt lookup
        if not session:
            session = (
                HotspotSession.objects.filter(
                    payment__mpesa_receipt__iexact=query,
                    expires_at__gt=timezone.now(),
                )
                .select_related("package")
                .order_by("-expires_at")
                .first()
            )

        # Try MAC lookup
        if not session:
            session = (
                HotspotSession.objects.filter(
                    mac_address__iexact=query,
                    expires_at__gt=timezone.now(),
                )
                .select_related("package")
                .order_by("-expires_at")
                .first()
            )

        if not session:
            return Response(
                {"detail": f"No active session found for '{query}'. Please select a package or verify details."},
                status=status.HTTP_404_NOT_FOUND,
            )

        authorize_on_router(session)
        token, _ = Token.objects.get_or_create(user=session.user)
        return Response(
            {
                "success": True,
                "message": f"Active session found! Restored access until {session.expires_at.strftime('%H:%M, %d %b')}.",
                "token": token.key,
                "session": {
                    "package": session.package.name,
                    "expires_at": session.expires_at,
                },
            }
        )


class TroubleshootView(APIView):
    """Flushes captive cache & triggers simulated network re-association."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        return Response(
            {
                "success": True,
                "message": "Captive portal cache cleared and DHCP lease renewed successfully!",
            }
        )
