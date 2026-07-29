from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Deck, Card
from .generation import MAX_CARDS, MIN_CARDS, MAX_NOTES_LENGTH, MIN_NOTES_LENGTH

class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = ["id", "front", "back", "mastery", "position",
            "easiness", "repetitions", "interval_days",
            "due_at", "last_reviewed_at", "lapses", 
            "created_at", "updated_at"]
        read_only_fields = [
            "mastery", "easiness", "repetitions", "interval_days",
            "due_at", "last_reviewed_at", "lapses",
            "created_at", "updated_at",
        ]

class DeckSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, required=False)
    due_count = serializers.SerializerMethodField()

    class Meta:
        model = Deck
        fields = [
            "id", "title", "description", "emoji", "color",
            "last_studied", "created_at", "updated_at", "due_count", "cards"
        ]
        read_only_fields = ["last_studied", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated_data):
        cards_data = validated_data.pop("cards", [])
        deck = Deck.objects.create(**validated_data)
        Card.objects.bulk_create([
            Card(deck=deck, front=card["front"], back=card["back"], position=index)
            for index, card in enumerate(cards_data)
        ])
        return deck

    def update(self, instance, validated_data):
        validated_data.pop("cards", None)
        return super().update(instance, validated_data)

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
