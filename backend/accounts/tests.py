from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework import status
from rest_framework.test import APITestCase
from io import StringIO

from decks.models import Deck, Review


User = get_user_model()


class AuthenticationTests(APITestCase):
    def test_signup_normalizes_email_and_returns_token(self):
        response = self.client.post("/api/auth/signup/", {
            "name": "Ada",
            "email": "  ADA@Example.COM ",
            "password": "correct-horse-battery-staple",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["token"])
        self.assertEqual(response.data["user"]["email"], "ada@example.com")
        self.assertTrue(User.objects.get(email="ada@example.com").check_password("correct-horse-battery-staple"))

    def test_login_ignores_a_stale_authorization_header(self):
        User.objects.create_user(name="Ada", email="ada@example.com", password="safe-password-123")
        self.client.credentials(HTTP_AUTHORIZATION="Token stale-token")

        response = self.client.post("/api/auth/login/", {
            "email": "ADA@example.com",
            "password": "safe-password-123",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["token"])

    def test_duplicate_email_is_rejected_case_insensitively(self):
        User.objects.create_user(name="Ada", email="ada@example.com", password="safe-password-123")

        response = self.client.post("/api/auth/signup/", {
            "name": "Ada Two",
            "email": "ADA@EXAMPLE.COM",
            "password": "another-safe-password",
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_superuser_flags_cannot_be_disabled(self):
        with self.assertRaisesMessage(ValueError, "is_staff=True"):
            User.objects.create_superuser(
                name="Admin",
                email="admin@example.com",
                password="safe-password-123",
                is_staff=False,
            )

    def test_demo_seed_creates_login_ready_history_and_resets_only_demo_user(self):
        other = User.objects.create_user(name="Existing Learner", email="existing@example.com", password="safe-password-123")
        Deck.objects.create(owner=other, title="Keep me")
        output = StringIO()

        call_command(
            "seed_demo_account",
            email="demo@cardsparks.app",
            password="SparkDemo!2026",
            name="Demo Learner",
            stdout=output,
        )

        demo = User.objects.get(email="demo@cardsparks.app")
        self.assertTrue(demo.check_password("SparkDemo!2026"))
        self.assertEqual(demo.decks.count(), 3)
        self.assertEqual(sum(deck.cards.count() for deck in demo.decks.all()), 16)
        self.assertGreater(Review.objects.filter(card__deck__owner=demo).count(), 0)
        self.assertEqual(demo.study_settings.max_reviews, 80)

        Deck.objects.create(owner=demo, title="Temporary judge edit")
        call_command(
            "seed_demo_account",
            email="demo@cardsparks.app",
            password="SparkDemo!2026",
            name="Demo Learner",
            stdout=StringIO(),
        )

        self.assertEqual(demo.decks.count(), 3)
        self.assertTrue(Deck.objects.filter(owner=other, title="Keep me").exists())

        response = self.client.post("/api/auth/login/", {
            "email": "demo@cardsparks.app",
            "password": "SparkDemo!2026",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
