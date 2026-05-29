import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { gerarParcelas, formatCurrency, formatPercent } from '../lib/commissions'
import { Plus, Search, Trash2, Eye, X, ShoppingBag, Edit2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_LABELS = { ativa: 'Ativa', cancelada: 'Cancelada' }

export default function Vendas() {
  const { user } = useAuth()
  const [vendas, setVendas] = useState([])
  const [clientes, setClientes] = useState([])
  const [admins, setAdmins] = useState([])
  const [revendedores, setRevendedores] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editVenda, setEditVenda] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    cliente_id: '', administradora_id: '', valor_venda: '',
    percentual_comissao: '', meses_recebimento: 6, data_venda: format(new Date(), 'yyyy-MM-dd'),
    descricao: '', revendedor_id: '', percentual_revendedor: ''
  })

  useEffect(() => { if (user) loadAll() }, [user])

  async function loadAll() {
    setLoading(true)
    const [v, c, a, r] = await Promise.all([
      supabase.from('vendas').select('*, clientes(nome), administradoras(nome), revendedores(nome)').eq('user_id', user.id).order('data_venda', { ascending: false }),
      supabase.from('clientes').select('id, nome').eq('user_id', user.id).order('nome'),
      supabase.from('administradoras').select('*').eq('user_id', user.id).order('nome'),
      supabase.from('revendedores').select('id, nome, percentual_comissao').eq('user_id', user.id).order('nome'),
    ])
    setVendas(v.data || [])
    setClientes(c.data || [])
    setAdmins(a.data || [])
    setRevendedores(r.data || [])
    setLoading(false)
  }

  function onAdminChange(id) {
    const admin = admins.find(a => a.id === id)
    setForm(f => ({
      ...f,
      administradora_id: id,
      percentual_comissao: admin ? admin.percentual_comissao : f.percentual_comissao,
      meses_recebimento: admin ? admin.meses_recebimento : f.meses_recebimento,
    }))
  }

  function abrirEditar(venda) {
    setEditVenda(venda)
    setForm({
      cliente_id: venda.cliente_id || '',
      administradora_id: venda.administradora_id || '',
      valor_venda: venda.valor_venda,
      percentual_comissao: venda.percentual_comissao,
      meses_recebimento: venda.meses_recebimento,
      data_venda: venda.data_venda,
      descricao: venda.descricao || '',
    })
    setModal(true)
  }

  function fecharModal() {
    setModal(false)
    setEditVenda(null)
    setForm({ cliente_id: '', administradora_id: '', valor_venda: '', percentual_comissao: '', meses_recebimento: 6, data_venda: format(new Date(), 'yyyy-MM-dd'), descricao: '' })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        user_id: user.id,
        valor_venda: Number(form.valor_venda),
        percentual_comissao: Number(form.percentual_comissao),
        meses_recebimento: Number(form.meses_recebimento),
        cliente_id: form.cliente_id || null,
        administradora_id: form.administradora_id || null,
        status: 'ativa',
      }

      if (editVenda) {
        // Editar venda existente
        const { error } = await supabase.from('vendas').update(payload).eq('id', editVenda.id)
        if (error) throw error

        // Recriar parcelas se valor/% ou meses mudaram
        const valorMudou = Number(form.valor_venda) !== Number(editVenda.valor_venda)
        const pctMudou = Number(form.percentual_comissao) !== Number(editVenda.percentual_comissao)
        const mesesMudou = Number(form.meses_recebimento) !== Number(editVenda.meses_recebimento)

        if (valorMudou || pctMudou || mesesMudou) {
          // Apagar apenas parcelas pendentes e recriar
          await supabase.from('parcelas_comissao').delete().eq('venda_id', editVenda.id).eq('status', 'pendente')
          const vendaAtualizada = { ...editVenda, ...payload }
          const { data: parcelasExist } = await supabase.from('parcelas_comissao').select('numero_parcela').eq('venda_id', editVenda.id).order('numero_parcela', { ascending: false }).limit(1)
          const ultimaParcela = parcelasExist?.[0]?.numero_parcela || 0
          const novasParcelas = gerarParcelas(vendaAtualizada).slice(ultimaParcela)
          if (novasParcelas.length > 0) {
            await supabase.from('parcelas_comissao').insert(novasParcelas)
          }
        }
      } else {
        // Nova venda
        const { data, error } = await supabase.from('vendas').insert(payload).select().single()
        if (error) throw error

        // Gerar parcelas da comissão
        const parcelas = gerarParcelas(data)
        const { error: pErr } = await supabase.from('parcelas_comissao').insert(parcelas)
        if (pErr) throw pErr

        // Gerar parcelas do revendedor se houver
        if (payload.revendedor_id && payload.percentual_revendedor > 0) {
          const valorParcelaRev = (Number(payload.valor_venda) * Number(payload.percentual_revendedor)) / 100
          const { addMonths, startOfMonth, format: fmt } = await import('date-fns')
          const parcelasRev = []
          const dataBase = startOfMonth(new Date(payload.data_venda + 'T00:00:00'))
          for (let i = 0; i < Number(payload.meses_recebimento); i++) {
            const mesRef = addMonths(dataBase, i)
            parcelasRev.push({
              user_id: user.id,
              venda_id: data.id,
              revendedor_id: payload.revendedor_id,
              numero_parcela: i + 1,
              mes_referencia: fmt(mesRef, 'yyyy-MM-dd'),
              valor_bruto: Number(valorParcelaRev.toFixed(2)),
              status: 'pendente',
            })
          }
          await supabase.from('parcelas_revendedor').insert(parcelasRev)
        }
      }

      fecharModal()
      loadAll()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(venda) {
    if (!confirm(`Excluir venda de ${formatCurrency(venda.valor_venda)}? Isso removerá todas as parcelas.`)) return
    await supabase.from('parcelas_comissao').delete().eq('venda_id', venda.id)
    await supabase.from('vendas').delete().eq('id', venda.id)
    loadAll()
  }

  async function abrirDetalhe(venda) {
    const { data } = await supabase
      .from('parcelas_comissao')
      .select('*')
      .eq('venda_id', venda.id)
      .order('numero_parcela')
    setDetalhe({ venda, parcelas: data || [] })
  }

  const filtered = vendas.filter(v =>
    v.clientes?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    v.descricao?.toLowerCase().includes(search.toLowerCase()) ||
    v.administradoras?.nome?.toLowerCase().includes(search.toLowerCase())
  )

  const comissaoTotal = (v) => ((v.valor_venda * v.percentual_comissao) / 100) * v.meses_recebimento

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendas</h1>
          <p className="text-gray-400 text-sm mt-1">Registre e gerencie suas vendas de consórcio</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={18} /> Nova Venda
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente, descrição ou administradora..." style={{ paddingLeft: '36px' }} />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <ShoppingBag size={32} className="mb-2 opacity-30" />
            <p>Nenhuma venda encontrada</p>
            <button className="btn-primary mt-3 btn-sm" onClick={() => setModal(true)}>Registrar primeira venda</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Administradora</th>
                  <th>Valor Venda</th>
                  <th>Comissão/mês</th>
                  <th>Meses</th>
                  <th>Total Comissão</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id}>
                    <td className="text-white font-medium">{v.clientes?.nome || v.descricao || '—'}</td>
                    <td className="text-gray-300">{v.administradoras?.nome || '—'}</td>
                    <td className="text-white font-semibold">{formatCurrency(v.valor_venda)}</td>
                    <td style={{ color: '#818cf8' }}>{formatCurrency((v.valor_venda * v.percentual_comissao) / 100)} <span className="text-gray-500 text-xs">({formatPercent(v.percentual_comissao)})</span></td>
                    <td className="text-gray-300">{v.meses_recebimento}x</td>
                    <td style={{ color: '#10b981' }} className="font-semibold">{formatCurrency(comissaoTotal(v))}</td>
                    <td className="text-gray-400">{format(new Date(v.data_venda + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                    <td><span className={`status-badge ${v.status === 'ativa' ? 'status-active' : 'status-reversed'}`}>{STATUS_LABELS[v.status]}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-secondary btn-sm" onClick={() => abrirDetalhe(v)}><Eye size={14} /></button>
                        <button className="btn-secondary btn-sm" onClick={() => abrirEditar(v)}><Edit2 size={14} /></button>
                        <button className="btn-danger btn-sm" onClick={() => handleDelete(v)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nova venda */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editVenda ? 'Editar Venda' : 'Nova Venda'}</h2>
              <button onClick={fecharModal} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
                  <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Administradora *</label>
                  <select value={form.administradora_id} onChange={e => onAdminChange(e.target.value)} required>
                    <option value="">Selecione...</option>
                    {admins.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descrição (opcional)</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Consórcio imóvel, carro..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Valor da Venda (R$) *</label>
                  <input type="number" step="0.01" min="0" value={form.valor_venda} onChange={e => setForm(f => ({ ...f, valor_venda: e.target.value }))} placeholder="100000.00" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Data da Venda *</label>
                  <input type="date" value={form.data_venda} onChange={e => setForm(f => ({ ...f, data_venda: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">% Comissão/mês *</label>
                  <input type="number" step="0.01" min="0.01" max="10" value={form.percentual_comissao} onChange={e => setForm(f => ({ ...f, percentual_comissao: e.target.value }))} placeholder="0.75" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Meses de recebimento *</label>
                  <select value={form.meses_recebimento} onChange={e => setForm(f => ({ ...f, meses_recebimento: Number(e.target.value) }))}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m} meses</option>)}
                  </select>
                </div>
              </div>

              {/* Revendedor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Revendedor</label>
                  <select value={form.revendedor_id} onChange={e => {
                    const rev = revendedores.find(r => r.id === e.target.value)
                    setForm(f => ({ ...f, revendedor_id: e.target.value, percentual_revendedor: rev ? rev.percentual_comissao : '' }))
                  }}>
                    <option value="">Sem revendedor</option>
                    {revendedores.map(r => <option key={r.id} value={r.id}>{r.nome} ({r.percentual_comissao}%)</option>)}
                  </select>
                </div>
                {form.revendedor_id && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">% Comissão Revendedor</label>
                    <input type="number" step="0.01" min="0" value={form.percentual_revendedor} onChange={e => setForm(f => ({ ...f, percentual_revendedor: e.target.value }))} placeholder="2.50" />
                  </div>
                )}
              </div>

              {/* Preview */}
              {form.valor_venda && form.percentual_comissao && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">Preview das comissões</p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Sua comissão/mês</p>
                      <p className="text-base font-bold text-indigo-400">{formatCurrency((form.valor_venda * form.percentual_comissao) / 100)}</p>
                    </div>
                    {form.revendedor_id && form.percentual_revendedor && (
                      <div>
                        <p className="text-xs text-gray-500">Revendedor/mês</p>
                        <p className="text-base font-bold text-red-400">-{formatCurrency((form.valor_venda * form.percentual_revendedor) / 100)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500">Meses</p>
                      <p className="text-base font-bold text-white">{form.meses_recebimento}x</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Seu lucro total</p>
                      <p className="text-base font-bold text-emerald-400">
                        {formatCurrency((((form.valor_venda * form.percentual_comissao) / 100) - ((form.valor_venda * (form.percentual_revendedor || 0)) / 100)) * form.meses_recebimento)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? 'Salvando...' : editVenda ? 'Salvar alterações' : 'Registrar Venda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal detalhe parcelas */}
      {detalhe && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetalhe(null)}>
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Parcelas da Venda</h2>
                <p className="text-gray-400 text-sm">{detalhe.venda.clientes?.nome || detalhe.venda.descricao} · {formatCurrency(detalhe.venda.valor_venda)}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Mês Ref.</th>
                    <th>Bruto</th>
                    <th>Estorno</th>
                    <th>Líquido</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhe.parcelas.map(p => (
                    <tr key={p.id}>
                      <td className="text-gray-400">{p.numero_parcela}</td>
                      <td className="text-white">{format(new Date(p.mes_referencia + 'T00:00:00'), "MMM 'de' yyyy", { locale: ptBR })}</td>
                      <td className="text-indigo-400 font-medium">{formatCurrency(p.valor_bruto)}</td>
                      <td style={{ color: p.valor_estorno > 0 ? '#f87171' : '#6b7280' }}>{formatCurrency(p.valor_estorno)}</td>
                      <td className="text-emerald-400 font-semibold">{formatCurrency(p.valor_liquido)}</td>
                      <td><span className={`status-badge status-${p.status === 'pendente' ? 'pending' : p.status === 'pago' ? 'paid' : 'reversed'}`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
