import { addMonths, startOfMonth, format } from 'date-fns'

/**
 * Gera as parcelas de comissão para uma venda.
 * A primeira parcela cai no mesmo mês da venda.
 * Parcelas seguintes somam 1 mês cada.
 */
export function gerarParcelas(venda) {
  const parcelas = []
  const valorBruto = (venda.valor_venda * venda.percentual_comissao) / 100
  const dataBase = startOfMonth(new Date(venda.data_venda + 'T00:00:00'))

  for (let i = 0; i < venda.meses_recebimento; i++) {
    const mesRef = addMonths(dataBase, i)
    parcelas.push({
      venda_id: venda.id,
      user_id: venda.user_id,
      numero_parcela: i + 1,
      mes_referencia: format(mesRef, 'yyyy-MM-dd'),
      valor_bruto: Number(valorBruto.toFixed(2)),
      valor_estorno: 0,
      status: 'pendente',
    })
  }

  return parcelas
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}

export function formatPercent(value) {
  return `${Number(value ?? 0).toFixed(2)}%`
}
