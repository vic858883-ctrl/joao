import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/commissions'
import { Plus, Search, Trash2, Users, X } from 'lucide-react'

export default function Clientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nome: '', cpf: '', telefone: '', email: '' })

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('clientes')
      .select('*, vendas(id, valor_venda, status)')
      .eq('user_id', user.id)
      .order('nome')
    setClientes(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from('clientes').insert({ ...form, user_id: user.id })
      if (error) throw error
      setModal(false)
      setForm({ nome: '', cpf: '', telefone: '', email: '' })
      load()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Excluir cliente? Isso não remove as vendas vinculadas.')) return
    await supabase.from('clientes').delete().eq('id', id)
    load()
  }

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.cpf?.includes(search)
  )

  const totalVendas = (c) => (c.vendas || []).filter(v => v.status === 'ativa').reduce((s, v) => s + Number(v.valor_venda), 0)

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 text-sm mt-1">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} cadastrado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={18} /> Novo Cliente
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou CPF..." style={{ paddingLeft: '36px' }} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-40 text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center h-40 text-gray-500">
            <Users size={32} className="mb-2 opacity-30" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="glass glass-hover rounded-2xl p-5 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  {c.nome[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold">{c.nome}</p>
                  {c.cpf && <p className="text-xs text-gray-500">{c.cpf}</p>}
                </div>
              </div>
              <button className="text-gray-600 hover:text-red-400 transition-colors" onClick={() => handleDelete(c.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            {c.email && <p className="text-sm text-gray-400 mb-1">✉ {c.email}</p>}
            {c.telefone && <p className="text-sm text-gray-400 mb-3">📱 {c.telefone}</p>}
            <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{(c.vendas || []).length} venda{(c.vendas || []).length !== 1 ? 's' : ''}</span>
                <span style={{ color: '#10b981' }} className="font-semibold">{formatCurrency(totalVendas(c))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Novo Cliente</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome completo *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="João da Silva" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">CPF</label>
                  <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cliente@email.com" />
              </div>
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
