'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const router = useRouter()

  const [formValues, setFormValues] = useState<any>({
    motorista: '',
    placa: '',
    data_frete: '',
    peso_ton: '',
    preco_ton: '',
    pedagio: '',
    mecanica: '',
    eletrica: '',
    borracharia: '',
    solda: '',
    graxa: '',
    
    patio: '',
    limpeza: '',
    lavagem: '',
    peca: '',
    caixinha: '',
    filtro: '',
    diversos_operacional: '',
  })

  const [abastecimentos, setAbastecimentos] = useState([
    { volume: '', odometro: '', valor: '', completou: false }
  ])

  useEffect(() => {
    setHydrated(true)
    async function checkUser() {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setRole(profile?.role || 'user')
    }
    checkUser()
  }, [router])

  const parseCurrency = (v: any) => Number(String(v).replace(/\D/g, '')) / 100

  // Cálculo de Dashboard incluindo os novos campos
  const stats = useMemo(() => {
    const receita = (Number(formValues.peso_ton) || 0) * parseCurrency(formValues.preco_ton)
    const custoDiesel = abastecimentos.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0)
    
    const despesasManutencao = 
      parseCurrency(formValues.pedagio) + parseCurrency(formValues.mecanica) +
      parseCurrency(formValues.eletrica) + parseCurrency(formValues.borracharia) +
      parseCurrency(formValues.solda) + parseCurrency(formValues.graxa) +
      parseCurrency(formValues.diversos_operacional) +
      // ADICIONADOS AO CÁLCULO
      parseCurrency(formValues.patio) + parseCurrency(formValues.limpeza) +
      parseCurrency(formValues.lavagem) + parseCurrency(formValues.peca) +
      parseCurrency(formValues.caixinha) + parseCurrency(formValues.filtro)
    
    return { receita, despesas: despesasManutencao + custoDiesel, lucro: receita - (despesasManutencao + custoDiesel) }
  }, [formValues, abastecimentos])

  const handleInputChange = (e: any) => {
    const { name, value } = e.target
    // Força placa em MAIÚSCULO
    const val = name === 'placa' ? value.toUpperCase() : value
    setFormValues((prev: any) => ({ ...prev, [name]: val }))
  }

  const handleAbastecimentoChange = (index: number, field: string, value: any) => {
    const novos = [...abastecimentos]
    novos[index] = { ...novos[index], [field]: value }
    setAbastecimentos(novos)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: ultimoFrete } = await supabase
        .from('fretes')
        .select('odometro_atual, km_acumulado, litros_acumulados')
        .eq('placa', formValues.placa)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let lastOdo = ultimoFrete?.odometro_atual || 0
      let lastKmAcum = ultimoFrete?.km_acumulado || 0
      let lastLitrosAcum = ultimoFrete?.litros_acumulados || 0

      const processados = abastecimentos.map((abs) => {
        const v = Number(abs.volume), o = Number(abs.odometro), c = abs.completou
        const difKm = o - lastOdo
        const kmAcumAtual = c ? difKm : (Number(lastKmAcum) + difKm)
        const litrosAcumAtual = c ? v : (Number(lastLitrosAcum) + v)
        const media = (c && litrosAcumAtual > 0) ? (kmAcumAtual / litrosAcumAtual) : 0
        lastOdo = o; lastKmAcum = kmAcumAtual; lastLitrosAcum = litrosAcumAtual
        return { 
          volume: v, odometro: o, valor: parseCurrency(abs.valor), 
          completou: c, km_acumulado: kmAcumAtual, 
          litros_acumulados: litrosAcumAtual, media_kml: media 
        }
      })

      const ultimoRegistro = processados[processados.length - 1]

      const { error } = await supabase.from('fretes').insert([{
        ...formValues,
        peso_ton: Number(formValues.peso_ton),
        preco_ton: parseCurrency(formValues.preco_ton),
        pedagio: parseCurrency(formValues.pedagio),
        mecanica: parseCurrency(formValues.mecanica),
        eletrica: parseCurrency(formValues.eletrica),
        borracharia: parseCurrency(formValues.borracharia),
        solda: parseCurrency(formValues.solda),
        graxa: parseCurrency(formValues.graxa),
        diversos_operacional: parseCurrency(formValues.diversos_operacional),
        // SALVANDO NOVOS CAMPOS
        patio: parseCurrency(formValues.patio),
        limpeza: parseCurrency(formValues.limpeza),
        lavagem: parseCurrency(formValues.lavagem),
        peca: parseCurrency(formValues.peca),
        caixinha: parseCurrency(formValues.caixinha),
        filtro: parseCurrency(formValues.filtro),
        
        abastecimentos_json: processados,
        valor: processados.reduce((acc, curr) => acc + curr.valor, 0),
        odometro_atual: ultimoRegistro.odometro,
        km_acumulado: ultimoRegistro.km_acumulado,
        litros_acumulados: ultimoRegistro.litros_acumulados,
        media_kml: ultimoRegistro.media_kml,
        completou: ultimoRegistro.completou
      }])

      if (error) throw error
      alert('Frete registrado com sucesso!')
      window.location.reload()
    } catch (err: any) { alert('Erro: ' + err.message) }
    finally { setLoading(false) }
  }

  if (!hydrated || role === null) return <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center text-emerald-500 animate-pulse font-medium">Iniciando sistema...</div>

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-2xl">🚛</div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Sistema de Fretes</h1>
              <p className="text-slate-400 text-sm">Controle de paradas e acumuladores.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-[10px] font-bold border ${role === 'admin' ? 'border-purple-500/40 text-purple-400' : 'border-slate-700 text-slate-500'}`}>
              {role === 'admin' ? '⚡ ADMIN' : '👤 MOTORISTA'}
            </div>
            {role === 'admin' && <Link href="/fretes" className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all">HISTÓRICO</Link>}
          </div>
        </header>

        {role === 'admin' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">Receita Bruta</span>
              <p className="text-xl font-bold text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.receita)}</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Despesas</span>
              <p className="text-xl font-bold text-red-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.despesas)}</p>
            </div>
            <div className="bg-slate-900/80 border border-emerald-500/30 p-4 rounded-2xl bg-emerald-500/5">
              <span className="text-[10px] uppercase text-emerald-500 font-bold block">Lucro Estimado</span>
              <p className="text-xl font-bold text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.lucro)}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 pb-12">
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-emerald-400 font-semibold uppercase text-[11px] tracking-widest mb-6">📦 Dados da Carga</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FloatingInput name="motorista" value={formValues.motorista} onChange={handleInputChange} placeholder="Motorista" required />
              <FloatingInput name="placa" value={formValues.placa} onChange={handleInputChange} placeholder="Placa" required />
              <FloatingInput type="date" name="data_frete" value={formValues.data_frete} onChange={handleInputChange} placeholder="Data" required />
              <FloatingNumberInput name="peso_ton" value={formValues.peso_ton} onChange={handleInputChange} placeholder="Peso Carregado" suffix="Ton" />
              <FloatingCurrencyInput name="preco_ton" value={formValues.preco_ton} onChange={handleInputChange} placeholder="Preço por Tonelada" />
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-amber-400 font-semibold uppercase text-[11px] tracking-widest mb-6">🛠️ Manutenção e Despesas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['pedagio', 'mecanica', 'eletrica', 'borracharia', 'solda', 'graxa',  'patio', 'limpeza', 'lavagem', 'peca', 'caixinha', 'filtro', 'diversos'].map(campo => (
                <FloatingCurrencyInput key={campo} name={campo} value={formValues[campo]} onChange={handleInputChange} placeholder={campo.replace('_', ' ').toUpperCase()} />
              ))}
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-blue-400 font-semibold uppercase text-[11px] tracking-widest">⛽ Paradas para Abastecimento</h2>
              {abastecimentos.length < 5 && (
                <button type="button" onClick={() => setAbastecimentos([...abastecimentos, { volume: '', odometro: '', valor: '', completou: false }])} className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all">+ ADICIONAR PARADA</button>
              )}
            </div>
            <div className="space-y-4">
              {abastecimentos.map((abs, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-800/20 rounded-xl border border-slate-700/30 relative">
                  <FloatingNumberInput placeholder={`Volume (L) - P${index+1}`} value={abs.volume} onChange={(e: any) => handleAbastecimentoChange(index, 'volume', e.target.value)} suffix="L" />
                  <FloatingNumberInput placeholder="Odômetro (Km)" value={abs.odometro} onChange={(e: any) => handleAbastecimentoChange(index, 'odometro', e.target.value)} suffix="Km" />
                  <FloatingCurrencyInput placeholder="Valor Pago" value={abs.valor} onChange={(e: any) => handleAbastecimentoChange(index, 'valor', e.target.value)} />
                  <label className="flex items-center gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 cursor-pointer">
                    <input type="checkbox" checked={abs.completou} onChange={(e) => handleAbastecimentoChange(index, 'completou', e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                    <span className="text-sm text-slate-300">Encheu o Tanque?</span>
                  </label>
                  {index > 0 && <button type="button" onClick={() => setAbastecimentos(abastecimentos.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 bg-red-500/80 text-white w-5 h-5 rounded-full text-[10px]">✕</button>}
                </div>
              ))}
            </div>
          </section>

          <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-black py-5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 uppercase tracking-widest">
            {loading ? 'Processando Registro...' : 'Finalizar e Salvar Frete'}
          </button>
        </form>
      </div>
    </div>
  )
}

function FloatingInput({ placeholder, highlight, ...props }: any) {
  return (
    <div className="relative group">
      <input 
        {...props} 
        placeholder=" " 
        className={`peer w-full bg-slate-800/40 border border-slate-700/80 text-white px-4 pt-6 pb-2 rounded-xl focus:border-emerald-500 outline-none transition-all ${highlight ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`} 
      />
      <label 
        className="pointer-events-none absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400"
      >
        {placeholder}
      </label>
    </div>
  )
}

function FloatingNumberInput({ suffix, ...props }: any) {
  return (
    <div className="relative flex items-center">
      <FloatingInput {...props} onInput={(e: any) => e.target.value = e.target.value.replace(/[^0-9.]/g, '')} />
      {suffix && <span className="absolute right-4 top-[62%] -translate-y-1/2 text-[10px] font-bold text-slate-500">{suffix}</span>}
    </div>
  )
}

function FloatingCurrencyInput({ ...props }: any) {
  const format = (v: string) => {
    const num = v.replace(/\D/g, ''); if (!num) return ''
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(num) / 100)
  }
  return <FloatingInput {...props} onInput={(e: any) => { e.target.value = format(e.target.value) }} />
}

