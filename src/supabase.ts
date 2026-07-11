import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSessionToken(): string {
  const key = 'study_timer_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export interface StudySession {
  id: string;
  session_token: string;
  type: 'study' | 'break';
  duration_minutes: number;
  completed: boolean;
  completed_at: string;
  created_at: string;
}

export async function logSession(
  type: 'study' | 'break',
  durationMinutes: number,
  completed: boolean
): Promise<void> {
  const session_token = getSessionToken();
  await supabase.from('study_sessions').insert({
    session_token,
    type,
    duration_minutes: durationMinutes,
    completed,
    completed_at: new Date().toISOString(),
  });
}

export async function fetchSessions(): Promise<StudySession[]> {
  const session_token = getSessionToken();
  const { data } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('session_token', session_token)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data as StudySession[]) ?? [];
}
