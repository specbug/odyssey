#!/usr/bin/env python3
"""
Test script for verifying 1:1 constraints between annotations and study cards

This script tests:
1. UNIQUE constraint on annotation_id
2. NOT NULL constraint on annotation_id
3. CASCADE DELETE from annotations to study cards
4. Proper error handling for constraint violations
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import PDFFile, Annotation, StudyCard, CardReview
from app.spaced_repetition import SpacedRepetitionService
from datetime import datetime
import sqlalchemy as sa


class OneToOneConstraintTester:
    def __init__(self):
        self.db = SessionLocal()
        self.test_results = []

    def setup_test_data(self):
        """Create test PDF and annotations for testing"""
        print("🔧 Setting up test data...")

        # Clean up any existing test data
        self.cleanup_test_data()

        # Create test PDF
        test_pdf = PDFFile(
            filename="test_constraints.pdf",
            original_filename="test_constraints.pdf",
            file_hash=f"constraint_test_{int(datetime.utcnow().timestamp())}",
            file_size=1000,
            file_path="/test/path",
            mime_type="application/pdf",
        )
        self.db.add(test_pdf)
        self.db.commit()
        self.db.refresh(test_pdf)

        # Create test annotations
        self.test_annotations = []
        for i in range(3):
            annotation = Annotation(
                file_id=test_pdf.id,
                annotation_id=f"constraint_test_{i}_{int(datetime.utcnow().timestamp())}",
                page_index=0,
                question=f"Test question {i}",
                answer=f"Test answer {i}",
                highlighted_text="test text",
                position_data="{}",
            )
            self.db.add(annotation)
            self.db.commit()
            self.db.refresh(annotation)
            self.test_annotations.append(annotation)

        print(f"✅ Created test PDF and {len(self.test_annotations)} annotations")

    def cleanup_test_data(self):
        """Clean up test data"""
        try:
            # Delete test study cards and reviews
            test_cards = (
                self.db.query(StudyCard)
                .join(Annotation)
                .filter(Annotation.annotation_id.like("constraint_test_%"))
                .all()
            )

            for card in test_cards:
                self.db.query(CardReview).filter(CardReview.card_id == card.id).delete()
                self.db.delete(card)

            # Delete test annotations
            self.db.query(Annotation).filter(
                Annotation.annotation_id.like("constraint_test_%")
            ).delete()

            # Delete test PDFs
            self.db.query(PDFFile).filter(
                PDFFile.filename == "test_constraints.pdf"
            ).delete()

            self.db.commit()
        except Exception as e:
            print(f"⚠️  Warning during cleanup: {e}")
            self.db.rollback()

    def test_unique_constraint(self):
        """Test that annotation_id must be unique"""
        print("\n🧪 Test 1: UNIQUE constraint on annotation_id")

        annotation = self.test_annotations[0]

        # Create first study card - should succeed
        try:
            card1 = SpacedRepetitionService.create_study_card(self.db, annotation.id)
            print(f"   ✅ Created first study card (ID: {card1.id})")

            # Try to create second study card for same annotation - should return existing
            card2 = SpacedRepetitionService.create_study_card(self.db, annotation.id)

            if card1.id == card2.id:
                print("   ✅ UNIQUE constraint working - returned existing card")
                self.test_results.append("UNIQUE constraint: PASS")
            else:
                print("   ❌ UNIQUE constraint failed - created duplicate card")
                self.test_results.append("UNIQUE constraint: FAIL")

        except Exception as e:
            print(f"   ❌ Unexpected error in UNIQUE test: {e}")
            self.test_results.append("UNIQUE constraint: ERROR")

    def test_not_null_constraint(self):
        """Test that annotation_id cannot be NULL"""
        print("\n🧪 Test 2: NOT NULL constraint on annotation_id")

        try:
            # Try to create study card with NULL annotation_id
            null_card = StudyCard(
                annotation_id=None,  # This should fail
                easiness=2.5,
                interval=1,
                repetitions=0,
                is_new=True,
                is_learning=False,
                is_graduated=False,
                next_review_date=datetime.utcnow(),
                learning_step=0,
            )

            self.db.add(null_card)
            self.db.commit()

            print("   ❌ NOT NULL constraint failed - allowed NULL annotation_id")
            self.test_results.append("NOT NULL constraint: FAIL")

        except Exception as e:
            self.db.rollback()
            print(f"   ✅ NOT NULL constraint working - rejected NULL annotation_id")
            print(f"      Error: {str(e)[:100]}...")
            self.test_results.append("NOT NULL constraint: PASS")

    def test_cascade_delete(self):
        """Test that deleting annotation deletes associated study card"""
        print("\n🧪 Test 3: CASCADE DELETE from annotation to study card")

        annotation = self.test_annotations[1]
        annotation_id = annotation.id  # Store ID before closing session

        # Ensure foreign keys are enabled for this connection
        with engine.connect() as conn:
            conn.execute(sa.text("PRAGMA foreign_keys = ON"))
            conn.commit()

        # Create study card
        study_card = SpacedRepetitionService.create_study_card(self.db, annotation_id)
        card_id = study_card.id

        print(f"   📋 Created study card {card_id} for annotation {annotation_id}")

        # Create some review history
        review = CardReview(
            card_id=card_id,
            quality=4,
            easiness_before=2.5,
            interval_before=1,
            repetitions_before=0,
            easiness_after=2.6,
            interval_after=4,
            repetitions_after=1,
            time_taken=30,
        )
        self.db.add(review)
        self.db.commit()

        print(f"   📝 Created review record for the study card")

        # Verify card exists before deletion
        card_exists_before = (
            self.db.query(StudyCard).filter(StudyCard.id == card_id).first()
        )
        review_exists_before = (
            self.db.query(CardReview).filter(CardReview.card_id == card_id).first()
        )

        if not card_exists_before:
            print("   ❌ Setup failed - study card not found")
            self.test_results.append("CASCADE DELETE: SETUP_FAIL")
            return

        # Close the current session and use raw SQL to test CASCADE DELETE
        self.db.close()

        # Use direct database connection to test CASCADE DELETE
        with engine.connect() as conn:
            # Enable foreign keys
            conn.execute(sa.text("PRAGMA foreign_keys = ON"))

            # Delete the annotation using raw SQL
            result = conn.execute(
                sa.text(f"DELETE FROM annotations WHERE id = {annotation_id}")
            )
            conn.commit()

            print(f"   🗑️  Deleted annotation {annotation_id}")

            # Check if study card and reviews were also deleted
            card_exists_after = conn.execute(
                sa.text(f"SELECT COUNT(*) FROM study_cards WHERE id = {card_id}")
            ).scalar()
            review_exists_after = conn.execute(
                sa.text(f"SELECT COUNT(*) FROM card_reviews WHERE card_id = {card_id}")
            ).scalar()

            if card_exists_after == 0 and review_exists_after == 0:
                print("   ✅ CASCADE DELETE working - study card and reviews deleted")
                self.test_results.append("CASCADE DELETE: PASS")
            elif card_exists_after == 0:
                print("   ⚠️  Study card deleted but review remains (orphaned)")
                self.test_results.append("CASCADE DELETE: PARTIAL")
            else:
                print("   ❌ CASCADE DELETE failed - study card still exists")
                self.test_results.append("CASCADE DELETE: FAIL")

        # Reopen session for remaining tests
        self.db = SessionLocal()

    def test_foreign_key_constraint(self):
        """Test that study card cannot reference non-existent annotation"""
        print("\n🧪 Test 4: Foreign key constraint validation")

        try:
            # Try to create study card with non-existent annotation_id
            invalid_card = StudyCard(
                annotation_id=99999,  # This ID should not exist
                easiness=2.5,
                interval=1,
                repetitions=0,
                is_new=True,
                is_learning=False,
                is_graduated=False,
                next_review_date=datetime.utcnow(),
                learning_step=0,
            )

            self.db.add(invalid_card)
            self.db.commit()

            print("   ❌ Foreign key constraint failed - allowed invalid annotation_id")
            self.test_results.append("Foreign key constraint: FAIL")

        except Exception as e:
            self.db.rollback()
            print(
                f"   ✅ Foreign key constraint working - rejected invalid annotation_id"
            )
            print(f"      Error: {str(e)[:100]}...")
            self.test_results.append("Foreign key constraint: PASS")

    def test_service_layer_validation(self):
        """Test that service layer properly validates annotation existence"""
        print("\n🧪 Test 5: Service layer validation")

        try:
            # Try to create study card for non-existent annotation via service
            SpacedRepetitionService.create_study_card(self.db, 99999)
            print("   ❌ Service validation failed - allowed non-existent annotation")
            self.test_results.append("Service validation: FAIL")

        except ValueError as e:
            print(
                f"   ✅ Service validation working - rejected non-existent annotation"
            )
            print(f"      Error: {str(e)}")
            self.test_results.append("Service validation: PASS")
        except Exception as e:
            print(f"   ❌ Unexpected error in service validation: {e}")
            self.test_results.append("Service validation: ERROR")

    def verify_database_schema(self):
        """Verify that database schema has correct constraints"""
        print("\n🔍 Verifying database schema...")

        with engine.connect() as conn:
            # Get table schema
            schema = conn.execute(
                sa.text('SELECT sql FROM sqlite_master WHERE name="study_cards"')
            ).scalar()

            print("   Database schema:")
            print(f"   {schema}")

            # Check for expected constraints
            constraints_found = {
                "NOT NULL": "NOT NULL" in schema and "annotation_id" in schema,
                "UNIQUE": "UNIQUE" in schema and "annotation_id" in schema,
                "CASCADE": "CASCADE" in schema,
                "FOREIGN KEY": "FOREIGN KEY" in schema and "annotation_id" in schema,
            }

            print("\n   Constraint verification:")
            for constraint, found in constraints_found.items():
                status = "✅" if found else "❌"
                print(f"   {status} {constraint}: {'Found' if found else 'Missing'}")

    def run_all_tests(self):
        """Run the complete test suite"""
        print("🚀 Starting 1:1 Constraint Test Suite")
        print("=" * 60)

        try:
            self.setup_test_data()
            self.verify_database_schema()

            # Run all constraint tests
            self.test_unique_constraint()
            self.test_not_null_constraint()
            self.test_cascade_delete()
            self.test_foreign_key_constraint()
            self.test_service_layer_validation()

            # Summary
            print("\n" + "=" * 60)
            print("📊 TEST RESULTS SUMMARY")
            print("=" * 60)

            passed = sum(1 for result in self.test_results if "PASS" in result)
            total = len(self.test_results)

            for result in self.test_results:
                status = "✅" if "PASS" in result else "❌" if "FAIL" in result else "⚠️"
                print(f"   {status} {result}")

            print(f"\n📈 Overall: {passed}/{total} tests passed")

            if passed == total:
                print("🎉 ALL CONSTRAINTS WORKING CORRECTLY!")
                return True
            else:
                print("⚠️  Some constraints need attention")
                return False

        except Exception as e:
            print(f"❌ Test suite failed with error: {e}")
            import traceback

            traceback.print_exc()
            return False
        finally:
            self.cleanup_test_data()
            self.db.close()


def main():
    """Main function"""
    tester = OneToOneConstraintTester()
    success = tester.run_all_tests()

    if success:
        print("\n✅ 1:1 constraints are properly implemented and working!")
    else:
        print("\n❌ Some issues were found with the 1:1 constraints")

    return success


if __name__ == "__main__":
    main()
