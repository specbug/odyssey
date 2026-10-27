"""Which due cards make up a review session, and in what order.

Two leaks this guards against, both caused by what ReviewScreen shows:

- **Siblings.** An annotation with N `[[x]]` blanks is N cards, and each card
  renders the *other* blanks with their answers visible — before reveal. So
  reviewing blank 0 shows blank 1's answer, and spacing the two apart in a
  session doesn't help: the answer was on screen minutes ago. Siblings are
  therefore *buried*, not spaced: at most one card per annotation per queue,
  and a New / Review card is held back entirely while one of its siblings was
  reviewed within SIBLING_BURY_HOURS. Learning / Relearning cards are never
  buried — they're on minute-scale steps and FSRS needs them on time — but
  they still take their annotation's one slot.
- **Linked notes.** After reveal, a card lists its linked notes (the note
  graph) with their text, so a linked card that comes up right after has had
  its answer shown. That only happens post-reveal, so spacing is enough:
  linked cards are kept at least LINK_SPACING positions apart whenever the
  queue has something else to put in between.

Clients concatenate the buckets as review → learning → new (ReviewScreen.js,
HomeScreen.js). The spacing pass runs over that same sequence, so the
concatenation *is* the spaced queue and no client needs to change.

Everything here is pure — cards are anything with `id`, `annotation_id`,
`state`, `due` and `cloze_index` — so the policy is testable without a DB.
"""
from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime
from typing import Iterable, Sequence

LEARNING_STATES = ("Learning", "Relearning")

# How long a reviewed card keeps its siblings out of the queue. Rolling rather
# than calendar-day so it needs no timezone: a cloze reviewed in the evening
# releases its siblings the next morning.
SIBLING_BURY_HOURS = 12

# Minimum distance, in queue positions, between two cards whose notes are
# linked. 3 means at least two other cards sit between them.
LINK_SPACING = 3


def _urgency(card) -> tuple:
    """Sort key for picking an annotation's one card: learning steps first,
    then reviews, then new; within a class the most overdue, then blank order."""
    rank = 0 if card.state in LEARNING_STATES else 2 if card.state == "New" else 1
    return (rank, card.due or datetime.max, card.cloze_index, card.id)


def select_deliverable(
    cards: Iterable, recently_reviewed: Iterable[tuple[int, int]]
) -> list:
    """Drop buried siblings and keep one card per annotation.

    `recently_reviewed` is (annotation_id, card_id) for every card whose
    last review falls inside the bury window — due or not, since a sibling
    reviewed an hour ago usually isn't due any more.
    """
    recent: dict[int, set[int]] = defaultdict(set)
    for annotation_id, card_id in recently_reviewed:
        recent[annotation_id].add(card_id)

    best: dict[int, object] = {}
    for card in cards:
        if card.state not in LEARNING_STATES and recent[card.annotation_id] - {card.id}:
            continue  # a sibling was just on screen with this card's answer
        current = best.get(card.annotation_id)
        if current is None or _urgency(card) < _urgency(current):
            best[card.annotation_id] = card
    return list(best.values())


def build_queue(
    cards: Sequence, links: Iterable[tuple[int, int]], limit: int
) -> dict[str, list]:
    """Split deliverable cards into the response buckets, trimmed and spaced.

    The limit is filled by urgency — learning steps, then the most overdue
    reviews, then new cards — and the buckets come back in the order clients
    play them, with linked notes spaced across bucket boundaries too.
    """
    by_due = lambda c: (c.due or datetime.max, c.id)  # noqa: E731
    learning = sorted((c for c in cards if c.state in LEARNING_STATES), key=by_due)
    new = sorted((c for c in cards if c.state == "New"), key=by_due)
    review = sorted(
        (c for c in cards if c.state not in LEARNING_STATES and c.state != "New"),
        key=by_due,
    )

    budget = max(limit, 0)
    learning = learning[:budget]
    budget -= len(learning)
    review = review[:budget]
    budget -= len(review)
    new = new[:budget]

    linked: dict[int, set[int]] = defaultdict(set)
    for a, b in links:
        linked[a].add(b)
        linked[b].add(a)

    placed: deque[int] = deque(maxlen=max(LINK_SPACING - 1, 0))
    return {
        "due_cards": _space(review, linked, placed),
        "learning_cards": _space(learning, linked, placed),
        "new_cards": _space(new, linked, placed),
    }


def _space(bucket: list, linked: dict[int, set[int]], placed: deque) -> list:
    """Greedy: take the first card (in bucket order) not linked to anything in
    the last few placed; if every remaining card conflicts, take the first
    anyway — order beats spacing when there's no way to honour both."""
    remaining = list(bucket)
    out = []
    while remaining:
        nearby = set(placed)
        pick = next(
            (i for i, c in enumerate(remaining) if not (linked[c.annotation_id] & nearby)),
            0,
        )
        card = remaining.pop(pick)
        out.append(card)
        placed.append(card.annotation_id)
    return out
