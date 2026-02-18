'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, Mail, Key, Truck } from 'lucide-react'
import Swal from 'sweetalert2'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toast = (title: string, icon: 'success' | 'error' | 'info') => {
    Swal.fire({
      title,
      icon,
      timer: 3000,
      showConfirmButton: false,
      background: '#1e293b',
      color: '#fff',
      toast: true,
      position: 'top-end',
      timerProgressBar: true,
    })
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (!email || password.length < 6) {
      toast('Preencha os campos corretamente.', 'info')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      toast("Erro ao entrar: " + error.message, 'error')
    } else if (data.user) {
      router.push('/')
    }

    setLoading(false)
  }

  async function handleSignup() {
    if (!email || password.length < 6 || !accessKey) {
      Swal.fire({
        title: 'Atenção',
        text: 'Preencha todos os campos corretamente.',
        icon: 'info',
        confirmButtonColor: '#10b981',
        background: '#1e293b',
        color: '#fff'
      })
      return
    }

    if (accessKey !== process.env.NEXT_PUBLIC_ACCESS_KEY) {
      toast('Chave de acesso inválida!', 'error')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      toast(error.message, 'error')
      setLoading(false)
      return
    }

    if (data.user) {
      toast('Conta criada com sucesso!', 'success')
      router.push('/')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f1a] p-4 text-white font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-8">

        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 text-emerald-500 mb-2 shadow-inner">
            <Truck size={40} />
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            NSA Logística
          </h1>
          <p className="text-slate-400 text-sm">Gestão logística inteligente</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
              E-mail
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-100 pl-12 pr-4 py-4 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
              Senha
            </label>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
              
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-100 pl-12 pr-12 py-4 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-600"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Indicador de força mínima */}
            <div className="mt-2 px-1">
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-1 transition-all duration-500 ${
                      password.length === 0
                        ? 'w-0'
                        : password.length < 6
                        ? 'w-1/2 bg-red-500'
                        : 'w-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    }`}
                  />
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    password.length === 0
                      ? 'text-slate-600'
                      : password.length < 6
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {password.length === 0
                    ? 'Mínimo 6 caracteres'
                    : password.length < 6
                    ? 'Senha muito curta'
                    : 'Senha válida'}
                </span>
              </div>
            </div>
          </div>


          {/* Chave de Acesso */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
              Chave de Acesso
            </label>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={20} />
              <input
                type="text"
                placeholder="Chave fornecida pela empresa"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 text-slate-100 pl-12 pr-4 py-4 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="pt-6 space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'ENTRAR NO SISTEMA'}
            </button>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading}
              className="w-full bg-transparent border border-slate-800 hover:bg-slate-800/50 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest py-3 rounded-2xl transition-all"
            >
              Criar nova conta
            </button>
          </div>
        </form>

        <p className="text-center text-slate-600 text-[10px] uppercase tracking-[0.3em]">
          Ambiente Seguro • NSA Logística
        </p>
      </div>
    </div>
  )
}
