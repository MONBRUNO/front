# Smart Ingredient Management App

스마트 냉장고 식재료 관리 앱 프론트엔드입니다.  
원본 Figma 프로젝트: https://www.figma.com/design/XwTjN5IKMKgo8Txe5Nno8x/Smart-Ingredient-Management-App

---

## 실행 방법

```bash
npm i          # 의존성 설치
npm run dev    # 개발 서버 시작 (http://localhost:5173)
```

---

## 개발 환경 — MSW 모킹

백엔드 서버 없이 프론트엔드를 개발할 수 있도록 **MSW(Mock Service Worker)** 를 사용합니다.  
`npm run dev` 실행 시 자동으로 MSW가 활성화됩니다.

### 가상 로그인 계정 (개발용)

| 항목 | 값 |
|------|-----|
| 아이디 | `d23` |
| 비밀번호 | `d3d3` |

> 소셜 로그인(네이버·카카오·구글)은 MSW에서 모킹 불가 — 백엔드 서버 실행 시에만 동작합니다.

### 백엔드 연동 후 MSW 제거 방법

1. `src/mocks/` 폴더 전체 삭제
2. `src/main.tsx` 에서 `enableMocking()` 블록 제거 후 `createRoot(...).render(<App />)` 만 남기기
3. `public/mockServiceWorker.js` 삭제

---

## API 매핑 (MSW ↔ 백엔드)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/user/login` | 로그인 |
| POST | `/user/token/refresh` | 액세스 토큰 재발급 |
| POST | `/user/logout` | 로그아웃 |
| GET | `/user/me` | 내 프로필 조회 |
| PUT | `/user/me` | 프로필 업데이트 |
| POST | `/recipe/ai-recommend` | AI 레시피 추천 *(연동 전 콘솔 로그만 출력)* |

---

## 작업 이력

### 2026-05-22

#### 배포 (Vercel)
- `API_BASE_URL`을 `VITE_API_BASE_URL` 환경변수로 분리 — 로컬/배포 백엔드 URL 전환 (`apiClient.ts`)
- `vercel.json` — SPA fallback rewrite 추가 (OAuth 콜백 등 클라이언트 라우트 새로고침 시 404 방지)

#### 로그인 화면
- 한 페이지에 들어오도록 마진 축소
- 소셜 로그인 버튼(카카오·네이버·구글) 높이 통일, 카카오 로고는 크게 유지

#### 영양 분석 페이지 (`NutritionAnalysis.tsx`)
- **칼로리 버그 수정** — `factor = quantity/100`을 곱하던 것 제거. `quantity` 단위가 개/팩 등이라(예: 튀김우동 2개) 100으로 나누면 `150×0.02=3kcal` 같은 엉터리 값이 나왔음. 식재료 페이지와 동일하게 100g 기준 값 그대로 표시
- **식재료별 칼로리 정확도** — 내장 `nutritionDatabase`(기본 23종)로 못 잡는 브랜드·가공식품을 위해, 페이지 진입 시 `POST /api/ingredients/nutrition`(백엔드 Gemini 조회)으로 영양정보를 일괄 조회. 조회 실패 시 내장 DB로 fallback
- 차트 x축 긴 식재료 이름 회전 + 말줄임 처리 (전체 이름은 툴팁에 표시)

### 2026-05-14

#### MSW 모킹 환경 구축
- `msw` 패키지 설치 및 `public/mockServiceWorker.js` 초기화
- `src/mocks/handlers/authHandlers.ts` — 로그인·로그아웃·토큰 재발급·프로필 API 모킹
- `src/mocks/handlers/index.ts` — 핸들러 통합 진입점 (추후 도메인 핸들러 추가 위치)
- `src/mocks/browser.ts` — 브라우저 Service Worker 등록
- `src/main.tsx` — 개발 환경에서만 MSW 활성화 (`import.meta.env.DEV` 조건부 동적 import)
- `src/app/pages/Login.tsx` — MSW 관련 TODO 주석 추가 (백엔드 연동 후 삭제 가이드 포함)

#### 레시피 페이지 — AI 추천 기능 추가 (`Recipes.tsx`)
- "전체 레시피 / 만들 수 있는 요리" 필터 버튼 오른쪽에 **✨ AI 추천** 버튼 추가
- AI 추천 모달 (바텀 시트 스타일, 2단계):
  - **Step 1** — 현재 등록된 식재료 다중 선택 (그리드 레이아웃, 중복 선택 가능)
  - **Step 2** — 요리 스타일 선택 (한식·중식·일식·양식 등 10가지, 다중 선택)
  - 완료 시 `POST /recipe/ai-recommend` 로 데이터 전송 (백엔드 연동 후 실제 응답 처리 필요)

#### 식재료 페이지 — 카테고리 필터 UI 개선 (`Ingredients.tsx`)
- 기존 가로 스크롤 버튼 방식 → **드롭다운 select** 로 교체
- 카테고리·보관 방법·정렬 3개 select를 한 줄에 나란히 배치 (모바일 친화적)
- 이모지 추가로 시각적 구분 개선 (🥦 채소, 🥩 육류, ❄️ 냉장 등)