const SUPABASE_URL = 'https://lmgyzbahmeamienakvge.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxtZ3l6YmFobWVhbWllbmFrdmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzE2MzksImV4cCI6MjA5Nzk0NzYzOX0.2CsliNUQnJLrwTUWfBFoRJ6cNFZxdwli1cK2NGNb_hM';

const API = `${SUPABASE_URL}/rest/v1`;

export async function api(method, table, body, query = '') {
  const url = query ? `${API}/${table}?${query}` : `${API}/${table}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST' || method === 'PATCH') {
    headers.Prefer = 'resolution=merge-duplicates';
  }
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`DB ${method} ${table}: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
