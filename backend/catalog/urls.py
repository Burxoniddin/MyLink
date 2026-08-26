from django.urls import path

from . import views

# Collection routes are catalog-id scoped (``catalogs/<pk>/...``); detail routes
# are flat by child pk (``catalog/...``) — mirrors the sections/blocks
# convention in businesses/urls.py. Reorder routes sit above their siblings.
urlpatterns = [
    path('catalogs/', views.CatalogListCreateView.as_view(), name='catalog-list'),
    path('catalogs/<int:pk>/categories/reorder/', views.CategoryReorderView.as_view()),
    path('catalogs/<int:pk>/categories/', views.CategoryListCreateView.as_view()),
    path('catalogs/<int:pk>/items/reorder/', views.ItemReorderView.as_view()),
    path('catalogs/<int:pk>/items/', views.ItemCreateView.as_view()),
    path('catalogs/<int:pk>/qr.png', views.CatalogQrView.as_view()),
    path('catalogs/<int:pk>/', views.CatalogDetailView.as_view()),
    path('catalog/categories/<int:pk>/', views.CategoryDetailView.as_view()),
    path('catalog/items/<int:pk>/images/reorder/', views.ItemImageReorderView.as_view()),
    path('catalog/items/<int:pk>/images/', views.ItemImageCreateView.as_view()),
    path('catalog/items/<int:pk>/', views.ItemDetailView.as_view()),
    path('catalog/images/<int:pk>/', views.ItemImageDeleteView.as_view()),
    # Public web-menu (AllowAny). Django paths are end-anchored, so this never
    # collides with businesses' ``public/<slug:path>/``.
    path('public/<slug:path>/catalog/', views.PublicCatalogView.as_view()),
]
