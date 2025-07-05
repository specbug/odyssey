# 1:1 Constraints Implementation - Complete Documentation

## 🎯 Overview

We have successfully implemented **true 1:1 constraints** between annotations and study cards in the spaced repetition system. This ensures data integrity and consistent behavior throughout the application.

## 🔧 Implementation Details

### Database Schema Changes

#### 1. StudyCard Table Constraints
```sql
CREATE TABLE "study_cards" (
    id INTEGER PRIMARY KEY,
    annotation_id INTEGER NOT NULL UNIQUE,  -- ✅ NOT NULL + UNIQUE
    easiness REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 1,
    repetitions INTEGER DEFAULT 0,
    is_new BOOLEAN DEFAULT 1,
    is_learning BOOLEAN DEFAULT 0,
    is_graduated BOOLEAN DEFAULT 0,
    learning_step INTEGER DEFAULT 0,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_review_date DATETIME,
    next_review_date DATETIME,
    FOREIGN KEY (annotation_id) REFERENCES annotations(id) ON DELETE CASCADE  -- ✅ CASCADE DELETE
)
```

**Key Constraints:**
- ✅ **NOT NULL**: Every study card MUST have an annotation
- ✅ **UNIQUE**: Each annotation can have at most ONE study card
- ✅ **CASCADE DELETE**: When annotation is deleted, study card is automatically deleted

#### 2. CardReview Table Constraints
```sql
CREATE TABLE "card_reviews" (
    id INTEGER PRIMARY KEY,
    card_id INTEGER,
    session_id INTEGER, 
    quality INTEGER,
    review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    easiness_before REAL,
    interval_before INTEGER,
    repetitions_before INTEGER,
    easiness_after REAL,
    interval_after INTEGER,
    repetitions_after INTEGER,
    time_taken INTEGER,
    FOREIGN KEY (card_id) REFERENCES study_cards(id) ON DELETE CASCADE,      -- ✅ CASCADE DELETE
    FOREIGN KEY (session_id) REFERENCES review_sessions(id) ON DELETE CASCADE  -- ✅ CASCADE DELETE
)
```

**Key Constraints:**
- ✅ **CASCADE DELETE**: When study card is deleted, all its reviews are automatically deleted
- ✅ **CASCADE DELETE**: When review session is deleted, all its reviews are automatically deleted

### SQLAlchemy Model Updates

#### StudyCard Model
```python
class StudyCard(Base):
    """A card that can be studied using spaced repetition.
    
    Each study card has a 1:1 relationship with an annotation.
    When an annotation is deleted, its study card is automatically deleted (CASCADE).
    """
    
    annotation_id = Column(
        Integer, 
        ForeignKey("annotations.id", ondelete="CASCADE"), 
        nullable=False,  # NOT NULL constraint
        unique=True,     # UNIQUE constraint
        index=True
    )
    
    # Relationships
    annotation = relationship("Annotation", backref="study_card")  # 1:1 relationship
    reviews = relationship("CardReview", back_populates="card", cascade="all, delete-orphan", passive_deletes=True)
```

#### CardReview Model
```python
class CardReview(Base):
    """Individual card review with SM-2 algorithm data."""
    
    card_id = Column(Integer, ForeignKey("study_cards.id", ondelete="CASCADE"), index=True)
    session_id = Column(Integer, ForeignKey("review_sessions.id", ondelete="CASCADE"), index=True)
    
    # Relationships
    card = relationship("StudyCard", back_populates="reviews")
    session = relationship("ReviewSession", back_populates="reviews")
```

### Database Engine Configuration

#### Foreign Key Enforcement
```python
from sqlalchemy import create_engine, event

# Enable foreign key constraints for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key constraints for SQLite connections"""
    if "sqlite" in DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
```

This ensures foreign key constraints are **always enabled** for all database connections.

### Service Layer Updates

#### Enhanced Study Card Creation
```python
@staticmethod
def create_study_card(db: Session, annotation_id: int) -> StudyCard:
    """Create a new study card from an annotation.
    
    Due to 1:1 constraint, each annotation can have exactly one study card.
    If a study card already exists for this annotation, returns the existing one.
    """
    # Validate that annotation exists
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise ValueError(f"Annotation with ID {annotation_id} not found")
    
    # Check if study card already exists for this annotation
    existing_card = (
        db.query(StudyCard).filter(StudyCard.annotation_id == annotation_id).first()
    )

    if existing_card:
        return existing_card

    # Create new study card with required annotation_id
    try:
        study_card = StudyCard(
            annotation_id=annotation_id,  # Now required (NOT NULL)
            # ... other fields
        )
        db.add(study_card)
        db.commit()
        return study_card
    except Exception as e:
        db.rollback()
        # Handle constraint violations gracefully
        existing_card = db.query(StudyCard).filter(StudyCard.annotation_id == annotation_id).first()
        if existing_card:
            return existing_card
        else:
            raise ValueError(f"Failed to create study card for annotation {annotation_id}: {str(e)}")
```

## 🧪 Comprehensive Testing

### Test Suite Results
All 5 critical tests pass:

1. **✅ UNIQUE Constraint Test**: Prevents duplicate study cards for same annotation
2. **✅ NOT NULL Constraint Test**: Prevents study cards without annotations
3. **✅ CASCADE DELETE Test**: Deletes study card when annotation is deleted
4. **✅ Foreign Key Constraint Test**: Prevents study cards with invalid annotation references
5. **✅ Service Layer Validation Test**: Application-level validation works correctly

### Test Coverage
- **Constraint violations** are properly handled
- **Cascade deletes** work through the entire chain: Annotation → StudyCard → CardReviews
- **Concurrent creation** attempts are handled gracefully
- **Invalid references** are rejected at both database and application levels

## 🔄 Cascade Delete Flow

When an annotation is deleted, the following cascade occurs automatically:

```
DELETE Annotation
    ↓ (CASCADE DELETE)
DELETE StudyCard (annotation_id references deleted annotation)
    ↓ (CASCADE DELETE) 
DELETE ALL CardReviews (card_id references deleted study card)
```

This ensures **complete data consistency** with no orphaned records.

## 🚀 API Impact

### Updated Endpoints

#### Delete Single Annotation
```http
DELETE /annotations/{annotation_id}
```
**Response:**
```json
{
  "message": "Annotation deleted successfully (associated study card also deleted)"
}
```

#### Delete All Annotations for File
```http
DELETE /files/{file_id}/annotations
```
**Response:**
```json
{
  "message": "Successfully deleted all annotations for file 1",
  "deleted_annotations": 8,
  "deleted_study_cards": 8
}
```

## 💡 Benefits

### 1. **Data Integrity**
- No orphaned study cards without annotations
- No duplicate study cards for same annotation
- Automatic cleanup when annotations are deleted

### 2. **Predictable Behavior**
- Each annotation has exactly 0 or 1 study card
- Clear 1:1 relationship that matches business logic
- Consistent behavior across all operations

### 3. **Performance**
- Database-level constraints are faster than application-level checks
- Cascade deletes are atomic and efficient
- Indexes on unique constraints improve query performance

### 4. **Maintainability**
- Database enforces business rules automatically
- Less application code needed for data consistency
- Clear and explicit relationships in schema

## 🔒 Constraint Summary

| Constraint Type | Table | Column | Effect |
|----------------|-------|---------|---------|
| NOT NULL | study_cards | annotation_id | Every study card must have an annotation |
| UNIQUE | study_cards | annotation_id | Each annotation can have at most one study card |
| FOREIGN KEY | study_cards | annotation_id | Study cards can only reference existing annotations |
| CASCADE DELETE | study_cards | annotation_id | Deleting annotation deletes its study card |
| CASCADE DELETE | card_reviews | card_id | Deleting study card deletes all its reviews |
| CASCADE DELETE | card_reviews | session_id | Deleting session deletes all its reviews |

## 🎯 Migration Summary

### What Was Changed
1. **Cleaned up** all inconsistent data (orphaned cards, duplicates)
2. **Recreated** study_cards table with proper constraints
3. **Recreated** card_reviews table with CASCADE DELETE
4. **Updated** SQLAlchemy models to reflect constraints
5. **Added** database engine configuration for foreign key enforcement
6. **Enhanced** service layer with proper validation and error handling

### Data Migration
- ✅ All orphaned study cards (annotation_id = NULL) were deleted
- ✅ All study cards with invalid annotation references were deleted  
- ✅ All duplicate study cards were consolidated (kept oldest)
- ✅ All card reviews were cleaned up to maintain referential integrity

## 🎉 Final Status

**✅ 1:1 constraints are fully implemented and tested!**

The system now enforces a true 1:1 relationship between annotations and study cards at the database level, with proper cascade deletes and comprehensive error handling. All existing APIs work seamlessly with the new constraints, and the system is more robust and maintainable.

---

*Implementation completed: $(date)*  
*All tests passing: 5/5 ✅*  
*Status: Production Ready 🚀* 