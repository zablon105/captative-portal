from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from .models import Package
from .serializers import PackageSerializer


class PackageListView(ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    pagination_class = None
    serializer_class = PackageSerializer
    queryset = Package.objects.filter(is_active=True)
