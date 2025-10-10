import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the request body
    const { action, data } = await req.json()

    switch (action) {
      case 'get_user_playlists':
        return await getUserPlaylists(supabaseClient, data)
      
      case 'save_playlist':
        return await savePlaylist(supabaseClient, data)
      
      case 'get_track_history':
        return await getTrackHistory(supabaseClient, data)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
    }
  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function getUserPlaylists(supabase: any, data: any) {
  const { user_id } = data
  
  const { data: playlists, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return new Response(
    JSON.stringify({ playlists }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function savePlaylist(supabase: any, data: any) {
  const { user_id, name, tracks, description } = data
  
  const { data: playlist, error } = await supabase
    .from('playlists')
    .insert({
      user_id,
      name,
      description,
      tracks: JSON.stringify(tracks),
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return new Response(
    JSON.stringify({ playlist }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

async function getTrackHistory(supabase: any, data: any) {
  const { user_id, limit = 50 } = data
  
  const { data: history, error } = await supabase
    .from('track_history')
    .select('*')
    .eq('user_id', user_id)
    .order('played_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return new Response(
    JSON.stringify({ history }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}
