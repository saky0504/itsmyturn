
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q')

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter "q" is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      // Supabase API URL - Env var automatically populated by Supabase
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase Anon Key - Env var automatically populated by Supabase
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 'pg_trgm' 인덱스를 활용하기 위해 .or 조건과 .ilike 사용
    // Supabase JS 로직: title ILIKE '%query%' OR artist ILIKE '%query%'
    const { data, error } = await supabaseClient
      .from('lp_products')
      .select(`
        *,
        offers:lp_offers(
            base_price,
            shipping_fee,
            vendor_name,
            in_stock
        )
      `)
      .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
      .limit(50)

    if (error) throw error

    // 최저가 계산 등 가공 로직
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedData = data.map((product: any) => {
      const lowestPrice = product.offers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.filter((o: any) => o.inStock)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((min: number, curr: any) => {
          const price = curr.base_price + curr.shipping_fee;
          return price < min ? price : min;
        }, Infinity);

      return {
        ...product,
        lowest_price: lowestPrice === Infinity ? null : lowestPrice,
        offers_count: product.offers?.length || 0
      };
    });

    return new Response(
      JSON.stringify(enrichedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
