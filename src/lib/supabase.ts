import { createClient } from '@supabase/supabase-js'

// Pegamos as variáveis
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Se as variáveis estiverem faltando (comum no build da Vercel), 
// usamos valores falsos apenas para o build não quebrar.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)