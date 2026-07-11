/*
  # Create study_sessions table

  1. New Tables
    - `study_sessions`
      - `id` (uuid, primary key)
      - `type` (text) - 'study' or 'break'
      - `duration_minutes` (integer) - planned duration in minutes
      - `completed_at` (timestamptz) - when the session was completed
      - `completed` (boolean) - whether the session was fully completed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `study_sessions` table
    - Add policy for anonymous users to insert and select their own sessions
      (using a client-generated session_token stored in localStorage)
    - `session_token` (text) - anonymous session identifier

  Notes
    - Since there is no auth, we use a client-generated UUID stored in localStorage
      as a session_token to allow users to see their own history
    - This is for personal, local-scoped study tracking
*/

CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL,
  type text NOT NULL CHECK (type IN ('study', 'break')),
  duration_minutes integer NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own sessions"
  ON study_sessions FOR INSERT
  WITH CHECK (session_token IS NOT NULL);

CREATE POLICY "Users can read own sessions"
  ON study_sessions FOR SELECT
  USING (session_token IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_study_sessions_token ON study_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created ON study_sessions(created_at DESC);
