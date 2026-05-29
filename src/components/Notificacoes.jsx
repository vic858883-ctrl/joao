import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Bell, X, Clock, AlertTriangle } from 'lucide-react'
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { formatCurrency } from '../lib/commissions'

export default function Notificacoes() {
  const { user } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [notificacoes, setNotificacoes] = useState([])
  const [lidas, setLidas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('notif_lidas') || '[]') } catch { return [] }
  })

  useEffect(() => { if (user) loadNotificacoes() }, [user])

  async function loadNotificacoes() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const proximoMes = format(endOfMonth(addDays(new Date(), 30)), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('parcelas_comissao')
      .select('*, vendas(descricao, clientes(nome))')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .gte('mes_referencia', hoje)
      .lte('mes_referencia', proximoMes)
      .order('mes_referencia', { ascending: true })
      .limit(10)

    const notifs = (data || []).map(p => ({
      id: p.id,
      tipo: p.mes_referencia <= hoje ? 'vencida' : 'proxima',
      titulo: p.mes_referencia <= hoje ? 'Parcela vencida!' : 'Parcela vencendo',
      descricao: `${p.vendas?.clientes?.nome || p.vendas?.descricao || 'Venda'} — Parc. ${p.numero_parcela}`,
      valor: p.valor_bruto,
      data: p.mes_referencia,
    }))

    setNotificacoes(notifs)
  }

  function marcarLida(id) {
    const novas = [...lidas, id]
    setLidas(novas)
    localStorage.setItem('notif_lidas', JSON.stringify(novas))
  }

  function marcarTodasLidas() {
    const ids = notificacoes.map(n => n.id)
    const novas = [...new Set([...lidas, ...ids])]
    setLidas(novas)
    localStorage.setItem('notif_lidas', JSON.stringify(novas))
  }

  const naoLidas = notificacoes.filter(n => !lidas.includes(n.id))

  return (
    <div className="relative">
      {/* Botão */}
      <button
        onClick={() => setAberto(!aberto)}
        className="relative p-2 rounded-xl transition-all"
        style={{ background: aberto ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)' }}
      >
        <Bell size={20} className="text-gray-300" />
        {naoLidas.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: '#ef4444', fontSize: 10 }}>
            {naoLidas.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-12 w-80 z-50 rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.2)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
              <div className="flex items-center gap-2">
                <Bell size={16} style={{ color: '#818cf8' }} />
                <span className="font-semibold text-white text-sm">Notificações</span>
                {naoLidas.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: '#ef4444' }}>
                    {naoLidas.length}
                  </span>
                )}
              </div>
              {naoLidas.length > 0 && (
                <button onClick={marcarTodasLidas} className="text-xs text-indigo-400 hover:text-indigo-300">
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-80 overflow-y-auto">
              {notificacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Bell size={24} className="mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                notificacoes.map(n => (
                  <div key={n.id}
                    className="flex items-start gap-3 p-4 border-b transition-all"
                    style={{
                      borderColor: 'rgba(255,255,255,0.04)',
                      background: lidas.includes(n.id) ? 'transparent' : 'rgba(99,102,241,0.05)'
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: n.tipo === 'vencida' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }}>
                      {n.tipo === 'vencida'
                        ? <AlertTriangle size={14} style={{ color: '#f87171' }} />
                        : <Clock size={14} style={{ color: '#fbbf24' }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: n.tipo === 'vencida' ? '#f87171' : '#fbbf24' }}>
                        {n.titulo}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{n.descricao}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">
                          {format(new Date(n.data + 'T00:00:00'), "MMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs font-semibold" style={{ color: '#10b981' }}>
                          {formatCurrency(n.valor)}
                        </p>
                      </div>
                    </div>
                    {!lidas.includes(n.id) && (
                      <button onClick={() => marcarLida(n.id)} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notificacoes.length > 0 && (
              <div className="p-3 text-center border-t" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
                <p className="text-xs text-gray-500">Parcelas dos próximos 30 dias</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
