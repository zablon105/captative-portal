from django.urls import path

from .views import InitiatePaymentView, MpesaCallbackView, PaymentStatusView, VerifySmsView

urlpatterns = [
    path("initiate/", InitiatePaymentView.as_view()),
    path("callback/", MpesaCallbackView.as_view()),
    path("verify-sms/", VerifySmsView.as_view()),
    path("<int:pk>/status/", PaymentStatusView.as_view()),
]
