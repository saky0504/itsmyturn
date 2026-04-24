import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function Limit: 10s (Hobby)
// This endpoint performs Admin database operations bypassing RLS using the service role key.
// It requires the VITE_ADMIN_PASSWORD in the Authorization header.

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // 1. CORS Headers for browser requests
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // 2. Authentication Check
  const authHeader = request.headers.authorization;
  const adminPassword = process.env.VITE_ADMIN_PASSWORD || 'admin123';

  if (!authHeader || authHeader !== `Bearer ${adminPassword}`) {
    return response.status(401).json({ error: 'Unauthorized: Invalid Admin Password' });
  }

  // 3. Request Validation
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const { action, payload } = request.body;

  if (!action || !payload) {
    return response.status(400).json({ error: 'Bad Request: Missing action or payload' });
  }

  // 4. Initialize Admin Supabase Client
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Server configuration error: Missing Supabase URL or Service Role Key');
    return response.status(500).json({ error: 'Server configuration error' });
  }

  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // 5. Execute Action
  try {
    let result;

    switch (action) {
      // --- LP Products ---
      case 'insertProduct':
        result = await adminSupabase.from('lp_products').insert(payload.data).select(payload.select || '*').single();
        break;
      case 'updateProduct':
        result = await adminSupabase.from('lp_products').update(payload.data).eq('id', payload.id).select(payload.select || '*');
        break;
      case 'deleteProduct':
        result = await adminSupabase.from('lp_products').delete().eq('id', payload.id);
        break;
      
      // --- LP Offers ---
      case 'insertOffer':
        result = await adminSupabase.from('lp_offers').insert(payload.data);
        break;
      case 'updateOffer':
        result = await adminSupabase.from('lp_offers').update(payload.data).eq('id', payload.id);
        break;
      case 'deleteOffer':
        result = await adminSupabase.from('lp_offers').delete().eq('id', payload.id);
        break;
      case 'deleteOffersByProductId':
        result = await adminSupabase.from('lp_offers').delete().eq('product_id', payload.productId);
        break;
      case 'moveOffersToNewProduct': {
        // 1. 새 상품(baseId)이 이미 가진 Offer 조회
        const { data: newOffers } = await adminSupabase
          .from('lp_offers')
          .select('id, vendor_name')
          .eq('product_id', payload.newProductId);

        // 2. 병합될 이전 상품(oldId)의 Offer 조회
        const { data: oldOffers } = await adminSupabase
          .from('lp_offers')
          .select('id, vendor_name')
          .eq('product_id', payload.oldProductId);

        const existingVendors = new Set((newOffers || []).map(o => o.vendor_name));
        const offersToMove: string[] = [];
        const offersToDelete: string[] = [];

        for (const old of (oldOffers || [])) {
          if (existingVendors.has(old.vendor_name)) {
            // 이미 기준 앨범에 같은 판매처 정보가 있다면, 중복이므로 파기
            offersToDelete.push(old.id);
          } else {
            // 중복이 아니면 이동 목록에 넣고, 중복 체크 셋에 추가
            offersToMove.push(old.id);
            existingVendors.add(old.vendor_name);
          }
        }

        // 중복 데이터 먼저 파기
        if (offersToDelete.length > 0) {
          const { error: deleteError } = await adminSupabase.from('lp_offers').delete().in('id', offersToDelete);
          if (deleteError) throw deleteError;
        }

        // 유효한 데이터만 새 상품으로 이동
        if (offersToMove.length > 0) {
          result = await adminSupabase
            .from('lp_offers')
            .update({ product_id: payload.newProductId, updated_at: payload.updatedAt })
            .in('id', offersToMove);
        } else {
          result = { data: null, error: null };
        }
        break;
      }

      // --- Comments ---
      case 'deleteComment':
        result = await adminSupabase.from('comments').delete().eq('id', payload.id);
        break;
      case 'deleteAllComments':
        result = await adminSupabase.from('comments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        break;

      default:
        return response.status(400).json({ error: `Unknown action: ${action}` });
    }

    if (result.error) {
      console.error(`Supabase DB Error [${action}]:`, result.error);
      throw result.error;
    }

    return response.status(200).json({ success: true, data: result.data });

  } catch (error: any) {
    console.error('Admin API Error:', error);
    return response.status(500).json({ 
      success: false, 
      error: error.message || String(error) 
    });
  }
}
