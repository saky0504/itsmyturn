#!/bin/bash
# Supabase Edge Functions 배포 스크립트

echo "🚀 Supabase Edge Functions 배포 시작..."

# 1. Supabase CLI 로그인 확인
echo "📋 Supabase CLI 로그인 확인 중..."
npx supabase login

# 2. 프로젝트 연결 (프로젝트 참조 ID 필요)
# Supabase 대시보드 > Project Settings > General > Reference ID 확인
echo "🔗 프로젝트 연결 중..."
echo "⚠️  프로젝트 참조 ID를 입력하세요 (예: abcdefghijklmnop):"
read PROJECT_REF

npx supabase link --project-ref $PROJECT_REF

# 3. Edge Function 배포
echo "📦 search-prices 함수 배포 중..."
npx supabase functions deploy search-prices

echo "✅ 배포 완료!"
echo ""
echo "⚠️  환경 변수 설정 확인:"
echo "   - NAVER_CLIENT_ID"
echo "   - NAVER_CLIENT_SECRET"
echo "   - ALADIN_TTB_KEY"
echo ""
echo "Supabase 대시보드 > Project Settings > Edge Functions > Secrets에서 설정하세요."
