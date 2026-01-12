import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProductIdentifier {
  ean?: string;
  discogsId?: string;
  title?: string;
  artist?: string;
}

interface VendorOffer {
  vendorName: string;
  channelId: string;
  basePrice: number;
  shippingFee: number;
  shippingPolicy: string;
  url: string;
  inStock: boolean;
  affiliateCode?: string;
  affiliateParamKey?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const body = await req.json()
    const { productId, artist, title, ean, discogsId, forceRefresh } = body

    // 파라미터 검증
    if (!productId && (!artist || !title)) {
      return new Response(
        JSON.stringify({ error: 'productId 또는 (artist + title)이 필요합니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    let product: any = null
    let identifier: ProductIdentifier = { ean, discogsId, title, artist }

    // 1. 제품 ID가 있으면 DB에서 제품 정보 가져오기
    if (productId) {
      const { data, error } = await supabaseClient
        .from('lp_products')
        .select('id, ean, discogs_id, title, artist')
        .eq('id', productId)
        .single()

      if (error) throw error
      if (data) {
        product = data
        identifier = {
          ean: data.ean || ean,
          discogsId: data.discogs_id || discogsId,
          title: data.title || title,
          artist: data.artist || artist,
        }
      }
    }

    // 2. 캐시 확인 (24시간 이내 데이터)
    if (!forceRefresh && productId) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      
      const { data: cachedOffers, error: offersError } = await supabaseClient
        .from('lp_offers')
        .select('*')
        .eq('product_id', productId)
        .gte('last_checked', oneDayAgo)
        .order('base_price', { ascending: true })

      if (!offersError && cachedOffers && cachedOffers.length > 0) {
        // 캐시된 데이터 반환
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
        }))

        return new Response(
          JSON.stringify({
            offers,
            cached: true,
            searchTime: 0,
            productId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // 3. 실시간 가격 검색
    const searchStartTime = Date.now();
    const { collectPricesForProduct } = await import('../_shared/price-search.ts')
    
    const offers = await collectPricesForProduct(identifier)
    const searchTime = ((Date.now() - searchStartTime) / 1000).toFixed(2)

    // 4. 검색 결과를 DB에 저장 (제품이 있는 경우)
    if (productId && offers.length > 0) {
      // 기존 offers 삭제
      await supabaseClient
        .from('lp_offers')
        .delete()
        .eq('product_id', productId)

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
      }))

      await supabaseClient
        .from('lp_offers')
        .insert(offersToInsert)

      // 제품의 last_synced_at 업데이트
      await supabaseClient
        .from('lp_products')
        .update({
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
    }

    return new Response(
      JSON.stringify({
        offers,
        cached: false,
        searchTime: parseFloat(searchTime),
        productId: productId || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
