# DELETE All Annotations API Endpoint

## Overview

The `DELETE /files/{file_id}/annotations` endpoint allows you to delete all annotations for a specific file, including their associated study cards and card reviews. This is useful for cleaning up when users want to remove all annotations from a document.

## Endpoint Details

- **Method**: `DELETE`
- **URL**: `/files/{file_id}/annotations`
- **Authentication**: None (currently)
- **Content-Type**: `application/json`

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_id` | integer | Yes | The ID of the file whose annotations should be deleted |

## Response Format

### Success Response (200 OK)

When annotations are found and deleted:
```json
{
  "message": "Successfully deleted all annotations for file {file_id}",
  "deleted_annotations": 8,
  "deleted_study_cards": 8
}
```

When no annotations are found:
```json
{
  "message": "No annotations found for this file",
  "deleted_annotations": 0,
  "deleted_study_cards": 0
}
```

### Error Response (404 Not Found)

When the file doesn't exist:
```json
{
  "detail": "File not found"
}
```

### Error Response (500 Internal Server Error)

When there's a server error:
```json
{
  "detail": "Error deleting annotations: {error_message}"
}
```

## Usage Examples

### cURL Examples

1. **Delete all annotations for file ID 1:**
   ```bash
   curl -X DELETE "http://127.0.0.1:8000/files/1/annotations" \
        -H "accept: application/json"
   ```

2. **Delete all annotations for file ID 2 (no annotations):**
   ```bash
   curl -X DELETE "http://127.0.0.1:8000/files/2/annotations" \
        -H "accept: application/json"
   ```

3. **Try to delete annotations for non-existent file:**
   ```bash
   curl -X DELETE "http://127.0.0.1:8000/files/999/annotations" \
        -H "accept: application/json"
   ```

### JavaScript/Frontend Examples

```javascript
// Delete all annotations for a file
async function deleteAllAnnotations(fileId) {
    try {
        const response = await fetch(`/files/${fileId}/annotations`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`Deleted ${result.deleted_annotations} annotations and ${result.deleted_study_cards} study cards`);
        return result;
    } catch (error) {
        console.error('Error deleting annotations:', error);
        throw error;
    }
}

// Usage
deleteAllAnnotations(1)
    .then(result => {
        console.log('Success:', result.message);
    })
    .catch(error => {
        console.error('Failed to delete annotations:', error);
    });
```

### Python Examples

```python
import requests

def delete_all_annotations(file_id):
    """Delete all annotations for a specific file"""
    url = f"http://127.0.0.1:8000/files/{file_id}/annotations"
    
    try:
        response = requests.delete(url, headers={"accept": "application/json"})
        response.raise_for_status()  # Raise an exception for bad status codes
        
        result = response.json()
        print(f"Success: {result['message']}")
        print(f"Deleted {result['deleted_annotations']} annotations")
        print(f"Deleted {result['deleted_study_cards']} study cards")
        return result
        
    except requests.exceptions.HTTPError as e:
        if response.status_code == 404:
            print("Error: File not found")
        else:
            print(f"HTTP Error: {e}")
    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}")
    except Exception as e:
        print(f"Unexpected Error: {e}")

# Usage
delete_all_annotations(1)
```

## What Gets Deleted

The endpoint performs a **cascade delete** of the following data:

1. **Annotations**: All annotations associated with the file
2. **Study Cards**: All study cards that reference the deleted annotations
3. **Card Reviews**: All review history for the deleted study cards

## Database Operations

The endpoint performs the following operations in order:

1. **Validation**: Checks if the file exists
2. **Data Retrieval**: Gets all annotations for the file
3. **Cascade Delete**: 
   - Deletes all card reviews for study cards linked to the annotations
   - Deletes all study cards linked to the annotations
   - Deletes all annotations for the file
4. **Transaction Commit**: Commits all changes atomically

## Error Handling

The endpoint includes comprehensive error handling:

- **File Not Found**: Returns 404 if the file doesn't exist
- **Database Errors**: Rolls back transaction and returns 500 with error details
- **Empty Results**: Gracefully handles files with no annotations
- **Transaction Safety**: Uses database transactions to ensure data integrity

## Security Considerations

- The endpoint currently has no authentication requirements
- Consider adding authentication/authorization before production use
- The endpoint permanently deletes data - consider adding confirmation mechanisms
- Rate limiting may be advisable for production environments

## Performance Notes

- The endpoint uses efficient database queries with foreign key relationships
- Deletion operations are performed in the correct order to avoid constraint violations
- Database transactions ensure atomicity of the delete operations
- For files with many annotations, the operation may take some time

## Testing

Use the provided test script to verify the endpoint functionality:

```bash
python test_delete_annotations.py
```

This will demonstrate:
- Successful deletion of annotations
- Handling of files with no annotations
- Error handling for non-existent files
- Response format examples

## Related Endpoints

- `GET /files/{file_id}/annotations` - Get all annotations for a file
- `DELETE /annotations/{annotation_id}` - Delete a single annotation
- `DELETE /files/{file_id}` - Delete entire file and its annotations
- `POST /files/{file_id}/annotations` - Create new annotation

## Changelog

- **v1.0.0**: Initial implementation with cascade delete functionality 