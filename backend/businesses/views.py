from rest_framework import generics, permissions
from .models import Business
from .serializers import BusinessSerializer
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user

class BusinessListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Business.objects.filter(owner=self.request.user)

class BusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Lookup by path or id? Usually ID for editing, PATH for public.
    # User can change path, so ID is safer for editing dashboard.
    queryset = Business.objects.all()
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    lookup_field = 'path' # Or 'pk' if frontend prefers. Let's use path for consistency with user request, but PK is better if path changes.
    # Let's support PK for editing to avoid issues if path updates. 
    # Actually, let's stick to 'path' but be careful. If path changes, URL changes.
    
    def get_queryset(self):
        return Business.objects.filter(owner=self.request.user)

class PublicBusinessView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, path):
        business = get_object_or_404(Business, path=path)
        serializer = BusinessSerializer(business)
        return Response(serializer.data)
