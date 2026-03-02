'use client'
export const dynamic = 'force-dynamic'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Swal from 'sweetalert2'
import {
  Truck, Fuel, Package,
  CheckCircle2, Trash2, Plus, Save, History, Fuel as FuelIcon, Lock, AlertTriangle, RefreshCw, WifiOff
} from 'lucide-react'

// ... (LABELS_CAMPOS, CAMPOS_OPERACIONAIS e funções auxiliares round mantidas iguais)
const STORAGE_KEY = 'rascunho_frete_pwa'
const APP_VERSION = '1.0.4' 

const LABELS_CAMPOS: Record<string, string> = {
  pedagio: 'Pedágio', mecanica: 'Mecânica', eletrica: 'Elétrica', borracharia: 'Borracharia',
  diferenca_frete: 'Diferença Frete', quebra: 'Quebra', patio: 'Pátio', limpeza: 'Limpeza',
  lavagem: 'Lavagem', arla: 'ARLA', cartao: 'Cartão', diversos_operacional: 'Diversos Operacional',
  caixinha: 'Caixinha',
};
const CAMPOS_OPERACIONAIS = Object.keys(LABELS_CAMPOS);
const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100
const round3 = (num: number) => Math.round((num + Number.EPSILON) * 1000) / 1000

// Componente BigInput mantido igual
function BigInput({ label, value, onChange, name, type = "text", isCurrency = false, isDecimal = false, isOdometer = false, placeholder = "", required = false, badge = null, icon = null, disabled = false }: any) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (isCurrency || isDecimal || isOdometer) {
      const val = e.target.value.replace(/\D/g, '')
      if (!val) return onChange({ target: { name, value: '' } })
      let formatted;
      if (isOdometer) { formatted = new Intl.NumberFormat('pt-BR').format(Number(val)) } 
      else if (isCurrency) { formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) / 100) } 
      else {
        const isWeight = name === 'peso_ton'
        formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: isWeight ? 3 : 2, maximumFractionDigits: isWeight ? 3 : 2 }).format(Number(val) / (isWeight ? 1000 : 100))
      }
      onChange({ target: { name, value: formatted } })
    } else { onChange(e) }
  }
  return (
    <div className={`flex flex-col gap-1.5 w-full relative transition-all duration-500 ${disabled ? 'opacity-20 grayscale' : 'opacity-100'}`}>
      <div className="flex justify-between items-center px-1">
        <label className="text-[11px] font-black uppercase text-slate-400 tracking-tight">{label} {required && <span className="text-red-500">*</span>}</label>
        {badge}
      </div>
      <div className="relative">
        <input type={type} name={name} value={value || ''} onChange={handleChange} placeholder={placeholder} required={required} disabled={disabled} className="bg-slate-800 border-2 border-slate-700 text-white font-bold px-4 py-4 rounded-2xl outline-none focus:border-emerald-500 transition-all text-base placeholder:text-slate-600 uppercase w-full pr-12 disabled:cursor-not-allowed" />
        <div className="absolute right-4 top-1/2 -translate-y-1/2">{icon}</div>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [role, setRole] = useState<string | 'loading'>('loading')
  const [userName, setUserName] = useState('')
  const [hydrated, setHydrated] = useState(false)
  
  // NOVOS ESTADOS PARA GESTÃO DE REDE E ODÔMETRO
  const [odometroAnteriorBanco, setOdometroAnteriorBanco] = useState<number | null>(null)
  const [buscandoOdo, setBuscandoOdo] = useState(false)
  const [errorOdo, setErrorOdo] = useState(false)

  const [formValues, setFormValues] = useState<any>({
    motorista: '', placa: '', data_frete: new Date().toISOString().split('T')[0],
    peso_ton: '', preco_ton: '', frete_de: '', para: '', pedagio: '', mecanica: '', eletrica: '',
    borracharia: '', diferenca_frete: '', quebra: '', patio: '', limpeza: '', lavagem: '', arla: '',
    caixinha: 'R$ 20,00', cartao: '', diversos_operacional: '',
  })

  const [abastecimentos, setAbastecimentos] = useState([{ volume: '', odometro: '', valor: '', completou: false }])

  const isPlacaPreenchida = useMemo(() => formValues.placa.replace(/[^A-Z0-9]/gi, '').length >= 7, [formValues.placa])
  const parseCurrency = (v: any) => Number(String(v || '0').replace(/\D/g, '')) / 100
  const parseNumero = (v: any) => parseFloat(String(v || '0').replace(/\./g, '').replace(',', '.')) || 0

  // 1. FUNÇÃO DE BUSCA ROBUSTA
  const buscarUltimoOdometro = useCallback(async () => {
    const placaLimpa = formValues.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    if (placaLimpa.length < 7) return

    setBuscandoOdo(true)
    setErrorOdo(false)

    try {
      const { data, error } = await supabase
        .from('fretes')
        .select('odometro_atual')
        .eq('placa', placaLimpa)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      setOdometroAnteriorBanco(data ? Number(data.odometro_atual) : 0)
    } catch (err) {
      console.error("Erro ao buscar odômetro:", err)
      setErrorOdo(true) // Ativa estado de erro visualmente
    } finally {
      setBuscandoOdo(false)
    }
  }, [formValues.placa])

  // 2. TRIGGER DE REDE (ONLINE/OFFLINE)
  useEffect(() => {
    const handleOnline = () => {
      if (isPlacaPreenchida && (odometroAnteriorBanco === null || errorOdo)) {
        buscarUltimoOdometro()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [isPlacaPreenchida, odometroAnteriorBanco, errorOdo, buscarUltimoOdometro])

  // 3. EFEITO PARA A PLACA
  useEffect(() => {
    if (!isPlacaPreenchida) {
      setOdometroAnteriorBanco(null)
      setErrorOdo(false)
      return
    }
    buscarUltimoOdometro()
  }, [isPlacaPreenchida, buscarUltimoOdometro])

  // Efeitos de rascunho e autenticação mantidos...
  useEffect(() => {
    const lastVersion = localStorage.getItem('app_version')
    if (lastVersion !== APP_VERSION) { localStorage.removeItem(STORAGE_KEY); localStorage.setItem('app_version', APP_VERSION) }
    const rascunhoSalvo = localStorage.getItem(STORAGE_KEY)
    if (rascunhoSalvo) {
      try {
        const { formValues: f, abastecimentos: a } = JSON.parse(rascunhoSalvo)
        if (f) setFormValues({ ...f, caixinha: 'R$ 20,00' })
        if (a) setAbastecimentos(a)
      } catch (e) { console.error("Erro ao recuperar rascunho", e) }
    }
  }, [])

  useEffect(() => {
    if (hydrated) {
      const dadosParaSalvar = { formValues, abastecimentos }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dadosParaSalvar))
    }
  }, [formValues, abastecimentos, hydrated])

  useEffect(() => {
    setHydrated(true)
    async function checkUser() {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) { router.push('/login'); return; }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      setRole(profile?.role || 'user')
      setUserName(profile?.full_name || data.user.email?.split('@')[0] || '')
    }
    checkUser()
  }, [router])

  const handleInputChange = useCallback((e: any) => {
    const { name, value } = e.target
    if (name === 'caixinha') return
    setFormValues((prev: any) => ({ ...prev, [name]: name === 'placa' ? value.replace(/[^A-Z0-9]/gi, '').toUpperCase() : value }))
  }, [])

  const handleAbastecimentoChange = (index: number, field: string, value: any) => {
    if (!isPlacaPreenchida) return;
    const novos = [...abastecimentos]
    novos[index] = { ...novos[index], [field]: value }
    setAbastecimentos(novos)
  }

  const abastecimentosComMedia = useMemo(() => {
    // Agora o cálculo reage IMEDIATAMENTE quando odometroAnteriorBanco muda
    let ultimoOdoCheio = odometroAnteriorBanco ?? 0;
    let volumeAcumulado = 0;
    
    return abastecimentos.map((abs) => {
      const odoAtual = parseNumero(abs.odometro);
      const volumeAtual = parseNumero(abs.volume);
      volumeAcumulado = round2(volumeAcumulado + volumeAtual);
      let media = 0;
      
      if (abs.completou && odoAtual > 0 && volumeAcumulado > 0) {
        if (ultimoOdoCheio > 0) {
          const kmPercorrida = odoAtual - ultimoOdoCheio;
          if (kmPercorrida > 0) media = round2(kmPercorrida / volumeAcumulado);
        }
        ultimoOdoCheio = odoAtual; 
        volumeAcumulado = 0;
      }
      return { ...abs, media_kml: media };
    });
  }, [abastecimentos, odometroAnteriorBanco]);

  const stats = useMemo(() => {
    const bruto = round2(parseNumero(formValues.peso_ton) * parseCurrency(formValues.preco_ton))
    const receita = round2(bruto * 0.88) 
    const diesel = round2(abastecimentos.reduce((acc, curr) => acc + parseCurrency(curr.valor), 0))
    const despesasOp = round2(CAMPOS_OPERACIONAIS.reduce((acc, campo) => {
        let v = parseCurrency(formValues[campo]);
        if (campo === 'caixinha' && v === 0) v = 20;
        return acc + v;
    }, 0))
    const despesasTotais = round2(diesel + despesasOp)
    const lucro = round2(receita - despesasTotais)
    return { bruto, receita, despesas: despesasTotais, lucro }
  }, [formValues, abastecimentos])

  async function handleConfirmSave() {
    setIsModalOpen(false)
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')
      const operacionaisTratados: any = {}
      CAMPOS_OPERACIONAIS.forEach(c => { 
        let valorNumerico = round2(parseCurrency(formValues[c]));
        if (c === 'caixinha' && (valorNumerico === 0 || !valorNumerico)) valorNumerico = 20;
        operacionaisTratados[c] = valorNumerico;
      })
      const processados = abastecimentosComMedia.map(a => ({ ...a, volume: round2(parseNumero(a.volume)), valor: round2(parseCurrency(a.valor)), media_kml: round2(a.media_kml) }))
      const mediaFinal = [...processados].reverse().find(a => a.media_kml > 0)?.media_kml || 0
      const payload = {
        ...formValues, ...operacionaisTratados,
        placa: formValues.placa.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
        user_email: user.email,
        peso_ton: round3(parseNumero(formValues.peso_ton)),
        preco_ton: parseCurrency(formValues.preco_ton), 
        receita: stats.receita, 
        abastecimentos_json: processados,
        valor: stats.despesas,
        odometro_atual: parseNumero(processados[processados.length - 1]?.odometro),
        media_kml: round2(mediaFinal)
      }
      const { error } = await supabase.from('fretes').insert([payload])
      if (error) throw error
      localStorage.removeItem(STORAGE_KEY)
      await Swal.fire({ title: 'Sucesso!', text: `Frete salvo com sucesso!`, icon: 'success', background: '#0f172a', color: '#fff' })
      window.location.reload()
    } catch (err: any) { Swal.fire('Erro', err.message, 'error') } finally { setLoading(false) }
  }

  if (!hydrated || role === 'loading') return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500 font-bold animate-pulse">CARREGANDO...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
           <div className="flex items-center gap-4">
             <div className="p-3 bg-emerald-600 rounded-xl"><Truck size={24} className="text-white" /></div>
             <div>
               <h1 className="text-xl font-black uppercase tracking-tight">Novo Frete</h1>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{userName}</p>
             </div>
           </div>
           {role === 'admin' && (
             <Link href="/fretes" className="bg-slate-800 px-4 py-2 rounded-lg text-xs font-bold border border-slate-700 hover:bg-slate-700 transition-all flex items-center gap-2 text-slate-300">
               <History size={14}/> HISTÓRICO
             </Link>
           )}
        </header>

        <form onSubmit={(e) => { e.preventDefault(); if (!isPlacaPreenchida || !formValues.motorista) return Swal.fire('Atenção', 'Preencha placa e motorista corretamente', 'warning'); setIsModalOpen(true); }} className="space-y-6">
          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
            <div className="bg-blue-700 px-6 py-3"><h2 className="text-sm font-black uppercase flex items-center gap-2"><Package size={18} /> Dados da Viagem</h2></div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
              <BigInput label="Motorista" name="motorista" value={formValues.motorista} onChange={handleInputChange} placeholder="NOME DO MOTORISTA" required />
              
              {/* INPUT DE PLACA COM FEEDBACK DE REDE */}
              <BigInput 
                label="Placa" 
                name="placa" 
                value={formValues.placa} 
                onChange={handleInputChange} 
                placeholder="AAA-0000" 
                required 
                badge={
                  buscandoOdo ? (
                    <span className="flex items-center gap-1 text-[9px] font-black text-blue-400 animate-pulse"><RefreshCw size={10} className="animate-spin" /> BUSCANDO KM...</span>
                  ) : errorOdo ? (
                    <button type="button" onClick={buscarUltimoOdometro} className="flex items-center gap-1 text-[9px] font-black text-red-400 uppercase hover:underline"><WifiOff size={10} /> FALHA NA REDE (REPETIR)</button>
                  ) : odometroAnteriorBanco !== null ? (
                    <span className="text-[9px] font-black text-emerald-400 uppercase">KM ANTERIOR: {odometroAnteriorBanco.toLocaleString('pt-BR')}</span>
                  ) : null
                } 
                icon={
                  buscandoOdo ? <RefreshCw className="text-blue-500 animate-spin" size={20} /> :
                  errorOdo ? <AlertTriangle className="text-red-500" size={20} /> :
                  odometroAnteriorBanco !== null ? <CheckCircle2 className="text-emerald-500" size={20} /> : null
                } 
              />

              <BigInput label="Data" name="data_frete" value={formValues.data_frete} onChange={handleInputChange} type="date" required />
              <div className="grid grid-cols-2 gap-4">
                <BigInput label="Frete de" name="frete_de" value={formValues.frete_de} onChange={handleInputChange} />
                <BigInput label="Para" name="para" value={formValues.para} onChange={handleInputChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <BigInput label="Valor/Ton" name="preco_ton" value={formValues.preco_ton} onChange={handleInputChange} isCurrency />
                <BigInput label="Peso (Ton)" name="peso_ton" value={formValues.peso_ton} onChange={handleInputChange} placeholder="0,000" isDecimal />
              </div>
            </div>
          </section>

          {/* SEÇÃO ABASTECIMENTO (Igual ao anterior com o botão responsivo) */}
          <section className="relative">
            <div className={`bg-slate-900 rounded-3xl overflow-hidden border-2 transition-all duration-700 ${isPlacaPreenchida ? 'border-emerald-500/30 shadow-2xl' : 'border-slate-800'}`}>
              <div className={`px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3 transition-colors duration-700 ${isPlacaPreenchida ? 'bg-emerald-600/20' : 'bg-slate-800/50'}`}>
                <h2 className="text-sm font-black uppercase flex items-center gap-2 md:gap-3 flex-1 min-w-[120px]">
                  <div className={`p-2 rounded-lg transition-all ${isPlacaPreenchida ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    <FuelIcon size={18} className="md:w-[20px] md:h-[20px]" />
                  </div>
                  <span className="truncate">Abastecimento</span>
                </h2>
                <button type="button" disabled={!isPlacaPreenchida} onClick={() => setAbastecimentos([...abastecimentos, { volume: '', odometro: '', valor: '', completou: false }])} className="bg-emerald-500 text-slate-950 h-10 md:h-11 px-3 md:px-5 rounded-xl text-[10px] md:text-[11px] font-black flex items-center justify-center gap-2 hover:bg-emerald-400 disabled:hidden transition-all shadow-lg active:scale-95 whitespace-nowrap border-b-2 border-emerald-700 active:border-b-0">
                  <Plus size={16} /> <span className="hidden sm:inline">ADICIONAR NOVO</span><span className="inline sm:hidden">ADICIONAR</span>
                </button>
              </div>
              
              <div className="p-4 space-y-4 relative min-h-[150px]">
                {!isPlacaPreenchida && (
                  <div className="absolute inset-0 z-20 backdrop-blur-[2px] bg-slate-950/40 flex flex-col items-center justify-center rounded-b-3xl transition-all duration-500">
                    <div className="bg-slate-900/95 border-2 border-slate-700 p-6 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 max-w-[280px] text-center animate-in zoom-in-95">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-amber-500 shadow-inner"><Lock size={28} className="animate-pulse" /></div>
                      <div>
                        <p className="text-white font-black text-sm uppercase tracking-tight">Acesso Bloqueado</p>
                        <p className="text-slate-400 text-[10px] font-bold uppercase mt-1 leading-relaxed">Primeiro informe a placa do veículo nos dados acima.</p>
                      </div>
                      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black py-3 px-6 rounded-2xl transition-all">VOLTAR PARA PLACA</button>
                    </div>
                  </div>
                )}

                <div className={!isPlacaPreenchida ? 'pointer-events-none select-none' : ''}>
                  {abastecimentosComMedia.map((abs, index) => (
                    <div key={index} className="bg-slate-800/30 p-5 rounded-2xl border border-slate-700/50 relative space-y-4 mb-4 last:mb-0">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <BigInput label="Valor Pago" value={abs.valor} disabled={!isPlacaPreenchida} onChange={(e: any) => handleAbastecimentoChange(index, 'valor', e.target.value)} isCurrency />
                        <BigInput label="Odômetro" value={abs.odometro} disabled={!isPlacaPreenchida} onChange={(e: any) => handleAbastecimentoChange(index, 'odometro', e.target.value)} isOdometer />
                        <BigInput label="Volume (Litros)" value={abs.volume} disabled={!isPlacaPreenchida} onChange={(e: any) => handleAbastecimentoChange(index, 'volume', e.target.value)} isDecimal />
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input type="checkbox" disabled={!isPlacaPreenchida} checked={abs.completou} onChange={(e) => handleAbastecimentoChange(index, 'completou', e.target.checked)} className="w-7 h-7 rounded-lg accent-emerald-500" />
                          <span className="text-xs font-black uppercase text-slate-300">Completou?</span>
                        </label>
                        <div className="text-right">
                           <p className="text-[9px] font-black text-slate-500 uppercase">Média trecho</p>
                           <p className={`text-2xl font-black ${abs.media_kml > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                             {abs.media_kml > 0 ? abs.media_kml.toFixed(2) : '--'} <span className="text-xs">km/l</span>
                           </p>
                        </div>
                      </div>
                      {index > 0 && (
                        <button type="button" onClick={() => setAbastecimentos(abastecimentos.filter((_, i) => i !== index))} className="absolute -right-2 -top-2 bg-red-600 p-1.5 rounded-full shadow-lg border-2 border-slate-900 text-white"><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SEÇÃO OPERACIONAIS E FOOTER (Mantidos iguais) */}
          <section className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {CAMPOS_OPERACIONAIS.map(campo => {
                 const isLocked = campo === 'caixinha';
                 return (
                  <div key={campo} className="relative">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1">{LABELS_CAMPOS[campo]} {isLocked && <Lock size={10} />}</label>
                      <input type="text" name={campo} value={formValues[campo] || ''} readOnly={isLocked} onChange={(e) => { if (isLocked) return; const val = e.target.value.replace(/\D/g, ''); const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) / 100); handleInputChange({ target: { name: campo, value: formatted } }); }} placeholder="R$ 0,00" className={`w-full border rounded-xl px-3 py-3 text-sm font-bold outline-none transition-all ${isLocked ? 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed opacity-60' : 'bg-slate-800 border-slate-700 text-white focus:ring-2 ring-emerald-500/20'}`} />
                  </div>
                 )
               })}
              </div>
          </section>

          <div className="pt-4 pb-12">
            <div className="bg-slate-900 p-6 rounded-3xl border-2 border-emerald-500 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
              <div className="flex items-center gap-8 w-full md:w-auto justify-around md:justify-start text-white">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Gasto Total</p>
                  <p className="text-xl font-black text-red-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.despesas)}</p>
                </div>
                <div className="h-12 w-[1px] bg-slate-800 hidden md:block" />
                <div>
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Lucro Líquido</p>
                  <p className="text-3xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.lucro)}</p>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 transition-all border-b-4 border-emerald-800">
                {loading ? <div className="h-5 w-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><Save size={20}/> SALVAR OPERAÇÃO</>}
              </button>
            </div>
          </div>
        </form>

        {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-slate-950/95 backdrop-blur-md">
                <div className="bg-slate-900 border-4 border-emerald-500 w-full max-w-lg rounded-[3rem] shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-8 md:p-12 text-center">
                        <div className="flex justify-center mb-6"><div className="bg-emerald-500 text-slate-900 p-5 rounded-full animate-bounce"><CheckCircle2 size={48} strokeWidth={3} /></div></div>
                        <h3 className="text-4xl md:text-5xl font-black text-white uppercase leading-tight mb-6">CONFIRMAR <br/> ENVIO?</h3>
                        <div className="bg-slate-800 p-6 rounded-3xl border-2 border-slate-700 mb-8">
                            <div className="flex justify-between items-center border-b border-slate-700 pb-2"><span className="text-slate-400 font-bold uppercase text-sm">Placa:</span><span className="text-2xl font-black text-white tracking-widest">{formValues.placa}</span></div>
                            <div className="flex justify-between items-center pt-2"><span className="text-slate-400 font-bold uppercase text-sm">Lucro:</span><span className="text-2xl font-black text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.lucro)}</span></div>
                        </div>
                        <div className="flex flex-col gap-4">
                            <button onClick={handleConfirmSave} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-8 rounded-3xl font-black uppercase tracking-tighter text-2xl shadow-[0_10px_0_rgb(5,150,105)] active:translate-y-1 active:shadow-none transition-all">SIM! ENVIAR FRETE</button>
                            <button onClick={() => setIsModalOpen(false)} className="w-full bg-transparent border-2 border-slate-700 text-slate-500 py-5 rounded-2xl font-black uppercase tracking-widest text-sm hover:text-white transition-all">AINDA NÃO</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  )
}