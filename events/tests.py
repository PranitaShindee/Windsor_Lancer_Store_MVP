from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
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
        self.assertFormError(response, "form", "email", "This email address is already registered.")

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



