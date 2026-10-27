"""Review-queue selection: sibling burying, urgency, and linked-note spacing.

The first half drives the pure policy in `app.review_queue`; the second half
goes through the real endpoints (POST /study-cards, /review, GET
/study-cards/due, GET /files) against the throwaway SQLite DB.
"""
import random
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from app import review_queue as rq
from app.database import SessionLocal
from app.models import Annotation, CardReview, NoteLink, StudyCard

NOW = datetime(2026, 10, 27, 12, 0, 0)
_ids = iter(range(1, 1_000_000))


def card(ann, state="Review", due_days_ago=1.0, cloze=0, id=None):
    return SimpleNamespace(
        id=id if id is not None else next(_ids),
        annotation_id=ann,
        state=state,
        due=NOW - timedelta(days=due_days_ago),
        cloze_index=cloze,
    )


def order(queue):
    """The play order clients use: review → learning → new."""
    return queue["due_cards"] + queue["learning_cards"] + queue["new_cards"]


def anns(cards):
    return [c.annotation_id for c in cards]


# ─── select_deliverable: one per annotation, siblings buried ────────────

def test_one_card_per_annotation():
    cards = [card(1, cloze=0), card(1, cloze=1), card(1, cloze=2), card(2)]
    out = rq.select_deliverable(cards, [])
    assert sorted(anns(out)) == [1, 2]


def test_annotation_keeps_its_most_urgent_card():
    learning = card(1, state="Learning", due_days_ago=0, cloze=2)
    overdue = card(1, state="Review", due_days_ago=9, cloze=1)
    fresh = card(1, state="New", due_days_ago=20, cloze=0)
    assert rq.select_deliverable([fresh, overdue, learning], []) == [learning]
    assert rq.select_deliverable([fresh, overdue], []) == [overdue]


def test_ties_go_to_the_earlier_blank():
    same_due = dict(state="New", due_days_ago=0)
    b2, b0, b1 = card(1, cloze=2, **same_due), card(1, cloze=0, **same_due), card(1, cloze=1, **same_due)
    assert rq.select_deliverable([b2, b0, b1], []) == [b0]


def test_recently_reviewed_sibling_buries_new_and_review_cards():
    reviewed = card(1, cloze=0, id=10)  # not due any more; only in the recent list
    new_sib = card(1, state="New", cloze=1)
    review_sib = card(1, state="Review", cloze=2)
    other = card(2)
    out = rq.select_deliverable([new_sib, review_sib, other], [(1, reviewed.id)])
    assert out == [other]


def test_learning_cards_are_never_buried():
    # Blank 0 was failed a minute ago and is on a relearning step; blank 1
    # was also reviewed recently. Burying would strand the relearning card.
    relearning = card(1, state="Relearning", due_days_ago=0, cloze=0, id=20)
    out = rq.select_deliverable([relearning], [(1, 20), (1, 21)])
    assert out == [relearning]


def test_a_card_is_not_buried_by_its_own_review():
    c = card(1, state="Review", id=30)
    assert rq.select_deliverable([c], [(1, 30)]) == [c]


def test_recent_reviews_elsewhere_bury_nothing():
    c = card(1)
    assert rq.select_deliverable([c], [(2, 999)]) == [c]


# ─── build_queue: urgency, limit, buckets ───────────────────────────────

def test_buckets_and_most_overdue_first():
    r_old, r_new = card(1, due_days_ago=9), card(2, due_days_ago=1)
    l1 = card(3, state="Learning", due_days_ago=0)
    n1 = card(4, state="New")
    q = rq.build_queue([r_new, n1, l1, r_old], [], limit=50)
    assert q["due_cards"] == [r_old, r_new]
    assert q["learning_cards"] == [l1]
    assert q["new_cards"] == [n1]


def test_limit_is_filled_by_urgency():
    learning = [card(i, state="Relearning", due_days_ago=0) for i in range(1, 3)]
    reviews = [card(10 + i, due_days_ago=i) for i in range(1, 6)]  # 1..5 days overdue
    news = [card(20 + i, state="New") for i in range(3)]
    q = rq.build_queue(learning + reviews + news, [], limit=5)
    assert len(order(q)) == 5
    assert sorted(anns(q["learning_cards"])) == anns(learning)
    # The three most overdue reviews survive; no new card does.
    assert anns(q["due_cards"]) == [15, 14, 13]
    assert q["new_cards"] == []


def test_zero_limit_and_empty_input():
    assert order(rq.build_queue([card(1)], [], limit=0)) == []
    assert order(rq.build_queue([], [(1, 2)], limit=10)) == []


# ─── build_queue: linked notes spaced apart ─────────────────────────────

def positions(queue):
    return {c.annotation_id: i for i, c in enumerate(order(queue))}


def test_linked_cards_are_pushed_apart():
    cards = [card(a, due_days_ago=10 - a) for a in range(1, 6)]  # due order 1..5
    q = rq.build_queue(cards, [(1, 2)], limit=50)
    pos = positions(q)
    assert abs(pos[1] - pos[2]) >= rq.LINK_SPACING
    assert pos[1] == 0  # the most overdue still leads


def test_link_direction_does_not_matter():
    cards = [card(a, due_days_ago=10 - a) for a in range(1, 6)]
    q = rq.build_queue(cards, [(2, 1)], limit=50)
    pos = positions(q)
    assert abs(pos[1] - pos[2]) >= rq.LINK_SPACING


def test_spacing_holds_across_bucket_boundaries():
    # The last review card and the first learning card are linked: the
    # client concatenates the buckets, so they'd be adjacent unspaced.
    reviews = [card(1, due_days_ago=3), card(2, due_days_ago=2)]
    learning = [card(3, state="Learning", due_days_ago=0),
                card(4, state="Learning", due_days_ago=0.0),
                card(5, state="Learning", due_days_ago=0.0)]
    q = rq.build_queue(reviews + learning, [(2, 3)], limit=50)
    pos = positions(q)
    assert abs(pos[2] - pos[3]) >= rq.LINK_SPACING
    # Buckets stay pure: spacing never moves a card into another bucket.
    assert anns(q["due_cards"]) == [1, 2]
    assert sorted(anns(q["learning_cards"])) == [3, 4, 5]


def test_unavoidable_conflict_keeps_due_order():
    # Everything linked to everything: nothing can be spaced, so the queue
    # falls back to plain urgency order instead of shuffling.
    cards = [card(a, due_days_ago=10 - a) for a in range(1, 4)]
    links = [(1, 2), (1, 3), (2, 3)]
    assert anns(order(rq.build_queue(cards, links, limit=50))) == [1, 2, 3]


def test_unlinked_queue_is_pure_urgency_order():
    cards = [card(a, due_days_ago=a) for a in range(1, 8)]
    assert anns(order(rq.build_queue(cards, [], limit=50))) == [7, 6, 5, 4, 3, 2, 1]


@pytest.mark.parametrize("seed", range(25))
def test_invariants_on_random_libraries(seed):
    rng = random.Random(seed)
    states = ["New", "Learning", "Review", "Relearning"]
    cards = [
        card(rng.randint(1, 25), state=rng.choice(states),
             due_days_ago=rng.uniform(0, 30), cloze=rng.randint(0, 3))
        for _ in range(80)
    ]
    recent = [(rng.randint(1, 25), rng.randint(1, 10_000)) for _ in range(5)]
    links = {tuple(sorted(rng.sample(range(1, 26), 2))) for _ in range(15)}
    limit = rng.randint(1, 40)

    deliverable = rq.select_deliverable(cards, recent)
    q = rq.build_queue(deliverable, links, limit)
    played = order(q)

    # Never two cards from one annotation — the sibling leak is impossible.
    assert len(anns(played)) == len(set(anns(played)))
    # Only deliverable cards, at most `limit` of them, nothing invented.
    assert set(map(id, played)) <= set(map(id, deliverable))
    assert len(played) == min(limit, len(deliverable))
    # Buckets hold the right states.
    assert all(c.state in rq.LEARNING_STATES for c in q["learning_cards"])
    assert all(c.state == "New" for c in q["new_cards"])
    assert all(c.state == "Review" for c in q["due_cards"])
    # Buried cards really are absent.
    recent_by_ann = {}
    for a, cid in recent:
        recent_by_ann.setdefault(a, set()).add(cid)
    for c in played:
        if c.state not in rq.LEARNING_STATES:
            assert not (recent_by_ann.get(c.annotation_id, set()) - {c.id})


# ─── Through the API ────────────────────────────────────────────────────

@pytest.fixture
def db_clean():
    def wipe():
        db = SessionLocal()
        try:
            db.query(CardReview).delete()
            db.query(StudyCard).delete()
            db.query(NoteLink).delete()
            db.query(Annotation).delete()
            db.commit()
        finally:
            db.close()
    wipe()
    yield
    wipe()


def cloze_note(client, text, file_id=None):
    path = f"/files/{file_id}/annotations" if file_id else "/annotations"
    body = {"annotation_id": f"ann_{next(_ids)}", "question": text, "answer": ""}
    if file_id:
        body["page_index"] = 0
    resp = client.post(path, json=body)
    assert resp.status_code == 200, resp.text
    ann_id = resp.json()["id"]
    cards = client.post("/study-cards", params={"annotation_id": ann_id})
    assert cards.status_code == 200, cards.text
    return ann_id, sorted(cards.json(), key=lambda c: c["cloze_index"])


def due(client, **params):
    resp = client.get("/study-cards/due", params=params)
    assert resp.status_code == 200, resp.text
    return order_json(resp.json())


def order_json(body):
    return body["due_cards"] + body["learning_cards"] + body["new_cards"]


def backdate(card_ids, *, due_days_ago=0.0, last_review_hours_ago=None, state=None):
    db = SessionLocal()
    try:
        for c in db.query(StudyCard).filter(StudyCard.id.in_(card_ids)):
            c.due = datetime.utcnow() - timedelta(days=due_days_ago)
            if last_review_hours_ago is not None:
                c.last_review = datetime.utcnow() - timedelta(hours=last_review_hours_ago)
            if state is not None:
                c.state = state
        db.commit()
    finally:
        db.close()


def test_api_serves_one_blank_per_annotation(client, db_clean):
    a, a_cards = cloze_note(client, "[[Paris]] is the capital of [[France]], on the [[Seine]].")
    b, _ = cloze_note(client, "[[Water]] boils at 100C at sea level.")
    backdate([c["id"] for c in a_cards])

    queue = due(client)
    assert sorted(c["annotation_id"] for c in queue) == sorted([a, b])
    served_a = next(c for c in queue if c["annotation_id"] == a)
    assert served_a["cloze_index"] == 0


def test_api_buries_siblings_after_a_review(client, db_clean):
    a, a_cards = cloze_note(client, "[[Paris]] is the capital of [[France]].")
    first = due(client)
    assert [c["id"] for c in first] == [a_cards[0]["id"]]

    resp = client.post(f"/study-cards/{a_cards[0]['id']}/review",
                       json={"card_id": a_cards[0]["id"], "rating": 3})
    assert resp.status_code == 200, resp.text

    # Blank 1 is due (new) but its sibling was just on screen with its answer.
    assert due(client) == []


def test_api_releases_siblings_after_the_bury_window(client, db_clean):
    a, a_cards = cloze_note(client, "[[Paris]] is the capital of [[France]].")
    backdate([a_cards[0]["id"]], due_days_ago=-30,
             last_review_hours_ago=rq.SIBLING_BURY_HOURS + 1, state="Review")
    queue = due(client)
    assert [c["id"] for c in queue] == [a_cards[1]["id"]]


def test_api_failed_card_still_comes_back(client, db_clean):
    a, a_cards = cloze_note(client, "[[Paris]] is the capital of [[France]].")
    backdate([a_cards[0]["id"]], due_days_ago=0.01,
             last_review_hours_ago=0.1, state="Relearning")
    queue = due(client)
    assert [c["id"] for c in queue] == [a_cards[0]["id"]]


def test_api_limit_keeps_the_most_overdue(client, db_clean):
    made = [cloze_note(client, f"[[fact {i}]] number {i}") for i in range(6)]
    for i, (_, cards) in enumerate(made):
        backdate([cards[0]["id"]], due_days_ago=i + 1, state="Review")
    queue = due(client, limit=3)
    assert [c["annotation_id"] for c in queue] == [made[5][0], made[4][0], made[3][0]]


def test_api_spaces_linked_notes(client, db_clean):
    made = [cloze_note(client, f"[[claim {i}]] holds") for i in range(5)]
    for i, (_, cards) in enumerate(made):
        backdate([cards[0]["id"]], due_days_ago=10 - i, state="Review")
    a, b = made[0][0], made[1][0]
    db = SessionLocal()
    try:
        db.add(NoteLink(a_id=min(a, b), b_id=max(a, b), status="active", pair_sig="t"))
        # A declined link is not shown at review, so it must not move anything.
        c, d = made[2][0], made[3][0]
        db.add(NoteLink(a_id=min(c, d), b_id=max(c, d), status="declined", pair_sig="t"))
        db.commit()
    finally:
        db.close()

    played = [c["annotation_id"] for c in due(client)]
    assert abs(played.index(a) - played.index(b)) >= rq.LINK_SPACING
    assert played.index(d) - played.index(c) == 1


def test_api_library_badge_matches_the_queue(client, db_clean):
    from tests.pdf_factory import make_pdf

    up = client.post("/upload", files={"file": (
        "doc.pdf", make_pdf([["badge test"], ["page two"]]), "application/pdf")})
    assert up.status_code == 200, up.text
    file_id = up.json()["file_data"]["id"]
    a, a_cards = cloze_note(client, "[[one]] [[two]] [[three]]", file_id=file_id)
    cloze_note(client, "[[four]] alone", file_id=file_id)
    backdate([c["id"] for c in a_cards])

    files = {f["id"]: f for f in client.get("/files").json()}
    queue = due(client, file_id=file_id)
    assert files[file_id]["due_count"] == len(queue) == 2
