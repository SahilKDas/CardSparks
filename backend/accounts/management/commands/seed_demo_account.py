import os
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from rest_framework.authtoken.models import Token

from decks.models import Card, Deck, Review, StudySettings


DEMO_DECKS = [
    {
        "title": "Cell Biology Essentials",
        "description": "A judge-ready deck showing scheduling, weak spots, and exam mode.",
        "folder": "Demo semester",
        "tags": ["biology", "demo"],
        "emoji": "🧬",
        "color": "coral",
        "cards": [
            ("What is the main function of mitochondria?", "Generate ATP through cellular respiration.", 0.82, 0, 2.55, 4, 18, -2),
            ("What does the cell membrane control?", "Movement of substances into and out of the cell.", 0.63, 1, 2.25, 2, 5, -1),
            ("Where are proteins assembled?", "At ribosomes in the cytoplasm or on rough ER.", 0.91, 0, 2.72, 5, 32, 4),
            ("What is the role of lysosomes?", "Break down waste and damaged cell components with enzymes.", 0.31, 3, 1.85, 1, 1, -5),
            ("What is osmosis?", "Movement of water across a selectively permeable membrane toward higher solute concentration.", 0.48, 2, 2.05, 2, 3, 1),
            ("Where is eukaryotic DNA primarily stored?", "Inside the nucleus.", 0.75, 0, 2.48, 3, 12, 3),
        ],
    },
    {
        "title": "Spanish Everyday Verbs",
        "description": "High-frequency verbs with mixed mastery for a realistic rescue queue.",
        "folder": "Languages",
        "tags": ["spanish", "verbs"],
        "emoji": "🌮",
        "color": "violet",
        "cards": [
            ("hablar", "to speak or talk", 0.94, 0, 2.8, 6, 40, 8),
            ("tener", "to have", 0.84, 0, 2.6, 4, 20, 4),
            ("querer", "to want or love", 0.57, 1, 2.2, 2, 5, -2),
            ("hacer", "to do or make", 0.39, 2, 1.95, 1, 1, -4),
            ("poder", "to be able to or can", 0.68, 0, 2.4, 3, 8, 2),
        ],
    },
    {
        "title": "US History - Road to Independence",
        "description": "A newer deck for demonstrating generation, editing, and first reviews.",
        "folder": "Demo semester",
        "tags": ["history", "exam"],
        "emoji": "📜",
        "color": "blue",
        "cards": [
            ("What was the Stamp Act?", "A 1765 British tax on printed materials in the colonies.", 0.42, 1, 2.18, 1, 1, -1),
            ("Why was the Boston Tea Party significant?", "It protested taxation and prompted the Intolerable Acts.", 0.28, 2, 1.9, 1, 1, -3),
            ("What did no taxation without representation mean?", "Colonists rejected taxes from a Parliament in which they had no elected representatives.", 0.52, 0, 2.35, 2, 4, 1),
            ("When was the Declaration of Independence adopted?", "July 4, 1776.", 0.7, 0, 2.5, 3, 10, 5),
            ("What were the Intolerable Acts?", "Punitive British laws passed after the Boston Tea Party.", 0.0, 0, 2.5, 0, 0, 0),
        ],
    },
]


class Command(BaseCommand):
    help = "Create or reset the environment-configured CardSparks demo account."

    def add_arguments(self, parser):
        parser.add_argument("--email", default=None)
        parser.add_argument("--password", default=None)
        parser.add_argument("--name", default=None)

    def handle(self, *args, **options):
        email = (options["email"] or os.getenv("DEMO_ACCOUNT_EMAIL", "")).strip().lower()
        password = options["password"] or os.getenv("DEMO_ACCOUNT_PASSWORD", "")
        name = (options["name"] or os.getenv("DEMO_ACCOUNT_NAME", "Demo Learner")).strip()

        if not email or not password:
            raise CommandError("Set DEMO_ACCOUNT_EMAIL and DEMO_ACCOUNT_PASSWORD, or pass --email and --password.")
        if not name:
            raise CommandError("DEMO_ACCOUNT_NAME cannot be blank.")

        User = get_user_model()
        validation_user = User(email=email, name=name)
        try:
            validate_password(password, validation_user)
        except ValidationError as error:
            raise CommandError("Demo password failed Django validation: " + " ".join(error.messages)) from error

        with transaction.atomic():
            user = User.objects.filter(email=email).first()
            name_owner = User.objects.filter(name=name).exclude(email=email).first()
            if name_owner:
                raise CommandError(f'The demo name "{name}" is already used by another account.')

            if user is None:
                user = User(email=email, name=name)
            else:
                user.name = name
            user.set_password(password)
            user.is_active = True
            user.save()

            # Reset only this explicitly configured account. Re-running the
            # command restores a clean judge experience without touching any
            # real learner or their data.
            Token.objects.filter(user=user).delete()
            user.decks.all().delete()
            StudySettings.objects.update_or_create(
                user=user,
                defaults={"max_reviews": 80, "max_new_cards": 20, "grading_mode": "anki"},
            )

            now = timezone.now()
            review_offsets = [1, 2, 3, 5, 7, 9, 12, 15, 18, 22, 27]
            review_index = 0
            for deck_index, deck_data in enumerate(DEMO_DECKS):
                deck = Deck.objects.create(
                    owner=user,
                    title=deck_data["title"],
                    description=deck_data["description"],
                    folder=deck_data["folder"],
                    tags=deck_data["tags"],
                    emoji=deck_data["emoji"],
                    color=deck_data["color"],
                    is_public=deck_index == 0,
                    last_studied=now - timedelta(days=deck_index + 1),
                )
                for position, card_data in enumerate(deck_data["cards"]):
                    front, back, mastery, lapses, easiness, repetitions, interval_days, due_offset = card_data
                    reviewed = repetitions > 0 or lapses > 0
                    card = Card.objects.create(
                        deck=deck,
                        front=front,
                        back=back,
                        mastery=mastery,
                        lapses=lapses,
                        easiness=easiness,
                        repetitions=repetitions,
                        interval_days=interval_days,
                        due_at=(now + timedelta(days=due_offset)) if reviewed else None,
                        last_reviewed_at=(now - timedelta(days=max(1, abs(due_offset)))) if reviewed else None,
                        position=position,
                    )
                    if reviewed:
                        for grade in ([4, 3] if lapses == 0 else [4, 1, 3]):
                            review = Review.objects.create(
                                card=card,
                                grade=grade,
                                easiness_after=easiness,
                                repetitions_after=repetitions,
                                interval_days_after=interval_days,
                            )
                            days_ago = review_offsets[review_index % len(review_offsets)]
                            Review.objects.filter(pk=review.pk).update(reviewed_at=now - timedelta(days=days_ago))
                            review_index += 1

        self.stdout.write(self.style.SUCCESS(f"Demo account ready: {email} ({len(DEMO_DECKS)} decks)."))
