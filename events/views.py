from datetime import timedelta

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.http import Http404, HttpResponseForbidden
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.views.generic import CreateView, DeleteView, DetailView, ListView, TemplateView, UpdateView

from .forms import CommentForm, ContactForm, EventForm, RegistrationForm, UserProfileForm
from .models import Category, Comment, Event, EventHistory, FavoriteEvent, RSVP
from .utils import ensure_user_profile, record_event_history, safe_redirect_target, set_response_cookies, update_recently_viewed, update_visit_session


class VisitTrackingMixin:
    def dispatch(self, request, *args, **kwargs):
        self.visit_data = None
        if request.method == "GET":
            self.visit_data = update_visit_session(request)
        return super().dispatch(request, *args, **kwargs)

    def apply_visit_cookies(self, response, preferred_category=None):
        if self.visit_data is not None:
            response = set_response_cookies(response, self.request, preferred_category=preferred_category)
        return response


class HomeView(VisitTrackingMixin, TemplateView):
    template_name = "events/home.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        now = timezone.now()
        context["featured_events"] = (
            Event.objects.select_related("category", "creator")
            .filter(is_published=True, start_datetime__gte=now)
            .order_by("start_datetime")[:6]
        )
        context["categories"] = Category.objects.all()[:6]
        context["home_search_action"] = reverse("events:event_list")
        context["total_categories"] = Category.objects.count()
        return context

    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        if request.GET.get("dismiss_welcome") == "1":
            response.set_cookie("campusconnect_welcome_dismissed", "1", max_age=60 * 60 * 24 * 30)
        return self.apply_visit_cookies(response)


class EventListView(VisitTrackingMixin, ListView):
    model = Event
    template_name = "events/event_list.html"
    context_object_name = "events"
    paginate_by = 9

    def get_queryset(self):
        now = timezone.now()
        queryset = Event.objects.select_related("category", "creator")
        if self.request.user.is_staff:
            pass
        elif self.request.user.is_authenticated:
            queryset = queryset.filter(Q(is_published=True) | Q(creator=self.request.user))
        else:
            queryset = queryset.filter(is_published=True)

        query = self.request.GET.get("q", "").strip()
        category_id = self.request.GET.get("category", "").strip()
        date_filter = self.request.GET.get("date", "upcoming").strip() or "upcoming"

        if query:
            queryset = queryset.filter(
                Q(title__icontains=query)
                | Q(organizer__icontains=query)
                | Q(description__icontains=query)
                | Q(location__icontains=query)
            )

        if category_id:
            queryset = queryset.filter(category_id=category_id)

        if date_filter == "upcoming":
            queryset = queryset.filter(end_datetime__gte=now)
        elif date_filter == "today":
            queryset = queryset.filter(start_datetime__date=timezone.localdate())
        elif date_filter == "this_week":
            start_of_week = timezone.localdate() - timedelta(days=timezone.localdate().weekday())
            end_of_week = start_of_week + timedelta(days=6)
            queryset = queryset.filter(start_datetime__date__range=(start_of_week, end_of_week))
        elif date_filter == "past":
            queryset = queryset.filter(end_datetime__lt=now)

        return queryset.distinct().order_by("start_datetime")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["categories"] = Category.objects.all()
        context["selected_category"] = self.request.GET.get("category", "")
        context["search_query"] = self.request.GET.get("q", "")
        context["date_filter"] = self.request.GET.get("date", "upcoming")
        context["clear_filters_url"] = reverse("events:event_list")
        return context

    def render_to_response(self, context, **response_kwargs):
        response = super().render_to_response(context, **response_kwargs)
        category_value = self.request.GET.get("category")
        if category_value:
            response = set_response_cookies(response, self.request, preferred_category=category_value)
        return self.apply_visit_cookies(response)


class EventDetailView(VisitTrackingMixin, DetailView):
    model = Event
    template_name = "events/event_detail.html"
    context_object_name = "event"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def get_queryset(self):
        queryset = Event.objects.select_related("creator", "category").prefetch_related("comments__author")
        if self.request.user.is_authenticated and self.request.user.is_staff:
            return queryset
        if self.request.user.is_authenticated:
            return queryset.filter(Q(is_published=True) | Q(creator=self.request.user))
        return queryset.filter(is_published=True)

    def get(self, request, *args, **kwargs):
        response = super().get(request, *args, **kwargs)
        event = self.object
        update_recently_viewed(request, event.id)
        record_event_history(request, event)
        return self.apply_visit_cookies(response)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        event = self.object
        context["comment_form"] = CommentForm()
        context["approved_comments"] = event.comments.filter(is_approved=True).select_related("author")
        if self.request.user.is_authenticated:
            context["is_favorited"] = FavoriteEvent.objects.filter(user=self.request.user, event=event).exists()
            context["user_rsvp"] = RSVP.objects.filter(user=self.request.user, event=event).first()
            context["can_manage_event"] = self.request.user.is_staff or self.request.user == event.creator
        else:
            context["is_favorited"] = False
            context["user_rsvp"] = None
            context["can_manage_event"] = False
        context["recently_viewed_ids"] = self.request.session.get("recently_viewed_event_ids", [])
        return context


class EventCreateView(LoginRequiredMixin, CreateView):
    model = Event
    form_class = EventForm
    template_name = "events/event_form.html"

    def form_valid(self, form):
        form.instance.creator = self.request.user
        messages.success(self.request, "Event created successfully.")
        return super().form_valid(form)


class EventOwnerMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        event = self.get_object()
        return self.request.user.is_staff or event.creator == self.request.user


class EventUpdateView(EventOwnerMixin, UpdateView):
    model = Event
    form_class = EventForm
    template_name = "events/event_form.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"

    def form_valid(self, form):
        messages.success(self.request, "Event updated successfully.")
        return super().form_valid(form)


class EventDeleteView(EventOwnerMixin, DeleteView):
    model = Event
    template_name = "events/event_confirm_delete.html"
    slug_field = "slug"
    slug_url_kwarg = "slug"
    success_url = reverse_lazy("events:event_list")

    def delete(self, request, *args, **kwargs):
        messages.success(request, "Event deleted successfully.")
        return super().delete(request, *args, **kwargs)


def register_view(request):
    if request.user.is_authenticated:
        return redirect("events:dashboard")
    form = RegistrationForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        with transaction.atomic():
            user = form.save()
            ensure_user_profile(user)
            login(request, user)
        messages.success(request, "Registration successful. Welcome to CampusConnect.")
        return redirect("events:dashboard")
    return render(request, "registration/register.html", {"form": form})


@login_required
def dashboard_view(request):
    user = request.user
    profile = ensure_user_profile(user)
    created_events = Event.objects.filter(creator=user).select_related("category").order_by("start_datetime")
    active_rsvps = RSVP.objects.filter(user=user, status=RSVP.Status.ATTENDING).select_related("event", "event__category").order_by("event__start_datetime")
    favorite_events = Event.objects.filter(favorited_by__user=user).select_related("category").distinct().order_by("start_datetime")
    recent_history = EventHistory.objects.filter(user=user).select_related("event", "event__category")[:5]
    completed_fields = sum([bool(user.first_name), bool(user.last_name), bool(user.email), bool(profile.student_id), bool(profile.program), bool(profile.bio), bool(profile.profile_picture)])
    profile_completion = int((completed_fields / 7) * 100)
    staff_stats = None
    if user.is_staff:
        staff_stats = {
            "total_users": User.objects.count(),
            "total_published_events": Event.objects.filter(is_published=True).count(),
            "total_active_rsvps": RSVP.objects.filter(status=RSVP.Status.ATTENDING).count(),
            "total_comments": Comment.objects.count(),
        }
    return render(
        request,
        "events/dashboard.html",
        {
            "created_events": created_events,
            "active_rsvps": active_rsvps,
            "favorite_events": favorite_events,
            "recent_history": recent_history,
            "profile": profile,
            "profile_completion": profile_completion,
            "summary": {
                "created_count": created_events.count(),
                "rsvp_count": active_rsvps.count(),
                "favorite_count": favorite_events.count(),
                "recent_count": recent_history.count(),
            },
            "staff_stats": staff_stats,
        },
    )


@login_required
def profile_view(request):
    profile = ensure_user_profile(request.user)
    return render(request, "events/profile.html", {"profile": profile})


@login_required
def profile_update_view(request):
    profile = ensure_user_profile(request.user)
    form = UserProfileForm(request.POST or None, request.FILES or None, instance=profile, user=request.user)
    if request.method == "POST" and form.is_valid():
        with transaction.atomic():
            form.save()
        messages.success(request, "Profile updated successfully.")
        return redirect("events:profile")
    return render(request, "events/profile_form.html", {"form": form, "profile": profile})


@login_required
def toggle_rsvp(request, slug):
    if request.method != "POST":
        return HttpResponseForbidden("RSVP changes must use POST.")
    event = get_object_or_404(Event.objects.select_related("creator", "category"), slug=slug)
    if not event.is_published and not (request.user.is_staff or request.user == event.creator):
        raise Http404
    if event.is_past:
        messages.error(request, "This event has already ended.")
        return redirect(safe_redirect_target(request, event.get_absolute_url()))
    with transaction.atomic():
        rsvp = RSVP.objects.select_for_update().filter(user=request.user, event=event).first()
        if rsvp and rsvp.status == RSVP.Status.ATTENDING:
            rsvp.status = RSVP.Status.CANCELLED
            rsvp.save(update_fields=["status", "updated_at"])
            messages.success(request, "RSVP cancelled.")
        else:
            if event.capacity is not None and event.attendee_count >= event.capacity:
                messages.error(request, "This event is full.")
            else:
                if rsvp is None:
                    RSVP.objects.create(user=request.user, event=event, status=RSVP.Status.ATTENDING)
                else:
                    rsvp.status = RSVP.Status.ATTENDING
                    rsvp.save(update_fields=["status", "updated_at"])
                messages.success(request, "RSVP confirmed.")
    return redirect(safe_redirect_target(request, event.get_absolute_url()))


@login_required
def toggle_favorite(request, slug):
    if request.method != "POST":
        return HttpResponseForbidden("Favorites must use POST.")
    event = get_object_or_404(Event.objects.select_related("creator", "category"), slug=slug)
    favorite = FavoriteEvent.objects.filter(user=request.user, event=event).first()
    if favorite:
        favorite.delete()
        messages.success(request, "Removed from favorites.")
    else:
        FavoriteEvent.objects.create(user=request.user, event=event)
        messages.success(request, "Added to favorites.")
    return redirect(safe_redirect_target(request, event.get_absolute_url()))


@login_required
def add_comment(request, slug):
    if request.method != "POST":
        return HttpResponseForbidden("Comments must use POST.")
    event = get_object_or_404(Event.objects.select_related("creator", "category"), slug=slug)
    if not event.is_published and not (request.user.is_staff or request.user == event.creator):
        raise Http404
    form = CommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.event = event
        comment.author = request.user
        comment.save()
        messages.success(request, "Comment posted successfully.")
    else:
        messages.error(request, "Please correct the comment errors below.")
    return redirect(safe_redirect_target(request, event.get_absolute_url()))


@login_required
def delete_comment(request, pk):
    if request.method != "POST":
        return HttpResponseForbidden("Comment deletion must use POST.")
    comment = get_object_or_404(Comment.objects.select_related("event", "author"), pk=pk)
    if not (request.user.is_staff or comment.author == request.user):
        return HttpResponseForbidden("You cannot delete this comment.")
    event_url = comment.event.get_absolute_url()
    comment.delete()
    messages.success(request, "Comment deleted successfully.")
    return redirect(safe_redirect_target(request, event_url))


@login_required
def favorites_view(request):
    favorites = Event.objects.filter(favorited_by__user=request.user).select_related("category", "creator").distinct().order_by("start_datetime")
    return render(request, "events/favorites.html", {"favorites": favorites})


@login_required
def history_view(request):
    profile = ensure_user_profile(request.user)
    recent_ids = request.session.get("recently_viewed_event_ids", [])
    recent_events = list(Event.objects.filter(id__in=recent_ids).select_related("category", "creator"))
    recent_events.sort(key=lambda event: recent_ids.index(event.id))
    db_history = EventHistory.objects.filter(user=request.user).select_related("event", "event__category")[:10]
    rsvp_history = RSVP.objects.filter(user=request.user).select_related("event", "event__category").order_by("-updated_at")
    created_events = Event.objects.filter(creator=request.user).select_related("category").order_by("start_datetime")
    favorite_events = Event.objects.filter(favorited_by__user=request.user).select_related("category").distinct()
    return render(
        request,
        "events/history.html",
        {
            "profile": profile,
            "session_total_visits": request.session.get("total_visits", 0),
            "session_daily_visits": request.session.get("daily_visits", 0),
            "session_last_visit_date": request.session.get("last_visit_date", ""),
            "recent_events": recent_events,
            "db_history": db_history,
            "rsvp_history": rsvp_history,
            "created_events": created_events,
            "favorite_events": favorite_events,
        },
    )


@login_required
def clear_history_view(request):
    if request.method != "POST":
        return HttpResponseForbidden("History clearing must use POST.")
    EventHistory.objects.filter(user=request.user).delete()
    request.session.pop("recently_viewed_event_ids", None)
    messages.success(request, "Your browsing history was cleared.")
    return redirect("events:history")


class AboutView(VisitTrackingMixin, TemplateView):
    template_name = "events/about.html"

    def render_to_response(self, context, **response_kwargs):
        return self.apply_visit_cookies(super().render_to_response(context, **response_kwargs))


class ContactView(VisitTrackingMixin, TemplateView):
    template_name = "events/contact.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["form"] = kwargs.get("form") or ContactForm()
        return context

    def post(self, request, *args, **kwargs):
        form = ContactForm(request.POST)
        if form.is_valid():
            send_mail(
                subject=form.cleaned_data["subject"],
                message=f"From: {form.cleaned_data['name']} <{form.cleaned_data['email']}>\n\n{form.cleaned_data['message']}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.DEFAULT_FROM_EMAIL],
                fail_silently=False,
            )
            return render(request, "events/contact_success.html")
        return render(request, self.template_name, {"form": form})

    def render_to_response(self, context, **response_kwargs):
        return self.apply_visit_cookies(super().render_to_response(context, **response_kwargs))


class TermsView(VisitTrackingMixin, TemplateView):
    template_name = "events/terms.html"

    def render_to_response(self, context, **response_kwargs):
        return self.apply_visit_cookies(super().render_to_response(context, **response_kwargs))


def custom_403(request, exception=None):
    return render(request, "403.html", status=403)


def custom_404(request, exception=None):
    return render(request, "404.html", status=404)


def custom_500(request):
    return render(request, "500.html", status=500)
