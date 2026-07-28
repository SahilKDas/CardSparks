import math
from dataclasses import dataclass
from datetime import timedelta
from django.utils import timezone

from .models import Card

MIN_EASINESS, DEFAULT_EASINESS = 1.3, 2.5
PASS_THRESHOLD = 3
MASTERY_HORIZON_DAYS = 60
EASY_INTERVAL = 4
GOOD_INTERVAL = 2
HARD_FACTOR = 1.2
MAX_INTERVAL_DAYS = 36500

@dataclass(frozen=True)
class Schedule:
    easiness: float
    repetitions: int
    interval_days: int

def sm2(schedule: Schedule, grade: int):
    if not 0 <= grade <= 5:
        raise ValueError("Grade must be an integer between 0 and 5.")

    delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
    easiness = max(MIN_EASINESS, schedule.easiness + delta)

    if grade < PASS_THRESHOLD:
        return Schedule(easiness=easiness, repetitions=0, interval_days=0)

    repetitions = schedule.repetitions + 1
    
    if repetitions == 1:
        interval_days = EASY_INTERVAL if grade == 5 else (GOOD_INTERVAL if grade == 4 else 1)
    elif repetitions == 2:
        interval_days = {3: 3, 4: 6, 5: 9}.get(grade, 6)
    else:
        base = schedule.interval_days * easiness
        interval_days = round(base * (HARD_FACTOR / easiness) if grade == 3 else base)

    return Schedule(easiness, repetitions, min(interval_days, MAX_INTERVAL_DAYS))

def derive_mastery(schedule: Schedule):
    if schedule.interval_days <= 0:
        return 0
    return min(1.0, math.log1p(schedule.interval_days) / math.log1p(MASTERY_HORIZON_DAYS))

def apply_review(card: Card, grade: int, now=None):
    now = now or timezone.now()

    current = Schedule(card.easiness, card.repetitions, card.interval_days)
    result = sm2(current, grade)

    if grade < PASS_THRESHOLD and card.repetitions > 0:
        card.lapses += 1

    card.easiness = result.easiness
    card.repetitions = result.repetitions
    card.interval_days = result.interval_days
    card.due_at = now + timedelta(days=result.interval_days)
    card.last_reviewed_at = now
    card.mastery = derive_mastery(result)

    return result
