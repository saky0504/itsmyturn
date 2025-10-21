# 🛡️ Admin Dashboard Guide

관리자 페이지가 성공적으로 구축되었습니다!

## 📍 접속 방법

### 로컬 개발 환경
```
http://localhost:5173/admin.html
```

### 프로덕션 (Vercel)
```
https://yourdomain.com/admin.html
```

## 🔐 설정

### 1. 관리자 비밀번호 설정

`.env` 파일에 다음 추가:
```bash
VITE_ADMIN_PASSWORD=your-super-secure-password
```

**중요**: 기본 비밀번호는 `admin123`입니다. 반드시 변경하세요!

### 2. Vercel 환경변수 설정

Vercel Dashboard → 프로젝트 → Settings → Environment Variables:
- **Key**: `VITE_ADMIN_PASSWORD`
- **Value**: 안전한 비밀번호
- **Environments**: Production, Preview, Development

### 3. 보안 강화 (선택사항)

**robots.txt에 추가**:
```txt
User-agent: *
Disallow: /admin.html
```

**Vercel 헤더 설정** (vercel.json):
```json
{
  "headers": [
    {
      "source": "/admin.html",
      "headers": [
        {
          "key": "X-Robots-Tag",
          "value": "noindex, nofollow"
        }
      ]
    }
  ]
}
```

## 🎯 기능

### ✅ 인증 시스템
- 비밀번호 기반 인증
- 세션 저장 (브라우저 새로고침 시 유지)
- 로그아웃 기능

### 📊 통계 대시보드
- **Total Comments**: 전체 댓글 수
- **Today**: 오늘 등록된 댓글 수
- **Total Likes**: 전체 좋아요 수

### 🔍 댓글 관리
- 전체 댓글 목록 조회
- 트랙 이름/아티스트로 필터링
- 개별 댓글 삭제
- 전체 댓글 일괄 삭제
- 실시간 새로고침

### 📝 댓글 정보
- 작성자, 작성 시간
- 연결된 음악 정보
- 좋아요 수
- 댓글 ID

## 🚀 사용법

### 1. 로그인
1. `admin.html` 페이지 접속
2. 관리자 비밀번호 입력
3. "Sign In" 클릭

### 2. 댓글 조회
- 페이지 로드 시 자동으로 모든 댓글 표시
- "Refresh" 버튼으로 수동 갱신

### 3. 댓글 필터링
- 검색창에 트랙 이름 또는 아티스트 이름 입력
- 실시간 필터링

### 4. 댓글 삭제
- 개별 삭제: 각 댓글의 🗑️ 버튼 클릭
- 전체 삭제: "Delete All" 버튼 클릭 (2단계 확인)

### 5. 로그아웃
- "Logout" 버튼 클릭

## ⚠️ 주의사항

1. **비밀번호 보안**
   - 절대 Git에 커밋하지 마세요
   - 강력한 비밀번호 사용
   - 정기적으로 변경

2. **삭제 작업**
   - 삭제된 댓글은 복구 불가능
   - "Delete All" 사용 시 특히 주의

3. **접근 제한**
   - 관리자만 URL 공유
   - robots.txt로 검색엔진 크롤링 차단

## 🔧 트러블슈팅

### "Failed to load comments"
- Supabase 연결 확인
- `.env` 파일의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 확인
- 브라우저 콘솔에서 에러 메시지 확인

### "Invalid password"
- 환경변수 `VITE_ADMIN_PASSWORD` 확인
- Vercel 환경변수 재확인
- 로컬 개발 시 `.env` 파일 확인

### 페이지가 안 열림
- `npm run dev` 또는 `npm run build` 실행
- `vite.config.ts`의 multi-page 설정 확인

## 📱 모바일 지원

관리자 페이지는 반응형으로 설계되어 모바일에서도 사용 가능합니다.

## 🎨 커스터마이징

`src/AdminApp.tsx` 파일을 수정하여:
- UI 스타일 변경
- 추가 통계 표시
- 필터 옵션 추가
- 댓글 수정 기능 추가

## 🔗 관련 파일

- `admin.html` - 관리자 페이지 HTML
- `src/admin.tsx` - React 진입점
- `src/AdminApp.tsx` - 메인 컴포넌트
- `src/lib/supabase.ts` - Supabase 클라이언트
- `vite.config.ts` - Multi-page 설정

## ✅ 완료!

관리자 페이지가 준비되었습니다. 안전하게 관리하세요! 🎉

