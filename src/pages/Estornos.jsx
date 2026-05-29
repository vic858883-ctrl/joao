import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/commissions'
import { Plus, X, RotateCcw, AlertTriangle, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Estornos() {
  const { user } = useAuth()
  const [estornos, setEstornos] = useState([])
  const [vendas, setVendas] = useState([])
  const [parcelas, setParcelas] = useState([])
  const [vendaSelecionada, setVendaSelecionada] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    venda_id: '', parcela_id: 'geral', valor_estorno: '', motivo: '',
    data_estorno: format(new Date(), 'yyyy-MM-dd'), percentual_estorno: '',
    valor_estorno_revendedor: '', percentual_estorno_revendedor: ''
  })
  const [modoCalculo, setModoCalculo] = useState('percentual') // 'valor' ou 'percentual'

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    setLoading(true)
    const [e, v] = await Promise.all([
      supabase.from('estornos')
        .select('*, vendas(descricao, valor_venda, clientes(nome)), parcelas_comissao(numero_parcela, mes_referencia, valor_bruto)')
        .eq('user_id', user.id)
        .order('data_estorno', { ascending: false }),
      supabase.from('vendas')
        .select('id, descricao, valor_venda, percentual_comissao, meses_recebimento, clientes(nome), revendedor_id, percentual_revendedor, revendedores(nome)')
        .eq('user_id', user.id)
        .eq('status', 'ativa')
        .order('data_venda', { ascending: false }),
    ])
    setEstornos(e.data || [])
    setVendas(v.data || [])
    setLoading(false)
  }

  async function loadParcelas(vendaId) {
    const { data } = await supabase
      .from('parcelas_comissao')
      .select('id, numero_parcela, mes_referencia, valor_bruto, valor_estorno, status')
      .eq('venda_id', vendaId)
      .order('numero_parcela')
    setParcelas(data || [])
  }

  function onVendaChange(id) {
    const venda = vendas.find(v => v.id === id)
    setVendaSelecionada(venda || null)
    // Preencher automaticamente os percentuais se a venda tiver revendedor
    const pctRev = venda?.revendedor_id ? (Number(venda.percentual_revendedor) * 0.5).toFixed(2) : ''
    const valRev = pctRev && venda ? ((Number(pctRev) / 100) * Number(venda.valor_venda)).toFixed(2) : ''
    setForm(f => ({ ...f, venda_id: id, parcela_id: 'geral', valor_estorno: '', percentual_estorno: '', percentual_estorno_revendedor: pctRev, valor_estorno_revendedor: valRev }))
    if (id) loadParcelas(id)
    else setParcelas([])
  }

  function onPercentualChange(pct) {
    const venda = vendaSelecionada
    if (!venda) return
    const valor = ((Number(pct) / 100) * Number(venda.valor_venda)).toFixed(2)
    setForm(f => ({ ...f, percentual_estorno: pct, valor_estorno: valor }))
  }

  function onPercentualRevChange(pct) {
    const venda = vendaSelecionada
    if (!venda) return
    const valor = ((Number(pct) / 100) * Number(venda.valor_venda)).toFixed(2)
    setForm(f => ({ ...f, percentual_estorno_revendedor: pct, valor_estorno_revendedor: valor }))
  }

  function onValorChange(val) {
    const venda = vendaSelecionada
    const pct = venda ? ((Number(val) / Number(venda.valor_venda)) * 100).toFixed(4) : ''
    setForm(f => ({ ...f, valor_estorno: val, percentual_estorno: pct }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const valorEstorno = Number(form.valor_estorno)
      if (!valorEstorno || valorEstorno <= 0) throw new Error('Informe um valor de estorno válido')

      let parcelaId = form.parcela_id === 'geral' ? null : form.parcela_id

      // Buscar parcelas frescas do banco
      const { data: parcelasAtuais } = await supabase
        .from('parcelas_comissao')
        .select('*')
        .eq('venda_id', form.venda_id)
        .order('numero_parcela')

      // Cancelar parcelas PENDENTES da comissão
      await supabase.from('parcelas_comissao')
        .update({ status: 'estornado' })
        .eq('venda_id', form.venda_id)
        .eq('status', 'pendente')

      // Cancelar parcelas PENDENTES do revendedor também
      await supabase.from('parcelas_revendedor')
        .update({ status: 'pago' }) // marca como "pago" pois o revendedor devolveu
        .eq('venda_id', form.venda_id)
        .eq('status', 'pendente')

      // Aplicar o valor do estorno digitado na parcela selecionada (ou na primeira paga se for geral)
      if (parcelaId) {
        const parcela = parcelas.find(p => p.id === parcelaId)
        if (parcela) {
          const novoValorEstorno = Number(parcela.valor_estorno) + valorEstorno
          await supabase.from('parcelas_comissao')
            .update({ valor_estorno: novoValorEstorno })
            .eq('id', parcelaId)
        }
      } else {
        // Estorno geral: aplica na primeira parcela paga, se houver
        const paga = parcelas.find(p => p.status === 'pago')
        if (paga) {
          const novoValorEstorno = Number(paga.valor_estorno) + valorEstorno
          await supabase.from('parcelas_comissao')
            .update({ valor_estorno: novoValorEstorno })
            .eq('id', paga.id)
        }
      }

      // Registrar o estorno
      await supabase.from('estornos').insert({
        user_id: user.id,
        venda_id: form.venda_id,
        parcela_id: parcelaId,
        valor_estorno: valorEstorno,
        motivo: form.motivo,
        data_estorno: form.data_estorno,
      })

      setModal(false)
      setForm({ venda_id: '', parcela_id: 'geral', valor_estorno: '', motivo: '', data_estorno: format(new Date(), 'yyyy-MM-dd'), percentual_estorno: '' })
      setParcelas([])
      setVendaSelecionada(null)
      load()
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(estorno) {
    if (!confirm('Remover este estorno? O valor será restaurado na parcela.')) return
    if (estorno.parcela_id) {
      const { data: parcela } = await supabase.from('parcelas_comissao').select('*').eq('id', estorno.parcela_id).single()
      if (parcela) {
        const novoEstorno = Math.max(0, Number(parcela.valor_estorno) - Number(estorno.valor_estorno))
        const novoStatus = novoEstorno === 0 ? 'pendente' : 'estornado'
        await supabase.from('parcelas_comissao').update({ valor_estorno: novoEstorno, status: novoStatus }).eq('id', estorno.parcela_id)
      }
    }
    await supabase.from('estornos').delete().eq('id', estorno.id)
    load()
  }

  const totalEstornos = estornos.reduce((s, e) => s + Number(e.valor_estorno), 0)

  const parcelaLabel = (p) => {
    const mes = format(new Date(p.mes_referencia + 'T00:00:00'), "MMM/yy", { locale: ptBR })
    return `Parcela ${p.numero_parcela} — ${mes} (${formatCurrency(p.valor_bruto)})`
  }

  const comissaoTotal = vendaSelecionada
    ? (vendaSelecionada.valor_venda * vendaSelecionada.percentual_comissao / 100) * vendaSelecionada.meses_recebimento
    : 0

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Estornos</h1>
          <p className="text-gray-400 text-sm mt-1">Devoluções por inadimplência ou cancelamento</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}>
          <Plus size={18} /> Novo Estorno
        </button>
      </div>

      {/* Total */}
      <div className="glass rounded-2xl p-6 glow-danger flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <RotateCcw size={22} style={{ color: '#f87171' }} />
        </div>
        <div>
          <p className="text-gray-400 text-sm">Total devolvido em estornos</p>
          <p className="text-3xl font-bold" style={{ color: '#f87171' }}>{formatCurrency(totalEstornos)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-gray-500 text-sm">{estornos.length} estorno{estornos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Alert */}
      <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <AlertTriangle size={18} style={{ color: '#fbbf24' }} className="flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200">
          O estorno pode ser <strong>maior que a comissão recebida</strong> — quando o cliente cancela, você devolve um % sobre o valor total da venda, mesmo que ainda não tenha recebido todas as parcelas. Isso gera prejuízo real no mês do cancelamento.
        </p>
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">Carregando...</div>
        ) : estornos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <RotateCcw size={32} className="mb-2 opacity-30" />
            <p>Nenhum estorno registrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Venda / Cliente</th>
                  <th>Parcela afetada</th>
                  <th>Valor Estornado</th>
                  <th>Motivo</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {estornos.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div className="text-white font-medium">{e.vendas?.clientes?.nome || e.vendas?.descricao || '—'}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(e.vendas?.valor_venda)}</div>
                    </td>
                    <td className="text-gray-300">
                      {e.parcelas_comissao
                        ? `Parc. ${e.parcelas_comissao.numero_parcela} · ${format(new Date(e.parcelas_comissao.mes_referencia + 'T00:00:00'), "MMM/yy", { locale: ptBR })}`
                        : <span className="text-yellow-500">Geral (venda)</span>}
                    </td>
                    <td style={{ color: '#f87171' }} className="font-semibold">-{formatCurrency(e.valor_estorno)}</td>
                    <td className="text-gray-400">{e.motivo || '—'}</td>
                    <td className="text-gray-400">{format(new Date(e.data_estorno + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                    <td>
                      <button className="btn-danger btn-sm" onClick={() => handleDelete(e)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: '580px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Registrar Estorno</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Venda *</label>
                <select value={form.venda_id} onChange={e => onVendaChange(e.target.value)} required>
                  <option value="">Selecione a venda...</option>
                  {vendas.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.clientes?.nome || v.descricao || 'Sem nome'} — {formatCurrency(v.valor_venda)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Info da venda */}
              {vendaSelecionada && (
                <div className="p-3 rounded-xl text-sm grid grid-cols-3 gap-3 text-center" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div>
                    <p className="text-gray-500 text-xs">Valor venda</p>
                    <p className="text-white font-semibold">{formatCurrency(vendaSelecionada.valor_venda)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Comissão total</p>
                    <p className="text-indigo-400 font-semibold">{formatCurrency(comissaoTotal)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">% por mês</p>
                    <p className="text-white font-semibold">{vendaSelecionada.percentual_comissao}%</p>
                  </div>
                </div>
              )}

              {parcelas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Parcela afetada</label>
                  <select value={form.parcela_id} onChange={e => setForm(f => ({ ...f, parcela_id: e.target.value }))}>
                    <option value="geral">Estorno geral da venda (sem parcela específica)</option>
                    {parcelas.map(p => (
                      <option key={p.id} value={p.id}>{parcelaLabel(p)}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Selecione "geral" quando o cancelamento afeta a venda toda</p>
                </div>
              )}

              {/* Modo de cálculo */}
              {vendaSelecionada && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Calcular estorno por</label>
                  <div className="flex gap-2 mb-3">
                    <button type="button" onClick={() => setModoCalculo('valor')}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={modoCalculo === 'valor' ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' } : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                      Valor fixo (R$)
                    </button>
                    <button type="button" onClick={() => setModoCalculo('percentual')}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={modoCalculo === 'percentual' ? { background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white' } : { background: 'rgba(255,255,255,0.05)', color: '#9ca3af' }}>
                      % sobre a venda
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {modoCalculo === 'percentual' && (
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">% de estorno</label>
                        <input type="number" step="0.01" min="0" value={form.percentual_estorno}
                          onChange={e => onPercentualChange(e.target.value)}
                          placeholder="ex: 1.50" />
                        <p className="text-xs text-gray-500 mt-1">Ex: 1.5% de {formatCurrency(vendaSelecionada.valor_venda)}</p>
                      </div>
                    )}
                    <div className={modoCalculo === 'valor' ? 'col-span-2' : ''}>
                      <label className="block text-xs text-gray-400 mb-1">Valor do estorno (R$) *</label>
                      <input type="number" step="0.01" min="0.01" value={form.valor_estorno}
                        onChange={e => onValorChange(e.target.value)}
                        placeholder="0.00" required />
                      {vendaSelecionada && form.valor_estorno > comissaoTotal && (
                        <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                          ⚠ Estorno ({formatCurrency(form.valor_estorno)}) maior que comissão total ({formatCurrency(comissaoTotal)}) — prejuízo de {formatCurrency(form.valor_estorno - comissaoTotal)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!vendaSelecionada && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Valor do Estorno (R$) *</label>
                    <input type="number" step="0.01" min="0.01" value={form.valor_estorno} onChange={e => setForm(f => ({ ...f, valor_estorno: e.target.value }))} placeholder="0.00" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Data do Estorno *</label>
                    <input type="date" value={form.data_estorno} onChange={e => setForm(f => ({ ...f, data_estorno: e.target.value }))} required />
                  </div>
                </div>
              )}

              {/* Estorno do Revendedor */}
              {vendaSelecionada?.revendedor_id && (
                <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-sm font-semibold text-amber-300">Estorno do Revendedor — {vendaSelecionada.revendedores?.nome}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">% Estorno revendedor</label>
                      <input type="number" step="0.01" min="0" value={form.percentual_estorno_revendedor}
                        onChange={e => onPercentualRevChange(e.target.value)} placeholder="ex: 0.50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Valor que ele devolve (R$)</label>
                      <input type="number" step="0.01" min="0" value={form.valor_estorno_revendedor}
                        onChange={e => setForm(f => ({ ...f, valor_estorno_revendedor: e.target.value }))} placeholder="0.00" />
                    </div>
                  </div>
                  {form.valor_estorno_revendedor > 0 && (
                    <p className="text-xs text-amber-200">
                      O revendedor devolve {formatCurrency(form.valor_estorno_revendedor)} — suas parcelas pendentes dele serão canceladas automaticamente.
                    </p>
                  )}
                </div>
              )}

              {vendaSelecionada && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Data do Estorno *</label>
                  <input type="date" value={form.data_estorno} onChange={e => setForm(f => ({ ...f, data_estorno: e.target.value }))} required />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Motivo</label>
                <textarea value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                  placeholder="Cliente cancelou no 2º mês, inadimplência..." rows={2} style={{ resize: 'none' }} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saving}>
                  {saving ? 'Salvando...' : 'Registrar Estorno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
