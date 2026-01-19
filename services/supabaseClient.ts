
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mntcguprmspnywmmxjzg.supabase.co';
const supabaseKey = 'sb_publishable_QrWznkQOQKuub15OZnLvMA_uof8QS7W';

export const supabase = createClient(supabaseUrl, supabaseKey);
