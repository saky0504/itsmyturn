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

  // Vercel Serverless Function Limit: 10s (Hobby), 60s (Pro)
  // We try to run what we can, but likely better to trigger an external worker or just do quick discovery

  try {
    const { discoverKoreanLPs } = await import('../scripts/discover-korean-lps');
    const { cleanupBadProducts } = await import('../scripts/cleanup');

    // Run Korean Discovery (Aladin API is fast)
    await discoverKoreanLPs();

    // Run Cleanup to ensure DB stays clean
    await cleanupBadProducts();

    return response.status(200).json({
      success: true,
      message: 'Hourly sync executed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Hourly sync failed:', error);
    return response.status(500).json({
      success: false,
      error: String(error)
    });
  }
}

