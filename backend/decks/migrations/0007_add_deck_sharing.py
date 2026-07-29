import uuid

from django.db import migrations, models


def populate_share_tokens(apps, schema_editor):
    """Assign each existing deck its own token before uniqueness is enforced."""
    Deck = apps.get_model("decks", "Deck")
    for deck in Deck.objects.filter(share_token__isnull=True).iterator():
        deck.share_token = uuid.uuid4()
        deck.save(update_fields=["share_token"])


class Migration(migrations.Migration):
    dependencies = [
        ("decks", "0006_add_deck_organization"),
    ]

    operations = [
        migrations.AddField(
            model_name="deck",
            name="is_public",
            field=models.BooleanField(db_index=True, default=False),
        ),
        # The temporary nullable field lets old rows exist while RunPython gives
        # every one a distinct value. Adding unique=True with a callable default
        # in one operation would reuse a single evaluated value during migration.
        migrations.AddField(
            model_name="deck",
            name="share_token",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(populate_share_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="deck",
            name="share_token",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
