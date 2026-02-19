'use client'
export const dynamic = 'force-dynamic'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useMemo, ChangeEvent, FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Save, Truck, Fuel, Package, Trash2, CheckCircle2, Plus, Wrench } from 'lucide-react'

interface FreteData {
  motorista: string;
  placa: string;
  data_frete: string;
  peso_ton: number | string;
  preco_ton: number | string;
  odometro_atual: number;
  [key: string]: any;
}

export default function EditFretePage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id

  const [formValues, setFormValues] = useState<FreteData | null>(null)
  const [abastecimentos, setAbastecimentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [odometroAnterior, setOdometroAnterior] = useState(0)

  const camposOperacionais = [
    'pedagio', 'mecanica', 'eletrica', 'borracharia', 'solda', 'graxa', 
    'patio', 'limpeza', 'lavagem', 'peca', 'caixinha', 'cartao', 'diversos_operacional'
  ]

  // --- Funções de Formatação ---
  const formatCurrency = (value: any) => {
    const num = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, '')) / 100
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num || 0)
  }

  // Ajustado para aceitar uma flag de peso (3 casas)
  const formatDecimal = (value: any, isWeight = false) => {
    const divisor = isWeight ? 1000 : 100
    const num = typeof value === 'number' ? value : Number(String(value).replace(/\D/g, '')) / divisor
    return new Intl.NumberFormat('pt-BR', { 
      minimumFractionDigits: isWeight ? 3 : 2, 
      maximumFractionDigits: isWeight ? 3 : 2 
    }).format(num || 0)
  }

  const parseCurrency = (v: any) => {
    if (typeof v === 'number') return v
    const cleanValue = String(v).replace(/[^\d]/g, '')
    return cleanValue ? Number(cleanValue) / 100 : 0
  }

  const parseNumero = (v: any) => parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0

  useEffect(() => {
    async function fetchFrete() {
      if (!id) return
      const { data, error } = await supabase.from('fretes').select('*').eq('id', id).single()
      if (error) { router.push('/fretes'); return }
      
      const initialValues = { ...data }
      camposOperacionais.forEach(campo => { initialValues[campo] = data[campo] || 0 })
      
      setFormValues(initialValues)
      setAbastecimentos(data.abastecimentos_json || [])

      const { data: anterior } = await supabase
        .from('fretes').select('odometro_atual').eq('placa', data.placa)
        .lt('created_at', data.created_at).order('created_at', { ascending: false })
        .limit(1).maybeSingle()
      
      setOdometroAnterior(anterior?.odometro_atual || 0)
      setLoading(false)
    }
    fetchFrete()
  }, [id, router])

  const abastecimentosComMedia = useMemo(() => {
    let lastOdo = odometroAnterior
    let kmAcum = 0
    let litrosAcum = 0

    return abastecimentos.map((abs) => {
      const vol = parseNumero(abs.volume)
      const odo = Number(abs.odometro) || 0
      const comp = abs.completou
      const difKm = odo - lastOdo
      const kmAcumAtual = comp ? difKm : (kmAcum + difKm)
      const litrosAcumAtual = comp ? vol : (litrosAcum + vol)
      const media = (comp && litrosAcumAtual > 0) ? (kmAcumAtual / litrosAcumAtual) : 0
      lastOdo = odo; kmAcum = kmAcumAtual; litrosAcum = litrosAcumAtual
      return { ...abs, media_kml: media }
    })
  }, [abastecimentos, odometroAnterior])

  const stats = useMemo(() => {
    if (!formValues) return { despesas: 0, lucro: 0 }
    const receita = (parseNumero(formValues.peso_ton)) * parseCurrency(formValues.preco_ton)
    const custoDiesel = abastecimentos.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0)
    const outrosCustos = camposOperacionais.reduce((acc, campo) => acc + parseCurrency(formValues[campo]), 0)
    return { despesas: custoDiesel + outrosCustos, lucro: receita - (custoDiesel + outrosCustos) }
  }, [formValues, abastecimentos])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!formValues) return
    setSaving(true)
    
    const paradasProntas = abastecimentosComMedia.map(abs => ({
      volume: parseNumero(abs.volume),
      odometro: Number(abs.odometro) || 0,
      valor: parseCurrency(abs.valor),
      completou: !!abs.completou,
      media_kml: abs.media_kml || 0
    }))

    const ultimo = paradasProntas[paradasProntas.length - 1] || {}
    const dataToSave: any = {
      ...formValues,
      // O parseNumero já lida com a string formatada independente das casas
      peso_ton: parseNumero(formValues.peso_ton),
      preco_ton: parseCurrency(formValues.preco_ton),
      abastecimentos_json: paradasProntas,
      valor: stats.despesas,
      odometro_atual: ultimo.odometro || formValues.odometro_atual,
      media_kml: ultimo.media_kml || 0,
    }

    camposOperacionais.forEach(campo => { dataToSave[campo] = parseCurrency(formValues[campo]) })
    
    const { error } = await supabase.from('fretes').update(dataToSave).eq('id', id)
    if (!error) router.push('/fretes')
    else { setSaving(false); alert(error.message) }
  }

  if (loading || !formValues) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-black animate-pulse">CARREGANDO...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl"><Truck size={24} className="text-white" /></div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Editar Operação</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ajuste os dados do frete</p>
            </div>
          </div>
          <button type="button" onClick={() => router.back()} className="bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all flex items-center gap-2 text-slate-300">
            <ArrowLeft size={14}/> VOLTAR
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="bg-blue-700 px-6 py-3 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase flex items-center gap-2"><Package size={18} /> Dados da Viagem</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <BigInput label="Motorista" value={formValues.motorista} onChange={(e: any) => setFormValues({...formValues, motorista: e.target.value})} placeholder="NOME DO MOTORISTA" required />
              <BigInput label="Placa" value={formValues.placa} onChange={(e: any) => setFormValues({...formValues, placa: e.target.value.toUpperCase()})} placeholder="AAA-0000" required />
              <BigInput label="Data" type="date" value={formValues.data_frete} onChange={(e: any) => setFormValues({...formValues, data_frete: e.target.value})} required />
              
              <div className="grid grid-cols-2 gap-4">
                {/* Aqui passamos explicitamente name="peso_ton" para o componente saber formatar 3 casas */}
                <BigInput label="Peso (Ton)" name="peso_ton" value={formatDecimal(formValues.peso_ton, true)} onChange={(e: any) => setFormValues({...formValues, peso_ton: e.target.value})} isDecimal />
                <BigInput label="Valor/Ton" value={formatCurrency(formValues.preco_ton)} onChange={(e: any) => setFormValues({...formValues, preco_ton: e.target.value})} isCurrency />
              </div>
            </div>
          </section>

          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="bg-emerald-700 px-6 py-3 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase flex items-center gap-2"><Fuel size={18} /> Abastecimento</h2>
              <button type="button" onClick={() => setAbastecimentos([...abastecimentos, { volume: '', odometro: '', valor: 0, completou: false }])} className="bg-white text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1"><Plus size={14} /> ADICIONAR</button>
            </div>
            <div className="p-4 space-y-4">
              {abastecimentosComMedia.map((abs, index) => (
                <div key={index} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 relative space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <BigInput label="Valor Pago" value={formatCurrency(abs.valor)} onChange={(e: any) => {
                       const n = [...abastecimentos]; n[index].valor = e.target.value; setAbastecimentos(n);
                    }} isCurrency />
                    <BigInput label="KM no Painel" value={abs.odometro} onChange={(e: any) => {
                       const n = [...abastecimentos]; n[index].odometro = e.target.value; setAbastecimentos(n);
                    }} placeholder="0" />
                    <BigInput label="Litros" value={formatDecimal(abs.volume)} onChange={(e: any) => {
                       const n = [...abastecimentos]; n[index].volume = e.target.value; setAbastecimentos(n);
                    }} isDecimal />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={abs.completou} onChange={(e: any) => {
                        const n = [...abastecimentos]; n[index].completou = e.target.checked; setAbastecimentos(n);
                      }} className="w-7 h-7 rounded-lg accent-emerald-500" />
                      <span className="text-xs font-black uppercase text-slate-300 group-hover:text-white">Encheu o Tanque?</span>
                    </label>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Média deste trecho</p>
                       <p className={`text-2xl font-black ${abs.media_kml > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{abs.media_kml > 0 ? abs.media_kml.toFixed(2) : '--'} <span className="text-xs">km/l</span></p>
                    </div>
                  </div>
                  {index > 0 && (
                    <button type="button" onClick={() => setAbastecimentos(abastecimentos.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 bg-red-600 p-1.5 rounded-full shadow-lg border-2 border-slate-900 text-white"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl p-6">
              <h2 className="text-xs font-black uppercase text-slate-500 mb-6 flex items-center gap-2"><Wrench size={16} /> Manutenção e Extras</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {camposOperacionais.map(campo => (
                <div key={campo}>
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-tighter">{campo.replace('_', ' ')}</label>
                    <input
                     type="text"
                     value={formatCurrency(formValues[campo])}
                     onChange={(e: any) => setFormValues({...formValues, [campo]: e.target.value})}
                     className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-white outline-none focus:ring-2 ring-emerald-500/20"
                   />
                </div>
              ))}
              </div>
          </section>

          <div className="pt-6">
            <div className="bg-slate-900 p-4 rounded-3xl border-2 border-emerald-500 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 w-full md:w-auto justify-around md:justify-start text-white">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase">Gasto Acumulado</p>
                  <p className="text-lg font-black text-red-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.despesas)}</p>
                </div>
                <div className="h-10 w-[1px] bg-slate-800 hidden md:block" />
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Saldo da Viagem</p>
                  <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.lucro)}</p>
                </div>
              </div>
              <button type="submit" disabled={saving} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
                {saving ? <div className="h-5 w-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={20}/> ATUALIZAR DADOS</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function BigInput({ label, badge, isCurrency, isDecimal, onChange, name, ...props }: any) {
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isCurrency || isDecimal) {
      const val = e.target.value.replace(/\D/g, '');
      
      // Lógica de 3 casas para o campo peso_ton
      const isWeight = name === 'peso_ton';
      const divisor = isWeight ? 1000 : 100;
      const num = Number(val) / divisor;
      
      const formatted = isCurrency 
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
        : new Intl.NumberFormat('pt-BR', { 
            minimumFractionDigits: isWeight ? 3 : 2, 
            maximumFractionDigits: isWeight ? 3 : 2 
          }).format(num);
      
      e.target.value = formatted;
    }
    if (onChange) onChange(e);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
        {badge}
      </div>
      <input 
        {...props}
        name={name}
        onChange={handleInputChange}
        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-white font-bold outline-none focus:ring-2 ring-blue-500/50 transition-all placeholder:text-slate-600"
      />
    </div>
  )
}