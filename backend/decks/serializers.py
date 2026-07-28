from rest_framework import serializers
from django.db import transaction
from django.utils import timezone
from .models import Deck, Card

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

    def create(self, validated_data):
        cards_data = validated_data.pop("cards", [])
        with transaction.atomic():
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
            raise serializers.ValidationError("Each card may appear only once per study session.")
        return value
