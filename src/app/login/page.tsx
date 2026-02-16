'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert("Erro ao entrar: " + error.message)
    } else if (data.user) {
      router.push('/')
    }

    setLoading(false)
  }

  async function handleSignup() {
    if (!email || !password) {
      alert("Preencha email e senha para criar conta.")
      return
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Conta criada! Verifique seu email e faça login.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f1a] p-4 text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-8">
        
        {/* Branding/Título */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500 text-3xl mb-2">
            🚚
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bem-vindo</h1>
          <p className="text-slate-400 text-sm">Acesse o sistema de gestão de fretes</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 text-slate-100 px-4 py-3 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
              required
            />
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'ENTRAR NO SISTEMA'}
            </button>

            <button
              type="button"
              onClick={handleSignup}
              className="w-full bg-transparent border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium py-3 rounded-xl transition-all"
            >
              Criar nova conta
            </button>
          </div>
        </form>

        <p className="text-center text-slate-500 text-xs">
          Acesso restrito a pessoal autorizado.
        </p>
      </div>
    </div>
  )
}