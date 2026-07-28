from django.shortcuts import render
from django.db.models import Max
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import APIView, action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
from django.db.models import F, Q, Count

from .scheduling import apply_review
from .models import Deck, Card, Review
from .serializers import DeckSerializer, CardSerializer, StudyResultSerializer, StudySessionSerializer
from .generation import GenerationError, generate_cards
from .stats import build_stats

MASTERY_ON_PASS = 0.20
MASTERY_ON_FAIL = -0.12 

class DeckViewSet(viewsets.ModelViewSet):
    serializer_class = DeckSerializer

    def get_queryset(self):
        now = timezone.now()
        return (Deck.objects.filter(owner=self.request.user)
                .prefetch_related("cards")
                .annotate(due_cards=Count("cards", filter=Q(cards__due_at__isnull=True) | Q(cards__due_at__lte=now))))

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"], url_path="study-sessions")
    def study_sessions(self, request, pk=None):
        deck = self.get_object()

        serializer = StudySessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        grades = {r["cardId"]: r["grade"] for r in serializer.validated_data["results"]}
        now = timezone.now()

        with transaction.atomic():
            cards = list(deck.cards.filter(id__in=grades.keys()))
            reviews = []

            for card in cards:
                result = apply_review(card, grades[card.id], now=now)
                card.updated_at = now
                reviews.append(Review(
                    card=card,
                    grade=grades[card.id],
                    easiness_after=result.easiness,
                    repetitions_after=result.repetitions,
                    interval_days_after=result.interval_days
                ))

            if cards:
                Card.objects.bulk_update(cards, ["easiness", "repetitions", "interval_days",
                    "due_at", "last_reviewed_at", "lapses",
                    "mastery", "updated_at"])
                Review.objects.bulk_create(reviews)

        deck.last_studied = now
        deck.save(update_fields=["last_studied", "updated_at"])


        deck = self.get_queryset().get(pk=deck.pk)
        return Response(DeckSerializer(deck).data)

    @action(detail=True, methods=["get"], url_path="study-queue")
    def study_queue(self, request, pk=None):
        deck = self.get_object()
        now = timezone.now()

        try:
            limit = int(request.query_params.get("limit", 100))
        except (TypeError, ValueError):
            limit = 100

        cards = deck.cards.filter(
            Q(due_at__isnull=True) | Q(due_at__lte=now)
        ).order_by(F('due_at').asc(nulls_first=True), "position")[:limit]

        return Response({"cards": CardSerializer(cards, many=True).data})

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

class StatsView(APIView):
    def get(self, request):
        def bounded(name, default, ceiling):
            try:
                return max(1, min(int(request.query_params.get(name, default)), ceiling))
            except (TypeError, ValueError):
                return default

        return Response(build_stats(
            request.user,
            history_days=bounded("days", 365, 365),
            horizon_days=bounded("horizon", 30, 90)
        ))