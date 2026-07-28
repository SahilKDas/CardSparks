from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

class Deck(models.Model):
    class Color(models.TextChoices):
        CORAL = "coral", "Coral"
        VIOLET = "violet", "Violet"
        BLUE = "blue", "Blue"
        GREEN = "green", "Green"
        YELLOW = "yellow", "Yellow"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, related_name="decks", null=True)
    title = models.CharField(max_length=256)
    description = models.TextField(blank=True)
    emoji = models.CharField(max_length=8, blank=True, default="✨")
    color = models.CharField(max_length=32, choices=Color.choices, default=Color.CORAL)
    last_studied = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f'{self.title} ({self.owner.username if self.owner else "Unknown"})'

class Card(models.Model):
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="cards")
    front = models.TextField()
    back = models.TextField()
    mastery = models.FloatField(default=0.0, validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # for the SM-2 algorithm 
    easiness = models.FloatField(default=2.5)
    repetitions = models.PositiveIntegerField(default=0)
    interval_days = models.PositiveIntegerField(default=0)
    due_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_reviewed_at = models.DateTimeField(null=True, blank=True)
    lapses = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(mastery__gte=0.0) & models.Q(mastery__lte=1.0), name="card_mastery_between_0_and_1")
        ]

    def __str__(self):
        return f'{self.front[:32]} / {self.back[:32]}'

class Review(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="reviews")
    reviewed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    grade = models.PositiveIntegerField()
    easiness_after = models.FloatField()
    repetitions_after = models.PositiveIntegerField()
    interval_days_after = models.PositiveIntegerField()

    class Meta:
        ordering = ['-reviewed_at', '-id']