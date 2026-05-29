import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatPercent } from '../lib/commissions'
import { Plus, Trash2, Building2, X, Edit2, Check } from 'lucide-react'

export default function Administradoras() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [form, setForm] = useState({ nome: '', percentual_comissao: '', meses_recebimento: 6 })

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('administradoras')
      .select('*, vendas(id)')
      .eq('user_id', user.id)
      .order('nome')
    setAdmins(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('administradoras').insert({
        ...form,
        user_id: user.id,
        percentual_comissao: Number(form.percentual_comissao),
        meses_recebimento: Number(form.meses_recebimento),
      })
      if (error) throw error
      setModal(false)
      setForm({ nome: '', percentual_comissao: '', meses_recebimento: 6 })
      load()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir administradora?')) return
    await supabase.from('administradoras').delete().eq('id', id)
    load()
  }

  async function handleEdit(id) {
    const { error } = await supabase.from('administradoras').update({
      nome: editValues.nome,
      percentual_comissao: Number(editValues.percentual_comissao),
      meses_recebimento: Number(editValues.meses_recebimento),
    }).eq('id', id)
    if (!error) { setEditId(null); load() }
  }

  function startEdit(a) {
    setEditId(a.id)
    setEditValues({ nome: a.nome, percentual_comissao: a.percentual_comissao, meses_recebimento: a.meses_recebimento })
  }

  const EXEMPLOS = [
    { nome: 'Porto Seguro', percentual_comissao: 0.75, meses_recebimento: 6 },
    { nome: 'Embracon', percentual_comissao: 1.00, meses_recebimento: 8 },
    { nome: 'Magalu Consórcio', percentual_comissao: 0.50, meses_recebimento: 6 },
    { nome: 'Itaú Consórcio', percentual_comissao: 0.25, meses_recebimento: 6 },
    { nome: 'Caixa Consórcio', percentual_comissao: 1.50, meses_recebimento: 8 },
  ]

  async function addExemplo(ex) {
    await supabase.from('administradoras').insert({ ...ex, user_id: user.id })
    load()
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Administradoras</h1>
          <p className="text-gray-400 text-sm mt-1">Configure as regras de comissão por administradora</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={18} /> Nova Administradora
        </button>
      </div>

      {/* Atalhos */}
      {admins.length === 0 && !loading && (
        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-gray-400 mb-3 font-medium">Adicionar exemplos rápidos:</p>
          <div className="flex flex-wrap gap-2">
            {EXEMPLOS.map(ex => (
              <button key={ex.nome} onClick={() => addExemplo(ex)} className="btn-secondary btn-sm">
                + {ex.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Carregando...</div>
        ) : admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <Building2 size={32} className="mb-2 opacity-30" />
            <p>Nenhuma administradora cadastrada</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>% Comissão/mês</th>
                <th>Meses de recebimento</th>
                <th>Total Comissão (por venda)</th>
                <th>Vendas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id}>
                  <td>
                    {editId === a.id ? (
                      <input value={editValues.nome} onChange={e => setEditValues(v => ({ ...v, nome: e.target.value }))} style={{ width: '160px', padding: '6px 10px' }} />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                          {a.nome[0]}
                        </div>
                        <span className="text-white font-medium">{a.nome}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    {editId === a.id ? (
                      <input type="number" step="0.01" value={editValues.percentual_comissao} onChange={e => setEditValues(v => ({ ...v, percentual_comissao: e.target.value }))} style={{ width: '80px', padding: '6px 10px' }} />
                    ) : (
                      <span style={{ color: '#818cf8' }} className="font-semibold">{formatPercent(a.percentual_comissao)}</span>
                    )}
                  </td>
                  <td>
                    {editId === a.id ? (
                      <select value={editValues.meses_recebimento} onChange={e => setEditValues(v => ({ ...v, meses_recebimento: e.target.value }))} style={{ width: '100px' }}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m} meses</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-300">{a.meses_recebimento} meses</span>
                    )}
                  </td>
                  <td>
                    <span style={{ color: '#10b981' }} className="text-sm">
                      {formatPercent(a.percentual_comissao * a.meses_recebimento)} do valor
                    </span>
                  </td>
                  <td className="text-gray-400">{(a.vendas || []).length}</td>
                  <td>
                    <div className="flex gap-2">
                      {editId === a.id ? (
                        <>
                          <button className="btn-primary btn-sm" onClick={() => handleEdit(a.id)}><Check size={14} /></button>
                          <button className="btn-secondary btn-sm" onClick={() => setEditId(null)}><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <button className="btn-secondary btn-sm" onClick={() => startEdit(a)}><Edit2 size={14} /></button>
                          <button className="btn-danger btn-sm" onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Nova Administradora</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome da Administradora *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Porto Seguro, Embracon..." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">% Comissão/mês *</label>
                  <input type="number" step="0.01" min="0.01" max="10" value={form.percentual_comissao} onChange={e => setForm(f => ({ ...f, percentual_comissao: e.target.value }))} placeholder="0.75" required />
                  <p className="text-xs text-gray-500 mt-1">Entre 0,25% e 1,50%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Meses de recebimento *</label>
                  <select value={form.meses_recebimento} onChange={e => setForm(f => ({ ...f, meses_recebimento: Number(e.target.value) }))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m} meses</option>)}
                  </select>
                </div>
              </div>

              {form.percentual_comissao && form.meses_recebimento && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-xs text-indigo-300">
                    Exemplo: venda de R$ 100.000 → <strong>R$ {((100000 * form.percentual_comissao) / 100).toFixed(2)}/mês</strong> por {form.meses_recebimento} meses = <strong>R$ {(((100000 * form.percentual_comissao) / 100) * form.meses_recebimento).toFixed(2)}</strong> total
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
