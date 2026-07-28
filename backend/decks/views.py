from django.shortcuts import render
from django.db.models import Max
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from .models import Deck, Card
from .serializers import DeckSerializer, CardSerializer, StudyResultSerializer, StudySessionSerializer
from .generation import GenerationError, generate_cards

MASTERY_ON_PASS = 0.20
MASTERY_ON_FAIL = -0.12 

class DeckViewSet(viewsets.ModelViewSet):
    serializer_class = DeckSerializer

    def get_queryset(self):
        return Deck.objects.filter(owner=self.request.user).prefetch_related("cards")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="study-sessions")
    def study_sessions(self, request, pk=None):
        deck = self.get_object()

        serializer = StudySessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        adjustments = {
            result["cardId"]: (
                MASTERY_ON_PASS if result["correct"] else MASTERY_ON_FAIL
            ) for result in serializer.validated_data["results"]
        }

        now = timezone.now()

        with transaction.atomic():
            cards = list(deck.cards.filter(id__in=adjustments.keys()))

            for card in cards:
                updated = (card.mastery or 0.0) + adjustments[card.id]
                card.mastery = max(0.0, min(1.0, updated))
                card.updated_at = now

            if cards:
                Card.objects.bulk_update(cards, ["mastery", "updated_at"])

            deck.last_studied = now
            deck.save(update_fields=["last_studied", "updated_at"])

        deck = self.get_queryset().get(pk=deck.pk)
        return Response(DeckSerializer(deck).data)

    @action(detail=False, methods=["post"], url_path="generate")
    def generate_preview(self, request):
        try:
            cards, count = generate_cards(
                request.data.get("topic"),
                request.data.get("num_cards", 8)
            )
        except GenerationError as err:
            return Response({"detail": str(err)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({"cards": cards, "cards_added": count})

    @action(detail=True, methods=["post"], url_path="generate")
    def generate_into_deck(self, request, pk=None):
        deck = self.get_object()

        try:
            cards, count = generate_cards(
                request.data.get("topic"),
                request.data.get("num_cards", 8)
            )
        except GenerationError as err:
            return Response({"detail": str(err)}, status=status.HTTP_502_BAD_GATEWAY)

        max_pos = deck.cards.aggregate(Max("position"))["position__max"]
        start = 0 if max_pos is None else max_pos + 1

        Card.objects.bulk_create(
            Card(deck=deck, front=card["front"], back=card["back"], position = start + offset)
            for offset, card in enumerate(cards)
        )
        deck.save(update_fields=["updated_at"])

        deck = self.get_queryset().get(pk=deck.pk)
        return Response(DeckSerializer(deck).data)

    @action(detail=True, methods=["post"], url_path="cards")
    def add_card(self, request, pk=None):
        deck = self.get_object()

        serializer = CardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        max_pos = deck.cards.aggregate(Max("position"))["position__max"]
        next_pos = 0 if max_pos is None else max_pos + 1

        card = serializer.save(deck=deck, position=next_pos)
        deck.save(update_fields=["updated_at"])

        return Response(CardSerializer(card).data, status=status.HTTP_201_CREATED)

class CardViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = CardSerializer

    def get_queryset(self):
        return Card.objects.filter(deck__owner=self.request.user)

    def perform_update(self, serializer):
        card = serializer.save()
        card.deck.save(update_fields=["updated_at"])

    def perform_destroy(self, instance):
        deck = instance.deck
        instance.delete()
        deck.save(update_fields=["updated_at"])