/**
 * Vercel Serverless Function for Hourly Sync
 * 
 * 이 함수는 Vercel Cron에 의해 한 시간마다 자동으로 호출됩니다.
 * vercel.json의 crons 설정을 참조하세요.
 * 
 * 주의: Vercel Serverless Function에서는 외부 스크립트를 직접 실행할 수 없으므로,
 * GitHub Actions를 사용하는 것을 권장합니다.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Vercel Cron에서만 실행되도록 보안 체크
  const authHeader = request.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  // Vercel Serverless Function에서는 외부 스크립트 실행이 제한적이므로
  // GitHub Actions를 사용하는 것을 권장합니다.
  // 이 엔드포인트는 단순히 상태를 반환합니다.

  return response.status(200).json({
    success: true,
    message: 'Vercel Cron endpoint is configured. Please use GitHub Actions for actual script execution.',
    note: 'The hourly sync should be run via GitHub Actions (.github/workflows/hourly-sync.yml)',
    timestamp: new Date().toISOString(),
  });
}

