from django.contrib import admin
from .models import Deck, Card

class CardInline(admin.TabularInline):
    model = Card
    extra = 1

@admin.register(Deck)
class DeckAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "created_at")
    inlines = [CardInline]