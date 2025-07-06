#!/usr/bin/env python3
"""
Test script to verify the delete annotation fix works correctly using API only.
"""

import requests
import json
import os
import tempfile
import sys


def test_delete_annotation_via_api():
    """Test deleting an annotation via API only."""

    try:
        # Create a temporary PDF file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            # Write minimal PDF content
            pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000074 00000 n 
0000000120 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
197
%%EOF"""
            tmp_file.write(pdf_content)
            tmp_file.flush()

            # Upload the PDF file
            print("📤 Uploading test PDF file...")
            with open(tmp_file.name, "rb") as f:
                files = {"file": ("test.pdf", f, "application/pdf")}
                upload_response = requests.post(
                    "http://localhost:8000/upload", files=files
                )

            if upload_response.status_code != 200:
                print(f"❌ Failed to upload file: {upload_response.status_code}")
                print(f"   Response: {upload_response.text}")
                return False

            upload_data = upload_response.json()
            file_id = upload_data["file_data"]["id"]
            print(f"✅ Successfully uploaded file with ID: {file_id}")

            # Create an annotation
            print("📝 Creating annotation...")
            annotation_data = {
                "annotation_id": "test-annotation-123",
                "page_index": 0,
                "question": "Test question",
                "answer": "Test answer",
                "highlighted_text": "Test text",
                "position_data": json.dumps({"rects": []}),
            }

            create_response = requests.post(
                f"http://localhost:8000/files/{file_id}/annotations",
                json=annotation_data,
            )

            if create_response.status_code != 200:
                print(f"❌ Failed to create annotation: {create_response.status_code}")
                print(f"   Response: {create_response.text}")
                return False

            create_data = create_response.json()
            annotation_id = create_data["id"]
            print(f"✅ Successfully created annotation with ID: {annotation_id}")

            # Create a study card for the annotation
            print("🎓 Creating study card...")
            study_card_response = requests.post(
                f"http://localhost:8000/study-cards?annotation_id={annotation_id}"
            )

            if study_card_response.status_code != 200:
                print(
                    f"❌ Failed to create study card: {study_card_response.status_code}"
                )
                print(f"   Response: {study_card_response.text}")
                return False

            study_card_data = study_card_response.json()
            print(
                f"✅ Successfully created study card with ID: {study_card_data['id']}"
            )

            # Now test deletion via API
            print(f"🗑️  Attempting to delete annotation {annotation_id} via API...")
            delete_response = requests.delete(
                f"http://localhost:8000/annotations/{annotation_id}"
            )

            if delete_response.status_code == 200:
                print(f"✅ Successfully deleted annotation via API")
                print(f"   Response: {delete_response.json()}")

                # Verify the annotation is deleted by trying to get it
                get_response = requests.get(
                    f"http://localhost:8000/files/{file_id}/annotations"
                )
                if get_response.status_code == 200:
                    annotations = get_response.json()
                    if not any(ann["id"] == annotation_id for ann in annotations):
                        print("✅ Verified annotation is deleted from API")
                    else:
                        print("❌ Annotation still exists in API")
                        return False

                # Verify the study card is also deleted
                study_card_check = requests.get(
                    f"http://localhost:8000/study-cards/{study_card_data['id']}"
                )
                if study_card_check.status_code == 404:
                    print("✅ Verified study card is deleted from API")
                else:
                    print(f"❌ Study card still exists: {study_card_check.status_code}")
                    return False

                print(
                    "✅ All tests passed! Delete annotation fix is working correctly."
                )
                return True

            else:
                print(f"❌ Failed to delete annotation via API")
                print(f"   Status: {delete_response.status_code}")
                print(f"   Response: {delete_response.text}")
                return False

    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

    finally:
        # Clean up temporary file
        try:
            os.unlink(tmp_file.name)
        except:
            pass


if __name__ == "__main__":
    print("🧪 Testing delete annotation fix via API only...")
    if test_delete_annotation_via_api():
        print("🎉 Test completed successfully!")
    else:
        print("💥 Test failed!")
        sys.exit(1)
