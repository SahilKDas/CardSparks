from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Card, Deck


class BulkMoveCardsView(APIView):
    @transaction.atomic
    def post(self, request):
        raw_ids = request.data.get("card_ids")
        if not isinstance(raw_ids, list) or not 1 <= len(raw_ids) <= 500:
            raise ValidationError({"card_ids": "Select between 1 and 500 cards."})
        try:
            card_ids = [int(card_id) for card_id in raw_ids]
            target_id = int(request.data.get("target_deck_id"))
        except (TypeError, ValueError):
            raise ValidationError("Card and destination deck IDs must be integers.")
        if len(card_ids) != len(set(card_ids)):
            raise ValidationError({"card_ids": "Card IDs must be unique."})

        target = get_object_or_404(Deck, pk=target_id, owner=request.user)
        cards = list(Card.objects.select_for_update().filter(id__in=card_ids, deck__owner=request.user))
        if {card.id for card in cards} != set(card_ids):
            raise ValidationError({"card_ids": "Every card must belong to your account."})
        if any(card.deck_id == target.id for card in cards):
            raise ValidationError("The destination deck already contains one or more selected cards.")

        maximum = target.cards.aggregate(Max("position"))["position__max"]
        next_position = 0 if maximum is None else maximum + 1
        now = timezone.now()
        source_ids = {card.deck_id for card in cards}
        for offset, card in enumerate(cards):
            card.deck = target
            card.position = next_position + offset
            card.updated_at = now
        # Updating the existing rows preserves every SM-2 field and Review FK;
        # copying then deleting would silently erase the learner's history.
        Card.objects.bulk_update(cards, ["deck", "position", "updated_at"])
        Deck.objects.filter(id__in=source_ids | {target.id}).update(updated_at=now)
        return Response({"moved": len(cards), "target_deck_id": target.id})
