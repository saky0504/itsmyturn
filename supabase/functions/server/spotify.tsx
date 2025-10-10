import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Simple health check for server status
app.get('/make-server-f3afc2d2/spotify/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'spotify-vinyl-player'
  });
});

// Detailed health check for Spotify service
app.get('/make-server-f3afc2d2/spotify/health/detailed', async (c) => {
  try {
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    // Test the credentials by getting a token
    if (clientId && clientSecret) {
      try {
        await getSpotifyAccessToken();
        return c.json({
          status: 'ok',
          hasCredentials: true,
          credentialsValid: true,
          timestamp: new Date().toISOString()
        });
      } catch (tokenError) {
        return c.json({
          status: 'warning',
          hasCredentials: true,
          credentialsValid: false,
          error: tokenError.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return c.json({
      status: 'demo_mode',
      hasCredentials: false,
      credentialsValid: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return c.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Get sample tracks for demo (fallback when API fails)
app.get('/make-server-f3afc2d2/spotify/demo', (c) => {
  const demoResult = getDemoTracks();
  return c.json(demoResult);
});

// Spotify API Base URL
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Get demo tracks helper function (?¤ì œ ?¬ìƒ ê°€?¥í•œ ?˜í”Œ ?¸ëž™)
function getDemoTracks() {
  
  // HTML5 ?„ì „ ?¸í™˜ ?°ëª¨ ?¸ëž™??(?¹ì—??ë°”ë¡œ ?¬ìƒ ê°€??
  const demoTracks = [
    {
      id: 'demo1',
      title: 'Demo Track 1',
      artist: 'Test Artist',
      album: 'Demo Album',
      cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop',
      preview_url: 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
      duration: 30000,
      spotify_url: 'https://open.spotify.com/track/demo1'
    },
    {
      id: 'demo2',
      title: 'Demo Track 2', 
      artist: 'Test Artist',
      album: 'Demo Album',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
      preview_url: 'https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand60.wav',
      duration: 30000,
      spotify_url: 'https://open.spotify.com/track/demo2'
    },
    {
      id: 'demo3',
      title: 'Demo Track 3',
      artist: 'Test Artist', 
      album: 'Demo Album',
      cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=300&h=300&fit=crop',
      preview_url: 'https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav',
      duration: 30000,
      spotify_url: 'https://open.spotify.com/track/demo3'
    }
  ];
  
  return { tracks: demoTracks };
}

// Get Spotify access token
async function getSpotifyAccessToken() {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  console.log('Checking Spotify credentials...', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdLength: clientId?.length || 0
  });
  
  if (!clientId || !clientSecret) {
    console.error('Missing Spotify credentials');
    throw new Error('Spotify credentials not configured');
  }

  console.log('Requesting Spotify access token...');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
    },
    body: 'grant_type=client_credentials'
  });

  console.log('Token response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token request failed:', response.status, errorText);
    throw new Error(`Failed to get Spotify token: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('Token obtained successfully');
  return data.access_token;
}

// Search for tracks
app.get('/make-server-f3afc2d2/spotify/search', async (c) => {
  try {
    const query = c.req.query('q');
    const limit = c.req.query('limit') || '20';
    
    if (!query) {
      return c.json({ error: 'Query parameter required' }, 400);
    }

    const accessToken = await getSpotifyAccessToken();
    
    const response = await fetch(
      `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform data for our player
    const tracks = data.tracks.items.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist: any) => artist.name).join(', '),
      album: track.album.name,
      cover: track.album.images[0]?.url || '',
      preview_url: track.preview_url,
      duration: track.duration_ms,
      spotify_url: track.external_urls.spotify
    }));

    return c.json({ tracks });
  } catch (error) {
    console.error('Spotify search error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get featured playlists
app.get('/make-server-f3afc2d2/spotify/featured', async (c) => {
  try {
    const accessToken = await getSpotifyAccessToken();
    
    const response = await fetch(
      `${SPOTIFY_API_BASE}/browse/featured-playlists?limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return c.json({ playlists: data.playlists.items });
  } catch (error) {
    console.error('Spotify featured playlists error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get playlist tracks
app.get('/make-server-f3afc2d2/spotify/playlist/:id', async (c) => {
  try {
    const playlistId = c.req.param('id');
    console.log('Fetching playlist tracks for ID:', playlistId);
    
    const accessToken = await getSpotifyAccessToken();
    
    const response = await fetch(
      `${SPOTIFY_API_BASE}/playlists/${playlistId}/tracks?limit=50&market=US`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('Playlist tracks response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spotify playlist API error:', response.status, errorText);
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Playlist tracks data received, items count:', data.items?.length || 0);
    
    // Transform data for our player
    const tracks = data.items
      .filter((item: any) => item.track && item.track.preview_url)
      .map((item: any) => ({
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((artist: any) => artist.name).join(', '),
        album: item.track.album.name,
        cover: item.track.album.images[0]?.url || '',
        preview_url: item.track.preview_url,
        duration: item.track.duration_ms,
        spotify_url: item.track.external_urls.spotify
      }));

    console.log('Filtered playlist tracks with preview:', tracks.length);
    return c.json({ tracks });
  } catch (error) {
    console.error('Spotify playlist tracks error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return c.json({ 
      error: error.message,
      details: 'Check server logs for more information'
    }, 500);
  }
});

// Get recommendations
app.get('/make-server-f3afc2d2/spotify/recommendations', async (c) => {
  try {
    console.log('?Žµ === Starting Spotify recommendations request ===');
    console.log('?”‘ Getting Spotify access token...');
    
    let accessToken;
    try {
      accessToken = await getSpotifyAccessToken();
      console.log('Access token obtained successfully');
    } catch (tokenError) {
      console.error('??Failed to get access token:', tokenError.message);
      // Spotify API ?¤íŒ¨?œì—ë§??°ëª¨ ?¸ëž™ ?¬ìš©
      console.log('?“» Using demo tracks as fallback');
      const demoResult = getDemoTracks();
      console.log('?“» Demo tracks prepared:', demoResult.tracks.map(t => ({ title: t.title, url: t.preview_url })));
      return c.json(demoResult);
    }
    
    // Use search for popular tracks with preview URLs
    console.log('Searching for popular tracks with previews...');
    
    // Search for specific popular songs that usually have preview URLs
    const searchTerms = [
      'track:"Blinding Lights" artist:"The Weeknd"',
      'track:"Shape of You" artist:"Ed Sheeran"', 
      'track:"As It Was" artist:"Harry Styles"',
      'track:"Anti-Hero" artist:"Taylor Swift"',
      'track:"Bad Habit" artist:"Steve Lacy"',
      'track:"Flowers" artist:"Miley Cyrus"',
      'track:"Unholy" artist:"Sam Smith"',
      'track:"Good 4 U" artist:"Olivia Rodrigo"'
    ];
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    console.log('Using search term:', randomTerm);
    
    const response = await fetch(
      `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(randomTerm)}&type=track&limit=50&market=US`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    console.log('Search response status:', response.status);
    console.log('Search response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spotify search API error:', response.status, errorText);
      
      // Fallback to recommendations API with seed genres
      console.log('Trying fallback with recommendations API...');
      const fallbackResponse = await fetch(
        `${SPOTIFY_API_BASE}/recommendations?seed_genres=pop,rock,hip-hop&limit=20&market=US`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      console.log('Fallback response status:', fallbackResponse.status);
      
      if (!fallbackResponse.ok) {
        console.error('Both search and recommendations failed, using demo tracks');
        const demoResult = getDemoTracks();
        return c.json(demoResult);
      }
      
      const fallbackData = await fallbackResponse.json();
      const fallbackTracks = fallbackData.tracks
        .filter((track: any) => track.preview_url)
        .map((track: any) => ({
          id: track.id,
          title: track.name,
          artist: track.artists.map((artist: any) => artist.name).join(', '),
          album: track.album.name,
          cover: track.album.images[0]?.url || '',
          preview_url: track.preview_url,
          duration: track.duration_ms,
          spotify_url: track.external_urls.spotify
        }));
      
      console.log('Fallback tracks with preview:', fallbackTracks.length);
      
      // If still no tracks with preview, return demo tracks
      if (fallbackTracks.length === 0) {
        console.log('No fallback tracks with preview found, returning demo tracks');
        const demoResult = getDemoTracks();
        return c.json(demoResult);
      }
      
      console.log('Returning fallback tracks');
      return c.json({ tracks: fallbackTracks });
    }

    const responseText = await response.text();
    console.log('Raw response length:', responseText.length);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Spotify response:', parseError);
      console.error('Response text preview:', responseText.substring(0, 500));
      const demoResult = getDemoTracks();
      return c.json(demoResult);
    }
    
    console.log('Search data received, tracks count:', data.tracks?.items?.length || 0);
    
    // Transform data for our player
    const tracks = (data.tracks?.items || [])
      .filter((track: any) => {
        // More strict filtering - ensure we have valid preview URLs
        return track && 
               track.preview_url && 
               typeof track.preview_url === 'string' && 
               track.preview_url.startsWith('https://') &&
               track.name &&
               track.artists &&
               track.artists.length > 0;
      })
      .map((track: any) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: any) => artist.name).join(', '),
        album: track.album.name,
        cover: track.album.images[0]?.url || '',
        preview_url: track.preview_url,
        duration: track.duration_ms,
        spotify_url: track.external_urls.spotify
      }))
      .slice(0, 20); // Limit to 20 tracks

    console.log('Filtered tracks with preview:', tracks.length);
    
    // If no tracks with preview found, return demo tracks
    if (tracks.length === 0) {
      console.log('? ï¸ No tracks with preview found, returning demo tracks');
      const demoResult = getDemoTracks();
      console.log('?“» Demo tracks prepared:', demoResult.tracks.map(t => ({ title: t.title, url: t.preview_url })));
      return c.json(demoResult);
    }
    
    console.log('??=== Successfully returning Spotify tracks ===');
    console.log('?Žµ Tracks with preview URLs:', tracks.map(t => ({ title: t.title, url: t.preview_url?.substring(0, 50) + '...' })));
    return c.json({ tracks });
  } catch (error) {
    console.error('=== Spotify recommendations error ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Always return demo tracks on any error
    console.log('?“» Returning demo tracks due to error');
    try {
      const demoResult = getDemoTracks();
      console.log('?“» Demo tracks prepared after error:', demoResult.tracks.map(t => ({ title: t.title, url: t.preview_url })));
      return c.json(demoResult);
    } catch (demoError) {
      console.error('??Failed to get demo tracks:', demoError);
      return c.json({ 
        error: 'Service temporarily unavailable',
        tracks: []
      }, 500);
    }
  }
});

export default app;
