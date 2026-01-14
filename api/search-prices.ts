/**
 * Vercel Serverless Function for On-Demand Price Search
 * 
 * Edge Function 대신 Vercel Serverless Function 사용
 * 더 간단하고 안정적인 배포
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// CORS 헤더는 jsonResponse 함수에서 처리

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // CORS preflight 처리
  if (request.method === 'OPTIONS') {
    return response.status(200).setHeader('Access-Control-Allow-Origin', '*').setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS').setHeader('Access-Control-Allow-Headers', 'Content-Type').json({ ok: true });
  }

  // POST만 허용
  if (request.method !== 'POST') {
    return response.status(405).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Method not allowed' });
  }

  // 모든 응답에 CORS 헤더 추가하는 헬퍼
  const jsonResponse = (status: number, data: any) => {
    return response.status(status)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .json(data);
  };

  try {
    // Vercel Serverless Function에서는 VITE_ 접두사가 없어야 함
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // 모든 환경 변수 확인 (디버깅용)
      const allEnvKeys = Object.keys(process.env).sort();
      const relevantKeys = allEnvKeys.filter(k => 
        k.includes('SUPABASE') || 
        k.includes('NAVER') || 
        k.includes('VITE')
      );
      
      const envInfo = {
        hasUrl: !!process.env.SUPABASE_URL,
        hasViteUrl: !!process.env.VITE_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasViteKey: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        relevantEnvKeys: relevantKeys,
        supabaseUrlValue: supabaseUrl ? '***설정됨***' : '없음',
        supabaseKeyValue: supabaseKey ? '***설정됨***' : '없음'
      };
      
      console.error('[가격 검색 API] ❌ Supabase 환경 변수 없음:', JSON.stringify(envInfo, null, 2));
      
      // 프로덕션에서도 디버깅 정보 반환 (환경 변수 값은 제외)
      return jsonResponse(500, { 
        error: 'Supabase credentials not configured',
        hint: 'Vercel 대시보드 > Settings > Environment Variables에서 다음을 설정하세요: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET',
        debug: {
          hasUrl: !!process.env.SUPABASE_URL,
          hasViteUrl: !!process.env.VITE_SUPABASE_URL,
          hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasViteKey: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
          foundEnvKeys: relevantKeys
        }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Supabase 연결 테스트 (테이블 존재 확인)
    try {
      const { error: testError } = await supabase
        .from('lp_products')
        .select('id')
        .limit(1);
      
      if (testError) {
        console.error('[가격 검색 API] ❌ Supabase 테이블 접근 오류:', testError);
        return jsonResponse(500, {
          error: 'Database connection failed',
          message: testError.message,
          hint: 'Supabase URL과 Service Role Key가 올바른지 확인하세요. 테이블이 존재하는지 확인하세요.',
          details: {
            errorCode: testError.code,
            errorMessage: testError.message,
            supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '없음',
          }
        });
      }
    } catch (testErr: any) {
      console.error('[가격 검색 API] ❌ Supabase 연결 테스트 실패:', testErr);
      return jsonResponse(500, {
        error: 'Database connection test failed',
        message: testErr.message,
        hint: 'Supabase URL과 Service Role Key를 확인하세요.',
      });
    }

    const { productId, artist, title, ean, discogsId, forceRefresh } = request.body;

    // 파라미터 검증
    if (!productId && (!artist || !title)) {
      return jsonResponse(400, { 
        error: 'productId 또는 (artist + title)이 필요합니다.' 
      });
    }

    let identifier = { ean, discogsId, title, artist };

    // 1. 제품 ID가 있으면 DB에서 제품 정보 가져오기
    if (productId) {
      const { data, error } = await supabase
        .from('lp_products')
        .select('id, ean, discogs_id, title, artist')
        .eq('id', productId)
        .single();

      if (error) {
        console.error('[가격 검색 API] ❌ 제품 조회 오류:', error);
        return jsonResponse(500, {
          error: 'Failed to fetch product',
          message: error.message,
          productId,
        });
      }
      if (data) {
        identifier = {
          ean: data.ean || ean,
          discogsId: data.discogs_id || discogsId,
          title: data.title || title,
          artist: data.artist || artist,
        };
      }
    }

    // 2. 캐시 확인 (24시간 이내 데이터)
    if (!forceRefresh && productId) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: cachedOffers, error: offersError } = await supabase
        .from('lp_offers')
        .select('*')
        .eq('product_id', productId)
        .gte('last_checked', oneDayAgo)
        .order('base_price', { ascending: true });

      if (offersError) {
        console.error('[가격 검색 API] ⚠️ 캐시 조회 오류 (무시하고 계속):', offersError);
      }

      if (!offersError && cachedOffers && cachedOffers.length > 0) {
        const offers = cachedOffers.map((o: any) => ({
          vendorName: o.vendor_name,
          channelId: o.channel_id,
          basePrice: o.base_price,
          shippingFee: o.shipping_fee || 0,
          shippingPolicy: o.shipping_policy || '',
          url: o.url,
          inStock: o.is_stock_available,
          affiliateCode: o.affiliate_code,
          affiliateParamKey: o.affiliate_param_key,
        }));

        return jsonResponse(200, {
          offers,
          cached: true,
          searchTime: 0,
          productId,
        });
      }
    }

    // 3. 실시간 가격 검색
    console.log(`[가격 검색 API] 검색 시작:`, JSON.stringify(identifier, null, 2));
    const searchStartTime = Date.now();
    const { collectPricesForProduct } = await import('./lib/price-search');
    
    let offers: any[] = [];
    let searchTime = 0;
    try {
      offers = await collectPricesForProduct(identifier);
      searchTime = parseFloat(((Date.now() - searchStartTime) / 1000).toFixed(2));
      console.log(`[가격 검색 API] 검색 완료: ${offers.length}개 (${searchTime}초)`);
      if (offers.length === 0) {
        console.log(`[가격 검색 API] ⚠️ 결과 없음 - 검색 쿼리나 필터링 문제 가능성`);
      }
    } catch (error: any) {
      console.error(`[가격 검색 API] ❌ 검색 오류:`, error.message, error.stack);
      return jsonResponse(500, {
        error: 'Price search failed',
        message: error.message,
        identifier,
      });
    }

    // 4. 검색 결과를 DB에 저장 (제품이 있는 경우)
    if (productId && offers.length > 0) {
      // 기존 offers 삭제
      await supabase
        .from('lp_offers')
        .delete()
        .eq('product_id', productId);

      // 새 offers 삽입
      const offersToInsert = offers.map(offer => ({
        product_id: productId,
        vendor_name: offer.vendorName,
        channel_id: offer.channelId,
        price: offer.basePrice,
        base_price: offer.basePrice,
        currency: 'KRW',
        shipping_fee: offer.shippingFee,
        shipping_policy: offer.shippingPolicy,
        url: offer.url,
        affiliate_url: null,
        is_stock_available: offer.inStock,
        last_checked: new Date().toISOString(),
        badge: null,
      }));

      await supabase
        .from('lp_offers')
        .insert(offersToInsert);

      // 제품의 last_synced_at 업데이트
      await supabase
        .from('lp_products')
        .update({
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);
    }

    return jsonResponse(200, {
      offers,
      cached: false,
      searchTime,
      productId: productId || null,
    });

  } catch (error: any) {
    console.error('[가격 검색 오류]', error);
    return jsonResponse(500, { 
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
