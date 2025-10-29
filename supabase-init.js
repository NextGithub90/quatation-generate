// Supabase client initialization
// This file exposes `supabaseClient` globally via window for use in non-module scripts
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://fwmuqztfjjikooimcdks.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXVxenRmamppa29vaW1jZGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDk0NzQsImV4cCI6MjA3NzMyNTQ3NH0.TWt62PnAFYlcuORXOcke-4ESMj4NerCt7DcKMPp-qRM';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// expose globally
window.supabaseClient = supabaseClient;