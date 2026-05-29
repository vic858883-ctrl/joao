import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { gerarParcelas } from '../lib/commissions'
import { formatCurrency } from '../lib/commissions'
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X, Download } from 'lucide-react'
import { read, utils } from 'xlsx'
import { format, parse, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function parseDate(val) {
  if (!val) return null
  // Excel serial date
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return format(d, 'yyyy-MM-dd')
  }
  const str = String(val).trim()
  // dd/mm/yyyy
  const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'd/M/yyyy']
  for (const f of formats) {
    try {
      const d = parse(str, f, new Date())
      if (isValid(d)) return format(d, 'yyyy-MM-dd')
    } catch {}
  }
  return null
}

function parseMoney(val) {
  if (!val) return 0
  const str = String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  return Number(str) || 0
}

function parsePercent(val) {
  if (!val) return 0
  const str = String(val).replace('%', '').replace(',', '.').trim()
  return Number(str) || 0
}

export default function Importar() {
  const { user } = useAuth()
  const [preview, setPreview] = useState([])
  const [erros, setErros] = useState([])
  const [loading, setLoading] = useState(false)
  const [importado, setImportado] = useState(false)
  const [admins, setAdmins] = useState([])
  const [adminSelecionada, setAdminSelecionada] = useState('')
  const [arquivo, setArquivo] = useState(null)

  async function loadAdmins() {
    const { data } = await supabase.from('administradoras').select('*').eq('user_id', user.id)
    setAdmins(data || [])
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setArquivo(file.name)
    setImportado(false)
    setErros([])
    await loadAdmins()

    const buffer = await file.arrayBuffer()
    const wb = read(buffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Encontrar linha de cabeçalho (primeira linha com "Data" ou "Cliente")
    let headerIdx = 0
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i].map(c => String(c).toLowerCase())
      if (row.some(c => c.includes('data') || c.includes('cliente') || c.includes('valor'))) {
        headerIdx = i
        break
      }
    }

    const headers = rows[headerIdx].map(c => String(c).trim().toLowerCase())
    const dataRows = rows.slice(headerIdx + 1).filter(r => r.some(c => c !== ''))

    // Mapear colunas automaticamente
    const colIdx = {
      data: headers.findIndex(h => h.includes('data da venda') || h.includes('data')),
      cliente: headers.findIndex(h => h.includes('cliente')),
      valor: headers.findIndex(h => h.includes('valor do cr') || h.includes('crédito') || h.includes('credito')),
      percentual: headers.findIndex(h => h.includes('comiss') && h.includes('%') || h === '% comissão' || h === '% comissao'),
      parcelas: headers.findIndex(h => h.includes('nº da parcela') || h.includes('parcela') || h.includes('meses')),
      vendedor: headers.findIndex(h => h.includes('vendedor') || h.includes('vende')),
    }

    const itens = []
    const errosList = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const cliente = String(row[colIdx.cliente] || '').trim()
      const valor = parseMoney(row[colIdx.valor])
      const pct = parsePercent(row[colIdx.percentual])
      const data = parseDate(row[colIdx.data])
      const meses = Number(row[colIdx.parcelas]) || 6

      // Pular linha de total
      if (cliente.toLowerCase().includes('total') || (!cliente && !valor)) continue

      const erroLinha = []
      if (!cliente) erroLinha.push('sem cliente')
      if (!valor) erroLinha.push('sem valor')
      if (!data) erroLinha.push('data inválida')
      if (!pct) erroLinha.push('sem % comissão')

      if (erroLinha.length > 0) {
        errosList.push(`Linha ${i + 2}: ${erroLinha.join(', ')}`)
        continue
      }

      itens.push({
        cliente,
        valor,
        percentual: pct,
        data,
        meses,
        vendedor: String(row[colIdx.vendedor] || '').trim(),
        comissaoMes: (valor * pct) / 100,
        comissaoTotal: ((valor * pct) / 100) * meses,
      })
    }

    setPreview(itens)
    setErros(errosList)
  }

  async function handleImportar() {
    if (!adminSelecionada) { alert('Selecione a administradora antes de importar!'); return }
    setLoading(true)

    let ok = 0
    let fail = 0

    for (const item of preview) {
      try {
        // Criar ou encontrar cliente
        let clienteId = null
        const { data: clienteExist } = await supabase
          .from('clientes').select('id').eq('user_id', user.id).ilike('nome', item.cliente).single()

        if (clienteExist) {
          clienteId = clienteExist.id
        } else {
          const { data: novoCliente } = await supabase
            .from('clientes').insert({ user_id: user.id, nome: item.cliente }).select().single()
          clienteId = novoCliente?.id
        }

        // Criar venda
        const vendaPayload = {
          user_id: user.id,
          cliente_id: clienteId,
          administradora_id: adminSelecionada,
          valor_venda: item.valor,
          percentual_comissao: item.percentual,
          meses_recebimento: item.meses,
          data_venda: item.data,
          descricao: item.vendedor || null,
          status: 'ativa',
        }

        const { data: venda, error } = await supabase.from('vendas').insert(vendaPayload).select().single()
        if (error) throw error

        // Gerar parcelas
        const parcelas = gerarParcelas(venda)
        await supabase.from('parcelas_comissao').insert(parcelas)

        ok++
      } catch (err) {
        fail++
      }
    }

    setLoading(false)
    setImportado(true)
    alert(`Importação concluída!\n✓ ${ok} vendas importadas\n✗ ${fail} erros`)
  }

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar Excel</h1>
        <p className="text-gray-400 text-sm mt-1">Importe suas vendas diretamente do arquivo Excel</p>
      </div>

      {/* Upload */}
      <div className="glass rounded-2xl p-8">
        <label className="flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed rounded-xl p-10 transition-all"
          style={{ borderColor: 'rgba(99,102,241,0.3)' }}
          onDragOver={e => e.preventDefault()}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.15)' }}>
            <FileSpreadsheet size={32} style={{ color: '#818cf8' }} />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-lg">Clique para selecionar o arquivo</p>
            <p className="text-gray-400 text-sm mt-1">Suporta .xlsx e .xls</p>
            {arquivo && <p className="text-indigo-400 text-sm mt-2 font-medium">📄 {arquivo}</p>}
          </div>
          <input type="file" accept=".xlsx,.xls,.xlsm" onChange={handleFile} className="hidden" />
        </label>
      </div>

      {/* Colunas esperadas */}
      <div className="glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-gray-300 mb-3">Colunas reconhecidas automaticamente:</p>
        <div className="flex flex-wrap gap-2">
          {['Data da Venda', 'Cliente', 'Valor do Crédito', '% Comissão', 'Nº da Parcela', 'Vendedor'].map(c => (
            <span key={c} className="status-badge status-paid">{c}</span>
          ))}
        </div>
      </div>

      {/* Erros */}
      {erros.length > 0 && (
        <div className="glass rounded-2xl p-5" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
            <p className="text-amber-300 font-semibold">{erros.length} linha(s) ignoradas</p>
          </div>
          <div className="space-y-1">
            {erros.map((e, i) => <p key={i} className="text-xs text-gray-400">{e}</p>)}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">{preview.length} vendas encontradas</h2>
            <div className="flex items-center gap-3">
              <select value={adminSelecionada} onChange={e => setAdminSelecionada(e.target.value)} style={{ width: 'auto', paddingLeft: '12px' }}>
                <option value="">Selecione a administradora...</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
              <button className="btn-primary" onClick={handleImportar} disabled={loading || !adminSelecionada}>
                {loading ? 'Importando...' : <><Upload size={16} /> Importar tudo</>}
              </button>
            </div>
          </div>

          {importado && (
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <CheckCircle size={20} style={{ color: '#34d399' }} />
              <p className="text-emerald-300 font-semibold">Importação concluída! Veja suas vendas na aba Vendas.</p>
            </div>
          )}

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Valor da Venda</th>
                    <th>% Comissão</th>
                    <th>Meses</th>
                    <th>Comissão/mês</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((item, i) => (
                    <tr key={i}>
                      <td className="text-white font-medium">{item.cliente}</td>
                      <td className="text-gray-300">{item.data}</td>
                      <td className="text-white">{formatCurrency(item.valor)}</td>
                      <td style={{ color: '#818cf8' }}>{item.percentual}%</td>
                      <td className="text-gray-300">{item.meses}x</td>
                      <td style={{ color: '#818cf8' }}>{formatCurrency(item.comissaoMes)}</td>
                      <td style={{ color: '#10b981' }} className="font-semibold">{formatCurrency(item.comissaoTotal)}</td>
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
