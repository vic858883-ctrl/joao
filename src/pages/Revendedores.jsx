import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatPercent } from '../lib/commissions'
import { Plus, Trash2, Users2, X, Edit2, Check, CheckCircle, Clock, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Revendedores() {
  const { user } = useAuth()
  const [tab, setTab] = useState('revendedores') // 'revendedores' | 'comissoes'
  const [revendedores, setRevendedores] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', percentual_comissao: 2.50 })

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [r, p] = await Promise.all([
      supabase.from('revendedores').select('*, vendas(id)').eq('user_id', user.id).order('nome'),
      supabase.from('parcelas_revendedor')
        .select('*, revendedores(nome), vendas(descricao, valor_venda, clientes(nome))')
        .eq('user_id', user.id)
        .order('mes_referencia', { ascending: false }),
    ])
    setRevendedores(r.data || [])
    setParcelas(p.data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('revendedores').insert({
        ...form,
        user_id: user.id,
        percentual_comissao: Number(form.percentual_comissao),
      })
      if (error) throw error
      setModal(false)
      setForm({ nome: '', telefone: '', email: '', percentual_comissao: 2.50 })
      loadAll()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir revendedor?')) return
    await supabase.from('revendedores').delete().eq('id', id)
    loadAll()
  }

  async function handleEdit(id) {
    await supabase.from('revendedores').update({
      nome: editValues.nome,
      percentual_comissao: Number(editValues.percentual_comissao),
      telefone: editValues.telefone,
      email: editValues.email,
    }).eq('id', id)
    setEditId(null)
    loadAll()
  }

  async function marcarPago(parcela) {
    await supabase.from('parcelas_revendedor')
      .update({ status: 'pago', data_pagamento: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', parcela.id)
    loadAll()
  }

  async function marcarPendente(parcela) {
    await supabase.from('parcelas_revendedor')
      .update({ status: 'pendente', data_pagamento: null })
      .eq('id', parcela.id)
    loadAll()
  }

  const parcelasFiltradas = parcelas.filter(p =>
    filtroStatus === 'todos' ? true : p.status === filtroStatus
  )

  const totalAPagar = parcelas.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor_bruto), 0)
  const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor_bruto), 0)

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Revendedores</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie sua equipe e comissões a pagar</p>
        </div>
        {tab === 'revendedores' && (
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus size={18} /> Novo Revendedor
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'revendedores', label: 'Revendedores' },
          { key: 'comissoes', label: 'Comissões a Pagar' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={tab === t.key
              ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }
              : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
            }>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Revendedores */}
      {tab === 'revendedores' && (
        <div className="glass rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">Carregando...</div>
          ) : revendedores.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <Users2 size={32} className="mb-2 opacity-30" />
              <p>Nenhum revendedor cadastrado</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  <th>% Comissão</th>
                  <th>Vendas</th>
                  <th>A Pagar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {revendedores.map(r => {
                  const parcelasR = parcelas.filter(p => p.revendedor_id === r.id)
                  const aPagar = parcelasR.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor_bruto), 0)
                  return (
                    <tr key={r.id}>
                      <td>
                        {editId === r.id ? (
                          <input value={editValues.nome} onChange={e => setEditValues(v => ({ ...v, nome: e.target.value }))} style={{ width: '150px', padding: '6px 10px' }} />
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                              {r.nome[0].toUpperCase()}
                            </div>
                            <span className="text-white font-medium">{r.nome}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {editId === r.id ? (
                          <input value={editValues.telefone} onChange={e => setEditValues(v => ({ ...v, telefone: e.target.value }))} placeholder="Telefone" style={{ width: '130px', padding: '6px 10px' }} />
                        ) : (
                          <span className="text-gray-400">{r.telefone || r.email || '—'}</span>
                        )}
                      </td>
                      <td>
                        {editId === r.id ? (
                          <input type="number" step="0.01" value={editValues.percentual_comissao} onChange={e => setEditValues(v => ({ ...v, percentual_comissao: e.target.value }))} style={{ width: '80px', padding: '6px 10px' }} />
                        ) : (
                          <span style={{ color: '#818cf8' }} className="font-semibold">{formatPercent(r.percentual_comissao)}</span>
                        )}
                      </td>
                      <td className="text-gray-400">{(r.vendas || []).length}</td>
                      <td style={{ color: aPagar > 0 ? '#f59e0b' : '#10b981' }} className="font-semibold">{formatCurrency(aPagar)}</td>
                      <td>
                        <div className="flex gap-2">
                          {editId === r.id ? (
                            <>
                              <button className="btn-primary btn-sm" onClick={() => handleEdit(r.id)}><Check size={14} /></button>
                              <button className="btn-secondary btn-sm" onClick={() => setEditId(null)}><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              <button className="btn-secondary btn-sm" onClick={() => { setEditId(r.id); setEditValues({ nome: r.nome, percentual_comissao: r.percentual_comissao, telefone: r.telefone || '', email: r.email || '' }) }}><Edit2 size={14} /></button>
                              <button className="btn-danger btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab Comissões */}
      {tab === 'comissoes' && (
        <div className="space-y-4">
          {/* Totais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5">
              <p className="text-gray-400 text-sm">A Pagar (pendente)</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#f59e0b' }}>{formatCurrency(totalAPagar)}</p>
            </div>
            <div className="glass rounded-2xl p-5">
              <p className="text-gray-400 text-sm">Total Pago</p>
              <p className="text-2xl font-bold mt-1" style={{ color: '#10b981' }}>{formatCurrency(totalPago)}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            <Filter size={16} className="text-gray-400 mt-2" />
            {['todos', 'pendente', 'pago'].map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize"
                style={filtroStatus === s
                  ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
                }>
                {s === 'todos' ? 'Todos' : s === 'pendente' ? 'A Pagar' : 'Pago'}
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {parcelasFiltradas.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-500">Nenhuma comissão encontrada</div>
            ) : (
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Revendedor</th>
                      <th>Venda / Cliente</th>
                      <th>Parc.</th>
                      <th>Mês Ref.</th>
                      <th>A Pagar</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelasFiltradas.map(p => (
                      <tr key={p.id}>
                        <td className="text-white font-medium">{p.revendedores?.nome || '—'}</td>
                        <td>
                          <div className="text-gray-300">{p.vendas?.clientes?.nome || p.vendas?.descricao || '—'}</div>
                          <div className="text-xs text-gray-500">{formatCurrency(p.vendas?.valor_venda)}</div>
                        </td>
                        <td className="text-gray-400">{p.numero_parcela}</td>
                        <td className="text-gray-300 capitalize">
                          {format(new Date(p.mes_referencia + 'T00:00:00'), "MMM 'de' yyyy", { locale: ptBR })}
                        </td>
                        <td style={{ color: '#f59e0b' }} className="font-semibold">{formatCurrency(p.valor_bruto)}</td>
                        <td>
                          <span className={`status-badge ${p.status === 'pendente' ? 'status-pending' : 'status-paid'}`}>
                            {p.status === 'pendente' ? 'A Pagar' : 'Pago'}
                          </span>
                        </td>
                        <td>
                          {p.status === 'pendente' ? (
                            <button className="btn-secondary btn-sm" onClick={() => marcarPago(p)}>
                              <CheckCircle size={14} /> Pago
                            </button>
                          ) : (
                            <button className="btn-danger btn-sm" onClick={() => marcarPendente(p)}>
                              <Clock size={14} /> Reverter
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
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Novo Revendedor</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome do revendedor" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@..." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">% Comissão *</label>
                <input type="number" step="0.01" min="0" max="100" value={form.percentual_comissao} onChange={e => setForm(f => ({ ...f, percentual_comissao: e.target.value }))} placeholder="2.50" required />
                <p className="text-xs text-gray-500 mt-1">Porcentagem sobre o valor da venda</p>
              </div>

              {form.percentual_comissao && (
                <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-indigo-300">
                    Exemplo: venda de R$ 100.000 → revendedor recebe <strong>R$ {((100000 * form.percentual_comissao) / 100).toFixed(2)}/mês</strong>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
