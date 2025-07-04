#!/usr/bin/env python3
"""
Comprehensive verification script for spaced repetition implementation.
This script tests all components to ensure they work properly.
"""

import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))


def test_imports():
    """Test that all required modules can be imported."""
    print("🧪 Testing imports...")
    try:
        from app.database import engine, Base, get_db
        from app.models import PDFFile, Annotation, StudyCard, CardReview, ReviewSession
        from app.schemas import (
            StudyCardCreate,
            StudyCardResponse,
            CardReviewCreate,
            CardReviewResult,
            DueCardsResponse,
            ReviewOptions,
        )
        from app.spaced_repetition import SpacedRepetitionService
        from supermemo2 import first_review, review

        print("✅ All imports successful")
        return True
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False


def test_database_creation():
    """Test database table creation."""
    print("\n🗄️  Testing database creation...")
    try:
        from app.database import engine, Base
        from app.models import PDFFile, Annotation, StudyCard, CardReview, ReviewSession

        # Create tables
        Base.metadata.create_all(bind=engine)

        # Check that tables exist
        tables = Base.metadata.tables.keys()
        expected_tables = [
            "pdf_files",
            "annotations",
            "study_cards",
            "card_reviews",
            "review_sessions",
        ]

        for table in expected_tables:
            if table not in tables:
                print(f"❌ Missing table: {table}")
                return False

        print(f"✅ Database created with tables: {', '.join(tables)}")
        return True
    except Exception as e:
        print(f"❌ Database creation failed: {e}")
        return False


def test_sm2_algorithm():
    """Test SM-2 algorithm functionality."""
    print("\n🧠 Testing SM-2 algorithm...")
    try:
        from supermemo2 import first_review, review

        # Test first review
        result1 = first_review(4, datetime.utcnow())
        print(
            f"✅ First review (quality=4): interval={result1['interval']}, easiness={result1['easiness']}"
        )

        # Test subsequent review
        result2 = review(
            3,
            result1["easiness"],
            result1["interval"],
            result1["repetitions"],
            datetime.utcnow(),
        )
        print(
            f"✅ Second review (quality=3): interval={result2['interval']}, easiness={result2['easiness']}"
        )

        # Test poor quality review
        result3 = review(
            1,
            result2["easiness"],
            result2["interval"],
            result2["repetitions"],
            datetime.utcnow(),
        )
        print(
            f"✅ Poor review (quality=1): interval={result3['interval']}, easiness={result3['easiness']}"
        )

        return True
    except Exception as e:
        print(f"❌ SM-2 algorithm test failed: {e}")
        return False


def test_spaced_repetition_service():
    """Test SpacedRepetitionService functionality."""
    print("\n🎯 Testing SpacedRepetitionService...")
    try:
        from app.database import SessionLocal
        from app.models import Annotation, StudyCard
        from app.spaced_repetition import SpacedRepetitionService

        # Create test session
        db = SessionLocal()

        # Create test annotation
        test_annotation = Annotation(
            annotation_id="test-123",
            file_id=1,
            page_index=1,
            question="What is the capital of France?",
            answer="Paris",
            highlighted_text="Paris is the capital of France",
            position_data="{}",
        )

        db.add(test_annotation)
        db.commit()
        db.refresh(test_annotation)

        # Test study card creation
        study_card = SpacedRepetitionService.create_study_card(db, test_annotation.id)
        print(
            f"✅ Study card created: ID={study_card.id}, easiness={study_card.easiness}"
        )

        # Test getting due cards
        due_cards = SpacedRepetitionService.get_due_cards(db, limit=10)
        print(
            f"✅ Due cards retrieved: {len(due_cards['due_cards'])} due, {len(due_cards['new_cards'])} new"
        )

        # Test review options
        options = SpacedRepetitionService.get_review_options(study_card)
        print(f"✅ Review options generated: {len(options)} options")

        # Test card review
        result = SpacedRepetitionService.review_card(db, study_card.id, quality=4)
        print(f"✅ Card reviewed: next review in {result.card.interval} days")

        # Test study stats
        stats = SpacedRepetitionService.get_study_stats(db)
        print(f"✅ Study stats: {stats}")

        # Cleanup
        db.delete(study_card)
        db.delete(test_annotation)
        db.commit()
        db.close()

        return True
    except Exception as e:
        print(f"❌ SpacedRepetitionService test failed: {e}")
        return False


def test_api_endpoints():
    """Test that FastAPI app can be created with all endpoints."""
    print("\n🌐 Testing API endpoints...")
    try:
        from app.main import app

        # Get all routes
        routes = []
        for route in app.routes:
            if hasattr(route, "methods") and hasattr(route, "path"):
                for method in route.methods:
                    if method != "OPTIONS":  # Skip OPTIONS method
                        routes.append(f"{method} {route.path}")

        # Check for spaced repetition endpoints
        expected_endpoints = [
            "POST /study-cards",
            "GET /study-cards/due",
            "POST /study-cards/{card_id}/review",
            "GET /study-cards/{card_id}/options",
            "GET /study-stats",
            "POST /review-sessions",
        ]

        missing_endpoints = []
        for endpoint in expected_endpoints:
            found = False
            for route in routes:
                if (
                    endpoint in route
                    or endpoint.replace("{card_id}", "{card_id:path}") in route
                ):
                    found = True
                    break
            if not found:
                missing_endpoints.append(endpoint)

        if missing_endpoints:
            print(f"❌ Missing endpoints: {missing_endpoints}")
            return False

        print(f"✅ All spaced repetition endpoints found in {len(routes)} total routes")
        return True
    except Exception as e:
        print(f"❌ API endpoints test failed: {e}")
        return False


def test_best_practices():
    """Test that the implementation follows best practices."""
    print("\n📋 Testing best practices...")
    try:
        # Test database relationships
        from app.models import StudyCard, CardReview

        # Check that models have proper relationships
        assert hasattr(StudyCard, "annotation"), (
            "StudyCard should have annotation relationship"
        )
        assert hasattr(StudyCard, "reviews"), (
            "StudyCard should have reviews relationship"
        )
        assert hasattr(CardReview, "card"), "CardReview should have card relationship"

        # Check that schemas have proper validation
        from app.schemas import StudyCardResponse, CardReviewCreate

        # Test schema validation
        from pydantic import ValidationError

        try:
            CardReviewCreate(card_id=1, quality=6)  # Invalid quality
            print("❌ Schema validation should have failed for quality=6")
            return False
        except ValidationError:
            pass  # Expected

        print("✅ Best practices checks passed")
        return True
    except Exception as e:
        print(f"❌ Best practices test failed: {e}")
        return False


def main():
    """Run all tests."""
    print(
        "🚀 Starting comprehensive spaced repetition implementation verification...\n"
    )

    tests = [
        test_imports,
        test_database_creation,
        test_sm2_algorithm,
        test_spaced_repetition_service,
        test_api_endpoints,
        test_best_practices,
    ]

    passed = 0
    failed = 0

    for test in tests:
        if test():
            passed += 1
        else:
            failed += 1

    print(f"\n📊 Test Results: {passed} passed, {failed} failed")

    if failed == 0:
        print(
            "🎉 All tests passed! Spaced repetition implementation is complete and working."
        )
        return True
    else:
        print("💥 Some tests failed. Please review the implementation.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
