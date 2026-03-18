import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://urwuobqxaamqdmopzcuw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_x8_Ytq1AlAluYoJm3Q_XUQ_C8k3fZ8V'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)