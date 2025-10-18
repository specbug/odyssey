#!/usr/bin/env python3
"""
Test script to verify the delete annotation fix works correctly.
"""

import requests
import json
import os
import sys

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "app"))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import Base, PDFFile, Annotation, StudyCard, CardReview
from app.spaced_repetition import SpacedRepetitionService


def test_delete_annotation_with_study_card():
    """Test deleting an annotation that has an associated study card."""

    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Create a database session
    db = SessionLocal()

    try:
        # Create a test PDF file
        test_file = PDFFile(
            filename="test.pdf",
            original_filename="test.pdf",
            file_hash="test-hash-123",
            file_size=1000,
            file_path="./test.pdf",
            mime_type="application/pdf",
        )
        db.add(test_file)
        db.commit()
        db.refresh(test_file)

        # Create a test annotation
        test_annotation = Annotation(
            file_id=test_file.id,
            annotation_id="test-annotation-123",
            page_index=0,
            question="Test question",
            answer="Test answer",
            highlighted_text="Test text",
            position_data=json.dumps({"rects": []}),
        )
        db.add(test_annotation)
        db.commit()
        db.refresh(test_annotation)

        # Create a study card for the annotation
        study_card = SpacedRepetitionService.create_study_card(db, test_annotation.id)
        print(f"✅ Created study card with ID: {study_card.id}")

        # Verify the study card exists
        card_check = (
            db.query(StudyCard)
            .filter(StudyCard.annotation_id == test_annotation.id)
            .first()
        )
        assert card_check is not None, "Study card should exist"

        # Now test deletion via API
        print(f"🗑️  Attempting to delete annotation {test_annotation.id} via API...")
        response = requests.delete(
            f"http://localhost:8000/annotations/{test_annotation.id}"
        )

        if response.status_code == 200:
            print(f"✅ Successfully deleted annotation via API")
            print(f"   Response: {response.json()}")

            # Refresh the database session to see changes made by the API
            db.expire_all()
            db.commit()

            # Verify the annotation is deleted
            annotation_check = (
                db.query(Annotation).filter(Annotation.id == test_annotation.id).first()
            )
            assert annotation_check is None, "Annotation should be deleted"

            # Verify the study card is also deleted
            card_check = (
                db.query(StudyCard)
                .filter(StudyCard.annotation_id == test_annotation.id)
                .first()
            )
            assert card_check is None, "Study card should be deleted"

            print("✅ All tests passed! Delete annotation fix is working correctly.")

        else:
            print(f"❌ Failed to delete annotation via API")
            print(f"   Status: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

    finally:
        # Clean up
        try:
            db.query(CardReview).delete()
            db.query(StudyCard).delete()
            db.query(Annotation).delete()
            db.query(PDFFile).delete()
            db.commit()
        except:
            pass
        db.close()

    return True


if __name__ == "__main__":
    print("🧪 Testing delete annotation fix...")
    if test_delete_annotation_with_study_card():
        print("🎉 Test completed successfully!")
    else:
        print("💥 Test failed!")
        sys.exit(1)
