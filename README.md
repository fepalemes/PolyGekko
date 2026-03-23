# PolyGekko
> Greed is good.

Dashboard de trading automatizado para Polymarket com 3 estratégias: Copy Trade, Market Maker e Sniper.

## Stack

- **Backend:** NestJS + TypeScript + Prisma + PostgreSQL
- **Frontend:** Next.js 14 + shadcn/ui + Tailwind CSS
- **Realtime:** Socket.io
- **Blockchain:** ethers.js + @polymarket/clob-client

## Estrutura

```
PolyGekko/
├── api/          # NestJS backend (porta 3001)
└── web/          # Next.js frontend (porta 3000)
```

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env com suas credenciais
```

### 3. Banco de dados

```bash
npm run db:migrate
npm run db:generate
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

Isso inicia tanto o backend (porta 3001) quanto o frontend (porta 3000).

## Estratégias

### Copy Trade
Monitora um trader alvo via WebSocket e espelha suas operações. Suporta ordens FOK com fallback GTC, auto-sell por alvo de lucro e resgate de mercados resolvidos.

### Market Maker
Provê liquidez em mercados binários de 5 ou 15 minutos. Divide USDC em tokens YES+NO via CTF e vende ambos ao preço alvo. Suporta cut-loss adaptativo e recovery buy.

### Sniper
Coloca ordens de compra limitadas em 3 níveis de preço baixo (1¢, 2¢, 3¢) para capturar vendas em pânico. Alocação por tier: 20%/30%/50%. Suporta multiplicadores por horário e agendamento por ativo.

## Dashboard

Acesse `http://localhost:3000` após iniciar o projeto.

Funcionalidades:
- Controle de estratégias (start/stop) com indicador de status
- Gráficos de performance por estratégia
- Gestão de posições abertas e histórico
- Configuração completa via dashboard (sem editar .env)
- Logs em tempo real via WebSocket
- Suporte a modo simulação (dry run) por estratégia
