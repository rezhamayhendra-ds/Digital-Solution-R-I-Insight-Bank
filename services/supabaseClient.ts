
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mntcguprmspnywmmxjzg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1udGNndXBybXNwbnl3bW14anpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3MTk2MTQsImV4cCI6MjA4NDI5NTYxNH0.unwQloNpZAEyxafDtOZUfX_yRzd4m0DOI0y2nkmScNw';

export const supabase = createClient(supabaseUrl, supabaseKey);