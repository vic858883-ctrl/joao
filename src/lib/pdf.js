import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function gerarRelatorioPDF(parcelas, filtroMes, userName) {
  const doc = new jsPDF()

  // Header
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, 210, 35, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ConsórcioPRO', 14, 15)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Relatório de Comissões', 14, 23)

  const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  doc.setFontSize(9)
  doc.text(`Gerado em: ${dataGeracao}`, 14, 30)

  if (filtroMes) {
    const mesLabel = format(new Date(filtroMes + '-01T00:00:00'), "MMMM 'de' yyyy", { locale: ptBR })
    doc.text(`Período: ${mesLabel}`, 120, 30)
  }

  // Totais
  const totalBruto = parcelas.reduce((s, p) => s + Number(p.valor_bruto), 0)
  const totalEstorno = parcelas.reduce((s, p) => s + Number(p.valor_estorno || 0), 0)
  const totalLiquido = totalBruto - totalEstorno
  const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor_liquido || p.valor_bruto), 0)
  const totalPendente = parcelas.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor_bruto), 0)

  // Cards de totais
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(9)

  const cards = [
    { label: 'Total Bruto', value: formatMoney(totalBruto), color: [99, 102, 241] },
    { label: 'Total Estornos', value: formatMoney(totalEstorno), color: [239, 68, 68] },
    { label: 'Líquido Total', value: formatMoney(totalLiquido), color: [6, 182, 212] },
    { label: 'A Receber', value: formatMoney(totalPendente), color: [245, 158, 11] },
  ]

  cards.forEach((card, i) => {
    const x = 14 + (i * 46)
    doc.setFillColor(...card.color)
    doc.roundedRect(x, 42, 42, 18, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.text(card.label, x + 3, 49)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(card.value, x + 3, 56)
    doc.setFont('helvetica', 'normal')
  })

  // Tabela
  doc.setTextColor(0, 0, 0)

  const rows = parcelas.map(p => [
    p.vendas?.clientes?.nome || p.vendas?.descricao || '—',
    p.vendas?.administradoras?.nome || '—',
    String(p.numero_parcela),
    p.mes_referencia ? format(new Date(p.mes_referencia + 'T00:00:00'), "MMM/yy", { locale: ptBR }) : '—',
    formatMoney(p.valor_bruto),
    p.valor_estorno > 0 ? `-${formatMoney(p.valor_estorno)}` : '—',
    formatMoney(p.valor_liquido || p.valor_bruto),
    p.status === 'pago' ? 'Pago' : p.status === 'pendente' ? 'Pendente' : 'Estornado',
  ])

  autoTable(doc, {
    startY: 68,
    head: [['Cliente', 'Administradora', 'Parc.', 'Mês', 'Bruto', 'Estorno', 'Líquido', 'Status']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 241],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 30 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
      7: { cellWidth: 20, halign: 'center' },
    },
    didDrawCell: (data) => {
      if (data.column.index === 7 && data.section === 'body') {
        const status = data.cell.raw
        if (status === 'Pago') data.cell.styles.textColor = [16, 185, 129]
        if (status === 'Pendente') data.cell.styles.textColor = [245, 158, 11]
        if (status === 'Estornado') data.cell.styles.textColor = [239, 68, 68]
      }
    },
  })

  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' })
    doc.text('ConsórcioPRO — Sistema de Gestão de Comissões', 105, 295, { align: 'center' })
  }

  const nomeArquivo = filtroMes
    ? `comissoes_${filtroMes}.pdf`
    : `comissoes_${format(new Date(), 'yyyy-MM-dd')}.pdf`

  doc.save(nomeArquivo)
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}
