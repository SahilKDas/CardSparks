import uuid

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
    folder = models.CharField(max_length=80, blank=True)
    # Tags are intentionally embedded metadata: they are small, deck-owned,
    # and do not need the lifecycle or joins of a separate shared Tag model.
    tags = models.JSONField(default=list, blank=True)
    is_public = models.BooleanField(default=False, db_index=True)
    # UUID links are unguessable identifiers, not authorization by themselves:
    # every public endpoint also checks is_public before returning the deck.
    share_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    review_limit = models.PositiveSmallIntegerField(null=True, blank=True)
    new_card_limit = models.PositiveSmallIntegerField(null=True, blank=True)
    grading_mode = models.CharField(
        max_length=10,
        choices=[("", "Use account default"), ("anki", "Four grades"), ("simple", "Pass/fail")],
        blank=True,
        default="",
    )
    emoji = models.CharField(max_length=8, blank=True, default="✨")
    color = models.CharField(max_length=32, choices=Color.choices, default=Color.CORAL)
    last_studied = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f'{self.title} ({self.owner.email if self.owner else "Unknown"})'

class Card(models.Model):
    class CardType(models.TextChoices):
        BASIC = "basic", "Basic"
        REVERSIBLE = "reversible", "Reversible"
        MULTIPLE_CHOICE = "multiple_choice", "Multiple choice"
        CLOZE = "cloze", "Cloze deletion"
        IMAGE = "image", "Image"

    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name="cards")
    front = models.TextField()
    back = models.TextField()
    # Type-specific fields stay on Card so copies and API-created decks retain
    # their complete learning behavior. Non-choice cards store an empty list;
    # serializer validation keeps mutually exclusive metadata normalized.
    card_type = models.CharField(max_length=24, choices=CardType.choices, default=CardType.BASIC)
    choices = models.JSONField(default=list, blank=True)
    correct_index = models.PositiveSmallIntegerField(null=True, blank=True)
    image_url = models.URLField(blank=True)
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
    grade = models.PositiveIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(5)]
    )
    easiness_after = models.FloatField()
    repetitions_after = models.PositiveIntegerField()
    interval_days_after = models.PositiveIntegerField()

    class Meta:
        ordering = ['-reviewed_at', '-id']
        constraints = [
            models.CheckConstraint(
                condition=models.Q(grade__gte=0, grade__lte=5),
                name="review_grade_between_0_and_5",
            )
        ]


class StudySettings(models.Model):
    class GradingMode(models.TextChoices):
        ANKI = "anki", "Four grades"
        SIMPLE = "simple", "Pass/fail"

    # OneToOneField enforces exactly one canonical settings record per user;
    # views create it lazily so existing accounts need no data migration.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="study_settings",
    )
    max_reviews = models.PositiveSmallIntegerField(
        default=100,
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
    )
    max_new_cards = models.PositiveSmallIntegerField(
        default=25,
        validators=[MinValueValidator(0), MaxValueValidator(200)],
    )
    grading_mode = models.CharField(
        max_length=10,
        choices=GradingMode.choices,
        default=GradingMode.ANKI,
    )
