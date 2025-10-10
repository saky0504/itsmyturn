// Key-Value Store for Supabase Edge Functions
// This module provides a simple key-value storage interface

interface KVStore {
  get(key: string): Promise<any>
  set(key: string, value: any, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
}

class MemoryKVStore implements KVStore {
  private store: Map<string, { value: any; expires?: number }> = new Map()

  async get(key: string): Promise<any> {
    const item = this.store.get(key)
    
    if (!item) {
      return null
    }

    // Check if item has expired
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key)
      return null
    }

    return item.value
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = ttl ? Date.now() + (ttl * 1000) : undefined
    this.store.set(key, { value, expires })
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    const item = this.store.get(key)
    return item !== undefined && (!item.expires || Date.now() <= item.expires)
  }

  // Utility methods
  async clear(): Promise<void> {
    this.store.clear()
  }

  async size(): Promise<number> {
    return this.store.size
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys())
  }
}

// Global KV store instance
export const kvStore = new MemoryKVStore()

// Helper functions for common use cases
export const cacheSpotifyToken = async (token: string, expiresIn: number) => {
  await kvStore.set('spotify_token', token, expiresIn - 60) // 60 second buffer
}

export const getSpotifyToken = async (): Promise<string | null> => {
  return await kvStore.get('spotify_token')
}

export const cacheUserSession = async (userId: string, sessionData: any, ttl = 3600) => {
  await kvStore.set(`user_session_${userId}`, sessionData, ttl)
}

export const getUserSession = async (userId: string): Promise<any> => {
  return await kvStore.get(`user_session_${userId}`)
}

export const cacheSearchResults = async (query: string, results: any[], ttl = 1800) => {
  const key = `search_${encodeURIComponent(query)}`
  await kvStore.set(key, results, ttl)
}

export const getCachedSearchResults = async (query: string): Promise<any[]> => {
  const key = `search_${encodeURIComponent(query)}`
  return await kvStore.get(key) || []
}

export const cacheTrackInfo = async (trackId: string, trackData: any, ttl = 86400) => {
  const key = `track_${trackId}`
  await kvStore.set(key, trackData, ttl)
}

export const getCachedTrackInfo = async (trackId: string): Promise<any> => {
  const key = `track_${trackId}`
  return await kvStore.get(key)
}

// Rate limiting helpers
export const checkRateLimit = async (identifier: string, limit = 100, window = 3600): Promise<boolean> => {
  const key = `rate_limit_${identifier}`
  const current = await kvStore.get(key) || 0
  
  if (current >= limit) {
    return false
  }
  
  await kvStore.set(key, current + 1, window)
  return true
}

export default kvStore
