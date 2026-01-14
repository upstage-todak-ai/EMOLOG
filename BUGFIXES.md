# Bug Fixes Documentation

## Bug 1: Hardcoded API Base URL ✅ FIXED

### Issue
The API base URL was hardcoded to a specific IP address (`192.168.0.36`) that only works on the original developer's network. This breaks the app for other developers, different networks, CI/CD pipelines, and production deployments.

### Solution
- Created `mobile/config/api.ts` to handle API base URL configuration
- Uses environment variable `EXPO_PUBLIC_API_BASE_URL` for configuration
- Falls back to `http://localhost:8000` for development
- Falls back to production URL for production builds

### Files Changed
- `mobile/config/api.ts` (new file)
- `mobile/services/api.ts` (updated to use config)

### Usage
Create a `.env` file in the `mobile/` directory:
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

For physical devices, use your local IP:
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.0.36:8000
```

---

## Bug 2: Incorrect Firestore collection.add() Return Value Unpacking ⚠️ DOCUMENTED

### Issue
The `collection.add()` method in Firestore returns a tuple of `(update_time, document_reference)`, but the code unpacks it as `(generated_id, doc_ref)`, assigning the Timestamp `update_time` object to `generated_id`. While the code doesn't crash because the variable is unused, this is incorrect API usage with a misleading variable name that could confuse future maintainers.

### Location
- `app/repository/diary_repository.py` (lines 58-59) - **File not found in current codebase**

### Correct Implementation
```python
# ❌ WRONG (current buggy code)
generated_id, doc_ref = self.collection.add(diary_dict)
doc_id = generated_id  # This is actually a Timestamp, not an ID!

# ✅ CORRECT (fixed code)
update_time, doc_ref = self.collection.add(diary_dict)
doc_id = doc_ref.id  # Get the actual document ID from the reference
```

### Fix to Apply
If `diary_repository.py` is restored or recreated, ensure the `create()` method uses:
```python
def create(self, diary: DiaryEntryCreate) -> DiaryEntry:
    diary_dict = {
        "user_id": diary.user_id,
        "date": diary.date.isoformat() if isinstance(diary.date, datetime) else diary.date,
        "content": diary.content,
        "emotion": diary.emotion.value,
        "created_at": datetime.now().isoformat(),
    }
    # Correct: collection.add() returns (update_time, document_reference)
    update_time, doc_ref = self.collection.add(diary_dict)
    
    # Get the document ID from the reference
    doc_id = doc_ref.id
    
    # Fetch the document to return
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=500, detail="일기 생성에 실패했습니다.")
    return self._doc_to_diary_entry(doc)
```

### Reference
- Firestore Python SDK: `collection.add()` returns `(update_time: Timestamp, document_reference: DocumentReference)`
- Document ID is accessed via `document_reference.id`
