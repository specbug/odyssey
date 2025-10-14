#!/usr/bin/env python3
"""
FSRS Integration Test Suite

Comprehensive end-to-end tests for the FSRS implementation.
Tests the complete flow from card creation to review with all 4 ratings.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from app.database import SessionLocal
from app.models import StudyCard, Annotation, PDFFile, CardReview
from app.spaced_repetition import SpacedRepetitionService


class FSRSIntegrationTest:
    """Comprehensive FSRS integration tests."""

    def __init__(self):
        self.db = SessionLocal()
        self.test_results = []

    def cleanup_test_data(self):
        """Clean up test data."""
        try:
            # Delete test cards and annotations
            test_annotations = (
                self.db.query(Annotation)
                .filter(Annotation.annotation_id.like("fsrs_test_%"))
                .all()
            )
            for ann in test_annotations:
                self.db.delete(ann)

            test_pdfs = (
                self.db.query(PDFFile)
                .filter(PDFFile.filename == "fsrs_test.pdf")
                .all()
            )
            for pdf in test_pdfs:
                self.db.delete(pdf)

            self.db.commit()
        except Exception as e:
            self.db.rollback()

    def create_test_annotation(self) -> Annotation:
        """Create a test annotation."""
        # Create test PDF
        test_pdf = PDFFile(
            filename="fsrs_test.pdf",
            original_filename="fsrs_test.pdf",
            file_hash=f"fsrs_test_{int(datetime.utcnow().timestamp())}",
            file_size=1000,
            file_path="/test/path",
            mime_type="application/pdf",
        )
        self.db.add(test_pdf)
        self.db.commit()
        self.db.refresh(test_pdf)

        # Create test annotation
        annotation = Annotation(
            file_id=test_pdf.id,
            annotation_id=f"fsrs_test_{int(datetime.utcnow().timestamp())}",
            page_index=0,
            question="What is FSRS?",
            answer="Free Spaced Repetition Scheduler",
            highlighted_text="test",
            position_data="{}",
        )
        self.db.add(annotation)
        self.db.commit()
        self.db.refresh(annotation)

        return annotation

    def test_card_creation(self) -> bool:
        """Test 1: Card creation with FSRS defaults."""
        print("\n" + "=" * 80)
        print("TEST 1: Card Creation with FSRS Defaults")
        print("=" * 80)

        try:
            annotation = self.create_test_annotation()
            card = SpacedRepetitionService.create_study_card(self.db, annotation.id)

            # Verify FSRS initialization
            assert card.state == "New", f"Expected state 'New', got '{card.state}'"
            assert card.difficulty == 0.0, f"Expected difficulty 0.0, got {card.difficulty}"
            assert card.stability == 0.0, f"Expected stability 0.0, got {card.stability}"
            assert card.reps == 0, f"Expected 0 reps, got {card.reps}"
            assert card.lapses == 0, f"Expected 0 lapses, got {card.lapses}"
            assert card.due is not None, "Card should have a due date"

            print(f"✅ Card created successfully")
            print(f"   • ID: {card.id}")
            print(f"   • State: {card.state}")
            print(f"   • Difficulty: {card.difficulty}")
            print(f"   • Stability: {card.stability}")
            print(f"   • Due: {card.due}")

            self.test_results.append(("Card Creation", True, card))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Card Creation", False, str(e)))
            return False

    def test_rating_again(self, card: StudyCard) -> bool:
        """Test 2: Review with 'Again' rating."""
        print("\n" + "=" * 80)
        print("TEST 2: Review with 'Again' Rating (Forgot)")
        print("=" * 80)

        try:
            state_before = card.state
            result = SpacedRepetitionService.review_card(self.db, card.id, rating=1)
            self.db.refresh(card)

            assert result.review.rating == 1, "Rating should be 1 (Again)"
            assert card.state in ["Learning", "Relearning"], f"State should be Learning/Relearning, got {card.state}"
            assert card.scheduled_days >= 0, "Scheduled days should be >= 0"

            print(f"✅ 'Again' rating works correctly")
            print(f"   • State: {state_before} → {card.state}")
            print(f"   • Next review: {card.scheduled_days} days")
            print(f"   • Message: {result.message}")
            print(f"   • Difficulty: {card.difficulty:.2f}")

            self.test_results.append(("Rating: Again", True, card))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Rating: Again", False, str(e)))
            return False

    def test_rating_hard(self, card: StudyCard) -> bool:
        """Test 3: Review with 'Hard' rating."""
        print("\n" + "=" * 80)
        print("TEST 3: Review with 'Hard' Rating")
        print("=" * 80)

        try:
            state_before = card.state
            result = SpacedRepetitionService.review_card(self.db, card.id, rating=2)
            self.db.refresh(card)

            assert result.review.rating == 2, "Rating should be 2 (Hard)"
            assert card.scheduled_days >= 0, "Scheduled days should be >= 0"

            print(f"✅ 'Hard' rating works correctly")
            print(f"   • State: {state_before} → {card.state}")
            print(f"   • Next review: {card.scheduled_days} days")
            print(f"   • Message: {result.message}")
            print(f"   • Stability: {card.stability:.2f}")

            self.test_results.append(("Rating: Hard", True, card))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Rating: Hard", False, str(e)))
            return False

    def test_rating_good(self, card: StudyCard) -> bool:
        """Test 4: Review with 'Good' rating."""
        print("\n" + "=" * 80)
        print("TEST 4: Review with 'Good' Rating")
        print("=" * 80)

        try:
            state_before = card.state
            result = SpacedRepetitionService.review_card(self.db, card.id, rating=3)
            self.db.refresh(card)

            assert result.review.rating == 3, "Rating should be 3 (Good)"
            assert card.scheduled_days >= 0, "Scheduled days should be >= 0"

            print(f"✅ 'Good' rating works correctly")
            print(f"   • State: {state_before} → {card.state}")
            print(f"   • Next review: {card.scheduled_days} days")
            print(f"   • Message: {result.message}")
            print(f"   • Reps: {card.reps}")

            self.test_results.append(("Rating: Good", True, card))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Rating: Good", False, str(e)))
            return False

    def test_rating_easy(self, card: StudyCard) -> bool:
        """Test 5: Review with 'Easy' rating."""
        print("\n" + "=" * 80)
        print("TEST 5: Review with 'Easy' Rating")
        print("=" * 80)

        try:
            state_before = card.state
            result = SpacedRepetitionService.review_card(self.db, card.id, rating=4)
            self.db.refresh(card)

            assert result.review.rating == 4, "Rating should be 4 (Easy)"
            assert card.scheduled_days >= 0, "Scheduled days should be >= 0"

            print(f"✅ 'Easy' rating works correctly")
            print(f"   • State: {state_before} → {card.state}")
            print(f"   • Next review: {card.scheduled_days} days")
            print(f"   • Message: {result.message}")
            print(f"   • Stability: {card.stability:.2f}")

            self.test_results.append(("Rating: Easy", True, card))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Rating: Easy", False, str(e)))
            return False

    def test_get_due_cards(self) -> bool:
        """Test 6: Get due cards by FSRS state."""
        print("\n" + "=" * 80)
        print("TEST 6: Get Due Cards (FSRS State Categorization)")
        print("=" * 80)

        try:
            due_cards_data = SpacedRepetitionService.get_due_cards(self.db, limit=50)

            new_cards = due_cards_data["new_cards"]
            learning_cards = due_cards_data["learning_cards"]
            review_cards = due_cards_data["due_cards"]

            total = len(new_cards) + len(learning_cards) + len(review_cards)

            print(f"✅ get_due_cards works correctly")
            print(f"   • New cards: {len(new_cards)}")
            print(f"   • Learning/Relearning cards: {len(learning_cards)}")
            print(f"   • Review cards: {len(review_cards)}")
            print(f"   • Total due: {total}")

            self.test_results.append(("Get Due Cards", True, None))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Get Due Cards", False, str(e)))
            return False

    def test_timeline_generation(self, card: StudyCard) -> bool:
        """Test 7: Timeline generation with 4 rating options."""
        print("\n" + "=" * 80)
        print("TEST 7: Timeline Generation (4-Way Preview)")
        print("=" * 80)

        try:
            timeline = SpacedRepetitionService.get_card_timeline(card)

            assert len(timeline["timeline_points"]) == 4, "Should have 4 timeline points"

            print(f"✅ Timeline generation works correctly")
            print(f"   • Current state: {timeline['current_state']}")
            print(f"   • Timeline points:")

            for point in timeline["timeline_points"]:
                print(f"     {point['rating_label']:6} → {point['interval_text']:>12} "
                      f"(State: {point['card_state']})")

            self.test_results.append(("Timeline Generation", True, None))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Timeline Generation", False, str(e)))
            return False

    def test_study_stats(self) -> bool:
        """Test 8: Study statistics."""
        print("\n" + "=" * 80)
        print("TEST 8: Study Statistics")
        print("=" * 80)

        try:
            stats = SpacedRepetitionService.get_study_stats(self.db)

            print(f"✅ Study stats work correctly")
            print(f"   • Total cards: {stats['total_cards']}")
            print(f"   • New cards: {stats['new_cards']}")
            print(f"   • Learning cards: {stats['learning_cards']}")
            print(f"   • Review cards: {stats['review_cards']}")
            print(f"   • Due today: {stats['due_today']}")

            self.test_results.append(("Study Stats", True, None))
            return True

        except Exception as e:
            print(f"❌ Test failed: {str(e)}")
            self.test_results.append(("Study Stats", False, str(e)))
            return False

    def print_final_results(self):
        """Print final test results summary."""
        print("\n" + "=" * 80)
        print("📊 FINAL TEST RESULTS")
        print("=" * 80)

        passed = sum(1 for _, success, _ in self.test_results if success)
        total = len(self.test_results)

        print(f"\n{'Test Name':<30} {'Status':<10}")
        print("-" * 42)

        for test_name, success, _ in self.test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{test_name:<30} {status:<10}")

        print("\n" + "=" * 80)
        print(f"TOTAL: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")

        if passed == total:
            print("\n🎉 ALL TESTS PASSED - FSRS INTEGRATION VERIFIED!")
        else:
            print(f"\n⚠️  {total - passed} tests failed - review errors above")

        print("=" * 80 + "\n")

    def run_all_tests(self):
        """Run the complete test suite."""
        print("\n" + "=" * 80)
        print("🧪 FSRS INTEGRATION TEST SUITE")
        print("=" * 80)

        # Cleanup
        self.cleanup_test_data()

        # Test 1: Card creation
        if not self.test_card_creation():
            print("\n❌ Card creation failed - aborting remaining tests")
            self.print_final_results()
            return

        # Get the created card for remaining tests
        card = self.test_results[0][2]

        # Test 2-5: All 4 ratings
        self.test_rating_again(card)
        self.test_rating_hard(card)
        self.test_rating_good(card)
        self.test_rating_easy(card)

        # Test 6-8: Additional functionality
        self.test_get_due_cards()
        self.test_timeline_generation(card)
        self.test_study_stats()

        # Final results
        self.print_final_results()

        # Cleanup
        self.cleanup_test_data()
        self.db.close()


def main():
    """Run the integration tests."""
    tester = FSRSIntegrationTest()
    tester.run_all_tests()


if __name__ == "__main__":
    main()
