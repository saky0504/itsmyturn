# 🔍 Google Search Console 설정 가이드

> **itsmyturn.app** 도메인을 Google Search Console에 등록하는 완전한 가이드

## 📋 사전 준비사항

- ✅ **도메인 소유권 확인**: `itsmyturn.app` 도메인에 대한 관리 권한 필요
- ✅ **DNS 관리자 접근**: 도메인 등록업체(예: GoDaddy, Namecheap) 계정 접근
- ✅ **Google 계정**: Gmail 계정으로 Google Search Console 접근

---

## 🚀 1단계: Google Search Console 접속

1. **Google Search Console** 방문: https://search.google.com/search-console/
2. **Google 계정으로 로그인**
3. **"속성 추가"** 또는 **"Add property"** 클릭

---

## 🎯 2단계: 도메인 속성 추가

### 방법 1: 도메인 속성 (권장)
```
도메인: itsmyturn.app
```

### 방법 2: URL 접두사 속성 (대안)
```
URL: https://itsmyturn.app
```

**→ 도메인 속성을 선택하는 것을 권장합니다!**

---

## 🔐 3단계: 도메인 소유권 확인

### DNS TXT 레코드 방법 (권장)

1. **"DNS 레코드"** 탭 선택
2. **TXT 레코드** 선택
3. **제공된 TXT 레코드 복사**:
   ```
   google-site-verification=z301HMyQYwRq4sTSqRZyy0jlsZVPuxyq51tLa
   ```

4. **도메인 등록업체에 로그인**:
   - GoDaddy: https://dcc.godaddy.com/
   - Namecheap: https://ap.www.namecheap.com/
   - 기타: 해당 업체 DNS 관리 페이지

5. **DNS 설정에서 TXT 레코드 추가**:
   ```
   Type: TXT
   Name: @ (또는 비워두기)
   Value: google-site-verification=z301HMyQYwRq4sTSqRZyy0jlsZVPuxyq51tLa
   TTL: 3600 (또는 기본값)
   ```

6. **변경사항 저장**

---

## ⏰ 4단계: DNS 전파 대기

- **DNS 전파 시간**: 5분 ~ 24시간
- **일반적으로**: 15분 ~ 1시간 내 완료
- **확인 방법**: 
  ```bash
  # Windows PowerShell
  nslookup -type=TXT itsmyturn.app
  
  # 또는 온라인 도구 사용
  # https://dnschecker.org/
  ```

---

## ✅ 5단계: 소유권 확인

1. **Google Search Console로 돌아가기**
2. **"확인" 또는 "VERIFY" 버튼 클릭**
3. **성공 메시지 확인**

---

## 🛠️ 6단계: 사이트맵 제출 (선택사항)

### Vercel 자동 사이트맵
```
https://itsmyturn.app/sitemap.xml
```

### 수동 사이트맵 생성
`public/sitemap.xml` 파일 생성:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://itsmyturn.app/</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://itsmyturn.app/admin.html</loc>
    <lastmod>2024-01-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

---

## 📊 7단계: 검색 성능 모니터링

### 주요 지표 확인
- **색인 생성 상태**: "색인 생성" → "페이지" 탭
- **검색 쿼리**: "성능" → "검색 결과" 탭
- **모바일 사용성**: "사용자 경험" → "모바일 사용성"
- **핵심 웹 바이탈**: "사용자 경험" → "핵심 웹 바이탈"

---

## 🔧 8단계: robots.txt 설정 (선택사항)

`public/robots.txt` 파일 생성:
```
User-agent: *
Allow: /
Disallow: /admin.html

Sitemap: https://itsmyturn.app/sitemap.xml
```

---

## 🚨 문제 해결

### DNS 확인이 안 될 때
1. **DNS 전파 시간 대기** (최대 24시간)
2. **다른 DNS 확인 도구 사용**:
   - https://dnschecker.org/
   - https://mxtoolbox.com/
3. **TXT 레코드 형식 재확인**
4. **도메인 등록업체에 문의**

### 대안 확인 방법
- **HTML 파일 업로드**: `public/google[random].html` 파일 생성
- **HTML 메타 태그**: `index.html`에 메타 태그 추가
- **Google Analytics**: Google Analytics 연동

---

## 📈 9단계: SEO 최적화

### 메타 태그 확인
`index.html`에 다음 태그들이 있는지 확인:
```html
<meta name="description" content="Premium LP Turntable Music Player with Spotify Integration">
<meta name="keywords" content="vinyl, turntable, music player, spotify, LP">
<meta property="og:title" content="It's My Turn - Vinyl Player">
<meta property="og:description" content="Beautiful vinyl turntable interface">
<meta property="og:url" content="https://itsmyturn.app">
<meta property="og:type" content="website">
```

### 구조화된 데이터 (선택사항)
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "It's My Turn",
  "description": "Premium LP Turntable Music Player",
  "url": "https://itsmyturn.app",
  "applicationCategory": "MusicApplication"
}
```

---

## ✅ 체크리스트

- [ ] Google Search Console 계정 생성
- [ ] 도메인 속성 추가
- [ ] DNS TXT 레코드 추가
- [ ] DNS 전파 대기 (15분~1시간)
- [ ] 소유권 확인 완료
- [ ] 사이트맵 제출
- [ ] robots.txt 설정
- [ ] 메타 태그 최적화
- [ ] 검색 성능 모니터링 시작

---

## 📞 지원

**문제가 발생하면:**
1. **Google Search Console 도움말**: https://support.google.com/webmasters/
2. **DNS 문제**: 도메인 등록업체 고객지원
3. **기술적 문제**: 프로젝트 GitHub Issues

---

**🎵 Happy SEO! It's My Turn이 검색 결과 상위에 노출되길 바랍니다!**
