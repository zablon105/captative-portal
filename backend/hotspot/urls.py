from django.urls import path

from .views import (
    CurrentSessionView,
    QuickReconnectView,
    SmartTvBindView,
    TroubleshootView,
    VoucherActivateView,
)

urlpatterns = [
    path("session/", CurrentSessionView.as_view()),
    path("smart-tv/", SmartTvBindView.as_view()),
    path("voucher/", VoucherActivateView.as_view()),
    path("reconnect/", QuickReconnectView.as_view()),
    path("troubleshoot/", TroubleshootView.as_view()),
]
