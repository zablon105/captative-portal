from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/accounts/", include("accounts.urls")),
    path("api/packages/", include("packages.urls")),
    path("api/payments/", include("payments.urls")),
    path("api/hotspot/", include("hotspot.urls")),
]
