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

from .generation import (
    GEN_FLASHCARDS_FROM_NOTES_SYSTEM_PROMPT,
    NOTES_END,
    NOTES_START,
    GenerationError,
    GenerationInputError,
    generate_cards,
    generate_feedback,
)
from .models import Card, Deck, Review, StudySettings
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

    def test_deck_organization_metadata_is_normalized_and_bounded(self):
        self.authenticate()
        response = self.client.patch(f"/api/decks/{self.deck.id}/", {
            "folder": "  Semester 1  ",
            "tags": ["Biology", " biology ", "Exam"],
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["folder"], "Semester 1")
        self.assertEqual(response.data["tags"], ["Biology", "Exam"])

        too_many = self.client.patch(f"/api/decks/{self.deck.id}/", {
            "tags": [f"tag-{index}" for index in range(11)],
        }, format="json")
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

    def test_private_decks_are_hidden_and_public_decks_expose_no_owner_email(self):
        private_response = self.client.get(f"/api/shared-decks/{self.deck.share_token}/")
        self.assertEqual(private_response.status_code, status.HTTP_404_NOT_FOUND)

        self.deck.is_public = True
        self.deck.save(update_fields=["is_public"])
        public_response = self.client.get(f"/api/shared-decks/{self.deck.share_token}/")

        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.data["author"], self.user.name)
        self.assertNotIn("owner", public_response.data)
        self.assertNotIn(self.user.email, str(public_response.data))

    def test_owner_can_publish_and_public_deck_can_be_duplicated_independently(self):
        self.authenticate()
        publish = self.client.post(
            f"/api/decks/{self.deck.id}/sharing/",
            {"is_public": True},
            format="json",
        )
        duplicate = self.client.post(f"/api/shared-decks/{self.deck.share_token}/duplicate/", {}, format="json")

        self.assertEqual(publish.status_code, status.HTTP_200_OK)
        self.assertTrue(publish.data["is_public"])
        self.assertEqual(duplicate.status_code, status.HTTP_201_CREATED)
        copied = Deck.objects.get(pk=duplicate.data["id"])
        self.assertEqual(copied.owner, self.user)
        self.assertFalse(copied.is_public)
        self.assertNotEqual(copied.share_token, self.deck.share_token)
        self.assertEqual(copied.cards.count(), self.deck.cards.count())

    def test_community_lists_only_published_decks(self):
        public = Deck.objects.create(owner=self.other, title="Community", is_public=True)
        Deck.objects.create(owner=self.other, title="Hidden", is_public=False)

        response = self.client.get("/api/community/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([str(deck["share_token"]) for deck in response.data], [str(public.share_token)])

    @patch("decks.serializers.Card.objects.bulk_create", side_effect=IntegrityError("card insert failed"))
    def test_create_deck_rolls_back_if_cards_cannot_be_created(self, _bulk_create):
        self.authenticate()
        initial_count = Deck.objects.count()

        with self.assertRaises(IntegrityError):
            self.client.post("/api/decks/", {
                "title": "Should roll back",
                "cards": [{"front": "Question", "back": "Answer"}],
            }, format="json")

        self.assertEqual(Deck.objects.count(), initial_count)

    def test_study_queue_clamps_invalid_limits_instead_of_crashing(self):
        self.authenticate()
        StudySettings.objects.create(user=self.user, max_new_cards=200)
        for index in range(1, 105):
            Card.objects.create(deck=self.deck, front=f"F{index}", back=f"B{index}", position=index)

        negative = self.client.get(f"/api/decks/{self.deck.id}/study-queue/?limit=-5")
        huge = self.client.get(f"/api/decks/{self.deck.id}/study-queue/?limit=9999")

        self.assertEqual(negative.status_code, status.HTTP_200_OK)
        self.assertEqual(len(negative.data["cards"]), 1)
        self.assertEqual(huge.status_code, status.HTTP_200_OK)
        self.assertEqual(len(huge.data["cards"]), 100)

    def test_account_and_per_deck_study_settings_limit_the_queue(self):
        reviewed_cards = [
            Card.objects.create(
                deck=self.deck,
                front=f"Reviewed {index}",
                back="Answer",
                last_reviewed_at=timezone.now(),
            )
            for index in range(3)
        ]
        Card.objects.bulk_create([
            Card(deck=self.deck, front=f"New {index}", back="Answer")
            for index in range(3)
        ])
        self.authenticate()

        updated = self.client.patch("/api/settings/", {
            "max_reviews": 2,
            "max_new_cards": 1,
            "grading_mode": "simple",
        }, format="json")
        account_queue = self.client.get(f"/api/decks/{self.deck.id}/study-queue/?limit=100")

        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["grading_mode"], "simple")
        self.assertEqual(len(account_queue.data["cards"]), 3)

        self.client.patch(f"/api/decks/{self.deck.id}/", {
            "review_limit": 1,
            "new_card_limit": 2,
            "grading_mode": "anki",
        }, format="json")
        deck_queue = self.client.get(f"/api/decks/{self.deck.id}/study-queue/?limit=100")

        self.assertEqual(len(deck_queue.data["cards"]), 3)
        self.assertEqual(deck_queue.data["cards"][0]["id"], reviewed_cards[0].id)

    def test_study_settings_require_authentication_and_validate_bounds(self):
        self.assertEqual(self.client.get("/api/settings/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.authenticate()
        invalid = self.client.patch("/api/settings/", {"max_new_cards": 201}, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

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

    def test_generate_preview_requires_authentication(self):
        response = self.client.post("/api/decks/generate/", {
            "topic": "Biology",
            "num_cards": 8,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_generate_preview_rejects_conflicting_missing_and_out_of_range_input(self):
        self.authenticate()
        requests = [
            {"topic": "Biology", "source_text": "x" * 100},
            {"num_cards": 8},
            {"source_text": "x" * 99},
            {"source_text": "x" * 20001},
            {"topic": "Biology", "num_cards": 0},
            {"topic": "Biology", "num_cards": 21},
        ]

        for payload in requests:
            with self.subTest(payload=payload):
                response = self.client.post("/api/decks/generate/", payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("decks.views.generate_cards_from_notes")
    def test_generate_preview_accepts_inclusive_note_boundaries_and_returns_existing_shape(self, generate_notes):
        generate_notes.return_value = ([{"front": "Q", "back": "A"}], 1)
        self.authenticate()

        for notes in ("x" * 100, "x" * 20000):
            with self.subTest(length=len(notes)):
                response = self.client.post("/api/decks/generate/", {
                    "source_text": notes,
                    "num_cards": 8,
                }, format="json")

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data, {
                    "cards": [{"front": "Q", "back": "A"}],
                    "cards_added": 1,
                })

        self.assertEqual(generate_notes.call_count, 2)

    @patch("decks.views.generate_cards", return_value=([{"front": "Q", "back": "A"}], 1))
    def test_topic_generation_remains_backward_compatible(self, generate_topic):
        self.authenticate()

        response = self.client.post("/api/decks/generate/", {
            "topic": "Biology",
            "num_cards": 8,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["cards_added"], 1)
        generate_topic.assert_called_once_with("Biology", 8)

    @patch("decks.views.generate_cards", side_effect=GenerationError("provider unavailable"))
    def test_generate_preview_returns_502_for_provider_failures(self, _generate_topic):
        self.authenticate()

        response = self.client.post("/api/decks/generate/", {
            "topic": "Biology",
            "num_cards": 8,
        }, format="json")

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    def test_study_feedback_requires_authentication_and_hides_inaccessible_decks(self):
        inaccessible = Deck.objects.create(owner=self.other, title="Private")
        unauthenticated = self.client.post(
            f"/api/decks/{self.deck.id}/study-feedback/",
            {"results": [{"cardId": self.card.id, "grade": 4}]},
            format="json",
        )
        self.authenticate()
        inaccessible_response = self.client.post(
            f"/api/decks/{inaccessible.id}/study-feedback/",
            {"results": [{"cardId": self.card.id, "grade": 4}]},
            format="json",
        )

        self.assertEqual(unauthenticated.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(inaccessible_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_study_feedback_rejects_empty_duplicate_foreign_and_invalid_results(self):
        other_deck = Deck.objects.create(owner=self.user, title="Other deck")
        foreign_card = Card.objects.create(deck=other_deck, front="Other", back="Other")
        self.authenticate()
        requests = [
            {"results": []},
            {"results": [
                {"cardId": self.card.id, "grade": 4},
                {"cardId": self.card.id, "grade": 5},
            ]},
            {"results": [{"cardId": foreign_card.id, "grade": 4}]},
            {"results": [{"cardId": self.card.id, "grade": 6}]},
        ]

        for payload in requests:
            with self.subTest(payload=payload):
                response = self.client.post(
                    f"/api/decks/{self.deck.id}/study-feedback/",
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("decks.views.generate_feedback", return_value="Review cellular structure before your next session.")
    def test_study_feedback_returns_feedback_without_changing_study_records(self, _generate_feedback):
        self.authenticate()
        original_updated_at = self.deck.updated_at

        response = self.client.post(
            f"/api/decks/{self.deck.id}/study-feedback/",
            {"results": [{"cardId": self.card.id, "grade": 2}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"feedback": "Review cellular structure before your next session."})
        self.assertEqual(Review.objects.count(), 0)
        self.deck.refresh_from_db()
        self.card.refresh_from_db()
        self.assertEqual(self.deck.updated_at, original_updated_at)
        self.assertIsNone(self.card.last_reviewed_at)

    @patch("decks.views.generate_feedback", side_effect=GenerationError("provider unavailable"))
    def test_study_feedback_returns_502_for_provider_failures(self, _generate_feedback):
        self.authenticate()
        response = self.client.post(
            f"/api/decks/{self.deck.id}/study-feedback/",
            {"results": [{"cardId": self.card.id, "grade": 4}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)

    @patch("decks.views.generate_feedback", side_effect=GenerationInputError("invalid summary"))
    def test_study_feedback_returns_400_for_generation_input_errors(self, _generate_feedback):
        self.authenticate()
        response = self.client.post(
            f"/api/decks/{self.deck.id}/study-feedback/",
            {"results": [{"cardId": self.card.id, "grade": 4}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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
        self.assertEqual(len(response.data["retention_trend"]), 8)
        self.assertEqual(len(response.data["streak_history"]), 8)
        self.assertEqual(response.data["weakest_decks"][0]["title"], self.deck.title)
        self.assertEqual(response.data["difficult_cards"][0]["deck__title"], self.deck.title)

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
    def test_notes_prompt_uses_real_markers_and_valid_json_example(self):
        self.assertIn(NOTES_START, GEN_FLASHCARDS_FROM_NOTES_SYSTEM_PROMPT)
        self.assertIn(NOTES_END, GEN_FLASHCARDS_FROM_NOTES_SYSTEM_PROMPT)
        self.assertNotIn("{NOTES_START}", GEN_FLASHCARDS_FROM_NOTES_SYSTEM_PROMPT)
        self.assertIn('{"cards": [{"front": "question", "back": "answer"}]}', GEN_FLASHCARDS_FROM_NOTES_SYSTEM_PROMPT)
        self.assertNotIn('{{"cards"', GEN_FLASHCARDS_FROM_NOTES_SYSTEM_PROMPT)

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
