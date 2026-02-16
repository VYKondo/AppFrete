'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  
  // Estado para armazenar o odômetro da última viagem deste veículo
  const [odometroAnteriorBanco, setOdometroAnteriorBanco] = useState<number | null>(null)
  
  const router = useRouter()

  const [formValues, setFormValues] = useState<any>({
    motorista: '', placa: '', data_frete: '', peso_ton: '', preco_ton: '',
    pedagio: '', mecanica: '', eletrica: '', borracharia: '', solda: '',
    graxa: '', patio: '', limpeza: '', lavagem: '', peca: '',
    caixinha: '', filtro: '', diversos_operacional: '',
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

  // LÓGICA DE BUSCA DO ÚLTIMO ODÔMETRO PELA PLACA
  useEffect(() => {
    const placaLimpa = formValues.placa.replace(/[^a-zA-Z0-9]/g, '')
    if (placaLimpa.length >= 7) {
      async function buscarUltimoRegistro() {
        const { data } = await supabase
          .from('fretes')
          .select('odometro_atual')
          .eq('placa', placaLimpa.toUpperCase())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (data) {
          setOdometroAnteriorBanco(data.odometro_atual)
        } else {
          setOdometroAnteriorBanco(0) // Veículo novo no sistema
        }
      }
      buscarUltimoRegistro()
    } else {
      setOdometroAnteriorBanco(null)
    }
  }, [formValues.placa])

  const parseCurrency = (v: any) => Number(String(v).replace(/\D/g, '')) / 100

  // CÁLCULO DA MÉDIA KML (ELO ENTRE VIAGENS)
  const abastecimentosComMedia = useMemo(() => {
    let lastOdo = odometroAnteriorBanco || 0
    let kmAcum = 0
    let litrosAcum = 0

    return abastecimentos.map((abs) => {
      const v = Number(abs.volume) || 0
      const o = Number(abs.odometro) || 0
      const c = abs.completou
      
      // Se não temos odômetro anterior (veículo novo), a km percorrida é 0 até a próxima parada
      const difKm = (lastOdo > 0) ? (o - lastOdo) : 0
      
      const kmAcumAtual = kmAcum + difKm
      const litrosAcumAtual = litrosAcum + v
      const media = (c && litrosAcumAtual > 0 && kmAcumAtual > 0) ? (kmAcumAtual / litrosAcumAtual) : 0

      // Atualiza referências para a próxima linha do map
      if (c) {
        lastOdo = o; kmAcum = 0; litrosAcum = 0
      } else {
        lastOdo = o; kmAcum = kmAcumAtual; litrosAcum = litrosAcumAtual
      }

      return { ...abs, media_kml: media }
    })
  }, [abastecimentos, odometroAnteriorBanco])

  // CÁLCULO DE DASHBOARD (PARA TODOS OS USERS)
  const stats = useMemo(() => {
    const receita = (Number(formValues.peso_ton) || 0) * parseCurrency(formValues.preco_ton)
    const custoDiesel = abastecimentos.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0)
    const despesasManutencao = ['pedagio', 'mecanica', 'eletrica', 'borracharia', 'solda', 'graxa', 'patio', 'limpeza', 'lavagem', 'peca', 'caixinha', 'filtro', 'diversos_operacional']
      .reduce((acc, campo) => acc + parseCurrency(formValues[campo]), 0)
    
    return { receita, despesas: despesasManutencao + custoDiesel, lucro: receita - (despesasManutencao + custoDiesel) }
  }, [formValues, abastecimentos])

  const handleInputChange = (e: any) => {
    const { name, value } = e.target
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
      const processados = abastecimentosComMedia
      const ultimoRegistro = processados[processados.length - 1]

      const { error } = await supabase.from('fretes').insert([{
        ...formValues,
        peso_ton: Number(formValues.peso_ton),
        preco_ton: parseCurrency(formValues.preco_ton),
        ...Object.fromEntries(Object.entries(formValues).filter(([k]) => k !== 'motorista' && k !== 'placa' && k !== 'data_frete').map(([k, v]) => [k, parseCurrency(v)])),
        abastecimentos_json: processados,
        valor: processados.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0),
        odometro_atual: Number(ultimoRegistro.odometro),
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

        {/* DASHBOARD VISÍVEL PARA TODOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Receita Bruta" value={stats.receita} color="text-white" />
          <StatCard label="Total Despesas" value={stats.despesas} color="text-red-400" />
          <StatCard label="Lucro Estimado" value={stats.lucro} color="text-emerald-400" highlight />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pb-12">
          {/* DADOS DA CARGA */}
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-emerald-400 font-semibold uppercase text-[11px] tracking-widest mb-6 flex items-center gap-2">
              <span>📦 Dados da Carga</span>
              {odometroAnteriorBanco !== null && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 animate-fade-in">
                  {odometroAnteriorBanco > 0 ? `Km Inicial: ${odometroAnteriorBanco}` : 'Veículo Novo'}
                </span>
              )}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FloatingInput name="motorista" value={formValues.motorista} onChange={handleInputChange} placeholder="Motorista" required />
              <div className="relative">
                <FloatingInput name="placa" value={formValues.placa} onChange={handleInputChange} placeholder="Placa" required />
                {odometroAnteriorBanco !== null && odometroAnteriorBanco > 0 && (
                  <span className="absolute right-3 top-6 text-emerald-500 text-xs">✓</span>
                )}
              </div>
              <FloatingInput type="date" name="data_frete" value={formValues.data_frete} onChange={handleInputChange} placeholder="Data" required />
              <FloatingNumberInput name="peso_ton" value={formValues.peso_ton} onChange={handleInputChange} placeholder="Peso Carregado" suffix="Ton" />
              <FloatingCurrencyInput name="preco_ton" value={formValues.preco_ton} onChange={handleInputChange} placeholder="Preço por Tonelada" />
            </div>
          </section>

          {/* MANUTENÇÃO */}
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <h2 className="text-amber-400 font-semibold uppercase text-[11px] tracking-widest mb-6">🛠️ Manutenção e Despesas</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['pedágio', 'mecânica', 'elétrica', 'borracharia', 'solda', 'graxa', 'pátio', 'limpeza', 'lavagem', 'peca', 'caixinha', 'filtro', 'diversos_operacional'].map(campo => (
                <FloatingCurrencyInput key={campo} name={campo} value={formValues[campo]} onChange={handleInputChange} placeholder={campo.replace('_', ' ').toUpperCase()} />
              ))}
            </div>
          </section>

          {/* ABASTECIMENTOS */}
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-blue-400 font-semibold uppercase text-[11px] tracking-widest">⛽ Paradas para Abastecimento</h2>
              <button type="button" onClick={() => setAbastecimentos([...abastecimentos, { volume: '', odometro: '', valor: '', completou: false }])} className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all">+ ADICIONAR PARADA</button>
            </div>
            <div className="space-y-4">
              {abastecimentosComMedia.map((abs, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-slate-800/20 rounded-xl border border-slate-700/30 relative">
                  <FloatingCurrencyInput placeholder="Valor Diesel" value={abs.valor} onChange={(e: any) => handleAbastecimentoChange(index, 'valor', e.target.value)} />
                  <FloatingNumberInput placeholder="Odômetro" value={abs.odometro} onChange={(e: any) => handleAbastecimentoChange(index, 'odometro', e.target.value)} suffix="Km" />
                  
                  <FloatingNumberInput placeholder="Volume (L)" value={abs.volume} onChange={(e: any) => handleAbastecimentoChange(index, 'volume', e.target.value)} suffix="L" />
                  
                  <label className="flex flex-col items-center justify-center bg-slate-800/40 rounded-xl border border-slate-700/50 cursor-pointer">
                    <span className="text-[9px] font-bold text-slate-500 uppercase mb-1">Cheio?</span>
                    <input type="checkbox" checked={abs.completou} onChange={(e) => handleAbastecimentoChange(index, 'completou', e.target.checked)} className="w-5 h-5 accent-emerald-500" />
                  </label>

                  <div className="flex flex-col items-center justify-center bg-slate-900/60 rounded-xl border border-blue-500/20">
                    <span className="text-[9px] font-black text-blue-400 uppercase leading-none mb-1">Média Parada</span>
                    <span className={`text-base font-bold ${abs.media_kml > 0 ? 'text-white' : 'text-slate-600'}`}>
                      {abs.media_kml > 0 ? abs.media_kml.toFixed(2) : '--'}
                    </span>
                  </div>

                  {index > 0 && <button type="button" onClick={() => setAbastecimentos(abastecimentos.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">✕</button>}
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

// COMPONENTES DE INTERFACE
function StatCard({ label, value, color, highlight }: any) {
  return (
    <div className={`bg-slate-900/80 border border-slate-800 p-4 rounded-2xl ${highlight ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : ''}`}>
      <span className="text-[10px] uppercase text-slate-500 font-bold block">{label}</span>
      <p className={`text-xl font-bold ${color}`}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}</p>
    </div>
  )
}

function FloatingInput({ placeholder, highlight, ...props }: any) {
  return (
    <div className="relative group">
      <input {...props} placeholder=" " className={`peer w-full bg-slate-800/40 border border-slate-700/80 text-white px-4 pt-6 pb-2 rounded-xl focus:border-emerald-500 outline-none transition-all ${highlight ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`} />
      <label className="pointer-events-none absolute left-4 top-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all peer-placeholder-shown:top-5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-focus:top-2 peer-focus:text-[10px] peer-focus:text-emerald-400">
        {placeholder}
      </label>
    </div>
  )
}

function FloatingNumberInput({ suffix, ...props }: any) {
  return (
    <div className="relative group">
      <FloatingInput {...props} onInput={(e: any) => e.target.value = e.target.value.replace(/[^0-9.]/g, '')} />
      {suffix && <span className="absolute right-4 top-[62%] -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none group-focus-within:text-emerald-400">{suffix}</span>}
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