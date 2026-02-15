'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Edit3, Trash2, ChevronDown, Truck, Fuel, DollarSign } from 'lucide-react'

export default function FretesPage() {
  const [role, setRole] = useState<string | null>(null)
  const [fretes, setFretes] = useState<any[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const labelMap: { [key: string]: string } = {
    peso_ton: "Peso (Ton)",
    preco_ton: "Preço/Ton",
    pedagio: "Pedágio",
    mecanica: "Mecânica",
    eletrica: "Elétrica",
    borracharia: "Borracharia",
    solda: "Solda",
    graxa: "Graxa",
    diversos_operacional: "Diversos"
  }

  useEffect(() => {
    async function checkAccess() {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      const userRole = profile?.role || 'user'
      setRole(userRole)
      if (userRole !== 'admin') { router.push('/'); return }
      fetchFretes()
    }
    checkAccess()
  }, [router])

  async function fetchFretes() {
    const { data, error } = await supabase.from('fretes').select('*').order('created_at', { ascending: false })
    if (!error) setFretes(data || [])
    setLoading(false)
  }

  const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation() // Impede que o card feche ao clicar em excluir
    if (!confirm('Excluir este frete permanentemente?')) return
    const { error } = await supabase.from('fretes').delete().eq('id', id)
    if (error) alert('Erro ao excluir')
    else fetchFretes()
  }

  if (loading) return <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center text-emerald-500 animate-pulse font-medium">Carregando histórico...</div>

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Histórico de Operações</h1>
            <p className="text-slate-400 mt-1 text-sm font-medium uppercase tracking-wider">Gestão de Consumo e Lucratividade</p>
          </div>
          <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-medium border border-slate-700 transition-all">
            Voltar ao Painel
          </Link>
        </header>

        <div className="space-y-4">
          {fretes.map((frete) => {
            const receitaTotal = (frete.peso_ton || 0) * (frete.preco_ton || 0);
            const despesasTotal = (frete.pedagio || 0) + (frete.mecanica || 0) + (frete.eletrica || 0) + (frete.borracharia || 0) + (frete.solda || 0) + (frete.graxa || 0) + (frete.diversos_operacional || 0) + (frete.valor || 0);
            const lucro = receitaTotal - despesasTotal;
            const paradas = frete.abastecimentos_json || [];

            return (
              <div key={frete.id} className={`group bg-slate-900 border transition-all duration-300 rounded-2xl overflow-hidden ${expanded === frete.id ? 'border-blue-500/50 ring-4 ring-blue-500/5' : 'border-slate-800 hover:border-slate-700'}`}>
                
                {/* CABEÇALHO DO CARD (RESUMO) */}
                <div onClick={() => setExpanded(expanded === frete.id ? null : frete.id)} className="p-5 md:p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-xl text-blue-400"><Truck size={24} /></div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{frete.motorista}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-blue-400 font-mono border border-slate-700/50">{frete.placa}</span>
                        <span>•</span>
                        <span>{new Date(frete.data_frete || frete.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Custo Diesel</span>
                      <span className="text-sm font-bold text-slate-300">{formatCurrency(frete.valor || 0)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mb-1">Lucro Líquido</span>
                      <span className={`text-xl font-black ${lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(lucro)}</span>
                    </div>
                    <ChevronDown className={`transition-transform duration-300 opacity-30 ${expanded === frete.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* CONTEÚDO DETALHADO (EXPANDIDO) */}
                {expanded === frete.id && (
                  <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                    
                    {/* TABELA DE ABASTECIMENTOS */}
                    <div className="bg-slate-950/50 rounded-2xl border border-slate-800/50 overflow-hidden mb-6">
                      <div className="bg-slate-800/30 px-4 py-3 border-b border-slate-800/50 flex items-center gap-2">
                        <Fuel size={14} className="text-blue-400" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Paradas e Médias Individuais</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[9px] uppercase text-slate-500 border-b border-slate-800">
                              <th className="px-4 py-3">Parada</th>
                              <th className="px-4 py-3">Odômetro</th>
                              <th className="px-4 py-3">Volume (L)</th>
                              <th className="px-4 py-3">Tanque Cheio?</th>
                              <th className="px-4 py-3 text-emerald-400 font-bold text-right">Média Km/L</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs">
                            {paradas.map((p: any, i: number) => (
                              <tr key={i} className="border-b border-slate-800/30 hover:bg-blue-500/5 transition-colors">
                                <td className="px-4 py-3 text-slate-400 font-bold">#{i + 1}</td>
                                <td className="px-4 py-3 text-slate-200">{p.odometro} Km</td>
                                <td className="px-4 py-3 text-slate-200">{p.volume} L</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black ${p.completou ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>
                                    {p.completou ? 'SIM' : 'NÃO'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {p.media_kml > 0 ? (
                                    <span className="bg-emerald-500 text-slate-950 px-2 py-1 rounded font-black">{p.media_kml.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-slate-600">---</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* OUTRAS DESPESAS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-8">
                      {Object.entries(frete)
                        .filter(([key]) => labelMap[key])
                        .map(([key, value]) => (
                          <div key={key} className="bg-slate-800/20 p-3 rounded-xl border border-slate-800/50">
                            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">{labelMap[key]}</p>
                            <p className="text-sm font-bold text-slate-200">
                              {key === 'peso_ton' ? `${value} Ton` : formatCurrency(Number(value || 0))}
                            </p>
                          </div>
                        ))}
                    </div>

                    {/* AÇÕES DE ADMINISTRAÇÃO */}
                    <div className="flex flex-col md:flex-row gap-3 pt-6 border-t border-slate-800/40">
                      <Link 
                        href={`/fretes/${frete.id}`} 
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-center py-3 rounded-xl font-bold text-xs transition-all tracking-widest uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                      >
                        <Edit3 size={16} /> Editar Registro Completo
                      </Link>
                      
                      <button 
                        onClick={(e) => handleDelete(frete.id, e)} 
                        className="px-8 bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white py-3 rounded-xl font-bold text-xs transition-all border border-slate-700 hover:border-red-500 tracking-widest uppercase flex items-center justify-center gap-2"
                      >
                        <Trash2 size={16} /> Excluir
                      </button>
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