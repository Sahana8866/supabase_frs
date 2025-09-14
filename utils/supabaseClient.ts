// utils/supabaseClient.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// IMPORTANT: Replace with your actual Supabase URL and Anon Key
// For deployment, these should be environment variables.
const supabaseUrl = https://vdgukrgshfxkglljdguu.supabase.co;
const supabaseAnonKey = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZ3VrcmdzaGZ4a2dsbGpkZ3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NDcxMTksImV4cCI6MjA3MzQyMzExOX0.AwuMlRpntDd62ribD30QJ-FOYeK6LFRpa2h6T2DHnC4;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
