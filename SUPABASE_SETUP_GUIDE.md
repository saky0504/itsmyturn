# 🗄️ Supabase 설정 가이드

커뮤니티 게시판이 Supabase를 사용하도록 업데이트되었습니다. 이제 모든 사용자가 댓글을 공유할 수 있습니다!

## 📋 설정 단계

### 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 가입 및 로그인
2. "New Project" 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호 설정
4. 리전 선택 (권장: Northeast Asia - Seoul)
5. 프로젝트 생성 완료 대기 (약 2분)

### 2. 데이터베이스 테이블 생성

1. Supabase 대시보드에서 **SQL Editor** 메뉴로 이동
2. "New query" 클릭
3. `supabase-setup.sql` 파일의 내용을 복사하여 붙여넣기
4. "Run" 버튼 클릭하여 실행
5. ✅ "Success. No rows returned" 메시지 확인

### 3. 환경변수 설정

1. Supabase 대시보드에서 **Settings** → **API** 메뉴로 이동
2. 다음 정보 확인:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGci...` (긴 문자열)

3. 프로젝트 루트에 `.env` 파일 생성:

```bash
# .env 파일
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**주의**: `.env` 파일은 Git에 커밋하지 마세요! (이미 .gitignore에 포함되어 있습니다)

### 4. Vercel 환경변수 설정

Vercel에 배포할 때는 환경변수를 추가해야 합니다:

1. [Vercel Dashboard](https://vercel.com/dashboard)에서 프로젝트 선택
2. **Settings** → **Environment Variables** 메뉴로 이동
3. 다음 환경변수 추가:
   - `VITE_SUPABASE_URL`: 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY`: Anon/Public Key
4. 모든 환경(Production, Preview, Development)에 체크
5. "Save" 클릭
6. 프로젝트 재배포

## 🎯 기능

### ✅ 구현된 기능

- **서버 기반 댓글 저장**: 모든 사용자가 댓글을 공유
- **실시간 업데이트**: 다른 사용자의 댓글이 자동으로 표시
- **좋아요 기능**: 댓글에 좋아요 추가 가능
- **곡별 댓글**: 각 곡과 연결된 댓글 표시
- **새로고침 버튼**: 수동으로 댓글 목록 갱신
- **닉네임 설정**: 로컬 스토리지에 저장

### 🔒 보안

- **Row Level Security (RLS)** 활성화
- 익명 사용자도 댓글 읽기/쓰기 가능
- SQL Injection 방지

## 🧪 테스트

로컬 개발 서버 실행:

```bash
npm run dev
```

1. 게시판 열기
2. 닉네임 설정
3. 댓글 작성
4. Supabase 대시보드의 **Table Editor** → **comments** 테이블에서 데이터 확인
5. 다른 브라우저/시크릿 모드에서 접속하여 댓글이 보이는지 확인

## 🚀 배포

### Vercel 배포

```bash
git add .
git commit -m "feat: Add Supabase community board"
git push origin main
```

Vercel이 자동으로 배포를 시작합니다.

## 🔧 트러블슈팅

### "댓글을 불러오는데 실패했습니다"

- `.env` 파일의 Supabase URL과 Key가 정확한지 확인
- Supabase 프로젝트가 활성화되어 있는지 확인
- 브라우저 콘솔에서 상세 에러 메시지 확인

### 실시간 업데이트가 작동하지 않음

- Supabase에서 Realtime이 활성화되어 있는지 확인
- **Database** → **Replication** → **comments** 테이블의 Realtime 활성화

### Vercel 배포 후 에러

- Vercel 환경변수가 올바르게 설정되었는지 확인
- Vercel 대시보드에서 배포 로그 확인

## 📊 데이터베이스 구조

```sql
comments (
  id UUID PRIMARY KEY,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  track_id TEXT,
  track_title TEXT,
  track_artist TEXT
)
```

## 🎉 완료!

이제 커뮤니티 게시판이 Supabase와 연동되어 모든 사용자가 댓글을 공유할 수 있습니다!

문제가 있으면 Supabase 대시보드의 Logs 메뉴에서 실시간 로그를 확인하세요.

