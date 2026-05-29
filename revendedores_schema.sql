-- Tabela de Revendedores
CREATE TABLE revendedores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 2.50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Parcelas de Comissão dos Revendedores
CREATE TABLE parcelas_revendedor (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  revendedor_id UUID REFERENCES revendedores(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  mes_referencia DATE NOT NULL,
  valor_bruto NUMERIC(15,2) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE revendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_revendedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_revendedores" ON revendedores FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_parcelas_revendedor" ON parcelas_revendedor FOR ALL USING (auth.uid() = user_id);

-- Adicionar coluna revendedor_id na tabela vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS revendedor_id UUID REFERENCES revendedores(id) ON DELETE SET NULL;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS percentual_revendedor NUMERIC(5,2) DEFAULT 0;
