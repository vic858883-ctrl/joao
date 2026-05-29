import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/commissions'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { DollarSign, TrendingUp, RotateCcw, Clock, ShoppingBag, Users, Calendar } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PERIODOS = [
  { label: 'Este mês', value: 'mes' },
  { label: 'Últimos 3 meses', value: '3meses' },
  { label: 'Últimos 6 meses', value: '6meses' },
  { label: 'Este ano', value: 'ano' },
  { label: 'Ano passado', value: 'anopassado' },
  { label: 'Tudo', value: 'tudo' },
]

function getRangeFromPeriodo(periodo) {
  const hoje = new Date()
  switch (periodo) {
    case 'mes': return { inicio: format(startOfMonth(hoje), 'yyyy-MM-dd'), fim: format(endOfMonth(hoje), 'yyyy-MM-dd') }
    case '3meses': return { inicio: format(startOfMonth(subMonths(hoje, 2)), 'yyyy-MM-dd'), fim: format(endOfMonth(hoje), 'yyyy-MM-dd') }
    case '6meses': return { inicio: format(startOfMonth(subMonths(hoje, 5)), 'yyyy-MM-dd'), fim: format(endOfMonth(hoje), 'yyyy-MM-dd') }
    case 'ano': return { inicio: format(startOfYear(hoje), 'yyyy-MM-dd'), fim: format(endOfYear(hoje), 'yyyy-MM-dd') }
    case 'anopassado': return { inicio: format(startOfYear(subYears(hoje, 1)), 'yyyy-MM-dd'), fim: format(endOfYear(subYears(hoje, 1)), 'yyyy-MM-dd') }
    default: return { inicio: null, fim: null }
  }
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl p-3 text-sm">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [periodo, setPeriodo] = useState('6meses')
  const [stats, setStats] = useState({ totalVendas: 0, totalComissoes: 0, totalEstornos: 0, pendente: 0, clientes: 0, vendas: 0 })
  const [chartData, setChartData] = useState([])
  const [pieData, setPieData] = useState([])
  const [proximasParcelas, setProximasParcelas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadAll()
  }, [user, periodo])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadStats(), loadChart(), loadPie(), loadProximas()])
    setLoading(false)
  }

  async function loadStats() {
    const { inicio, fim } = getRangeFromPeriodo(periodo)

    const [vendasRes, clientesRes] = await Promise.all([
      supabase.from('vendas').select('valor_venda').eq('user_id', user.id).eq('status', 'ativa'),
      supabase.from('clientes').select('id', { count: 'exact' }).eq('user_id', user.id),
    ])

    // Parcelas filtradas por período
    let parcelasQuery = supabase.from('parcelas_comissao').select('valor_bruto, valor_estorno, status').eq('user_id', user.id)
    if (inicio) parcelasQuery = parcelasQuery.gte('mes_referencia', inicio)
    if (fim) parcelasQuery = parcelasQuery.lte('mes_referencia', fim)
    const { data: parcelas } = await parcelasQuery

    // Estornos filtrados por período
    let estornosQuery = supabase.from('estornos').select('valor_estorno').eq('user_id', user.id)
    if (inicio) estornosQuery = estornosQuery.gte('data_estorno', inicio)
    if (fim) estornosQuery = estornosQuery.lte('data_estorno', fim)
    const { data: estornosData } = await estornosQuery

    const totalVendas = (vendasRes.data || []).reduce((s, v) => s + Number(v.valor_venda), 0)
    const totalComissoes = (parcelas || []).filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor_bruto), 0)
    const totalEstornos = (estornosData || []).reduce((s, e) => s + Number(e.valor_estorno), 0)
    const pendente = (parcelas || []).filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor_bruto), 0)

    setStats({
      totalVendas,
      totalComissoes,
      totalEstornos,
      pendente,
      clientes: clientesRes.count || 0,
      vendas: vendasRes.data?.length || 0,
    })
  }

  async function loadChart() {
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      meses.push({ mes: format(d, 'MMM/yy', { locale: ptBR }), inicio: format(startOfMonth(d), 'yyyy-MM-dd'), fim: format(endOfMonth(d), 'yyyy-MM-dd') })
    }

    const { data: parcelas } = await supabase
      .from('parcelas_comissao')
      .select('mes_referencia, valor_bruto, valor_estorno, status')
      .eq('user_id', user.id)

    const result = meses.map(({ mes, inicio, fim }) => {
      const p = (parcelas || []).filter(x => x.mes_referencia >= inicio && x.mes_referencia <= fim)
      const bruto = p.reduce((s, x) => s + Number(x.valor_bruto), 0)
      const estorno = p.reduce((s, x) => s + Number(x.valor_estorno), 0)
      const pago = p.filter(x => x.status === 'pago').reduce((s, x) => s + (Number(x.valor_bruto) - Number(x.valor_estorno)), 0)
      return { mes, bruto, estorno, liquido: bruto - estorno, pago }
    })

    setChartData(result)
  }

  async function loadPie() {
    const { data } = await supabase
      .from('vendas')
      .select('administradora_id, valor_venda, administradoras(nome)')
      .eq('user_id', user.id)
      .eq('status', 'ativa')

    const grouped = {}
    for (const v of data || []) {
      const nome = v.administradoras?.nome || 'Sem admin.'
      grouped[nome] = (grouped[nome] || 0) + Number(v.valor_venda)
    }

    setPieData(Object.entries(grouped).map(([name, value]) => ({ name, value })))
  }

  async function loadProximas() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('parcelas_comissao')
      .select('*, vendas(descricao, clientes(nome))')
      .eq('user_id', user.id)
      .eq('status', 'pendente')
      .gte('mes_referencia', hoje)
      .order('mes_referencia', { ascending: true })
      .limit(5)

    setProximasParcelas(data || [])
  }

  const StatCard = ({ icon: Icon, label, value, color, subtitle }) => (
    <div className="glass glass-hover rounded-2xl p-6 transition-all fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon size={22} style={{ color }} />
        </div>
      </div>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto mb-3" />
        <p className="text-gray-400">Carregando dados...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 fade-in">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Visão geral das suas comissões de consórcio</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <Calendar size={16} className="text-gray-400 flex-shrink-0" />
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodo(p.value)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0"
              style={periodo === p.value
                ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }
                : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={ShoppingBag} label="Total em Vendas" value={formatCurrency(stats.totalVendas)} color="#6366f1" subtitle={`${stats.vendas} vendas ativas`} />
        <StatCard icon={DollarSign} label="Total Comissões" value={formatCurrency(stats.totalComissoes)} color="#10b981" subtitle="Bruto gerado" />
        <StatCard icon={Clock} label="A Receber" value={formatCurrency(stats.pendente)} color="#f59e0b" subtitle="Parcelas pendentes" />
        <StatCard icon={RotateCcw} label="Total Estornos" value={formatCurrency(stats.totalEstornos)} color="#ef4444" subtitle="Devoluções" />
        <StatCard icon={TrendingUp} label="Líquido Total" value={formatCurrency(stats.totalComissoes - stats.totalEstornos)} color={stats.totalComissoes - stats.totalEstornos >= 0 ? "#06b6d4" : "#ef4444"} subtitle={stats.totalComissoes - stats.totalEstornos < 0 ? "⚠ Prejuízo no período" : "Recebido - Estornos"} />
        <StatCard icon={Users} label="Clientes" value={stats.clientes} color="#8b5cf6" subtitle="Cadastrados" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Comissões — Últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradLiquido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="bruto" name="Bruto" stroke="#6366f1" fill="url(#gradBruto)" strokeWidth={2} />
              <Area type="monotone" dataKey="liquido" name="Líquido" stroke="#10b981" fill="url(#gradLiquido)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Vendas por Administradora</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#111827', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Bar chart + Proximas */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Pago vs Pendente por Mês</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pago" name="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="estorno" name="Estorno" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Próximas parcelas */}
        <div className="glass rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Próximas Parcelas a Receber</h2>
          {proximasParcelas.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">Nenhuma parcela pendente</div>
          ) : (
            <div className="space-y-3">
              {proximasParcelas.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.vendas?.clientes?.nome || p.vendas?.descricao || 'Venda'}</p>
                    <p className="text-xs text-gray-500">
                      Parcela {p.numero_parcela} · {format(new Date(p.mes_referencia + 'T00:00:00'), "MMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-bold" style={{ color: '#10b981' }}>{formatCurrency(p.valor_bruto - p.valor_estorno)}</p>
                    <span className="status-badge status-pending" style={{ fontSize: 10 }}>Pendente</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
