import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// 데이터베이스 타입 정의
export interface Comment {
  id: string;
  author: string;
  message: string;
  created_at: string;
  likes: number;
  track_id?: string;
  track_title?: string;
  track_artist?: string;
}

