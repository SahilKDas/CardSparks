import json
import math
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .generation import GenerationError, generate_cards, generate_feedback
from .models import Card, Deck, Review
from .scheduling import MASTERY_HORIZON_DAYS, Schedule, derive_mastery


User = get_user_model()


class DeckApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(name="Learner", email="learner@example.com", password="safe-password-123")
        self.other = User.objects.create_user(name="Other", email="other@example.com", password="safe-password-123")
        self.deck = Deck.objects.create(owner=self.user, title="Biology")
        self.card = Card.objects.create(deck=self.deck, front="Cell?", back="Unit of life", position=0)

    def authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def test_deck_endpoints_require_authentication(self):
        response = self.client.get("/api/decks/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_deck_list_and_card_updates_are_owner_scoped(self):
        foreign_deck = Deck.objects.create(owner=self.other, title="Private")
        foreign_card = Card.objects.create(deck=foreign_deck, front="Secret", back="Hidden")
        self.authenticate()

        response = self.client.get("/api/decks/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([deck["id"] for deck in response.data], [self.deck.id])
        self.assertEqual(self.client.patch(f"/api/cards/{foreign_card.id}/", {"front": "Nope"}, format="json").status_code, status.HTTP_404_NOT_FOUND)

    def test_create_deck_with_cards_is_atomic_and_assigns_positions(self):
        self.authenticate()
        response = self.client.post("/api/decks/", {
            "title": "Physics",
            "cards": [
                {"front": "Force?", "back": "Mass times acceleration"},
                {"front": "Energy?", "back": "Capacity to do work"},
            ],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Deck.objects.get(pk=response.data["id"])
        self.assertEqual(created.owner, self.user)
        self.assertEqual(list(created.cards.values_list("position", flat=True)), [0, 1])

    def test_study_queue_clamps_invalid_limits_instead_of_crashing(self):
        self.authenticate()
        for index in range(1, 105):
            Card.objects.create(deck=self.deck, front=f"F{index}", back=f"B{index}", position=index)

        negative = self.client.get(f"/api/decks/{self.deck.id}/study-queue/?limit=-5")
        huge = self.client.get(f"/api/decks/{self.deck.id}/study-queue/?limit=9999")

        self.assertEqual(negative.status_code, status.HTTP_200_OK)
        self.assertEqual(len(negative.data["cards"]), 1)
        self.assertEqual(huge.status_code, status.HTTP_200_OK)
        self.assertEqual(len(huge.data["cards"]), 100)

    def test_study_session_rejects_empty_duplicate_and_foreign_results(self):
        foreign_deck = Deck.objects.create(owner=self.other, title="Private")
        foreign_card = Card.objects.create(deck=foreign_deck, front="Secret", back="Hidden")
        self.authenticate()

        empty = self.client.post(f"/api/decks/{self.deck.id}/study-sessions/", {"results": []}, format="json")
        duplicate = self.client.post(f"/api/decks/{self.deck.id}/study-sessions/", {
            "results": [{"cardId": self.card.id, "grade": 4}, {"cardId": self.card.id, "grade": 5}],
        }, format="json")
        foreign = self.client.post(f"/api/decks/{self.deck.id}/study-sessions/", {
            "results": [{"cardId": foreign_card.id, "grade": 4}],
        }, format="json")

        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(foreign.status_code, status.HTTP_400_BAD_REQUEST)
        self.deck.refresh_from_db()
        self.assertIsNone(self.deck.last_studied)

    def test_study_session_updates_schedule_and_creates_review(self):
        self.authenticate()
        response = self.client.post(f"/api/decks/{self.deck.id}/study-sessions/", {
            "results": [{"cardId": self.card.id, "grade": 4}],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.card.refresh_from_db()
        self.deck.refresh_from_db()
        self.assertEqual(self.card.repetitions, 1)
        self.assertEqual(self.card.interval_days, 2)
        self.assertIsNotNone(self.deck.last_studied)
        self.assertEqual(Review.objects.filter(card=self.card, grade=4).count(), 1)

    def test_stats_are_scoped_to_the_authenticated_user(self):
        Review.objects.create(card=self.card, grade=4, easiness_after=2.5, repetitions_after=1, interval_days_after=2)
        other_deck = Deck.objects.create(owner=self.other, title="Other")
        other_card = Card.objects.create(deck=other_deck, front="Other", back="Other")
        Review.objects.create(card=other_card, grade=1, easiness_after=2.1, repetitions_after=0, interval_days_after=0)
        self.authenticate()

        response = self.client.get("/api/stats/?days=7&horizon=7")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["totals"]["reviews"], 1)
        self.assertEqual(response.data["totals"]["decks"], 1)
        self.assertEqual(len(response.data["heatmap"]), 7)

    def test_deck_string_uses_custom_users_email(self):
        self.assertEqual(str(self.deck), "Biology (learner@example.com)")

    def test_database_rejects_out_of_range_review_grades(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Review.objects.create(card=self.card, grade=6, easiness_after=2.5, repetitions_after=0, interval_days_after=0)


class SchedulingTests(SimpleTestCase):
    def test_mastery_uses_same_logarithmic_scale_as_frontend(self):
        schedule = Schedule(easiness=2.5, repetitions=1, interval_days=4)
        self.assertAlmostEqual(derive_mastery(schedule), math.log1p(4) / math.log1p(MASTERY_HORIZON_DAYS))
        self.assertEqual(derive_mastery(Schedule(2.5, 5, MASTERY_HORIZON_DAYS)), 1.0)


class GenerationTests(SimpleTestCase):
    @patch("decks.generation.Mistral")
    @patch.dict("os.environ", {"MISTRAL_API_KEY": "test-key"})
    def test_generation_count_matches_truncated_card_list(self, mistral_class):
        payload = {"cards": [{"front": f"F{i}", "back": f"B{i}"} for i in range(12)]}
        mistral_class.return_value.chat.complete.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
        )

        cards, count = generate_cards("biology", 5)

        self.assertEqual(len(cards), 5)
        self.assertEqual(count, 5)

    @patch("decks.generation.Mistral")
    @patch.dict("os.environ", {"MISTRAL_API_KEY": "test-key"})
    def test_feedback_generation_returns_bounded_text(self, mistral_class):
        mistral_class.return_value.chat.complete.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps({"feedback": "x" * 400})))]
        )

        feedback = generate_feedback({"reviews": 4, "retention": 0.75})

        self.assertEqual(feedback, "x" * 300)

    @patch.dict("os.environ", {}, clear=True)
    def test_feedback_generation_requires_configuration(self):
        with self.assertRaisesMessage(GenerationError, "API key not provided"):
            generate_feedback("two missed reviews")
