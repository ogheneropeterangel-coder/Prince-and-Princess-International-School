
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://etnvfhncxzhbtcswwhud.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bnZmaG5jeHpoYnRjc3d3aHVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTg3NDgsImV4cCI6MjA4NDA3NDc0OH0.b4KRn8XL_mH773Ul7vWY9txZKD8Ll0EXtzG2n1L-HpY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
