#!/usr/bin/env python3
"""
Comprehensive Timeline Test Script

This script tests the timeline functionality by:
1. Creating test cards in different states (new, learning, graduated)
2. Testing timeline calculation for each card state
3. Verifying API endpoint responses
4. Testing different quality rating scenarios
5. Validating timeline accuracy against actual reviews
"""

import sys
import os
import json
from datetime import datetime, timedelta

try:
    from fastapi.testclient import TestClient
except ImportError:
    from starlette.testclient import TestClient

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.database import SessionLocal, engine
from app.models import Base, StudyCard, Annotation, PDFFile, CardReview
from app.spaced_repetition import SpacedRepetitionService
from app.schemas import TimelineResponse, CardTimeline, TimelinePoint


class TimelineTester:
    def __init__(self):
        self.db = SessionLocal()
        try:
            self.client = TestClient(app)
        except Exception as e:
            print(f"Warning: Could not create TestClient: {e}")
            self.client = None
        self.test_cards = []
        self.test_annotations = []
        self.test_pdf = None

    def setup_test_data(self):
        """Create test data for timeline testing"""
        print("🔧 Setting up test data for timeline testing...")

        # Clean up existing test data
        self.cleanup_test_data()

        # Create test PDF file
        self.test_pdf = PDFFile(
            filename="test_timeline.pdf",
            original_filename="test_timeline.pdf",
            file_hash=f"timeline_test_hash_{int(datetime.utcnow().timestamp())}",
            file_size=1000,
            file_path="/test/timeline/path",
            mime_type="application/pdf",
        )
        self.db.add(self.test_pdf)
        self.db.commit()
        self.db.refresh(self.test_pdf)

        # Create test annotations and cards in different states
        self.create_new_card()
        self.create_learning_card()
        self.create_graduated_card()

        print(f"✅ Created {len(self.test_cards)} test cards in different states")

    def cleanup_test_data(self):
        """Clean up test data"""
        try:
            # Delete test study cards and reviews
            test_cards = (
                self.db.query(StudyCard)
                .join(Annotation)
                .filter(Annotation.annotation_id.like("timeline_test_%"))
                .all()
            )
            for card in test_cards:
                # Delete associated reviews
                self.db.query(CardReview).filter(CardReview.card_id == card.id).delete()
                self.db.delete(card)

            # Delete test annotations
            test_annotations = (
                self.db.query(Annotation)
                .filter(Annotation.annotation_id.like("timeline_test_%"))
                .all()
            )
            for annotation in test_annotations:
                self.db.delete(annotation)

            # Delete test PDF
            if self.test_pdf:
                self.db.delete(self.test_pdf)

            self.db.commit()
            print("🧹 Cleaned up timeline test data")
        except Exception as e:
            print(f"⚠️  Warning during cleanup: {e}")
            self.db.rollback()

    def create_new_card(self):
        """Create a new card (never reviewed)"""
        annotation = Annotation(
            file_id=self.test_pdf.id,
            annotation_id=f"timeline_test_new_{int(datetime.utcnow().timestamp())}",
            page_index=0,
            question="What is a new card?",
            answer="A card that has never been reviewed",
            highlighted_text="new card text",
            position_data="{}",
        )
        self.db.add(annotation)
        self.db.commit()
        self.db.refresh(annotation)

        card = SpacedRepetitionService.create_study_card(self.db, annotation.id)
        self.test_cards.append({"card": card, "state": "new", "annotation": annotation})
        self.test_annotations.append(annotation)
        return card

    def create_learning_card(self):
        """Create a learning card (reviewed once, failed)"""
        annotation = Annotation(
            file_id=self.test_pdf.id,
            annotation_id=f"timeline_test_learning_{int(datetime.utcnow().timestamp())}",
            page_index=0,
            question="What is a learning card?",
            answer="A card that is in the learning phase",
            highlighted_text="learning card text",
            position_data="{}",
        )
        self.db.add(annotation)
        self.db.commit()
        self.db.refresh(annotation)

        card = SpacedRepetitionService.create_study_card(self.db, annotation.id)

        # Review with quality 1 (wrong) to put it in learning state
        SpacedRepetitionService.review_card(self.db, card.id, quality=1)
        self.db.refresh(card)

        self.test_cards.append(
            {"card": card, "state": "learning", "annotation": annotation}
        )
        self.test_annotations.append(annotation)
        return card

    def create_graduated_card(self):
        """Create a graduated card (successfully reviewed multiple times)"""
        annotation = Annotation(
            file_id=self.test_pdf.id,
            annotation_id=f"timeline_test_graduated_{int(datetime.utcnow().timestamp())}",
            page_index=0,
            question="What is a graduated card?",
            answer="A card that has passed the learning phase",
            highlighted_text="graduated card text",
            position_data="{}",
        )
        self.db.add(annotation)
        self.db.commit()
        self.db.refresh(annotation)

        card = SpacedRepetitionService.create_study_card(self.db, annotation.id)

        # Review with quality 4 (easy) to graduate it
        SpacedRepetitionService.review_card(self.db, card.id, quality=4)
        self.db.refresh(card)

        # Review again to get it to graduated state
        SpacedRepetitionService.review_card(self.db, card.id, quality=4)
        self.db.refresh(card)

        self.test_cards.append(
            {"card": card, "state": "graduated", "annotation": annotation}
        )
        self.test_annotations.append(annotation)
        return card

    def test_timeline_calculation(self):
        """Test timeline calculation logic"""
        print("\n🧪 Testing timeline calculation logic...")

        for test_card_data in self.test_cards:
            card = test_card_data["card"]
            state = test_card_data["state"]

            print(f"\n📋 Testing timeline for {state} card (ID: {card.id})")

            # Get timeline data
            timeline_data = SpacedRepetitionService.get_card_timeline(card)

            # Verify timeline structure
            assert "card_id" in timeline_data
            assert "current_state" in timeline_data
            assert "timeline_points" in timeline_data
            assert "generated_at" in timeline_data

            # Verify card_id matches
            assert timeline_data["card_id"] == card.id

            # Verify we have timeline points for all quality ratings (0-5)
            timeline_points = timeline_data["timeline_points"]
            assert len(timeline_points) == 6

            # Verify each timeline point has required fields
            for point in timeline_points:
                assert "quality" in point
                assert "quality_label" in point
                assert "next_review_date" in point
                assert "interval_text" in point
                assert "card_state" in point
                assert "easiness_after" in point
                assert "repetitions_after" in point

                # Quality should be between 0-5
                assert 0 <= point["quality"] <= 5

                # Quality label should be meaningful
                assert point["quality_label"] in [
                    "Blackout",
                    "Wrong",
                    "Hard",
                    "Good",
                    "Easy",
                    "Perfect",
                ]

                # Next review date should be in the future
                assert point["next_review_date"] > datetime.utcnow()

                # Interval text should be meaningful
                assert point["interval_text"] != ""

                # Card state should be valid
                assert point["card_state"] in ["new", "learning", "graduated"]

            print(f"   ✅ Timeline calculation passed for {state} card")

            # Print timeline summary
            print(f"   📊 Timeline summary:")
            for point in timeline_points:
                print(
                    f"      Quality {point['quality']} ({point['quality_label']}): {point['interval_text']} -> {point['card_state']}"
                )

    def test_timeline_api_endpoint(self):
        """Test the timeline API endpoint"""
        print("\n🌐 Testing timeline API endpoint...")

        if self.client is None:
            print("   ⚠️  Skipping API tests - TestClient not available")
            return

        for test_card_data in self.test_cards:
            card = test_card_data["card"]
            state = test_card_data["state"]

            print(f"\n📡 Testing API for {state} card (ID: {card.id})")

            # Test successful request
            response = self.client.get(f"/study-cards/{card.id}/timeline")

            # Verify response status
            assert response.status_code == 200

            # Verify response structure
            data = response.json()
            assert "success" in data
            assert "timeline" in data
            assert "message" in data

            assert data["success"] == True

            # Verify timeline data
            timeline = data["timeline"]
            assert "card_id" in timeline
            assert "current_state" in timeline
            assert "timeline_points" in timeline
            assert "generated_at" in timeline

            # Verify timeline points
            timeline_points = timeline["timeline_points"]
            assert len(timeline_points) == 6

            print(f"   ✅ API endpoint passed for {state} card")

        # Test 404 for non-existent card
        response = self.client.get("/study-cards/99999/timeline")
        assert response.status_code == 404

        print("   ✅ 404 handling works correctly")

    def test_timeline_accuracy(self):
        """Test timeline accuracy by comparing with actual reviews"""
        print("\n🎯 Testing timeline accuracy...")

        # Get a new card for testing
        card = self.create_new_card()

        # Get timeline prediction
        timeline_data = SpacedRepetitionService.get_card_timeline(card)
        timeline_points = timeline_data["timeline_points"]

        # Test quality 1 (wrong) prediction
        wrong_prediction = next(p for p in timeline_points if p["quality"] == 1)
        predicted_state = wrong_prediction["card_state"]
        predicted_interval = wrong_prediction["interval_text"]

        print(f"   📊 Predicted for quality 1: {predicted_state}, {predicted_interval}")

        # Actually review with quality 1
        result = SpacedRepetitionService.review_card(self.db, card.id, quality=1)
        self.db.refresh(card)

        # Verify prediction accuracy
        actual_state = SpacedRepetitionService._get_card_state_label(card)

        print(f"   📊 Actual after quality 1: {actual_state}")

        # States should match
        assert predicted_state == actual_state

        print("   ✅ Timeline prediction accuracy verified")

    def test_timeline_progression(self):
        """Test timeline progression through different states"""
        print("\n🔄 Testing timeline progression...")

        # Create a new card
        card = self.create_new_card()

        # Test progression: new -> learning -> graduated
        states_to_test = ["new", "learning", "graduated"]
        qualities_to_apply = [1, 3, 4]  # wrong, good, easy

        for i, (expected_state, quality) in enumerate(
            zip(states_to_test, qualities_to_apply)
        ):
            # Get timeline before review
            timeline_data = SpacedRepetitionService.get_card_timeline(card)
            current_state = timeline_data["current_state"]

            print(f"\n   📈 Step {i + 1}: Card in {current_state} state")

            # Find the timeline point for the quality we'll use
            timeline_points = timeline_data["timeline_points"]
            target_point = next(p for p in timeline_points if p["quality"] == quality)

            predicted_next_state = target_point["card_state"]
            print(f"   🎯 Applying quality {quality}, expecting {predicted_next_state}")

            # Apply the review
            SpacedRepetitionService.review_card(self.db, card.id, quality=quality)
            self.db.refresh(card)

            # Check actual state
            actual_state = SpacedRepetitionService._get_card_state_label(card)
            print(f"   ✅ Actual state after review: {actual_state}")

            # For the first review (new -> learning), the prediction might be different
            # because new cards have special behavior
            if i == 0:
                # New cards reviewed with quality 1 go to learning
                assert actual_state == "learning"
            else:
                # Later reviews should match predictions
                assert actual_state == predicted_next_state

    def test_timeline_edge_cases(self):
        """Test timeline edge cases"""
        print("\n🔍 Testing timeline edge cases...")

        # Test with very high repetition card
        card = self.create_graduated_card()

        # Simulate many successful reviews to get high repetition
        for i in range(5):
            SpacedRepetitionService.review_card(self.db, card.id, quality=4)
            self.db.refresh(card)

        # Get timeline
        timeline_data = SpacedRepetitionService.get_card_timeline(card)

        # Should still have 6 timeline points
        assert len(timeline_data["timeline_points"]) == 6

        # Should have valid intervals even for high repetition
        for point in timeline_data["timeline_points"]:
            assert point["interval_text"] != ""
            assert point["next_review_date"] > datetime.utcnow()

        print("   ✅ High repetition card timeline works correctly")

        # Test with card that has been failing repeatedly
        failing_card = self.create_learning_card()

        # Review with quality 0 multiple times
        for i in range(3):
            SpacedRepetitionService.review_card(self.db, failing_card.id, quality=0)
            self.db.refresh(failing_card)

        # Get timeline
        timeline_data = SpacedRepetitionService.get_card_timeline(failing_card)

        # Should still work
        assert len(timeline_data["timeline_points"]) == 6

        print("   ✅ Repeatedly failing card timeline works correctly")

    def run_all_tests(self):
        """Run all timeline tests"""
        print("🚀 Starting comprehensive timeline tests...")

        try:
            self.setup_test_data()
            self.test_timeline_calculation()
            self.test_timeline_api_endpoint()
            self.test_timeline_accuracy()
            self.test_timeline_progression()
            self.test_timeline_edge_cases()

            print("\n✅ All timeline tests passed successfully!")
            return True

        except Exception as e:
            print(f"\n❌ Timeline test failed: {e}")
            import traceback

            traceback.print_exc()
            return False

        finally:
            self.cleanup_test_data()

    def generate_timeline_report(self):
        """Generate a detailed timeline report"""
        print("\n📊 Generating timeline report...")

        self.setup_test_data()

        report = {"generated_at": datetime.utcnow().isoformat(), "test_cards": []}

        for test_card_data in self.test_cards:
            card = test_card_data["card"]
            state = test_card_data["state"]

            timeline_data = SpacedRepetitionService.get_card_timeline(card)

            card_report = {
                "card_id": card.id,
                "current_state": state,
                "current_interval": card.interval,
                "current_easiness": card.easiness,
                "current_repetitions": card.repetitions,
                "timeline_points": timeline_data["timeline_points"],
            }

            report["test_cards"].append(card_report)

        # Save report
        with open("timeline_test_report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)

        print("   💾 Timeline report saved to timeline_test_report.json")

        self.cleanup_test_data()
        return report


def main():
    """Run timeline tests"""
    print("🧪 Timeline Test Suite")
    print("=" * 50)

    tester = TimelineTester()

    # Run all tests
    success = tester.run_all_tests()

    # Generate report
    tester.generate_timeline_report()

    if success:
        print("\n🎉 Timeline testing completed successfully!")
        return 0
    else:
        print("\n💥 Timeline testing failed!")
        return 1


if __name__ == "__main__":
    exit(main())
