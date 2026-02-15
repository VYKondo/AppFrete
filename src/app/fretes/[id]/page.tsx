'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Truck, Navigation, CheckCircle2, Circle, Fuel, Plus, Trash2, Wrench } from 'lucide-react'

export default function EditFretePage() {
  const router = useRouter()
  const params = useParams()
  const { id } = params

  const [formValues, setFormValues] = useState<any>(null)
  const [abastecimentos, setAbastecimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [odometroAnterior, setOdometroAnterior] = useState(0)

  const parseCurrency = (v: any) => {
    if (typeof v === 'number') return v
    const cleanValue = String(v).replace(/\D/g, '')
    return cleanValue ? Number(cleanValue) / 100 : 0
  }

  // 1. Carregar dados iniciais
  useEffect(() => {
    async function fetchFrete() {
      if (!id) return
      const { data, error } = await supabase.from('fretes').select('*').eq('id', id).single()
      if (error) { router.push('/fretes'); return }
      
      setFormValues(data)
      setAbastecimentos(data.abastecimentos_json || [])

      const { data: anterior } = await supabase
        .from('fretes')
        .select('odometro_atual')
        .eq('placa', data.placa)
        .lt('created_at', data.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      setOdometroAnterior(anterior?.odometro_atual || 0)
      setLoading(false)
    }
    fetchFrete()
  }, [id, router])

  // 2. RECALCULO AUTOMÁTICO
  const abastecimentosProcessados = useMemo(() => {
    let lastOdo = odometroAnterior
    let kmAcum = 0
    let litrosAcum = 0

    return abastecimentos.map((abs) => {
      const vol = Number(abs.volume) || 0
      const odo = Number(abs.odometro) || 0
      const comp = abs.completou

      const difKm = odo - lastOdo
      const kmAcumAtual = comp ? difKm : (kmAcum + difKm)
      const litrosAcumAtual = comp ? vol : (litrosAcum + vol)
      const media = (comp && litrosAcumAtual > 0) ? (kmAcumAtual / litrosAcumAtual) : 0

      lastOdo = odo
      kmAcum = kmAcumAtual
      litrosAcum = litrosAcumAtual

      return {
        ...abs,
        valor: parseCurrency(abs.valor),
        km_acumulado: kmAcumAtual,
        litros_acumulados: litrosAcumAtual,
        media_kml: media
      }
    })
  }, [abastecimentos, odometroAnterior])

  const receitaCalculada = useMemo(() => {
    if (!formValues) return 0
    return (Number(formValues.peso_ton) || 0) * (Number(formValues.preco_ton) || 0)
  }, [formValues])

  // 3. Salvar Alterações
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    
    const ultimo = abastecimentosProcessados[abastecimentosProcessados.length - 1] || {}
    const custoTotalDiesel = abastecimentosProcessados.reduce((acc, curr) => acc + curr.valor, 0)

    const { id: _, created_at: __, ...oldData } = formValues
    
    const dataToSave = {
      ...oldData,
      // Garantindo que todos os campos numéricos sejam tratados
      peso_ton: Number(formValues.peso_ton),
      preco_ton: parseCurrency(formValues.preco_ton),
      pedagio: parseCurrency(formValues.pedagio),
      mecanica: parseCurrency(formValues.mecanica),
      eletrica: parseCurrency(formValues.eletrica),
      borracharia: parseCurrency(formValues.borracharia),
      solda: parseCurrency(formValues.solda),
      graxa: parseCurrency(formValues.graxa),
      diversos_operacional: parseCurrency(formValues.diversos_operacional),
      patio: parseCurrency(formValues.patio),
      limpeza: parseCurrency(formValues.limpeza),
      lavagem: parseCurrency(formValues.lavagem),
      peca: parseCurrency(formValues.peca),
      caixinha: parseCurrency(formValues.caixinha),
      filtro: parseCurrency(formValues.filtro),
      
      abastecimentos_json: abastecimentosProcessados,
      valor: custoTotalDiesel,
      odometro_atual: ultimo.odometro || formValues.odometro_atual,
      media_kml: ultimo.media_kml || 0,
      km_acumulado: ultimo.km_acumulado || 0,
      litros_acumulados: ultimo.litros_acumulados || 0
    }

    const { error } = await supabase.from('fretes').update(dataToSave).eq('id', id)

    if (!error) router.push('/fretes')
    else { setSaving(false); alert("Erro ao salvar mudanças") }
  }

  const handleChange = (name: string, value: any) => {
    const val = name === 'placa' ? value.toUpperCase() : value
    setFormValues((prev: any) => ({ ...prev, [name]: val }))
  }

  const handleAbsChange = (index: number, field: string, value: any) => {
    const novos = [...abastecimentos]
    novos[index] = { ...novos[index], [field]: value }
    setAbastecimentos(novos)
  }

  if (loading) return <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center text-emerald-500 animate-pulse font-medium">Carregando dados...</div>

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white transition-colors text-sm mb-2">
              <ArrowLeft size={16} className="mr-1" /> Voltar
            </button>
            <h1 className="text-3xl font-bold text-white tracking-tight">Editar Frete</h1>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl text-right">
             <span className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold block">Faturamento</span>
             <p className="text-xl font-black text-white">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(receitaCalculada)}</p>
          </div>
        </header>
    
        <form onSubmit={handleSubmit} className="space-y-6 pb-20">
          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6 text-emerald-400"><Truck size={20} /><h2 className="font-semibold uppercase text-xs tracking-wider">Identificação</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FloatingInput name="motorista" value={formValues.motorista} onChange={(e: any) => handleChange('motorista', e.target.value)} placeholder="Motorista" required />
              <FloatingInput name="placa" value={formValues.placa} onChange={(e: any) => handleChange('placa', e.target.value)} placeholder="Placa" required />
              <FloatingInput type="date" name="data_frete" value={formValues.data_frete} onChange={(e: any) => handleChange('data_frete', e.target.value)} placeholder="Data" required />
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-6 text-blue-400"><Navigation size={20} /><h2 className="font-semibold uppercase text-xs tracking-wider">Carga</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatingNumberInput name="peso_ton" value={formValues.peso_ton} onChange={(e: any) => handleChange('peso_ton', e.target.value)} placeholder="Peso" suffix="Ton" />
              <FloatingCurrencyInput name="preco_ton" value={formValues.preco_ton} onChange={(e: any) => handleChange('preco_ton', e.target.value)} placeholder="Preço/Ton" />
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-blue-400"><Fuel size={20} /><h2 className="font-semibold uppercase text-xs tracking-wider">Abastecimentos</h2></div>
              {abastecimentos.length < 5 && (
                <button type="button" onClick={() => setAbastecimentos([...abastecimentos, { volume: '', odometro: '', valor: '', completou: false }])} className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-lg border border-blue-500/30 hover:bg-blue-500 hover:text-white transition-all">+ ADICIONAR PARADA</button>
              )}
            </div>
            <div className="space-y-4">
              {abastecimentosProcessados.map((abs, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-slate-800/20 rounded-xl border border-slate-700/30 relative">
                  <FloatingNumberInput placeholder={`Volume (L) - P${index+1}`} value={abs.volume} onChange={(e: any) => handleAbsChange(index, 'volume', e.target.value)} suffix="L" />
                  <FloatingNumberInput placeholder="Odômetro" value={abs.odometro} onChange={(e: any) => handleAbsChange(index, 'odometro', e.target.value)} suffix="Km" />
                  <FloatingCurrencyInput placeholder="Valor Diesel" value={abs.valor} onChange={(e: any) => handleAbsChange(index, 'valor', e.target.value)} />
                  <button type="button" onClick={() => handleAbsChange(index, 'completou', !abs.completou)} className={`flex flex-col items-center justify-center rounded-xl border transition-all ${abs.completou ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-800/40 border-slate-700 text-slate-600'}`}>
                    <span className="text-[9px] font-bold uppercase mb-1">Cheio?</span>
                    {abs.completou ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </button>
                  <div className="flex flex-col justify-center items-center bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Média</span>
                    <span className={`text-sm font-black ${abs.media_kml > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {abs.media_kml > 0 ? abs.media_kml.toFixed(2) : '---'}
                    </span>
                  </div>
                  {index > 0 && <button type="button" onClick={() => setAbastecimentos(abastecimentos.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-400 transition-colors"><Trash2 size={12} /></button>}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 mb-6 text-amber-400"><Wrench size={20} /><h2 className="font-semibold uppercase text-xs tracking-wider">Custos Operacionais</h2></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['pedagio', 'mecanica', 'eletrica', 'borracharia', 'solda', 'graxa', 'diversos_operacional', 'patio', 'limpeza', 'lavagem', 'peca', 'caixinha', 'filtro'].map((campo) => (
                <FloatingCurrencyInput 
                  key={campo} 
                  name={campo} 
                  value={formValues[campo]} 
                  onChange={(e: any) => handleChange(campo, e.target.value)} 
                  placeholder={campo.replace('_', ' ').toUpperCase()} 
                />
              ))}
            </div>
          </section>
          
          <div className="fixed bottom-8 right-8 left-8 md:relative md:bottom-0 md:right-0 md:left-0">
            <button type="submit" disabled={saving} className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-3 tracking-widest uppercase shadow-2xl shadow-emerald-900/40 transition-all active:scale-95">
              {saving ? 'PROCESSANDO...' : <><Save size={20} /> Salvar Alterações</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// COMPONENTES AUXILIARES
function FloatingInput({ placeholder, highlight, ...props }: any) {
  return (
    <div className="relative group">
      <input 
        {...props} 
        placeholder=" " 
        className={`peer w-full bg-slate-800/40 border border-slate-700/80 text-white px-4 pt-6 pb-2 rounded-xl focus:border-emerald-500 outline-none transition-all ${highlight ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`} 
      />
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

function FloatingCurrencyInput({ value, ...props }: any) {
  const format = (v: any) => {
    const num = String(v).replace(/\D/g, ''); 
    if (!num) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(num) / 100)
  }
  return <FloatingInput {...props} value={format(value)} onInput={(e: any) => { const raw = e.target.value.replace(/\D/g, ''); e.target.value = raw ? format(raw) : '' }} />
}