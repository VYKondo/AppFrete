'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Swal from 'sweetalert2'
import {
  Truck, Fuel, Package,
  CheckCircle2, Trash2, Plus, Save, History
} from 'lucide-react'

function BigInput({
  label, value, onChange, name,
  type = "text",
  isCurrency = false,
  placeholder = "",
  required = false,
  badge = null
}: any) {

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCurrency) {
      const val = e.target.value.replace(/\D/g, '')
      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(Number(val) / 100)

      onChange({ target: { name, value: formatted } })
    } else {
      onChange(e)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-black uppercase text-slate-400 tracking-tight">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {badge}
      </div>
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className="bg-slate-800 border-2 border-slate-700 text-white font-bold px-4 py-4 rounded-2xl outline-none focus:border-emerald-500 transition-all text-base placeholder:text-slate-600 uppercase w-full"
      />
    </div>
  )
}

export default function Home() {

  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<string | 'loading'>('loading')
  const [userName, setUserName] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [odometroAnteriorBanco, setOdometroAnteriorBanco] = useState<number | null>(null)

  const [formValues, setFormValues] = useState<any>({
    motorista: '',
    placa: '',
    data_frete: new Date().toISOString().split('T')[0],
    peso_ton: '',
    preco_ton: '',
    frete_de: '',
    para: '',
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

  const handleInputChange = useCallback((e: any) => {
    const { name, value } = e.target
    setFormValues((prev: any) => ({
      ...prev,
      [name]: name === 'placa'
        ? value.replace(/[^A-Z0-9]/gi, '').toUpperCase()
        : value
    }))
  }, [])

  const handleAbastecimentoChange = (index: number, field: string, value: any) => {
    const novos = [...abastecimentos]
    novos[index] = { ...novos[index], [field]: value }
    setAbastecimentos(novos)
  }

  // 🔎 BUSCA ODÔMETRO
  useEffect(() => {
    const placaLimpa = formValues.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase()

    if (!placaLimpa) {
      setOdometroAnteriorBanco(null)
      return
    }

    async function buscarUltimo() {
      const { data } = await supabase
        .from('fretes')
        .select('odometro_atual')
        .eq('placa', placaLimpa)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setOdometroAnteriorBanco(data ? Number(data.odometro_atual) : 0)
    }

    buscarUltimo()
  }, [formValues.placa])

  // 🔐 USER
  useEffect(() => {
    setHydrated(true)

    async function checkUser() {
      const { data, error } = await supabase.auth.getUser()

      if (error || !data.user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      setRole(profile?.role || 'user')
      setUserName(profile?.full_name || data.user.email?.split('@')[0] || '')
    }

    checkUser()
  }, [router])

  const parseCurrency = (v: any) =>
    Number(String(v || '0').replace(/\D/g, '')) / 100

  const parseNumero = (v: any) =>
    parseFloat(String(v || '0')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '')
    ) || 0

  // 📊 MÉDIA KML
  const abastecimentosComMedia = useMemo(() => {
    let odoAnterior = odometroAnteriorBanco ?? 0

    return abastecimentos.map((abs) => {
      const odoAtual = parseNumero(abs.odometro)
      const volume = parseNumero(abs.volume)
      let media = 0

      if (odoAtual > 0) {
        const kmTrecho = odoAtual - odoAnterior
        if (abs.completou && volume > 0) {
          media = kmTrecho / volume
        }
        odoAnterior = odoAtual
      }

      return { ...abs, media_kml: media }
    })
  }, [abastecimentos, odometroAnteriorBanco])

  const stats = useMemo(() => {
    const receita =
      parseNumero(formValues.peso_ton) *
      parseCurrency(formValues.preco_ton)

    const diesel =
      abastecimentos.reduce(
        (acc, curr) => acc + parseCurrency(curr.valor), 0)

    const campos = [
      'pedagio', 'mecanica', 'eletrica', 'borracharia',
      'solda', 'graxa', 'patio', 'limpeza',
      'lavagem', 'peca', 'caixinha', 'filtro',
      'diversos_operacional'
    ]

    const despesas =
      campos.reduce(
        (acc, campo) => acc + parseCurrency(formValues[campo]), 0)

    return {
      receita,
      despesas: despesas + diesel,
      lucro: receita - (despesas + diesel)
    }
  }, [formValues, abastecimentos])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formValues.placa || !formValues.motorista) {
      return Swal.fire('Atenção', 'Preencha placa e motorista', 'warning')
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      // --- TRATAMENTO DOS CAMPOS NUMÉRICOS ---
      // Criamos uma cópia para não sujar o estado visual do form
      const operacionaisTratados: any = {}
      const camposFinanceiros = [
        'pedagio', 'mecanica', 'eletrica', 'borracharia', 'solda', 
        'graxa', 'patio', 'limpeza', 'lavagem', 'peca', 
        'caixinha', 'filtro', 'diversos_operacional'
      ]

      camposFinanceiros.forEach(campo => {
        // Se estiver vazio ou for apenas máscara, vira 0, senão converte
        operacionaisTratados[campo] = parseCurrency(formValues[campo]) || 0
      })

      const processados = abastecimentosComMedia
      const ultimoOdo = parseNumero(processados[processados.length - 1]?.odometro)

      const payload = {
        ...formValues,
        ...operacionaisTratados, // Sobrescreve as strings vazias por números (0)
        placa: formValues.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
        user_email: user.email,
        peso_ton: parseNumero(formValues.peso_ton) || 0,
        preco_ton: parseCurrency(formValues.preco_ton) || 0,
        abastecimentos_json: processados,
        valor: stats.despesas, // Envia o total calculado
        odometro_atual: ultimoOdo,
        media_kml: [...processados].reverse().find(a => a.media_kml > 0)?.media_kml || 0
      }

      const { error } = await supabase.from('fretes').insert([payload])

      if (error) throw error

    // ... resto do seu código (Swal e reload)

      await Swal.fire({
        title: 'Sucesso!',
        text: 'Operação salva.',
        icon: 'success',
        background: '#0f172a',
        color: '#fff'
      })

      window.location.reload()

    } catch (err: any) {
      Swal.fire('Erro', err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!hydrated || role === 'loading')
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">
      CARREGANDO...
    </div>
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 rounded-xl">
              <Truck size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Novo Frete</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {userName}
                </p>
                <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter border ${
                  role === 'admin' 
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                    : 'bg-slate-700/30 text-slate-500 border-slate-700'
                }`}>
                  {role}
                </span>
              </div>
            </div>
          </div>
          
          {role === 'admin' && (
            <Link href="/fretes" className="bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all flex items-center gap-2">
              <History size={14}/> HISTÓRICO
            </Link>
          )}
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 pb-24">
          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="bg-blue-700 px-6 py-3 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase flex items-center gap-2"><Package size={18} /> Dados da Viagem</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <BigInput label="Motorista" name="motorista" value={formValues.motorista} onChange={handleInputChange} placeholder="NOME DO MOTORISTA" required />
              
              {/* CAMPO PLACA COM O ODÔMETRO ANTERIOR RESTAURADO */}
              <div className="relative">
                <BigInput 
                  label="Placa" 
                  name="placa" 
                  value={formValues.placa} 
                  onChange={handleInputChange} 
                  placeholder="AAA-0000" 
                  required 
                  badge={
                    odometroAnteriorBanco !== null && (
                      <span className="bg-emerald-500/10 text-emerald-500 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-black">
                        KM ANTERIOR: {odometroAnteriorBanco}
                      </span>
                    )
                  }
                />
                {odometroAnteriorBanco !== null && odometroAnteriorBanco > 0 && <CheckCircle2 className="absolute right-4 bottom-4 text-emerald-500" size={20} />}
              </div>

              <BigInput label="Data" name="data_frete" value={formValues.data_frete} onChange={handleInputChange} type="date" required />
              <div className="grid grid-cols-2 gap-4">
                <BigInput label="Frete de" name="frete_de" value={formValues.frete_de} onChange={handleInputChange} />
                <BigInput label="Para" name="para" value={formValues.para} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <BigInput label="Valor/Ton" name="preco_ton" value={formValues.preco_ton} onChange={handleInputChange} isCurrency />
                <BigInput label="Peso (Ton)" name="peso_ton" value={formValues.peso_ton} onChange={handleInputChange} placeholder="0.00" />
              </div>
            </div>
          </section>

          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="bg-emerald-700 px-6 py-3 flex justify-between items-center">
              <h2 className="text-sm font-black uppercase flex items-center gap-2"><Fuel size={18} /> Abastecimento</h2>
              <button type="button" onClick={() => setAbastecimentos([...abastecimentos, { volume: '', odometro: '', valor: '', completou: false }])} className="bg-white text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1"><Plus size={14} /> ADICIONAR</button>
            </div>
            <div className="p-4 space-y-4">
              {abastecimentosComMedia.map((abs, index) => (
                <div key={index} className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 relative space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <BigInput label="Valor Pago" value={abs.valor} onChange={(e: any) => handleAbastecimentoChange(index, 'valor', e.target.value)} isCurrency />
                    <BigInput label="Odômetro" value={abs.odometro} onChange={(e: any) => handleAbastecimentoChange(index, 'odometro', e.target.value)} placeholder="0" />
                    <BigInput label="Volume" value={abs.volume} onChange={(e: any) => handleAbastecimentoChange(index, 'volume', e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={abs.completou} onChange={(e) => handleAbastecimentoChange(index, 'completou', e.target.checked)} className="w-7 h-7 rounded-lg accent-emerald-500" />
                      <span className="text-xs font-black uppercase text-slate-300 group-hover:text-white">Completou?</span>
                    </label>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Média deste trecho</p>
                       <p className={`text-2xl font-black ${abs.media_kml > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>{abs.media_kml > 0 ? abs.media_kml.toFixed(2) : '--'} <span className="text-xs">km/l</span></p>
                    </div>
                  </div>
                  {index > 0 && (
                    <button type="button" onClick={() => setAbastecimentos(abastecimentos.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 bg-red-600 p-1.5 rounded-full shadow-lg border-2 border-slate-900"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ... resto dos gastos operacionais ... */}
          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl p-6">
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['pedagio', 'mecanica', 'eletrica', 'borracharia', 'solda', 'graxa', 'patio', 'limpeza', 'lavagem', 'peca', 'caixinha', 'filtro', 'diversos_operacional'].map(campo => (
                <div key={campo}>
                   <label className="text-[10px] font-black text-slate-500 uppercase ml-1">{campo.replace('_', ' ')}</label>
                   <input
                    type="text"
                    value={formValues[campo] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) / 100);
                      handleInputChange({ target: { name: campo, value: formatted } });
                    }}
                    placeholder="R$ 0,00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm font-bold text-white outline-none focus:ring-2 ring-emerald-500/20"
                  />
                </div>
              ))}
             </div>
          </section>

          <div className="sticky bottom-4 z-50">
            <div className="bg-slate-900 p-4 rounded-3xl border-2 border-emerald-500 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6 w-full md:w-auto justify-around md:justify-start text-white">
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase">Gasto Total</p>
                  <p className="text-lg font-black text-red-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.despesas)}</p>
                </div>
                <div className="h-10 w-[1px] bg-slate-800 hidden md:block" />
                <div>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Lucro Líquido</p>
                  <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.lucro)}</p>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all">
                {loading ? <div className="h-5 w-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={20}/> SALVAR OPERAÇÃO</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}