/**
 * 환경 변수 테스트용 API
 * Vercel에 환경 변수가 제대로 설정되었는지 확인
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  // 모든 환경 변수 확인 (민감한 값은 마스킹)
  const allEnvKeys = Object.keys(process.env).sort();
  const relevantKeys = allEnvKeys.filter(k => 
    k.includes('SUPABASE') || 
    k.includes('NAVER') || 
    k.includes('VITE')
  );

  const envStatus = {
    SUPABASE_URL: {
      exists: !!process.env.SUPABASE_URL,
      value: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.substring(0, 20)}...` : '없음'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      value: process.env.SUPABASE_SERVICE_ROLE_KEY ? '***설정됨***' : '없음',
      length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
    },
    VITE_SUPABASE_URL: {
      exists: !!process.env.VITE_SUPABASE_URL,
      value: process.env.VITE_SUPABASE_URL ? `${process.env.VITE_SUPABASE_URL.substring(0, 20)}...` : '없음'
    },
    VITE_SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      value: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ? '***설정됨***' : '없음'
    },
    NAVER_CLIENT_ID: {
      exists: !!process.env.NAVER_CLIENT_ID,
      value: process.env.NAVER_CLIENT_ID ? '***설정됨***' : '없음'
    },
    NAVER_CLIENT_SECRET: {
      exists: !!process.env.NAVER_CLIENT_SECRET,
      value: process.env.NAVER_CLIENT_SECRET ? '***설정됨***' : '없음'
    },
    allRelevantKeys: relevantKeys,
    totalEnvKeys: allEnvKeys.length
  };

  return response.status(200)
    .setHeader('Access-Control-Allow-Origin', '*')
    .json({
      message: '환경 변수 상태',
      status: envStatus,
      recommendation: {
        required: [
          'SUPABASE_URL (VITE_ 없이)',
          'SUPABASE_SERVICE_ROLE_KEY (VITE_ 없이)',
          'NAVER_CLIENT_ID',
          'NAVER_CLIENT_SECRET'
        ],
        note: 'Vercel 대시보드에서 Production, Preview, Development 모두에 설정해야 합니다.'
      }
    });
}
