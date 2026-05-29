# ConsórcioPRO — Guia de Configuração

## 1. Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em **New Project**
3. Escolha um nome (ex: "consorcioPRO") e senha
4. Aguarde o projeto inicializar (~2 min)

## 2. Executar o Schema SQL

1. No Supabase, vá em **SQL Editor** (menu lateral)
2. Copie todo o conteúdo do arquivo `supabase_schema.sql`
3. Cole no editor e clique **Run**

## 3. Pegar as credenciais

1. Vá em **Project Settings → API**
2. Copie:
   - **Project URL** → `https://xxxxxx.supabase.co`
   - **anon public key** → chave longa começando com `eyJ...`

## 4. Configurar o .env

Abra o arquivo `.env` na raiz do projeto e substitua:

```
VITE_SUPABASE_URL=https://SEU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
```

## 5. Rodar o projeto

```bash
npm run dev
```

Acesse: http://localhost:5173

## 6. Primeiro uso

1. Clique em **Criar conta** na tela de login
2. Confirme seu email (verifique a caixa de entrada)
3. Faça login
4. Vá em **Administradoras** → adicione suas administradoras com os percentuais corretos
5. Vá em **Clientes** → cadastre seus clientes
6. Vá em **Vendas** → registre uma venda — as parcelas serão geradas automaticamente!

## Como funciona o cálculo de comissão

- Você registra uma venda de R$ 100.000 com 0,75%/mês por 6 meses
- O sistema gera automaticamente 6 parcelas de R$ 750,00
- Cada parcela tem seu mês de referência (mês da venda + 1, 2, 3...)
- No mês seguinte você marca cada parcela como "Pago"
- Se o cliente não pagar, você lança um **Estorno** com o valor a devolver
- O estorno desconta automaticamente do valor líquido da parcela

## Funcionalidades

| Página | O que faz |
|--------|-----------|
| Dashboard | Visão geral, gráficos de área/barras/pizza, próximas parcelas |
| Vendas | Registrar vendas, ver detalhes de parcelas, excluir |
| Comissões | Todas as parcelas, marcar como pago, filtrar por mês/status |
| Estornos | Registrar devoluções por inadimplência, remover estornos |
| Clientes | Cadastro de clientes com histórico de vendas |
| Administradoras | Configurar % e meses de cada administradora |
