import logging
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from .models import HotspotSession

logger = logging.getLogger(__name__)


def _mikrotik_base_url():
    scheme = "https" if getattr(settings, "MIKROTIK_USE_SSL", False) else "http"
    host = getattr(settings, "MIKROTIK_HOST", "127.0.0.1")
    port = getattr(settings, "MIKROTIK_PORT", 8088)
    return f"{scheme}://{host}:{port}/rest"


def _mikrotik_auth():
    return (
        getattr(settings, "MIKROTIK_USER", "admin"),
        getattr(settings, "MIKROTIK_PASSWORD", ""),
    )


def create_session_for_payment(payment, mac_address=""):
    """Create (or return) the access session for a successful payment."""
    existing = HotspotSession.objects.filter(payment=payment).first()
    if existing:
        if mac_address and not existing.mac_address:
            existing.mac_address = mac_address
            existing.save()
            authorize_on_router(existing)
        return existing

    now = timezone.now()
    session = HotspotSession.objects.create(
        user=payment.user,
        package=payment.package,
        payment=payment,
        mac_address=mac_address or "",
        started_at=now,
        expires_at=now + timedelta(minutes=payment.package.duration_minutes),
    )
    authorize_on_router(session)
    return session


def authorize_on_router(session):
    """
    Authorizes the device on MikroTik RouterOS (v7 REST API) or captive portal gateway.
    1. If MAC address is present, adds/updates IP binding with type='bypassed'.
    2. Provisions/updates hotspot user credentials with limit-uptime = package duration.
    """
    if getattr(settings, "ROUTER_TYPE", "mikrotik") != "mikrotik":
        return True

    base_url = _mikrotik_base_url()
    auth = _mikrotik_auth()

    # 1. Authorize by MAC address IP Binding if MAC is present
    if session.mac_address:
        try:
            # Check existing binding
            res = requests.get(
                f"{base_url}/ip/hotspot/ip-binding",
                params={"mac-address": session.mac_address},
                auth=auth,
                timeout=4,
            )
            existing = res.json() if res.status_code == 200 else []

            binding_data = {
                "mac-address": session.mac_address,
                "type": "bypassed",
                "comment": f"SwiftNet {session.package.name} | Phone: {session.user.phone} | Exp: {session.expires_at.strftime('%H:%M %d-%b')}",
            }

            if existing and len(existing) > 0:
                binding_id = existing[0].get(".id")
                requests.patch(
                    f"{base_url}/ip/hotspot/ip-binding/{binding_id}",
                    json=binding_data,
                    auth=auth,
                    timeout=4,
                )
            else:
                requests.put(
                    f"{base_url}/ip/hotspot/ip-binding",
                    json=binding_data,
                    auth=auth,
                    timeout=4,
                )
            logger.info("Successfully bound MAC %s on MikroTik", session.mac_address)
        except Exception as exc:
            logger.warning("Could not set IP binding on MikroTik: %s", exc)

    # 2. Provision Hotspot User on MikroTik
    try:
        user_data = {
            "name": session.user.phone,
            "password": session.user.phone,
            "limit-uptime": f"{session.package.duration_minutes}m",
            "comment": f"SwiftNet {session.package.name} until {session.expires_at.strftime('%Y-%m-%d %H:%M')}",
        }
        res = requests.get(
            f"{base_url}/ip/hotspot/user",
            params={"name": session.user.phone},
            auth=auth,
            timeout=4,
        )
        existing_user = res.json() if res.status_code == 200 else []
        if existing_user and len(existing_user) > 0:
            uid = existing_user[0].get(".id")
            requests.patch(
                f"{base_url}/ip/hotspot/user/{uid}",
                json=user_data,
                auth=auth,
                timeout=4,
            )
        else:
            requests.put(
                f"{base_url}/ip/hotspot/user",
                json=user_data,
                auth=auth,
                timeout=4,
            )
        logger.info("Successfully provisioned hotspot user %s on MikroTik", session.user.phone)
        return True
    except Exception as exc:
        logger.warning("Could not create hotspot user on MikroTik: %s", exc)
        return False


def deauthorize_on_router(session):
    """Removes authorized MAC binding and disconnects active user from MikroTik."""
    if getattr(settings, "ROUTER_TYPE", "mikrotik") != "mikrotik":
        return True

    base_url = _mikrotik_base_url()
    auth = _mikrotik_auth()

    # Remove MAC IP binding
    if session.mac_address:
        try:
            res = requests.get(
                f"{base_url}/ip/hotspot/ip-binding",
                params={"mac-address": session.mac_address},
                auth=auth,
                timeout=4,
            )
            if res.status_code == 200:
                for item in res.json():
                    requests.delete(
                        f"{base_url}/ip/hotspot/ip-binding/{item.get('.id')}",
                        auth=auth,
                        timeout=4,
                    )
        except Exception as exc:
            logger.warning("Error removing IP binding for %s: %s", session.mac_address, exc)

    # Disconnect active session
    try:
        res = requests.get(
            f"{base_url}/ip/hotspot/active",
            params={"user": session.user.phone},
            auth=auth,
            timeout=4,
        )
        if res.status_code == 200:
            for item in res.json():
                requests.delete(
                    f"{base_url}/ip/hotspot/active/{item.get('.id')}",
                    auth=auth,
                    timeout=4,
                )
    except Exception as exc:
        logger.warning("Error disconnecting active session for %s: %s", session.user.phone, exc)

    return True
