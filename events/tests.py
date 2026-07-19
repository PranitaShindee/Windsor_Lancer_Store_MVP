from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from datetime import timedelta

from .models import Category, Event, RSVP, Comment, UserProfile, FavoriteEvent, EventHistory


class HomePageTests(TestCase):
    def test_home_page_loads(self):
        response = self.client.get(reverse("events:home"))
        self.assertEqual(response.status_code, 200)


class ModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="student1", password="password123")
        self.user2 = User.objects.create_user(username="student2", password="password123")
        self.category = Category.objects.create(name="Academic", description="Academic events")

    def test_category_str(self):
        self.assertEqual(str(self.category), "Academic")

    def test_event_creation_and_slug(self):
        now = timezone.now()
        event = Event.objects.create(
            creator=self.user,
            category=self.category,
            title="UWindsor Welcome Session",
            organizer="UWindsor",
            description="Welcome to Windsor!",
            location="CAW Student Centre",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
            capacity=100
        )
        self.assertEqual(event.slug, "uwindsor-welcome-session")
        self.assertEqual(str(event), "UWindsor Welcome Session")

    def test_unique_slug_generation(self):
        now = timezone.now()
        event1 = Event.objects.create(
            creator=self.user,
            category=self.category,
            title="Overlap Title",
            organizer="UWindsor",
            description="First",
            location="Room 100",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2)
        )
        event2 = Event.objects.create(
            creator=self.user,
            category=self.category,
            title="Overlap Title",
            organizer="UWindsor",
            description="Second",
            location="Room 200",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2)
        )
        self.assertNotEqual(event1.slug, event2.slug)
        self.assertTrue(event2.slug.startswith("overlap-title-"))

    def test_invalid_event_date_range(self):
        now = timezone.now()
        event = Event(
            creator=self.user,
            category=self.category,
            title="Invalid Dates",
            organizer="UWindsor",
            description="End before start",
            location="Room 100",
            start_datetime=now + timedelta(days=2),
            end_datetime=now + timedelta(days=1)
        )
        with self.assertRaises(ValidationError):
            event.save()

    def test_invalid_capacity(self):
        now = timezone.now()
        event = Event(
            creator=self.user,
            category=self.category,
            title="Invalid Capacity",
            organizer="UWindsor",
            description="Negative capacity",
            location="Room 100",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
            capacity=0
        )
        with self.assertRaises(ValidationError):
            event.save()

    def test_rsvp_uniqueness_and_capacity_calculations(self):
        now = timezone.now()
        event = Event.objects.create(
            creator=self.user,
            category=self.category,
            title="Cap Test Event",
            organizer="UWindsor",
            description="Capacity and RSVP testing",
            location="Room 100",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
            capacity=2
        )
        
        # Test attendee count and available spots
        self.assertEqual(event.attendee_count, 0)
        self.assertEqual(event.available_spots, 2)
        
        # Add RSVPs
        rsvp1 = RSVP.objects.create(user=self.user, event=event, status=RSVP.Status.ATTENDING)
        self.assertEqual(event.attendee_count, 1)
        self.assertEqual(event.available_spots, 1)

        # Duplicate RSVP should fail unique constraint
        with self.assertRaises(Exception): # SQLite unique constraint or IntegrityError
            RSVP.objects.create(user=self.user, event=event, status=RSVP.Status.ATTENDING)

    def test_favorite_uniqueness(self):
        now = timezone.now()
        event = Event.objects.create(
            creator=self.user,
            category=self.category,
            title="Favorite Test",
            organizer="UWindsor",
            description="Fav testing",
            location="Room 100",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2)
        )
        
        FavoriteEvent.objects.create(user=self.user, event=event)
        
        # Duplicate favorite should fail unique constraint
        with self.assertRaises(Exception):
            FavoriteEvent.objects.create(user=self.user, event=event)


class AuthenticationTests(TestCase):
    def test_registration_success(self):
        response = self.client.post(reverse("events:register"), {
            "username": "newstudent",
            "first_name": "New",
            "last_name": "Student",
            "email": "newstudent@uwindsor.ca",
            "password1": "password123!",
            "password2": "password123!"
        })
        self.assertEqual(response.status_code, 302) # Redirects to dashboard
        self.assertTrue(User.objects.filter(username="newstudent").exists())
        # Check that profile is created automatically
        user = User.objects.get(username="newstudent")
        self.assertIsNotNone(user.profile)

    def test_duplicate_email_rejection(self):
        User.objects.create_user(username="student1", email="student1@uwindsor.ca", password="password123")
        response = self.client.post(reverse("events:register"), {
            "username": "student2",
            "first_name": "Student",
            "last_name": "Two",
            "email": "student1@uwindsor.ca",
            "password1": "password123!",
            "password2": "password123!"
        })
        self.assertEqual(response.status_code, 200) # Form page re-rendered
        self.assertFormError(response.context["form"], "email", "This email address is already registered.")

    def test_login_access_and_redirect(self):
        User.objects.create_user(username="student1", password="password123")
        response = self.client.post(reverse("events:login"), {
            "username": "student1",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 302)
        # Should redirect to the dashboard
        self.assertRedirects(response, reverse("events:dashboard"))

    def test_protected_page_redirect(self):
        # Accessing dashboard without logging in should redirect to login
        response = self.client.get(reverse("events:dashboard"))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse("events:login")))

    def test_logout_behaviour(self):
        User.objects.create_user(username="student1", password="password123")
        self.client.post(reverse("events:login"), {
            "username": "student1",
            "password": "password123"
        })
        response = self.client.post(reverse("events:logout"))
        self.assertEqual(response.status_code, 302)
        self.assertRedirects(response, reverse("events:home"))

    def test_password_reset_page_availability(self):
        response = self.client.get(reverse("events:password_reset"))
        self.assertEqual(response.status_code, 200)
        
        response = self.client.get(reverse("events:password_reset_done"))
        self.assertEqual(response.status_code, 200)


class EventCrudPermissionsTests(TestCase):
    def setUp(self):
        self.creator = User.objects.create_user(username="creator1", password="password123")
        self.other_user = User.objects.create_user(username="other1", password="password123")
        self.staff_user = User.objects.create_user(username="admin1", password="password123", is_staff=True)
        self.category = Category.objects.create(name="Academic")
        
        now = timezone.now()
        self.published_event = Event.objects.create(
            creator=self.creator,
            category=self.category,
            title="Published Event",
            organizer="UWindsor",
            description="Detail text",
            location="Room 100",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
            is_published=True
        )
        self.unpublished_event = Event.objects.create(
            creator=self.creator,
            category=self.category,
            title="Unpublished Event",
            organizer="UWindsor",
            description="Detail text",
            location="Room 100",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
            is_published=False
        )

    def test_guest_cannot_create_event(self):
        response = self.client.get(reverse("events:event_create"))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.url.startswith(reverse("events:login")))

    def test_registered_user_can_create_event(self):
        self.client.force_login(self.other_user)
        response = self.client.get(reverse("events:event_create"))
        self.assertEqual(response.status_code, 200)

        now = timezone.now()
        post_response = self.client.post(reverse("events:event_create"), {
            "category": self.category.id,
            "title": "New Created Event",
            "organizer": "Student Association",
            "description": "Fun activities",
            "location": "CAW",
            "start_datetime": (now + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M"),
            "end_datetime": (now + timedelta(days=2, hours=2)).strftime("%Y-%m-%dT%H:%M"),
            "capacity": 50,
            "is_published": True
        })
        self.assertEqual(post_response.status_code, 302)
        self.assertTrue(Event.objects.filter(title="New Created Event").exists())

    def test_creator_can_edit_event(self):
        self.client.force_login(self.creator)
        response = self.client.get(reverse("events:event_update", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(response.status_code, 200)

        now = timezone.now()
        post_response = self.client.post(reverse("events:event_update", kwargs={"slug": self.published_event.slug}), {
            "category": self.category.id,
            "title": "Updated Title By Creator",
            "organizer": "UWindsor",
            "description": "Updated",
            "location": "Room 100",
            "start_datetime": (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M"),
            "end_datetime": (now + timedelta(days=1, hours=2)).strftime("%Y-%m-%dT%H:%M"),
            "is_published": True
        })
        self.assertEqual(post_response.status_code, 302)
        self.published_event.refresh_from_db()
        self.assertEqual(self.published_event.title, "Updated Title By Creator")

    def test_other_user_cannot_edit_event(self):
        self.client.force_login(self.other_user)
        response = self.client.get(reverse("events:event_update", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(response.status_code, 403) # Forbidden by EventOwnerMixin

    def test_creator_can_delete_event(self):
        self.client.force_login(self.creator)
        response = self.client.get(reverse("events:event_delete", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(response.status_code, 200)

        post_response = self.client.post(reverse("events:event_delete", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(post_response.status_code, 302)
        self.assertFalse(Event.objects.filter(id=self.published_event.id).exists())

    def test_other_user_cannot_delete_event(self):
        self.client.force_login(self.other_user)
        response = self.client.post(reverse("events:event_delete", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(response.status_code, 403)

    def test_staff_can_edit_and_delete_any_event(self):
        self.client.force_login(self.staff_user)
        
        # Staff can edit
        response = self.client.get(reverse("events:event_update", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(response.status_code, 200)

        # Staff can delete
        post_response = self.client.post(reverse("events:event_delete", kwargs={"slug": self.published_event.slug}))
        self.assertEqual(post_response.status_code, 302)
        self.assertFalse(Event.objects.filter(id=self.published_event.id).exists())

    def test_unpublished_event_visibility(self):
        # Guest cannot see
        response = self.client.get(reverse("events:event_detail", kwargs={"slug": self.unpublished_event.slug}))
        self.assertEqual(response.status_code, 404)

        # Another registered user cannot see
        self.client.force_login(self.other_user)
        response = self.client.get(reverse("events:event_detail", kwargs={"slug": self.unpublished_event.slug}))
        self.assertEqual(response.status_code, 404)

        # Creator can see
        self.client.force_login(self.creator)
        response = self.client.get(reverse("events:event_detail", kwargs={"slug": self.unpublished_event.slug}))
        self.assertEqual(response.status_code, 200)

        # Staff can see
        self.client.force_login(self.staff_user)
        response = self.client.get(reverse("events:event_detail", kwargs={"slug": self.unpublished_event.slug}))
        self.assertEqual(response.status_code, 200)


class SearchFilterTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="searchuser", password="password123")
        self.academic = Category.objects.create(name="Academic")
        self.career = Category.objects.create(name="Career")
        now = timezone.now()
        Event.objects.create(
            creator=self.user,
            category=self.academic,
            title="Python Workshop",
            organizer="CS Department",
            description="Learn Python basics",
            location="Room 101",
            start_datetime=now + timedelta(days=3),
            end_datetime=now + timedelta(days=3, hours=2),
        )
        Event.objects.create(
            creator=self.user,
            category=self.career,
            title="Career Fair",
            organizer="Co-op Office",
            description="Meet employers",
            location="CAW Centre",
            start_datetime=now + timedelta(days=5),
            end_datetime=now + timedelta(days=5, hours=3),
        )

    def test_search_by_title(self):
        response = self.client.get(reverse("events:event_list"), {"q": "Python", "date": "all"})
        self.assertContains(response, "Python Workshop")
        self.assertNotContains(response, "Career Fair")

    def test_search_by_organizer_case_insensitive(self):
        response = self.client.get(reverse("events:event_list"), {"q": "co-op", "date": "all"})
        self.assertContains(response, "Career Fair")

    def test_category_filter(self):
        response = self.client.get(reverse("events:event_list"), {"category": self.academic.id, "date": "all"})
        self.assertContains(response, "Python Workshop")
        self.assertNotContains(response, "Career Fair")

    def test_combined_keyword_and_category_filter(self):
        response = self.client.get(
            reverse("events:event_list"),
            {"q": "Workshop", "category": self.academic.id, "date": "all"},
        )
        self.assertContains(response, "Python Workshop")
        self.assertNotContains(response, "Career Fair")

    def test_empty_search_returns_events(self):
        response = self.client.get(reverse("events:event_list"), {"date": "all"})
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Python Workshop")
        self.assertContains(response, "Career Fair")

    def test_no_results_state(self):
        response = self.client.get(reverse("events:event_list"), {"q": "nonexistentxyz", "date": "all"})
        self.assertContains(response, "No events found")


class InteractionTests(TestCase):
    def setUp(self):
        self.creator = User.objects.create_user(username="creator", password="password123")
        self.member = User.objects.create_user(username="member", password="password123")
        self.other = User.objects.create_user(username="other", password="password123")
        self.staff = User.objects.create_user(username="staff", password="password123", is_staff=True)
        self.category = Category.objects.create(name="Social")
        now = timezone.now()
        self.event = Event.objects.create(
            creator=self.creator,
            category=self.category,
            title="Club Social Night",
            organizer="Student Club",
            description="Fun evening",
            location="CAW",
            start_datetime=now + timedelta(days=2),
            end_datetime=now + timedelta(days=2, hours=2),
            capacity=1,
        )
        self.past_event = Event.objects.create(
            creator=self.creator,
            category=self.category,
            title="Past Meetup",
            organizer="Student Club",
            description="Already happened",
            location="CAW",
            start_datetime=now - timedelta(days=2),
            end_datetime=now - timedelta(days=1),
        )

    def test_rsvp_requires_login(self):
        response = self.client.post(reverse("events:toggle_rsvp", kwargs={"slug": self.event.slug}))
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response.url)

    def test_successful_rsvp(self):
        self.client.force_login(self.member)
        response = self.client.post(reverse("events:toggle_rsvp", kwargs={"slug": self.event.slug}))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            RSVP.objects.filter(user=self.member, event=self.event, status=RSVP.Status.ATTENDING).exists()
        )

    def test_duplicate_rsvp_prevented_via_toggle(self):
        self.client.force_login(self.member)
        self.client.post(reverse("events:toggle_rsvp", kwargs={"slug": self.event.slug}))
        self.client.post(reverse("events:toggle_rsvp", kwargs={"slug": self.event.slug}))
        self.assertEqual(RSVP.objects.filter(user=self.member, event=self.event).count(), 1)
        self.assertEqual(
            RSVP.objects.get(user=self.member, event=self.event).status,
            RSVP.Status.CANCELLED,
        )

    def test_full_event_rejected(self):
        RSVP.objects.create(user=self.creator, event=self.event, status=RSVP.Status.ATTENDING)
        self.client.force_login(self.member)
        response = self.client.post(reverse("events:toggle_rsvp", kwargs={"slug": self.event.slug}))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(
            RSVP.objects.filter(user=self.member, event=self.event, status=RSVP.Status.ATTENDING).exists()
        )

    def test_past_event_rsvp_rejected(self):
        self.client.force_login(self.member)
        response = self.client.post(reverse("events:toggle_rsvp", kwargs={"slug": self.past_event.slug}))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(RSVP.objects.filter(user=self.member, event=self.past_event).exists())

    def test_add_and_remove_favorite(self):
        self.client.force_login(self.member)
        add = self.client.post(reverse("events:toggle_favorite", kwargs={"slug": self.event.slug}))
        self.assertEqual(add.status_code, 302)
        self.assertTrue(FavoriteEvent.objects.filter(user=self.member, event=self.event).exists())
        remove = self.client.post(reverse("events:toggle_favorite", kwargs={"slug": self.event.slug}))
        self.assertEqual(remove.status_code, 302)
        self.assertFalse(FavoriteEvent.objects.filter(user=self.member, event=self.event).exists())

    def test_favorite_user_isolation(self):
        FavoriteEvent.objects.create(user=self.member, event=self.event)
        self.client.force_login(self.other)
        response = self.client.post(reverse("events:toggle_favorite", kwargs={"slug": self.event.slug}))
        self.assertEqual(response.status_code, 302)
        self.assertTrue(FavoriteEvent.objects.filter(user=self.member, event=self.event).exists())
        self.assertTrue(FavoriteEvent.objects.filter(user=self.other, event=self.event).exists())

    def test_registered_user_adds_comment(self):
        self.client.force_login(self.member)
        response = self.client.post(
            reverse("events:add_comment", kwargs={"slug": self.event.slug}),
            {"body": "Looking forward to this event!"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Comment.objects.filter(author=self.member, event=self.event).exists())

    def test_guest_cannot_comment(self):
        response = self.client.post(
            reverse("events:add_comment", kwargs={"slug": self.event.slug}),
            {"body": "Guest comment"},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response.url)

    def test_blank_comment_rejected(self):
        self.client.force_login(self.member)
        response = self.client.post(
            reverse("events:add_comment", kwargs={"slug": self.event.slug}),
            {"body": "   "},
        )
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Comment.objects.filter(author=self.member, event=self.event).exists())

    def test_owner_deletes_comment(self):
        comment = Comment.objects.create(event=self.event, author=self.member, body="Test comment")
        self.client.force_login(self.member)
        response = self.client.post(reverse("events:delete_comment", kwargs={"pk": comment.pk}))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Comment.objects.filter(pk=comment.pk).exists())

    def test_other_user_cannot_delete_comment(self):
        comment = Comment.objects.create(event=self.event, author=self.member, body="Test comment")
        self.client.force_login(self.other)
        response = self.client.post(reverse("events:delete_comment", kwargs={"pk": comment.pk}))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Comment.objects.filter(pk=comment.pk).exists())

    def test_staff_can_delete_comment(self):
        comment = Comment.objects.create(event=self.event, author=self.member, body="Test comment")
        self.client.force_login(self.staff)
        response = self.client.post(reverse("events:delete_comment", kwargs={"pk": comment.pk}))
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Comment.objects.filter(pk=comment.pk).exists())


class SessionCookieTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="historyuser", password="password123")
        self.category = Category.objects.create(name="Wellness")
        now = timezone.now()
        self.event = Event.objects.create(
            creator=self.user,
            category=self.category,
            title="Yoga Session",
            organizer="Rec Centre",
            description="Morning yoga",
            location="Gym",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=1),
        )

    def test_visit_counter_increments(self):
        self.client.get(reverse("events:home"))
        session = self.client.session
        self.assertEqual(session.get("total_visits"), 1)
        self.client.get(reverse("events:about"))
        session = self.client.session
        self.assertEqual(session.get("total_visits"), 2)

    def test_recently_viewed_updates(self):
        self.client.get(reverse("events:event_detail", kwargs={"slug": self.event.slug}))
        session = self.client.session
        self.assertIn(self.event.id, session.get("recently_viewed_event_ids", []))

    def test_preferred_category_cookie_set(self):
        response = self.client.get(
            reverse("events:event_list"),
            {"category": str(self.category.id), "date": "all"},
        )
        self.assertIn("campusconnect_preferred_category", response.cookies)

    def test_history_clearing_affects_only_current_user(self):
        other = User.objects.create_user(username="otherhist", password="password123")
        EventHistory.objects.create(user=self.user, event=self.event, session_key="abc")
        EventHistory.objects.create(user=other, event=self.event, session_key="def")
        self.client.force_login(self.user)
        response = self.client.post(reverse("events:clear_history"))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(EventHistory.objects.filter(user=self.user).count(), 0)
        self.assertEqual(EventHistory.objects.filter(user=other).count(), 1)


class StaticPageTests(TestCase):
    def test_event_list_returns_200(self):
        self.assertEqual(self.client.get(reverse("events:event_list")).status_code, 200)

    def test_event_detail_returns_200(self):
        user = User.objects.create_user(username="guestview", password="password123")
        category = Category.objects.create(name="Tech")
        now = timezone.now()
        event = Event.objects.create(
            creator=user,
            category=category,
            title="Tech Talk",
            organizer="IEEE",
            description="Talk",
            location="Room 200",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=1),
        )
        self.assertEqual(
            self.client.get(reverse("events:event_detail", kwargs={"slug": event.slug})).status_code,
            200,
        )

    def test_dashboard_requires_login(self):
        self.assertEqual(self.client.get(reverse("events:dashboard")).status_code, 302)

    def test_about_contact_terms_return_200(self):
        for name in ("about", "contact", "terms"):
            self.assertEqual(self.client.get(reverse(f"events:{name}")).status_code, 200)

    def test_custom_404_page(self):
        response = self.client.get("/events/does-not-exist-slug/")
        self.assertEqual(response.status_code, 404)


class UploadTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="uploader", password="password123")
        self.category = Category.objects.create(name="Cultural")

    def _make_test_image(self, name="poster.png"):
        from io import BytesIO
        from PIL import Image

        buffer = BytesIO()
        Image.new("RGB", (10, 10), color=(30, 41, 75)).save(buffer, format="PNG")
        buffer.seek(0)
        return SimpleUploadedFile(name, buffer.read(), content_type="image/png")

    def test_valid_image_accepted(self):
        self.client.force_login(self.user)
        now = timezone.now()
        image = self._make_test_image("poster.png")
        response = self.client.post(
            reverse("events:event_create"),
            {
                "category": self.category.id,
                "title": "Uploaded Poster Event",
                "organizer": "Arts Club",
                "description": "Cultural night",
                "location": "Hall A",
                "start_datetime": (now + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M"),
                "end_datetime": (now + timedelta(days=2, hours=2)).strftime("%Y-%m-%dT%H:%M"),
                "is_published": True,
                "poster": image,
            },
        )
        self.assertEqual(response.status_code, 302)
        event = Event.objects.get(title="Uploaded Poster Event")
        self.assertTrue(event.poster.name)

    def test_invalid_extension_rejected(self):
        self.client.force_login(self.user)
        now = timezone.now()
        bad_file = SimpleUploadedFile("poster.gif", b"fake", content_type="image/gif")
        response = self.client.post(
            reverse("events:event_create"),
            {
                "category": self.category.id,
                "title": "Bad Upload Event",
                "organizer": "Arts Club",
                "description": "Cultural night",
                "location": "Hall A",
                "start_datetime": (now + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M"),
                "end_datetime": (now + timedelta(days=2, hours=2)).strftime("%Y-%m-%dT%H:%M"),
                "is_published": True,
                "poster": bad_file,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Event.objects.filter(title="Bad Upload Event").exists())

    def test_missing_image_does_not_break_detail_page(self):
        user = User.objects.create_user(username="noposter", password="password123")
        category = Category.objects.create(name="Sports")
        now = timezone.now()
        event = Event.objects.create(
            creator=user,
            category=category,
            title="No Poster Event",
            organizer="Athletics",
            description="Game night",
            location="Field",
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=2),
        )
        response = self.client.get(reverse("events:event_detail", kwargs={"slug": event.slug}))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No Poster Event")

