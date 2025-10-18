#!/usr/bin/env python3
"""
Timeline Feature Demo

This script demonstrates the timeline functionality:
1. Creates a sample study card
2. Shows timeline predictions for all quality ratings
3. Demonstrates API usage
"""

import sys
import os
import json
from datetime import datetime, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import Base, StudyCard, Annotation, PDFFile
from app.spaced_repetition import SpacedRepetitionService


def demo_timeline():
    """Demonstrate timeline functionality"""
    print("🎯 Timeline Feature Demo")
    print("=" * 50)

    db = SessionLocal()

    try:
        # Create a demo PDF and annotation
        demo_pdf = PDFFile(
            filename="demo_timeline.pdf",
            original_filename="Demo: Study Card Timeline",
            file_hash=f"demo_hash_{int(datetime.utcnow().timestamp())}",
            file_size=1000,
            file_path="/demo/path",
            mime_type="application/pdf",
        )
        db.add(demo_pdf)
        db.commit()
        db.refresh(demo_pdf)

        demo_annotation = Annotation(
            file_id=demo_pdf.id,
            annotation_id=f"demo_annotation_{int(datetime.utcnow().timestamp())}",
            page_index=0,
            question="What is the capital of France?",
            answer="Paris",
            highlighted_text="The capital of France is Paris",
            position_data="{}",
        )
        db.add(demo_annotation)
        db.commit()
        db.refresh(demo_annotation)

        # Create study card
        card = SpacedRepetitionService.create_study_card(db, demo_annotation.id)
        print(f"\n📋 Created demo study card (ID: {card.id})")
        print(f"   Question: {demo_annotation.question}")
        print(f"   Answer: {demo_annotation.answer}")

        # Show timeline for new card
        print(f"\n🔮 Timeline Predictions for NEW card:")
        timeline_data = SpacedRepetitionService.get_card_timeline(card)

        print(f"   Current State: {timeline_data['current_state']}")
        print(f"   Current Interval: {timeline_data['current_interval']} days")
        print(f"   Current Easiness: {timeline_data['current_easiness']}")
        print(f"   Current Repetitions: {timeline_data['current_repetitions']}")

        print(f"\n   📊 Quality Rating Predictions:")
        for point in timeline_data["timeline_points"]:
            interval_str = point["interval_text"]
            state_str = point["card_state"]
            print(
                f"      Quality {point['quality']} ({point['quality_label']:8}): {interval_str:8} → {state_str}"
            )

        # Simulate reviewing with quality 1 (Wrong)
        print(f"\n🎯 Reviewing card with Quality 1 (Wrong)...")
        result = SpacedRepetitionService.review_card(db, card.id, quality=1)
        db.refresh(card)

        print(f"   Result: {result.message}")
        print(f"   Next review: {result.next_review_date}")

        # Show timeline for learning card
        print(f"\n🔮 Timeline Predictions for LEARNING card:")
        timeline_data = SpacedRepetitionService.get_card_timeline(card)

        print(f"   Current State: {timeline_data['current_state']}")
        print(f"   Current Interval: {timeline_data['current_interval']} minutes")
        print(f"   Current Easiness: {timeline_data['current_easiness']}")
        print(f"   Current Repetitions: {timeline_data['current_repetitions']}")

        print(f"\n   📊 Quality Rating Predictions:")
        for point in timeline_data["timeline_points"]:
            interval_str = point["interval_text"]
            state_str = point["card_state"]
            print(
                f"      Quality {point['quality']} ({point['quality_label']:8}): {interval_str:8} → {state_str}"
            )

        # Simulate reviewing with quality 4 (Easy) to graduate
        print(f"\n🎯 Reviewing card with Quality 4 (Easy)...")
        result = SpacedRepetitionService.review_card(db, card.id, quality=4)
        db.refresh(card)

        print(f"   Result: {result.message}")
        print(f"   Next review: {result.next_review_date}")

        # Show timeline for graduated card
        print(f"\n🔮 Timeline Predictions for GRADUATED card:")
        timeline_data = SpacedRepetitionService.get_card_timeline(card)

        print(f"   Current State: {timeline_data['current_state']}")
        print(f"   Current Interval: {timeline_data['current_interval']} days")
        print(f"   Current Easiness: {timeline_data['current_easiness']}")
        print(f"   Current Repetitions: {timeline_data['current_repetitions']}")

        print(f"\n   📊 Quality Rating Predictions:")
        for point in timeline_data["timeline_points"]:
            interval_str = point["interval_text"]
            state_str = point["card_state"]
            print(
                f"      Quality {point['quality']} ({point['quality_label']:8}): {interval_str:8} → {state_str}"
            )

        # API Usage Example
        print(f"\n🌐 API Usage Example:")
        print(f"   GET /study-cards/{card.id}/timeline")
        print(f"   Returns: JSON with timeline data for all quality ratings (0-5)")
        print(f"   Each timeline point contains:")
        print(f"     - quality: 0-5")
        print(f"     - quality_label: Human-readable label")
        print(f"     - next_review_date: When card will appear next")
        print(f"     - interval_text: Human-readable interval")
        print(f"     - card_state: new/learning/graduated")
        print(f"     - easiness_after: Easiness factor after review")
        print(f"     - repetitions_after: Number of repetitions after review")

        # Cleanup
        db.delete(card)
        db.delete(demo_annotation)
        db.delete(demo_pdf)
        db.commit()

        print(f"\n✅ Demo completed successfully!")
        print(f"\n💡 Key Benefits:")
        print(f"   - Predictable scheduling: See exactly when cards will appear")
        print(f"   - Variable timelines: Different intervals based on review quality")
        print(
            f"   - State transitions: Cards progress through new → learning → graduated"
        )
        print(f"   - API integration: Timeline data available via REST API")

    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    demo_timeline()
