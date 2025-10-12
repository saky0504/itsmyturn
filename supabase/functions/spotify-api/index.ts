import { Hono } from 'https://deno.land/x/hono@v3.12.11/mod.ts';
import { cors } from 'https://deno.land/x/hono@v3.12.11/middleware.ts';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'spotify-api',
    timestamp: new Date().toISOString()
  });
});

// Get Spotify access token
async function getSpotifyAccessToken() {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  console.log('🔑 Checking Spotify credentials...', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdLength: clientId?.length || 0
  });
  
  if (!clientId || !clientSecret) {
    console.error('❌ Missing Spotify credentials');
    throw new Error('Spotify credentials not configured');
  }

  console.log('🔐 Requesting Spotify access token...');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: 'grant_type=client_credentials'
  });
  
  console.log('🎫 Spotify token response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Spotify token error:', {
      status: response.status,
      statusText: response.statusText,
      body: errorText
    });
    throw new Error(`Spotify token error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Spotify access token received');
  return data.access_token;
}

// Get Spotify playlist
async function getSpotifyPlaylist(accessToken: string) {
  try {
    console.log('🎵 Fetching Spotify playlist with access token:', accessToken.substring(0, 20) + '...');
    
    // Spotify의 인기 플레이리스트 ID (Today's Top Hits)
    const playlistId = '37i9dQZF1DXcBWIGoYBM5M';
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=20`;
    
    console.log('🔗 Spotify API URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Spotify API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Spotify API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`Spotify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Spotify API Success - Total items:', data.items?.length || 0);
    
    const tracks = data.items
      .filter((item: any) => item.track && item.track.preview_url)
      .map((item: any) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists[0].name,
        album: item.track.album.name,
        cover: item.track.album.images[0]?.url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
        preview_url: item.track.preview_url,
        duration: item.track.duration_ms,
        spotify_url: item.track.external_urls.spotify
      }))
      .slice(0, 10); // 최대 10개 트랙 반환

    console.log('🎶 Processed tracks with preview:', tracks.length);
    return { tracks };
  } catch (error) {
    console.error('❌ Spotify playlist fetch error:', error);
    throw error;
  }
}

// Get Spotify playlist tracks
app.get('/playlist', async (c) => {
  try {
    console.log('🎧 Spotify playlist endpoint called');
    const accessToken = await getSpotifyAccessToken();
    const playlistResult = await getSpotifyPlaylist(accessToken);
    console.log('✅ Returning Spotify playlist result:', playlistResult.tracks.length, 'tracks');
    return c.json(playlistResult);
  } catch (error) {
    console.error('❌ Spotify playlist error:', error);
    return c.json({ 
      error: 'Failed to fetch Spotify playlist',
      details: (error as Error).message,
      tracks: [] 
    }, 500);
  }
});

// Serve the app
Deno.serve(app.fetch);
