from django.urls import path
from .views import BusinessListCreateView, BusinessDetailView, PublicBusinessView

urlpatterns = [
    path('businesses/', BusinessListCreateView.as_view()),
    # Helper: to edit, we need a way to identify. 
    # The list returns paths. The detail update uses path.
    path('businesses/<slug:path>/', BusinessDetailView.as_view()), 
    path('public/<slug:path>/', PublicBusinessView.as_view()),
]
