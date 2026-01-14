# 코딩 컨벤션

MVP 단계 개발을 위한 최소 규칙입니다. PR 리뷰 시 이 문서를 기준으로 확인해주세요.

## 1. Branch Naming

브랜치명은 `{type}/{issue-number}-{description}` 형식을 따릅니다.

**타입:**
- `feat`: 기능 개발 (#28, #29 등)
- `docs`: 문서 작업 (#1, #3 등)
- `chore`: 설정/빌드/기타 작업

**예시:**
```
feat/28-user-flow-doc
docs/3-event-data-definition
chore/7-db-selection
```

## 2. Commit Message

커밋 메시지는 간단하게 작성합니다.

**형식:**
```
{type}: {간단한 설명}
```

**타입:**
- `feat`: 새로운 기능
- `docs`: 문서 수정/추가
- `chore`: 설정, 빌드, 기타 작업

**예시:**
```
feat: 일기 저장 API 구현

docs: Journal 데이터 스키마 추가

chore: SQLite 설정 추가
```

## 3. Python Coding Style

### 네이밍
- 변수/함수: `snake_case`
- 클래스: `PascalCase`
- 상수: `UPPER_SNAKE_CASE`

### Type Hints
함수 정의 시 타입 힌트를 권장합니다.

```python
def save_journal(user_id: str, content: str, emoji: str | None) -> Journal:
    ...
```

### 함수 길이
함수는 50줄 이내로 작성하는 것을 권장합니다. 넘어가면 분리 고려.

## 4. PR 규칙

### PR = Issue
- 하나의 PR은 하나의 Issue를 해결합니다.
- PR 제목에 Issue 번호를 포함: `#28 사용자 핵심 플로우 문서화`

### Merge 조건
- 해당 Issue의 Done 체크리스트가 모두 완료된 경우
- 리뷰어 승인 (필요시)
- 이 컨벤션 문서 기준으로 리뷰 완료

### PR 설명 작성
PR 설명에 다음을 포함:
- 해결한 Issue 번호: `Closes #28`
- 주요 변경 사항 간단히 기술
- 컨벤션 준수 여부 확인

---

**PR 작성 시**: [이 문서](docs/coding-convention.md) 기준으로 리뷰 부탁드립니다.
