from django.urls import path
from .views import (
    BusinessListCreateView,
    BusinessDetailView,
    BusinessToggleLockView,
    PublicBusinessView,
    PublicStatsView,
    PublicSettingsView,
    ContactCreateView,
    StaticPageView,
    BlogListView,
    BlogDetailView,
)

urlpatterns = [
    path('businesses/', BusinessListCreateView.as_view()),
    path('businesses/<slug:path>/lock/', BusinessToggleLockView.as_view()),
    path('businesses/<slug:path>/', BusinessDetailView.as_view()),
    path('contact/', ContactCreateView.as_view()),
    path('blog/', BlogListView.as_view()),
    path('blog/<slug:slug>/', BlogDetailView.as_view()),
    path('pages/<slug:slug>/', StaticPageView.as_view()),
    # public/stats and public/settings must precede public/<slug:path>/ so they
    # aren't captured as a business path.
    path('public/stats/', PublicStatsView.as_view()),
    path('public/settings/', PublicSettingsView.as_view()),
    path('public/<slug:path>/', PublicBusinessView.as_view()),
]
