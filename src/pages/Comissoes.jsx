import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/commissions'
import { CheckCircle, Clock, Filter, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Comissoes() {
  const { user } = useAuth()
  const [parcelas, setParcelas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('ativos')
  const [filtroMes, setFiltroMes] = useState('')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('parcelas_comissao')
      .select('*, vendas(descricao, valor_venda, clientes(nome), administradoras(nome))')
      .eq('user_id', user.id)
      .order('mes_referencia', { ascending: false })
    setParcelas(data || [])
    setLoading(false)
  }

  async function marcarPago(parcela) {
    await supabase.from('parcelas_comissao').update({ status: 'pago', data_pagamento: format(new Date(), 'yyyy-MM-dd') }).eq('id', parcela.id)
    load()
  }

  async function marcarPendente(parcela) {
    await supabase.from('parcelas_comissao').update({ status: 'pendente', data_pagamento: null }).eq('id', parcela.id)
    load()
  }

  const filtered = parcelas.filter(p => {
    if (filtroStatus === 'ativos' && p.status === 'estornado') return false
    if (filtroStatus !== 'todos' && filtroStatus !== 'ativos' && p.status !== filtroStatus) return false
    if (filtroMes && !p.mes_referencia.startsWith(filtroMes)) return false
    return true
  })

  const totals = {
    bruto: filtered.reduce((s, p) => s + Number(p.valor_bruto), 0),
    estorno: filtered.reduce((s, p) => s + Number(p.valor_estorno), 0),
    liquido: filtered.reduce((s, p) => s + Number(p.valor_liquido), 0),
    pendente: filtered.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor_liquido), 0),
    pago: filtered.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor_liquido), 0),
  }

  const mesesDisponiveis = [...new Set(parcelas.map(p => p.mes_referencia.slice(0, 7)))].sort().reverse()

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Comissões</h1>
        <p className="text-gray-400 text-sm mt-1">Todas as parcelas de comissão geradas</p>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Bruto', value: totals.bruto, color: '#6366f1' },
          { label: 'Total Estornos', value: totals.estorno, color: '#ef4444' },
          { label: 'Líquido Total', value: totals.liquido, color: '#06b6d4' },
          { label: 'A Receber', value: totals.pendente, color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <p className="text-gray-400 text-sm">{label}</p>
            <p className="text-xl font-bold mt-1" style={{ color }}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 text-gray-400">
          <Filter size={16} />
          <span className="text-sm">Filtrar:</span>
        </div>
        {['ativos', 'todos', 'pendente', 'pago', 'estornado'].map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={filtroStatus === s
              ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }
              : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
            }
          >
            {{ ativos: 'Ativos', todos: 'Todos', pendente: 'Pendente', pago: 'Pago', estornado: 'Estornado' }[s]}
          </button>
        ))}
        <select
          value={filtroMes}
          onChange={e => setFiltroMes(e.target.value)}
          style={{ width: 'auto', paddingLeft: '12px' }}
        >
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map(m => (
            <option key={m} value={m}>
              {format(new Date(m + '-01T00:00:00'), "MMMM 'de' yyyy", { locale: ptBR })}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <DollarSign size={32} className="mb-2 opacity-30" />
            <p>Nenhuma comissão encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Venda / Cliente</th>
                  <th>Administradora</th>
                  <th>Parc.</th>
                  <th>Mês Ref.</th>
                  <th>Bruto</th>
                  <th>Estorno</th>
                  <th>Líquido</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="text-white font-medium">{p.vendas?.clientes?.nome || p.vendas?.descricao || '—'}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(p.vendas?.valor_venda)}</div>
                    </td>
                    <td className="text-gray-300">{p.vendas?.administradoras?.nome || '—'}</td>
                    <td className="text-gray-400">{p.numero_parcela}</td>
                    <td className="text-gray-300 capitalize">
                      {format(new Date(p.mes_referencia + 'T00:00:00'), "MMM 'de' yyyy", { locale: ptBR })}
                    </td>
                    <td style={{ color: '#818cf8' }} className="font-medium">{formatCurrency(p.valor_bruto)}</td>
                    <td style={{ color: p.valor_estorno > 0 ? '#f87171' : '#6b7280' }}>
                      {p.valor_estorno > 0 ? `-${formatCurrency(p.valor_estorno)}` : '—'}
                    </td>
                    <td style={{ color: '#10b981' }} className="font-semibold">{formatCurrency(p.valor_liquido)}</td>
                    <td>
                      <span className={`status-badge status-${p.status === 'pendente' ? 'pending' : p.status === 'pago' ? 'paid' : 'reversed'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      {p.status === 'pendente' && (
                        <button className="btn-secondary btn-sm" onClick={() => marcarPago(p)}>
                          <CheckCircle size={14} /> Pago
                        </button>
                      )}
                      {p.status === 'pago' && (
                        <button className="btn-danger btn-sm" onClick={() => marcarPendente(p)}>
                          <Clock size={14} /> Reverter
                        </button>
                      )}
                      {p.status === 'estornado' && (
                        <button className="btn-secondary btn-sm" onClick={() => marcarPago(p)}>
                          <CheckCircle size={14} /> Marcar pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
