// Spotify API integration for Supabase Edge Functions
// Handles authentication, API calls, and data caching

interface SpotifyTrack {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: {
    name: string
    images: Array<{ url: string; width: number; height: number }>
  }
  duration_ms: number
  preview_url: string | null
  external_urls: {
    spotify: string
  }
}

interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: Array<{ url: string }>
  tracks: {
    total: number
    items: Array<{ track: SpotifyTrack }>
  }
  owner: {
    display_name: string
  }
}

class SpotifyAPI {
  private clientId: string
  private clientSecret: string
  private redirectUri: string

  constructor() {
    this.clientId = Deno.env.get('SPOTIFY_CLIENT_ID') || ''
    this.clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET') || ''
    this.redirectUri = Deno.env.get('SPOTIFY_REDIRECT_URI') || ''
  }

  // Get access token using authorization code
  async getAccessToken(code: string): Promise<any> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get access token')
    }

    return await response.json()
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<any> {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh access token')
    }

    return await response.json()
  }

  // Make authenticated API request
  private async makeRequest(url: string, accessToken: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  // Search for tracks
  async searchTracks(query: string, accessToken: string, limit = 20): Promise<SpotifyTrack[]> {
    const encodedQuery = encodeURIComponent(query)
    const url = `https://api.spotify.com/v1/search?q=${encodedQuery}&type=track&limit=${limit}`
    
    const data = await this.makeRequest(url, accessToken)
    return data.tracks.items
  }

  // Get user's playlists
  async getUserPlaylists(accessToken: string, limit = 50): Promise<SpotifyPlaylist[]> {
    const url = `https://api.spotify.com/v1/me/playlists?limit=${limit}`
    const data = await this.makeRequest(url, accessToken)
    return data.items
  }

  // Get playlist tracks
  async getPlaylistTracks(playlistId: string, accessToken: string): Promise<SpotifyTrack[]> {
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`
    const data = await this.makeRequest(url, accessToken)
    return data.items.map((item: any) => item.track).filter((track: any) => track !== null)
  }

  // Get track details
  async getTrack(trackId: string, accessToken: string): Promise<SpotifyTrack> {
    const url = `https://api.spotify.com/v1/tracks/${trackId}`
    return await this.makeRequest(url, accessToken)
  }

  // Get user's top tracks
  async getUserTopTracks(accessToken: string, timeRange = 'medium_term', limit = 20): Promise<SpotifyTrack[]> {
    const url = `https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`
    const data = await this.makeRequest(url, accessToken)
    return data.items
  }

  // Get user's recently played tracks
  async getUserRecentlyPlayed(accessToken: string, limit = 20): Promise<SpotifyTrack[]> {
    const url = `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`
    const data = await this.makeRequest(url, accessToken)
    return data.items.map((item: any) => item.track)
  }

  // Create playlist
  async createPlaylist(userId: string, name: string, description: string, accessToken: string): Promise<any> {
    const url = `https://api.spotify.com/v1/users/${userId}/playlists`
    const body = {
      name,
      description,
      public: false,
    }

    return await this.makeRequest(url, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  // Add tracks to playlist
  async addTracksToPlaylist(playlistId: string, trackUris: string[], accessToken: string): Promise<any> {
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`
    const body = {
      uris: trackUris,
    }

    return await this.makeRequest(url, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  // Get user profile
  async getUserProfile(accessToken: string): Promise<any> {
    const url = 'https://api.spotify.com/v1/me'
    return await this.makeRequest(url, accessToken)
  }

  // Get recommendations
  async getRecommendations(
    accessToken: string,
    seedTracks: string[] = [],
    seedArtists: string[] = [],
    seedGenres: string[] = [],
    limit = 20
  ): Promise<SpotifyTrack[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
    })

    if (seedTracks.length > 0) {
      params.append('seed_tracks', seedTracks.join(','))
    }
    if (seedArtists.length > 0) {
      params.append('seed_artists', seedArtists.join(','))
    }
    if (seedGenres.length > 0) {
      params.append('seed_genres', seedGenres.join(','))
    }

    const url = `https://api.spotify.com/v1/recommendations?${params}`
    const data = await this.makeRequest(url, accessToken)
    return data.tracks
  }
}

// Export singleton instance
export const spotifyAPI = new SpotifyAPI()

// Helper functions
export const formatTrackForApp = (track: SpotifyTrack) => ({
  id: track.id,
  name: track.name,
  artist: track.artists.map(a => a.name).join(', '),
  album: track.album.name,
  image: track.album.images[0]?.url || '',
  duration: Math.round(track.duration_ms / 1000),
  preview_url: track.preview_url,
  spotify_url: track.external_urls.spotify,
})

export const formatPlaylistForApp = (playlist: SpotifyPlaylist) => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  image: playlist.images[0]?.url || '',
  trackCount: playlist.tracks.total,
  owner: playlist.owner.display_name,
})

export default spotifyAPI
