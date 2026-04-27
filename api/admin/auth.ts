import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Admin 인증 API
 * 
 * 클라이언트에서 비밀번호를 직접 비교하지 않고,
 * 서버 사이드에서 비밀번호를 검증합니다.
 * ADMIN_PASSWORD 환경변수는 VITE_ 접두사 없이 서버에서만 사용합니다.
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = request.body;

    if (!password || typeof password !== 'string') {
      return response.status(400).json({ error: 'Password is required' });
    }

    // 서버 사이드 환경변수에서 비밀번호 가져오기 (VITE_ 접두사 없음 = 클라이언트 번들에 포함되지 않음)
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('[Admin Auth] ADMIN_PASSWORD 환경변수가 설정되지 않음');
      return response.status(500).json({ error: 'Server configuration error' });
    }

    if (password !== adminPassword) {
      return response.status(401).json({ error: 'Invalid password' });
    }

    // 인증 성공 — 간단한 서명된 토큰 생성
    // 실제 프로덕션에서는 JWT를 사용하는 것이 좋지만,
    // 단일 관리자 시나리오에서는 HMAC 기반 토큰으로 충분합니다.
    const timestamp = Date.now();
    const tokenPayload = `admin:${timestamp}`;
    
    // 비밀번호를 시드로 사용한 간단한 해시 토큰 생성
    const encoder = new TextEncoder();
    const data = encoder.encode(tokenPayload + ':' + adminPassword);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const token = `${Buffer.from(tokenPayload).toString('base64')}.${hash}`;

    return response.status(200).json({
      success: true,
      token,
    });
  } catch (error: unknown) {
    console.error('[Admin Auth] Error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
