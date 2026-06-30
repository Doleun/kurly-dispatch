# 택배 기사 관리 시스템 (Kurly Dispatch)

80명 규모 택배 기사의 **휴무·고정 구역·당일 배차표**를 관리하는 내부 웹 앱입니다.

> 실제 물량(건수) 배차는 **마켓컬리 사이트**에서 진행합니다.  
> 본 시스템은 **구역번호 기준으로 "오늘 10-1에 누가 가는지"** 를 빠르게 도출하는 것이 목표입니다.

## 기술 스택

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS**
- **SQLite** (libSQL) + Drizzle ORM
- **JWT 쿠키** 기반 관리자 로그인

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수

```bash
copy .env.example .env
```

`.env`에서 `AUTH_SECRET`을 임의의 긴 문자열로 변경하세요.

### 3. DB 초기화 + 관리자 계정

```bash
npm run db:migrate
npm run db:seed
```

기본 관리자: `admin` / `admin123` (`.env`에서 변경 가능)

### 4. 개발 서버

```bash
npm run dev
```

브라우저: **http://localhost:3000**

> 이 프로젝트는 Cursor 기본 터미널을 **Command Prompt(cmd)** 로 설정해 두었습니다.  
> `npm run dev`를 그대로 쓰실 수 있습니다.

**PowerShell을 쓰는 경우** (실행 정책 오류 시):

```powershell
npm.cmd run dev
```

**서버가 여러 개 떠 있을 때** (포트 꼬임):

```cmd
stop-dev.cmd
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 현재 구현 범위 (Phase 1a)

| 기능 | 상태 |
|------|------|
| 관리자 로그인/로그아웃 | ✅ |
| 대시보드 | ✅ |
| **구역 CRUD** (등록·수정·삭제) | ✅ |
| 기사 관리 | 🔜 다음 단계 |
| 휴무 캘린더 | 🔜 |
| 출근 현황 / 배차표 | 🔜 |

## 프로젝트 구조

```
src/
  app/           # 페이지 + API
  components/    # UI 컴포넌트
  lib/db/        # SQLite 스키마·연결
docs/            # 기획 문서 (PRD, 유저플로우, 와이어프레임)
data/            # SQLite DB 파일 (gitignore)
scripts/         # migrate, seed
```

## 핵심 운영 규칙 (기획 확정)

1. 구역(10-1 ~ 60-5)은 **항상 전 구역 운영** — 별도 "오늘 운영 구역 선택" 없음
2. **휴무로 표시된 사람만 제외**, 나머지는 출근
3. 출근자 기준 **고정 구역 자동 채움** → 빈 구역은 **랜덤 후보군**에서 수동 배치
4. 같은 구역 2명 배치 = **휴무 분배 문제** (충돌 경고)
5. 마켓컬리 연동/물량 배차 **범위 제외**

## 문서

- [PRD](./docs/PRD.md)
- [USER_FLOW](./docs/USER_FLOW.md)
- [SPECS](./docs/SPECS.md)
