-- ============================================
-- SCHEMA: Sistema de Comissões de Consórcio
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Tabela de Administradoras
CREATE TABLE administradoras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 0.50, -- ex: 0.50 = 0.50%
  meses_recebimento INTEGER NOT NULL DEFAULT 6, -- 6 ou 8 meses
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Clientes
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Vendas
CREATE TABLE vendas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  administradora_id UUID REFERENCES administradoras(id) ON DELETE SET NULL,
  valor_venda NUMERIC(15,2) NOT NULL,
  percentual_comissao NUMERIC(5,2) NOT NULL,
  meses_recebimento INTEGER NOT NULL,
  data_venda DATE NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Parcelas de Comissão (geradas automaticamente)
CREATE TABLE parcelas_comissao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL, -- 1 a 6/8
  mes_referencia DATE NOT NULL, -- primeiro dia do mês
  valor_bruto NUMERIC(15,2) NOT NULL,
  valor_estorno NUMERIC(15,2) DEFAULT 0,
  valor_liquido NUMERIC(15,2) GENERATED ALWAYS AS (valor_bruto - valor_estorno) STORED,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'estornado')),
  data_pagamento DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Estornos
CREATE TABLE estornos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  parcela_id UUID REFERENCES parcelas_comissao(id) ON DELETE CASCADE,
  valor_estorno NUMERIC(15,2) NOT NULL,
  motivo TEXT,
  data_estorno DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) - cada usuário vê apenas seus dados
ALTER TABLE administradoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_comissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE estornos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_administradoras" ON administradoras FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_clientes" ON clientes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_vendas" ON vendas FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_parcelas" ON parcelas_comissao FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_estornos" ON estornos FOR ALL USING (auth.uid() = user_id);

-- Inserir administradoras padrão (serão inseridas via trigger após criação do usuário)
-- Ou insira manualmente após criar sua conta:
-- INSERT INTO administradoras (user_id, nome, percentual_comissao, meses_recebimento) VALUES
--   ('SEU_USER_ID', 'Porto Seguro', 0.75, 6),
--   ('SEU_USER_ID', 'Embracon', 1.00, 8),
--   ('SEU_USER_ID', 'Magalu', 0.50, 6);
