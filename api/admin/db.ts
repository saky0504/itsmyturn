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
      case 'moveOffersToNewProduct':
        result = await adminSupabase.from('lp_offers').update({ product_id: payload.newProductId, updated_at: payload.updatedAt }).eq('product_id', payload.oldProductId);
        break;

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
