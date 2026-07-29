import re

from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Deck, Card, StudySettings
from .generation import MAX_CARDS, MIN_CARDS, MAX_NOTES_LENGTH, MIN_NOTES_LENGTH

class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = ["id", "front", "back", "mastery", "position",
            "card_type", "choices", "correct_index", "image_url",
            "easiness", "repetitions", "interval_days",
            "due_at", "last_reviewed_at", "lapses", 
            "created_at", "updated_at"]
        read_only_fields = [
            "mastery", "easiness", "repetitions", "interval_days",
            "due_at", "last_reviewed_at", "lapses",
            "created_at", "updated_at",
        ]

    def validate(self, attrs):
        card_type = attrs.get("card_type", getattr(self.instance, "card_type", Card.CardType.BASIC))
        choices = attrs.get("choices", getattr(self.instance, "choices", []))
        correct_index = attrs.get("correct_index", getattr(self.instance, "correct_index", None))
        front = attrs.get("front", getattr(self.instance, "front", ""))
        image_url = attrs.get("image_url", getattr(self.instance, "image_url", ""))

        if card_type == Card.CardType.MULTIPLE_CHOICE:
            cleaned = [str(choice).strip() for choice in choices]
            if not 2 <= len(cleaned) <= 6:
                raise serializers.ValidationError({"choices": "Multiple-choice cards need 2 to 6 choices."})
            if any(not choice for choice in cleaned):
                raise serializers.ValidationError({"choices": "Every multiple-choice answer must contain text."})
            if correct_index is None or not 0 <= correct_index < len(cleaned):
                raise serializers.ValidationError({"correct_index": "Choose the correct answer."})
            attrs["choices"] = cleaned
        else:
            # Clearing type-specific data prevents stale answers from leaking if
            # an existing multiple-choice card is converted to another type.
            attrs["choices"] = []
            attrs["correct_index"] = None

        if card_type == Card.CardType.CLOZE and not re.search(r"\{\{[^{}]+}}", front):
            raise serializers.ValidationError({"front": "Wrap the hidden cloze text in double braces, for example {{answer}}."})
        if card_type == Card.CardType.IMAGE and not image_url:
            raise serializers.ValidationError({"image_url": "Image cards need an image URL."})
        return attrs

class DeckSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, required=False)
    due_count = serializers.SerializerMethodField()
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Deck
        fields = [
            "id", "title", "description", "folder", "tags", "emoji", "color",
            "is_public", "share_token",
            "review_limit", "new_card_limit", "grading_mode",
            "last_studied", "created_at", "updated_at", "due_count", "cards"
        ]
        read_only_fields = ["last_studied", "created_at", "updated_at", "is_public", "share_token"]

    @transaction.atomic
    def create(self, validated_data):
        cards_data = validated_data.pop("cards", [])
        deck = Deck.objects.create(**validated_data)
        Card.objects.bulk_create([
            Card(deck=deck, position=index, **card)
            for index, card in enumerate(cards_data)
        ])
        return deck

    def update(self, instance, validated_data):
        validated_data.pop("cards", None)
        return super().update(instance, validated_data)

    def validate_folder(self, value):
        return value.strip()

    def validate_tags(self, value):
        # Deduplicate case-insensitively while preserving the learner's casing
        # and first-entered order for predictable display in the UI.
        normalized = []
        seen = set()
        for raw_tag in value:
            tag = raw_tag.strip()
            key = tag.casefold()
            if tag and key not in seen:
                normalized.append(tag)
                seen.add(key)
        if len(normalized) > 10:
            raise serializers.ValidationError("Use no more than 10 tags per deck.")
        return normalized

    def validate_review_limit(self, value):
        if value is not None and not 1 <= value <= 1000:
            raise serializers.ValidationError("Review limit must be between 1 and 1,000.")
        return value

    def validate_new_card_limit(self, value):
        if value is not None and not 0 <= value <= 200:
            raise serializers.ValidationError("New-card limit must be between 0 and 200.")
        return value

    def get_due_count(self, deck):
        annotated = getattr(deck, "due_cards", None)
        if annotated is not None:
            return annotated
        now = timezone.now()
        return sum(1 for card in deck.cards.all() if card.due_at is None or card.due_at <= now)

class StudyResultSerializer(serializers.Serializer):
    cardId = serializers.IntegerField()
    grade = serializers.IntegerField(required=False, min_value=0, max_value=5)
    correct = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if "grade" not in attrs:
            if "correct" not in attrs:
                raise serializers.ValidationError("Provide either 'grade' or 'correct'.")
            attrs["grade"] = 5 if attrs["correct"] else 2
        return attrs


class SharingSerializer(serializers.Serializer):
    is_public = serializers.BooleanField()


class PublicDeckSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, read_only=True)
    author = serializers.CharField(source="owner.name", read_only=True)

    class Meta:
        model = Deck
        fields = [
            "title", "description", "folder", "tags", "emoji", "color",
            "share_token", "author", "created_at", "cards",
        ]


class StudySettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudySettings
        fields = ["max_reviews", "max_new_cards", "grading_mode"]



class StudySessionSerializer(serializers.Serializer):
    results = StudyResultSerializer(many=True, allow_empty=False)

    def validate_results(self, value):
        card_ids = [result["cardId"] for result in value]
        if len(card_ids) != len(set(card_ids)):
            raise serializers.ValidationError("Each card may only appear once per study session.")
        return value

class GenerateRequestSerializer(serializers.Serializer):
    """Only accepts a topic or notes"""

    topic = serializers.CharField(required=False, allow_blank=True)
    source_text = serializers.CharField(required=False, allow_blank=True)
    num_cards = serializers.IntegerField(required=False, default=8, min_value=MIN_CARDS, max_value=MAX_CARDS)

    def validate(self, attrs):
        topic = (attrs.get("topic") or "").strip()
        notes = (attrs.get("source_text") or "").strip()

        if topic and notes:
            raise serializers.ValidationError("Provide either a topic ('topic') or notes ('source_text'), not both.")

        if not topic and not notes:
            raise serializers.ValidationError("Provide a topic ('topic') or notes ('source_text')")

        if notes:
            if len(notes) > MAX_NOTES_LENGTH:
                raise serializers.ValidationError({
                    "source_text": f"Keep your notes at or below {MAX_NOTES_LENGTH:,} characters."
                })
            elif len(notes) < MIN_NOTES_LENGTH:
                raise serializers.ValidationError({
                    "source_text": f"Provide at least {MIN_NOTES_LENGTH} characters."
                })

        attrs["topic"] = topic
        attrs["source_text"] = notes
        return attrs


class StudyFeedbackResultsSerializer(serializers.Serializer):
    cardId = serializers.IntegerField()
    grade = serializers.IntegerField(min_value=0, max_value=5)

class StudyFeedbackSerializer(serializers.Serializer):
    results = StudyFeedbackResultsSerializer(many=True, allow_empty=False)

    def validate_results(self, value):
        card_ids = [result["cardId"] for result in value]
        if len(card_ids) != len(set(card_ids)):
            raise serializers.ValidationError("Each card may only appear once per feedback request.")
        return value
