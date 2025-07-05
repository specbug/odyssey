#!/usr/bin/env python3
"""
Test script for the DELETE /files/{file_id}/annotations endpoint

This script demonstrates how to use the new API endpoint to delete all annotations
for a specific file, including their associated study cards.
"""

import json
from app.database import SessionLocal
from app.models import PDFFile, Annotation, StudyCard


def test_delete_annotations_endpoint():
    """Test the delete all annotations endpoint"""

    try:
        import requests
    except ImportError:
        print("⚠️  requests library not available, skipping connection tests")
        return

    # Database session for verification
    db = SessionLocal()

    print("🧪 Testing DELETE /files/{file_id}/annotations endpoint")
    print("=" * 60)

    # Check current state
    print("\n📊 Current database state:")
    files = db.query(PDFFile).all()

    for file in files:
        annotation_count = (
            db.query(Annotation).filter(Annotation.file_id == file.id).count()
        )
        study_card_count = (
            db.query(StudyCard)
            .join(Annotation, StudyCard.annotation_id == Annotation.id)
            .filter(Annotation.file_id == file.id)
            .count()
        )
        print(
            f"   File {file.id} ({file.original_filename}): {annotation_count} annotations, {study_card_count} study cards"
        )

    # Test cases
    test_cases = [
        {
            "name": "Delete annotations for existing file with annotations",
            "file_id": 1,
            "expected_status": 200,
        },
        {
            "name": "Delete annotations for existing file with no annotations",
            "file_id": 2,
            "expected_status": 200,
        },
        {
            "name": "Delete annotations for non-existent file",
            "file_id": 999,
            "expected_status": 404,
        },
    ]

    print("\n🔧 Running test cases:")

    for i, test_case in enumerate(test_cases, 1):
        print(f"\n   Test {i}: {test_case['name']}")

        try:
            url = f"http://127.0.0.1:8000/files/{test_case['file_id']}/annotations"

            # Make the DELETE request
            response = requests.delete(url, headers={"accept": "application/json"})

            print(
                f"      Status: {response.status_code} (expected: {test_case['expected_status']})"
            )

            if response.status_code == test_case["expected_status"]:
                print("      ✅ Status code matches expected")
            else:
                print("      ❌ Status code mismatch")

            # Parse response
            if response.status_code == 200:
                result = response.json()
                print(f"      Response: {json.dumps(result, indent=8)}")
            elif response.status_code == 404:
                error = response.json()
                print(f"      Error: {error['detail']}")
            else:
                print(f"      Unexpected response: {response.text}")

        except requests.exceptions.ConnectionError:
            print("      ❌ Connection error - is the server running?")
        except Exception as e:
            print(f"      ❌ Error: {e}")

    # Verify final state
    print("\n📊 Final database state:")
    for file in files:
        annotation_count = (
            db.query(Annotation).filter(Annotation.file_id == file.id).count()
        )
        study_card_count = (
            db.query(StudyCard)
            .join(Annotation, StudyCard.annotation_id == Annotation.id)
            .filter(Annotation.file_id == file.id)
            .count()
        )
        print(
            f"   File {file.id} ({file.original_filename}): {annotation_count} annotations, {study_card_count} study cards"
        )

    db.close()

    print("\n✅ Test completed!")


def demo_endpoint_usage():
    """Demonstrate how to use the endpoint with curl commands"""

    print("\n🚀 API Endpoint Usage Examples:")
    print("=" * 60)

    examples = [
        {
            "description": "Delete all annotations for file ID 1",
            "curl_command": 'curl -X DELETE "http://127.0.0.1:8000/files/1/annotations" -H "accept: application/json"',
        },
        {
            "description": "Delete all annotations for file ID 2 (no annotations)",
            "curl_command": 'curl -X DELETE "http://127.0.0.1:8000/files/2/annotations" -H "accept: application/json"',
        },
        {
            "description": "Try to delete annotations for non-existent file",
            "curl_command": 'curl -X DELETE "http://127.0.0.1:8000/files/999/annotations" -H "accept: application/json"',
        },
    ]

    for i, example in enumerate(examples, 1):
        print(f"\n{i}. {example['description']}:")
        print(f"   {example['curl_command']}")

    print("\n📝 Expected Response Formats:")
    print("=" * 60)

    print("\n✅ Success (with deletions):")
    print(
        json.dumps(
            {
                "message": "Successfully deleted all annotations for file 1",
                "deleted_annotations": 8,
                "deleted_study_cards": 8,
            },
            indent=2,
        )
    )

    print("\n✅ Success (no annotations to delete):")
    print(
        json.dumps(
            {
                "message": "No annotations found for this file",
                "deleted_annotations": 0,
                "deleted_study_cards": 0,
            },
            indent=2,
        )
    )

    print("\n❌ Error (file not found):")
    print(json.dumps({"detail": "File not found"}, indent=2))


if __name__ == "__main__":
    # Test the endpoint if requests is available
    test_delete_annotations_endpoint()

    # Always show usage examples
    demo_endpoint_usage()
