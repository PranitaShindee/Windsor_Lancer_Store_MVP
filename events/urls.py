from django.contrib.auth import views as auth_views
from django.urls import path, reverse_lazy

from . import views

app_name = "events"

urlpatterns = [
    path("", views.HomeView.as_view(), name="home"),
    path("events/", views.EventListView.as_view(), name="event_list"),
    path("events/create/", views.EventCreateView.as_view(), name="event_create"),
    path("events/<slug:slug>/", views.EventDetailView.as_view(), name="event_detail"),
    path("events/<slug:slug>/edit/", views.EventUpdateView.as_view(), name="event_update"),
    path("events/<slug:slug>/delete/", views.EventDeleteView.as_view(), name="event_delete"),
    path("events/<slug:slug>/rsvp/", views.toggle_rsvp, name="toggle_rsvp"),
    path("events/<slug:slug>/favorite/", views.toggle_favorite, name="toggle_favorite"),
    path("events/<slug:slug>/comments/add/", views.add_comment, name="add_comment"),
    path("comments/<int:pk>/delete/", views.delete_comment, name="delete_comment"),
    path("dashboard/", views.dashboard_view, name="dashboard"),
    path("favorites/", views.favorites_view, name="favorites"),
    path("history/", views.history_view, name="history"),
    path("history/clear/", views.clear_history_view, name="clear_history"),
    path("profile/", views.profile_view, name="profile"),
    path("profile/edit/", views.profile_update_view, name="profile_edit"),
    path("about/", views.AboutView.as_view(), name="about"),
    path("contact/", views.ContactView.as_view(), name="contact"),
    path("terms/", views.TermsView.as_view(), name="terms"),
    path("register/", views.register_view, name="register"),
    path(
        "accounts/login/",
        auth_views.LoginView.as_view(template_name="registration/login.html", redirect_authenticated_user=True),
        name="login",
    ),
    path("accounts/logout/", auth_views.LogoutView.as_view(next_page=reverse_lazy("events:home")), name="logout"),
    path("accounts/password_reset/", auth_views.PasswordResetView.as_view(template_name="registration/password_reset_form.html"), name="password_reset"),
    path("accounts/password_reset/done/", auth_views.PasswordResetDoneView.as_view(template_name="registration/password_reset_done.html"), name="password_reset_done"),
    path(
        "accounts/reset/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(template_name="registration/password_reset_confirm.html"),
        name="password_reset_confirm",
    ),
    path("accounts/reset/done/", auth_views.PasswordResetCompleteView.as_view(template_name="registration/password_reset_complete.html"), name="password_reset_complete"),
]
