from rest_framework import serializers
from .models import Deck, Card

class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = ["id", "front", "back", "mastery", "position", "created_at", "updated_at"]
        read_only_fields = ["mastery", "created_at", "updated_at"]

class DeckSerializer(serializers.ModelSerializer):
    cards = CardSerializer(many=True, required=False)

    class Meta:
        model = Deck
        fields = [
            "id", "title", "description", "emoji", "color",
            "last_studied", "created_at", "updated_at", "cards"
        ]
        read_only_fields = ["last_studied", "created_at", "updated_at"]

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

class StudyResultSerializer(serializers.Serializer):
    cardId = serializers.IntegerField()
    correct = serializers.BooleanField()



class StudySessionSerializer(serializers.Serializer):
    results = StudyResultSerializer(many=True, allow_empty=True)