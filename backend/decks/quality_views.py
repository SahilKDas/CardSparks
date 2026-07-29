from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .generation import GenerationError
from .models import Deck
from .quality import analyze_card_quality


class CardQualityView(APIView):
    def post(self, request, pk):
        deck = get_object_or_404(Deck.objects.prefetch_related("cards"), pk=pk, owner=request.user)
        raw_ids = request.data.get("card_ids", [])
        if not isinstance(raw_ids, list) or len(raw_ids) > 100:
            raise ValidationError({"card_ids": "Provide a list containing at most 100 card IDs."})
        try:
            card_ids = [int(card_id) for card_id in raw_ids]
        except (TypeError, ValueError):
            raise ValidationError({"card_ids": "Every card ID must be an integer."})
        if len(card_ids) != len(set(card_ids)):
            raise ValidationError({"card_ids": "Card IDs must be unique."})

        cards = list(deck.cards.filter(id__in=card_ids)) if card_ids else list(deck.cards.all())[:100]
        if card_ids and {card.id for card in cards} != set(card_ids):
            raise ValidationError({"card_ids": "Every card must belong to this deck."})
        try:
            issues = analyze_card_quality(cards)
        except GenerationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"issues": issues})
