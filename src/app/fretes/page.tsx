'use client'
export const dynamic = 'force-dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Edit3, Trash2, ChevronDown, Truck, ArrowLeft, Calendar, Gauge, MapPin, Wallet, ReceiptText, Banknote } from 'lucide-react'
import Swal from 'sweetalert2'

export default function FretesPage() {
  const [fretes, setFretes] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const labelMap: { [key: string]: string } = {
    pedagio: "Pedágio",
    mecanica: "Mecânica",
    eletrica: "Elétrica",
    borracharia: "Borracharia",
    solda: "Solda",
    graxa: "Graxa",
    patio: "Pátio",
    limpeza: "Limpeza",
    lavagem: "Lavagem",
    peca: "Peça",
    caixinha: "Caixinha",
    filtro: "Filtro",
    diversos_operacional: "Diversos Operacional"
  }

  // Função para limpar strings de moeda e converter em número
  const parseCurrency = (v: any) => {
    if (typeof v === 'number') return v;
    const cleanValue = String(v || '0').replace(/\D/g, '');
    return Number(cleanValue) / 100;
  }

  useEffect(() => {
    async function checkAccess() {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      if (profile?.role !== 'admin') { router.push('/'); return }
      fetchFretes()
    }
    checkAccess()
  }, [router])

  async function fetchFretes() {
    const { data, error } = await supabase
      .from('fretes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!error && data) setFretes(data)
    setLoading(false)
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const result = await Swal.fire({
      title: 'Excluir registro?',
      text: "Isso apagará permanentemente este frete.",
      icon: 'warning',
      showCancelButton: true,
      background: '#0f172a',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Sim, excluir'
    })
    if (result.isConfirmed) {
      const { error } = await supabase.from('fretes').delete().eq('id', id)
      if (!error) fetchFretes()
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0b0f1a] flex flex-col items-center justify-center gap-4 text-emerald-500 font-medium">
      <div className="h-12 w-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <span>Carregando histórico...</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <Gauge size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Histórico de Operações</h1>
              <p className="text-slate-400 mt-1 text-[10px] font-bold uppercase tracking-[0.2em]">Gestão Administrativa</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl font-bold text-xs uppercase transition-all">
            <ArrowLeft size={16} /> Voltar ao Painel
          </Link>
        </header>

        <div className="space-y-5">
          {fretes.map((frete) => {
            const paradas = frete.abastecimentos_json || [];
            
            // CORREÇÃO: Usando parseCurrency para somar o diesel do JSON com segurança
            const gastoDiesel = paradas.reduce((acc: number, curr: any) => acc + parseCurrency(curr.valor), 0);
            
            const despesasOperacionaisAtivas = Object.keys(labelMap).filter(key => (Number(frete[key]) || 0) > 0);
            const totalOutrosGastos = despesasOperacionaisAtivas.reduce((acc, key) => acc + (Number(frete[key]) || 0), 0);
            
            const despesasTotal = gastoDiesel + totalOutrosGastos;
            const receitaTotal = (Number(frete.peso_ton) || 0) * (Number(frete.preco_ton) || 0);
            const lucro = receitaTotal - despesasTotal;

            return (
              <div key={frete.id} className={`group bg-slate-900/50 border transition-all duration-300 rounded-3xl overflow-hidden ${expanded === frete.id ? 'border-emerald-500/40 bg-slate-900 shadow-2xl' : 'border-slate-800 hover:border-slate-700'}`}>
                
                <div onClick={() => setExpanded(expanded === frete.id ? null : frete.id)} className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-emerald-400 transition-colors">
                      <Truck size={28} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">{frete.motorista}</h3>
                      <div className="flex items-center gap-2 mt-1 text-slate-400">
                         <MapPin size={12} className="text-emerald-500" />
                         <span className="text-[11px] font-bold uppercase">{frete.frete_de || '---'} → {frete.para || '---'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="bg-emerald-500/10 px-2 py-0.5 rounded text-emerald-500 font-bold text-[10px] border border-emerald-500/20">{frete.placa}</span>
                        <span className="text-slate-500 text-[10px] font-bold"><Calendar size={12} className="inline mr-1" /> {new Date(frete.data_frete).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-6 pt-6 md:pt-0 border-t md:border-t-0 border-slate-800/50 w-full md:w-auto justify-between">
                    <div className="grid grid-cols-2 md:flex items-center gap-6 w-full md:w-auto">
                      <div className="text-right border-r border-slate-800 pr-4 md:pr-6">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black block mb-1">Receita</span>
                        <span className="text-sm font-bold text-blue-400">{formatCurrency(receitaTotal)}</span>
                      </div>
                      
                      <div className="text-right md:border-r md:border-slate-800 md:pr-6">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black block mb-1">Despesas</span>
                        <span className="text-sm font-bold text-red-400">{formatCurrency(despesasTotal)}</span>
                      </div>
                    </div>

                    <div className="text-right min-w-[120px] w-full md:w-auto pt-4 md:pt-0 border-t border-slate-800/30 md:border-none">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-black block mb-1">Lucro Líquido</span>
                      <span className={`text-xl md:text-2xl font-black ${lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(lucro)}
                      </span>
                    </div>

                    <div className={`hidden md:block p-2 bg-slate-800 rounded-xl transition-transform ${expanded === frete.id ? 'rotate-180' : ''}`}>
                      <ChevronDown size={20} />
                    </div>
                  </div>
                </div>

                {expanded === frete.id && (
                  <div className="px-6 pb-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    
                    <div className="bg-blue-500/5 rounded-3xl border border-blue-500/20 overflow-hidden mb-6">
                        <div className="px-6 py-3 bg-blue-500/10 border-b border-blue-500/20 flex items-center">
                            <Banknote size={14} className="text-blue-400 mr-2" />
                            <span className="text-[10px] font-black uppercase text-blue-400">Detalhamento da Receita</span>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div className="flex flex-col">
                                <span className="text-[9px] text-slate-500 uppercase font-black">Preço por Tonelada</span>
                                <span className="text-sm font-bold text-slate-200">{formatCurrency(frete.preco_ton || 0)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] text-slate-500 uppercase font-black">Peso Total</span>
                                <span className="text-sm font-bold text-slate-200">{frete.peso_ton} Ton</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950/40 rounded-3xl border border-slate-800/50 overflow-hidden mb-6">
                      <div className="px-6 py-3 bg-slate-800/30 border-b border-slate-800/50 flex items-center">
                        <Wallet size={14} className="text-emerald-500 mr-2" />
                        <span className="text-[10px] font-black uppercase">Detalhamento Diesel</span>
                      </div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] uppercase text-slate-500 border-b border-slate-800/50">
                            <th className="px-6 py-3">Parada</th><th className="px-6 py-3">Valor</th><th className="px-6 py-3">Odômetro</th><th className="px-6 py-3">Volume</th><th className="px-6 py-3">Completou?</th><th className="px-6 py-3 text-right">Média</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs">
                          {paradas.map((p: any, i: number) => (
                            <tr key={i} className="border-b border-slate-800/20 last:border-0">
                              <td className="px-6 py-3 text-slate-400">#0{i + 1}</td>
                              <td className="px-6 py-3 text-red-400/80 font-medium">{formatCurrency(parseCurrency(p.valor))}</td>
                              <td className="px-6 py-3">{p.odometro} km</td>
                              <td className="px-6 py-3">{p.volume} L</td>
                              <td className="px-6 py-3">
                                {p.completou ? (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase">Sim</span>
                                ) : (
                                  <span className="text-[9px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full border border-slate-700 font-black uppercase">Não</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right font-black text-emerald-500">
                                {p.media_kml > 0 ? `${Number(p.media_kml).toFixed(2)}` : '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {despesasOperacionaisAtivas.length > 0 && (
                      <div className="bg-slate-950/40 rounded-3xl border border-slate-800/50 overflow-hidden mb-8">
                        <div className="px-6 py-3 bg-slate-800/30 border-b border-slate-800/50 flex items-center">
                          <ReceiptText size={14} className="text-slate-400 mr-2" />
                          <span className="text-[10px] font-black uppercase">Outros Gastos Operacionais</span>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                          {despesasOperacionaisAtivas.map(key => (
                            <div key={key} className="flex flex-col">
                              <span className="text-[9px] text-slate-500 uppercase font-black">{labelMap[key]}</span>
                              <span className="text-sm font-bold text-slate-200">{formatCurrency(Number(frete[key]))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 pt-6 border-t border-slate-800/50">
                      <Link href={`/fretes/${frete.id}`} className="flex-1 bg-white hover:bg-slate-200 text-slate-950 text-center py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 transition-all"><Edit3 size={18} /> Editar Registro</Link>
                      <button onClick={(e) => handleDelete(frete.id, e)} className="px-10 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-3 transition-all"><Trash2 size={18} /> Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}