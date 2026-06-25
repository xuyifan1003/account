const SUPABASE_URL = 'https://lmgyzbahmeamienakvge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3l6YmFobWVhbWllbmFrdmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzE2MzksImV4cCI6MjA5Nzk0NzYzOX0.2CsliNUQnJLrwTUWfBFoRJ6cNFZxdwli1cK2NGNb_hM';

let _db = null;

export async function getDb() {
  if (_db) return _db;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  _db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _db;
}
