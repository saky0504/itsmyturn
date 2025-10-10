// Supabase Edge Function using Hono
import { Hono } from 'npm:hono@3'
import { cors } from 'npm:hono/cors'

const app = new Hono()

// Enable CORS
app.use('/*', cors())

// Spotify API credentials
const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID') || ''
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET') || ''

let accessToken: string | null = null
let tokenExpiryTime = 0

// Get Spotify access token
async function getSpotifyToken() {
  if (accessToken && Date.now() < tokenExpiryTime) {
    return accessToken
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()
  accessToken = data.access_token
  tokenExpiryTime = Date.now() + data.expires_in * 1000

  return accessToken
}

// Search tracks
app.get('/search', async (c) => {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ error: 'Query parameter is required' }, 400)
  }

  const token = await getSpotifyToken()
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()
  const tracks = data.tracks.items.map((track: any) => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map((a: any) => a.name).join(', '),
    cover: track.album.images[0]?.url,
    duration: Math.floor(track.duration_ms / 1000),
    previewUrl: track.preview_url,
  }))

  return c.json({ tracks })
})

// Get featured playlists
app.get('/featured', async (c) => {
  const token = await getSpotifyToken()
  const response = await fetch(
    'https://api.spotify.com/v1/browse/featured-playlists?limit=10',
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()
  return c.json(data)
})

// Get recommendations
app.get('/recommendations', async (c) => {
  const seedTracks = c.req.query('seed_tracks') || ''
  
  const token = await getSpotifyToken()
  const response = await fetch(
    `https://api.spotify.com/v1/recommendations?seed_tracks=${seedTracks}&limit=20`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  const data = await response.json()
  const tracks = data.tracks.map((track: any) => ({
    id: track.id,
    title: track.name,
    artist: track.artists.map((a: any) => a.name).join(', '),
    cover: track.album.images[0]?.url,
    duration: Math.floor(track.duration_ms / 1000),
    previewUrl: track.preview_url,
  }))

  return c.json({ tracks })
})

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

Deno.serve(app.fetch)

