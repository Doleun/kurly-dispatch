# SPECS — 기술 명세

## 구현 현황 (2025-07)

| Phase | 항목 | 상태 |
|-------|------|------|
| 1a | 로그인, 구역 CRUD, 대시보드 | ✅ |
| 1b | 센터·관리자, role/center JWT, 기사 CRUD, 구역 매핑·랜덤 통합 UI, borrow rules, SplitEditorLayout | ✅ |
| 1c | 휴무·출근 | — |
| 1d | 배차 draft, 구역→ID, ID 일일 분할 | — |
| 2 | 정산 | — |

## DB 테이블

### users (관리자 계정)
| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| username | TEXT UNIQUE | 로그인 ID |
| password_hash | TEXT | bcrypt |
| role | TEXT | `super_admin` \| `center_manager` |
| center_id | FK → centers NULL | `center_manager`일 때 필수, `super_admin`은 null |

**권한**
- `super_admin`: 모든 센터 CRUD·조회
- `center_manager`: `center_id` 해당 센터만 (기사·구역·배차·휴무)

**현재 구현 (Phase 1b):** role/center_id ✅ · 센터·관리자 계정 UI ✅

### centers
| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| name | TEXT | 센터명 (예: 대구, 울산) |
| is_active | BOOLEAN | |

> **센터 = 구역·기사 묶음.** ID 매칭 방식은 센터별 고정 아님 — **배차(Phase 1d)에서 매일 변경**.

> DB에 `use_sub_zones`, `id_borrow_policy` 컬럼은 레거시(미사용). UI에서 노출하지 않음.

### center_sub_codes (레거시 — 미사용)
구역은 `code` 한 줄(`20-1가`)로 등록. 센터별 세분화 목록 UI는 사용하지 않음.

### zones
| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| center_id | FK → centers | **어느 센터 구역인지 (필수)** |
| code | TEXT | **입력·표시용** (`20-1` 또는 `20-1가`) |
| base_code | TEXT | 정렬용 (code에서 자동 파싱) |
| sub_code | TEXT | 정렬용 (code에서 자동 파싱, 없으면 '') |
| name | TEXT | 표시 이름 |
| description | TEXT | 메모 |
| is_active | BOOLEAN | 운영 여부 |
| sort_order | INTEGER | 정렬 |

**유니크:** `(center_id, base_code, sub_code)` — 같은 센터 안에서 중복 불가

**UI:** `code` 한 칸 입력. 세분화 ON/OFF 없음.

### drivers
| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| center_id | FK → centers | **소속 센터 (1개 고정)** |
| name | TEXT | **실명 — 정산·내부 표시용** (예: 홍길동, 오경인) |
| kurly_id | TEXT NULL | **컬리 로그인 아이디** (예: `Th300th1001`). 미배정 시 null |
| kurly_account_name | TEXT NULL | 컬리 계정에 표시되는 이름 |
| account_type | TEXT | `regular` \| `spare` — **spare=예비 ID** (고정 구역 없음, 비상 투입) |
| default_time_slot | first \| second | 기본 타임 (spare는 null 가능) |
| max_capacity | INTEGER | 최대 처리량 |
| capability_note | TEXT | 역량/특이사항 |
| is_active | BOOLEAN | |

**유니크:** `(center_id, kurly_id)` — kurly_id가 null이 아닐 때

**account_type**
- `regular`: 일반 기사 (고정 구역·출근·배차 대상)
- `spare`: 예비 ID — kurly_id는 있으나 **고정 배정 없음**, 배차 시 수동 선택

### driver_id_borrow_rules (Phase 1b) — **기본 ID 매칭 (편의용)**
아이디 미발급·타 ID 쓰는 기사의 **기본 페어**. 배차 초안 제안용. **당일 배차에서 언제든 덮어쓰기 가능** (대구·울산 동일).

| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| center_id | FK | |
| actual_driver_id | FK → drivers | 실배송자 (kurly_id 없음) |
| kurly_driver_id | FK → drivers | 빌려 쓸 ID 소유자 |
| is_active | BOOLEAN | |
| note | TEXT NULL | 예: "발급 전까지 고정" |

**유니크:** `(center_id, actual_driver_id)` — 실배송자당 활성 규칙 1개

**초안 생성 시**
- `driver_id_borrow_rules`에 매칭 있으면 → 배차 초안에 **기본값**으로 제안
- **확정 전·당일** 배차표에서 **모든 구역 ID 변경 가능** (센터 무관)

### zone_mappings
| 필드 | 타입 | 설명 |
|------|------|------|
| driver_id | FK | |
| zone_id | FK | |
| time_slot | first \| second | |

> 한 기사 ↔ 같은 센터 내 여러 zone 가능 (예: `20-1가` + `20-1나`). **UI는 `default_time_slot` 기준 한 목록**으로 편집.

### random_pool_members
| 필드 | 타입 | 설명 |
|------|------|------|
| driver_id | FK | |
| time_slot | first \| second | |

### dispatch_plans (Phase 1d)
일별·센터·타임 배차 확정 헤더

| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| center_id | FK | |
| dispatch_date | TEXT | YYYY-MM-DD |
| time_slot | first \| second | |
| status | TEXT | `draft` \| `confirmed` |
| confirmed_at | TEXT NULL | |
| confirmed_by | FK → users NULL | |

### dispatch_assignments (Phase 1d) — **구역→컬리 ID**
**컬리 사이트 입력용.** 구역마다 **어떤 kurly ID**로 넣을지만 기록. **매일 구역·ID 매핑 변경 가능.**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| plan_id | FK → dispatch_plans | |
| zone_id | FK → zones | |
| kurly_driver_id | FK → drivers | **이 구역을 컬리에 입력할 ID** |
| assignment_status | TEXT | assigned_fixed / unassigned / conflict / support_injection |
| note | TEXT NULL | |

> 구역 배정에는 **실배송자·건수 없음**. ID 분할은 `kurly_daily_pools`에서 관리.

### kurly_daily_pools (Phase 1d) — **ID 하루 전체 물량**
당일·타임·**컬리 ID 1개**당 1행. **하루 전체 물량**의 헤더.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| plan_id | FK → dispatch_plans | |
| kurly_driver_id | FK → drivers | **분할 대상 컬리 ID** (예: 홍길동) |
| total_quantity | INTEGER NULL | ID **하루 전체** 참고 건수 (예: 90). 컬리 수동 입력용 |
| note | TEXT NULL | |

**유니크:** `(plan_id, kurly_driver_id)`

### kurly_daily_splits (Phase 1d) — **ID 일일 분할 → 실배송자**
`kurly_daily_pool` 1개에 **N명** 연결. **정산의 핵심.**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| pool_id | FK → kurly_daily_pools | |
| actual_driver_id | FK → drivers | **실배송자 (정산 기준)** |
| share_quantity | INTEGER NULL | 해당 기사 **하루 몫** (예: 30) |
| note | TEXT NULL | |

**케이스**

| 케이스 | kurly_daily_pool | splits |
|--------|------------------|--------|
| 본인 ID, 1명 | 홍길동 ID, total=90 | 홍길동 90 (또는 1행) |
| ID 빌림 1:1 (대구) | 이순신 ID (컬리용) | 홍길동 90 (실배송) |
| 1 ID 3명 분할 | 홍길동 ID, total=90 | A30, B30, C30 |
| 예비 ID | 아무개(spare) | 비상 투입 인원 |

**관계 정리**

```
dispatch_assignments     kurly_daily_pools        kurly_daily_splits
(구역 → kurly ID)   +    (ID 하루 total)     →    (실배송자 + 몫)
20-1 → 홍길동 ID         홍길동 ID 90건            A 30, B 30, C 30
20-2 → 이순신 ID         (별도 pool)               …
```

- **구역은 매일 바뀔 수 있음** — assignments만 갱신
- **ID 분할은 ID 단위** — pool/splits는 구역과 **직접 연결하지 않음**
- 컬리 입력: assignments 보고 **구역별 ID** 입력 + pool.total 참고 **ID별 총량** 입력
- 정산: **splits.actual_driver_id + share_quantity** (구역 무관)

**1:1 빌림 표시:** pool의 kurly_driver ≠ split.actual_driver 이면 UI에 "ID 빌림" 배지

### settlement_lines (Phase 2 — 스키마만 선행)
정산 집계용. Phase 1d에서 `dispatch_assignments` 데이터가 쌓이면 Phase 2에서 연결.

| 필드 | 타입 | 설명 |
|------|------|------|
| id | INTEGER PK | |
| center_id | FK | |
| settlement_period | TEXT | 예: `2026-06` |
| driver_id | FK → drivers | **실배송자 기준** |
| dispatch_date | TEXT | |
| zone_id | FK NULL | 구역 연동 정산 시 (선택). **ID 일일 분할 정산은 null 가능** |
| source_pool_id | FK → kurly_daily_pools | |
| source_split_id | FK → kurly_daily_splits | **정산 단위** |
| share_quantity | INTEGER NULL | 해당 실배송자 몫 |
| amount | INTEGER NULL | Phase 2 금액 |
| status | TEXT | `pending` \| `confirmed` \| `paid` |

> Phase 1d: `kurly_daily_pools` + `kurly_daily_splits` 기록. Phase 2에서 `settlement_lines` 생성.

## 구역 코드 규칙

### base_code 형식
- 패턴: `{블록}-{번호}` (예: `10-1`, `20-3`, `60-5`)
- **센터 간 동일 번호도 별개 레코드**

### sub_code (레거시 — DB 정렬용)
- `code` 입력 시 `base_code` / `sub_code`로 **자동 파싱** (예: `20-1가` → base `20-1`, sub `가`)
- **UI에서 세분화 ON/OFF·`center_sub_codes` 선택 없음** — `code` 한 칸만 입력

### code (표시)
```
sub 없음  → code = 20-1
sub 있음  → code = 20-1가  (한 줄로 등록)
```

### 정렬
1. `center_id`
2. `base_code` 숫자 블록 → `-` 뒤 번호
3. `sub_code` 없음 먼저, 있으면 센터별 `sort_order` (가 < 나 < …)

## API

### Auth
- `POST /api/auth/login` — `{ username, password }`
- `POST /api/auth/logout`

### Centers (Phase 1b)
- `GET /api/centers`
- CRUD + `GET/POST /api/centers/:id/sub-codes`

### Zones
- `GET /api/zones?centerId=` — 센터별 목록
- `POST /api/zones` — `{ centerId, code, name?, description?, isActive? }`
- `GET /api/zones/:id`
- `PUT /api/zones/:id`
- `DELETE /api/zones/:id`

**현재 구현 (Phase 1b):** `code` 단일 필드 CRUD ✅ · 센터별 필터 ✅ · 자동 정렬 ✅

### Drivers (Phase 1b)
- `GET /api/drivers?centerId=`
- `POST /api/drivers` / `PUT /api/drivers/:id` / `DELETE /api/drivers/:id`
- `PUT /api/drivers/:id/assignments` — 고정 구역 + 랜덤 후보 (한 번에)

### Borrow rules (Phase 1b)
- `GET/POST /api/borrow-rules?centerId=`
- `DELETE /api/borrow-rules/:id`

### Zone mappings / Random pool (Phase 1b)
- `GET/POST /api/zone-mappings` · `GET/POST /api/random-pool`
- **UI:** 기사 관리 화면에 통합 (`/zone-mappings`, `/random-pool` → `/drivers` 리다이렉트)

### Admin users (Phase 1b)
- `GET/POST /api/admin-users` · `DELETE /api/admin-users/:id` (통합 관리자만)

## 배차 상태 (다음 단계)

| 상태 | 의미 |
|------|------|
| assigned_fixed | 고정 구역 배정 완료 |
| unassigned | 미배정 (후보군 필요) |
| conflict | 충돌 (휴무 조정 필요) |
| support_injection | 2차→1차 지원 투입 |

## 배차 초안 생성 알고리즘

```
INPUT: center_id, date, time_slot

FOR each active zone IN zones WHERE center_id = input:
  (센터 내 등록된 활성 구역 전체 — 대구는 20-1 단위, 울산은 20-1가 단위)

  IF fixed driver is on leave:
    mark unassigned
  ELSE IF fixed driver is present:
    assign driver
  ELSE:
    mark unassigned

DETECT conflicts (within same center + time_slot):
  - same zone → 2+ drivers
  - same driver → 2+ zones (policy: warn)

ON zone assignment (dispatch_assignments):
  kurly_driver_id = from fixed rule | daily pick | spare list
  (구역→ID만. 실배송자·건수 없음)

ON kurly daily pool (별도 UI/탭):
  FOR each kurly_driver_id used today (or all active IDs):
    CREATE/UPDATE kurly_daily_pool (total_quantity = ID 하루 전체)
    CREATE kurly_daily_splits (actual_driver + share_quantity each)
    e.g. 홍길동 ID total 90 → A30, B30, C30

CENTER id_borrow_policy: (레거시 — 사용 안 함. 모든 센터 배차 시 당일 ID 변경 가능)
```

## UI 레이아웃 (Phase 1b)

### SplitEditorLayout
등록 폼 + 목록 화면(구역 관리, 기사 관리) 공통 패턴:

| 영역 | 동작 |
|------|------|
| **왼쪽** | 등록/수정 폼 — 뷰포트 높이에 맞춰 고정, 구역 체크박스만 내부 스크롤 |
| **오른쪽** | 목록 — **독립 스크롤**, 테이블 헤더 sticky |
| **페이지** | `AppShell` main `overflow-hidden` — 전체 페이지 스크롤 없음 |

- 목록 **행 클릭 → 수정** (수정 버튼 없음), **삭제만 버튼**
- 1080p 기준 한 화면에 폼+목록 헤더 노출

## 배차 UI — **두 개 표** (Phase 1d)

### 표 1: 구역→컬리 ID (컬리 사이트 입력용)

| 구역 | 컬리 ID | 상태 |
|------|---------|------|
| 20-1 | 홍길동 (Th300…) | 고정 |
| 20-2 | 이순신 (Th300…) | ID빌림 |

### 표 2: ID 일일 분할 (정산용)

| 컬리 ID | 하루 전체 | 실배송자 (몫) |
|---------|----------|--------------|
| 홍길동 | 90건 | A 30 / B 30 / C 30 |
| 이순신 | 45건 | 홍길동 45 (ID빌림) |

> 구역 담당과 ID 분할은 **독립**. 구역은 매일 바뀌어도 ID 분할표는 ID 기준으로 관리.

## 환경 변수

| 변수 | 설명 |
|------|------|
| AUTH_SECRET | JWT 서명 키 |
| ADMIN_USERNAME | seed 관리자 ID |
| ADMIN_PASSWORD | seed 관리자 PW |
