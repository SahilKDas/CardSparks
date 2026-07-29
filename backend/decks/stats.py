from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone

from .models import Card, Deck, Review
from .scheduling import PASS_THRESHOLD

MATURE_INTERVAL_DAYS = 21
RECENT_WINDOW_DAYS = 30


def _ratio(passed, total):
    return round(passed / total, 4) if total else None


def _daily_counts(queryset, field):
    rows = (
        queryset.annotate(day=TruncDate(field))
        .values("day")
        .annotate(count=Count("id"))
    )
    return {row["day"]: row["count"] for row in rows}


def _dense_series(counts, start, days):
    return [
        {
            "date": (start + timedelta(days=offset)).isoformat(),
            "count": counts.get(start + timedelta(days=offset), 0),
        }
        for offset in range(days)
    ]


def _streaks(series, today):
    active = {row["date"] for row in series if row["count"] > 0}

    cursor = today
    if cursor.isoformat() not in active:
        cursor -= timedelta(days=1)

    current = 0
    while cursor.isoformat() in active:
        current += 1
        cursor -= timedelta(days=1)

    longest = 0
    run = 0
    for row in series:
        run = run + 1 if row["count"] > 0 else 0
        longest = max(longest, run)

    return {"current": current, "longest": longest}


def _weekly_insights(reviews, heatmap, today, weeks=8):
    """Return aligned retention and activity buckets for the recent weeks."""
    start = today - timedelta(days=(weeks * 7) - 1)
    review_rows = {
        row["day"]: row
        for row in (
            reviews.filter(reviewed_at__date__gte=start)
            .annotate(day=TruncDate("reviewed_at"))
            .values("day")
            .annotate(
                count=Count("id"),
                passed=Count("id", filter=Q(grade__gte=PASS_THRESHOLD)),
            )
        )
    }
    activity = {row["date"]: row["count"] for row in heatmap}
    retention_trend = []
    streak_history = []
    for week in range(weeks):
        week_start = start + timedelta(days=week * 7)
        dates = [week_start + timedelta(days=offset) for offset in range(7)]
        count = sum(review_rows.get(day, {}).get("count", 0) for day in dates)
        passed = sum(review_rows.get(day, {}).get("passed", 0) for day in dates)
        retention_trend.append({
            "date": week_start.isoformat(),
            "reviews": count,
            "retention": _ratio(passed, count),
        })
        streak_history.append({
            "date": week_start.isoformat(),
            "active_days": sum(1 for day in dates if activity.get(day.isoformat(), 0) > 0),
            "reviews": sum(activity.get(day.isoformat(), 0) for day in dates),
        })
    return retention_trend, streak_history


def build_stats(user, history_days=365, horizon_days=30):
    now = timezone.now()
    today = timezone.localdate()

    reviews = Review.objects.filter(card__deck__owner=user)
    cards = Card.objects.filter(deck__owner=user)

    all_time = reviews.aggregate(
        total=Count("id"),
        passed=Count("id", filter=Q(grade__gte=PASS_THRESHOLD)),
    )
    recent = reviews.filter(reviewed_at__gte=now - timedelta(days=RECENT_WINDOW_DAYS)).aggregate(
        total=Count("id"),
        passed=Count("id", filter=Q(grade__gte=PASS_THRESHOLD)),
    )
    card_totals = cards.aggregate(
        total=Count("id"),
        mature=Count("id", filter=Q(interval_days__gte=MATURE_INTERVAL_DAYS)),
        lapses=Sum("lapses"),
    )

    history_start = today - timedelta(days=history_days - 1)
    heatmap = _dense_series(
        _daily_counts(reviews.filter(reviewed_at__date__gte=history_start), "reviewed_at"),
        history_start,
        history_days,
    )

    forecast = _dense_series(
        _daily_counts(
            cards.filter(due_at__gt=now, due_at__date__lte=today + timedelta(days=horizon_days - 1)),
            "due_at",
        ),
        today,
        horizon_days,
    )

    backlog = cards.filter(Q(due_at__isnull=True) | Q(due_at__lte=now)).count()

    retention_trend, streak_history = _weekly_insights(reviews, heatmap, today)
    deck_rows = reviews.values(
        "card__deck_id", "card__deck__title", "card__deck__emoji"
    ).annotate(
        reviews=Count("id"),
        passed=Count("id", filter=Q(grade__gte=PASS_THRESHOLD)),
    )
    weakest_decks = sorted([
        {
            "id": row["card__deck_id"],
            "title": row["card__deck__title"],
            "emoji": row["card__deck__emoji"],
            "reviews": row["reviews"],
            "retention": _ratio(row["passed"], row["reviews"]),
        }
        for row in deck_rows
    ], key=lambda row: (row["retention"], -row["reviews"]))[:5]

    difficult_cards = list(
        cards.annotate(
            review_count=Count("reviews"),
            failed_reviews=Count("reviews", filter=Q(reviews__grade__lt=PASS_THRESHOLD)),
        )
        .filter(review_count__gt=0)
        .order_by("-lapses", "-failed_reviews", "mastery", "id")
        .values("id", "deck_id", "deck__title", "front", "lapses", "failed_reviews", "review_count")[:8]
    )

    return {
        "totals": {
            "reviews": all_time["total"],
            "cards": card_totals["total"],
            "mature_cards": card_totals["mature"],
            "lapses": card_totals["lapses"] or 0,
            "decks": Deck.objects.filter(owner=user).count(),
        },
        "retention": {
            "all_time": _ratio(all_time["passed"], all_time["total"]),
            "recent": _ratio(recent["passed"], recent["total"]),
            "recent_reviews": recent["total"],
            "window_days": RECENT_WINDOW_DAYS,
        },
        "streak": _streaks(heatmap, today),
        "backlog": backlog,
        "heatmap": heatmap,
        "forecast": forecast,
        "retention_trend": retention_trend,
        "streak_history": streak_history,
        "weakest_decks": weakest_decks,
        "difficult_cards": difficult_cards,
    }
