'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Lang = 'en' | 'pt';

// ─── Translations ────────────────────────────────────────────────────────────

const T = {
  en: {
    lang: { en: 'English', pt: 'Português' },

    nav: {
      dashboard: 'Dashboard',
      positions: 'Positions',
      trades: 'Trades',
      logs: 'Logs',
      settings: 'Settings',
      strategies: 'Strategies',
    },

    common: {
      save: 'Save',
      cancel: 'Cancel',
      loading: 'Loading...',
      running: 'Running',
      stopped: 'Stopped',
      start: 'Start',
      stop: 'Stop',
      reset: 'Reset',
      edit: 'Edit',
      clearing: 'Clearing...',
      clearSimData: 'Clear All Sim Data',
      clearSimDataConfirm: 'This will permanently delete ALL simulation positions, trades, logs and statistics. This cannot be undone. Continue?',
      yes: 'Yes',
      no: 'No',
      dryRun: 'Simulation',
      live: 'Live',
      simulated: 'Simulated',
      enabled: 'Enabled',
      disabled: 'Disabled',
      connected: 'Connected',
      disconnected: 'Disconnected',
      allStatuses: 'All statuses',
      allStrategies: 'All strategies',
      noData: 'No data found',
    },

    header: {
      connectedHelp: 'Real-time connection to the API via WebSocket. When connected, the dashboard updates instantly when trades occur or strategies change state.',
      simMode: 'Sim Mode',
      simModeHelp: 'When ON, the system runs globally in Simulation mode, meaning no real orders are sent. When OFF, real funds are used depending on each strategy config.',
    },

    dashboard: {
      title: 'Dashboard',
      totalPnl: 'Total P&L',
      totalPnlHelp: 'Cumulative profit and loss across all strategies. Calculated as: for wins, shares × $1 (resolution value) minus total cost; for losses, negative total cost. Only resolved (REDEEMED) positions are counted.',
      openPositions: 'Open Positions',
      openPositionsHelp: 'Number of positions currently open (awaiting market resolution). Each position represents a batch of shares purchased on a prediction market.',
      totalTrades: 'Total Trades',
      totalTradesHelp: 'Total number of buy/sell executions recorded. In simulation mode, trades are virtual and do not consume real funds.',
      winRate: 'Win Rate',
      winRateHelp: 'Percentage of resolved positions that were winners. A position wins when the outcome you purchased ($1/share at resolution) exceeds your entry cost. Formula: wins ÷ (wins + losses) × 100.',
      resolvedMarkets: 'resolved markets',
      simulatedPnl: 'Simulated P&L across all strategies',
      totalPositions: 'total',
    },

    balance: {
      title: 'Balance',
      help: 'In simulation mode, this is your virtual trading balance — it starts at $1,000 by default and is deducted on each buy and credited back when a position resolves. In live mode, this reflects your real USDC balance from the Polymarket wallet.',
      simHelp: 'Edit your simulation balance to test different capital sizes. This balance is automatically managed: deducted when a buy order is placed and returned (plus P&L) when the market resolves.',
    },

    strategies: {
      title: 'Strategies',
      modeHelp: 'In Dry Run mode, all orders are simulated — no real funds are moved. Use this to validate your configuration before going live. In Live mode, real USDC is spent and on-chain transactions are made.',

      copyTrade: {
        label: 'Copy Trade',
        description: 'Monitors a target trader\'s wallet in real-time and mirrors their buy/sell actions. When the tracked trader buys on a market, this strategy immediately places the same trade at a proportional size.',
        howItWorks: 'The strategy polls the Polymarket Data API every second to detect new trades from the watched wallet. On a BUY signal: fetches market metadata, calculates position size, attempts a FOK (Fill-or-Kill) order, falls back to GTC (Good-Till-Cancelled) if needed. On a SELL signal: cancels any open limit orders and exits the position.',
        fields: {
          dryRun: {
            label: 'Dry Run (Simulation)',
            help: 'When enabled, the strategy tracks real trades and records simulated positions in the database, but does NOT submit any orders to Polymarket. Use this to test your configuration risk-free. Your simulated balance is tracked separately.',
          },
          traderAddress: {
            label: 'Trader Wallet Address',
            help: 'The Polymarket proxy wallet address (0x...) of the trader you want to copy. You can find this by looking at the trader\'s activity on Polymarket. The strategy polls this address every second for new trades.',
            placeholder: '0xabcdef...',
          },
          sizeMode: {
            label: 'Size Mode',
            help: '"Fixed amount": always enter with exactly the configured USDC amount regardless of how much the trader invested. "Percentage of max": uses MAX_POSITION_SIZE as the base and applies the Size %. "Percentage of balance": uses your current balance as the base.',
            optFixed: 'Fixed amount (USDC)',
            optPercentage: 'Percentage of max',
            optBalance: 'Percentage of balance',
          },
          fixedAmount: {
            label: 'Fixed Entry Amount (USDC)',
            help: 'Exact USDC to spend on every trade when Size Mode is set to "Fixed". Always enters with this amount regardless of what the tracked trader invested. For example, set $1 to mirror all the trader\'s moves with just $1 each, or $50 for larger positions.',
          },
          sizePercent: {
            label: 'Size % per Trade',
            help: 'What percentage of the base amount (max position or balance) to allocate per trade. Example: if base = $100 and Size % = 10, each trade will be $10. Lower values reduce risk per trade.',
          },
          maxPositionSize: {
            label: 'Max Position Size (USDC)',
            help: 'Maximum USDC to spend on any single position. Acts as a hard cap regardless of the Size % calculation. Example: base $500 × 20% = $100, but if Max = $50, the order will be capped at $50.',
          },
          minEntryAmount: {
            label: 'Minimum Entry Amount (USDC)',
            help: 'The minimum USDC required to open a position. If the calculated size falls below this value, the trade is skipped. Set to 0 to never skip. Default is $1.',
          },
          maxBalanceUsage: {
            label: 'Max Balance Usage %',
            help: 'Maximum percentage of your total balance that can be tied up in open positions simultaneously. Example: 30% means if your balance is $1,000, you can have at most $300 invested across all open positions. New trades are blocked when this limit is reached.',
          },
          sellMode: {
            label: 'Sell Mode',
            help: '"Market (FOK)" sells immediately at the best available price (Fill-or-Kill). Faster but may execute at a worse price. "Limit (GTC)" places a limit order that stays open until filled. Better price control but may not fill immediately.',
            optMarket: 'Market (FOK) — instant fill',
            optLimit: 'Limit (GTC) — price controlled',
          },
          autoSell: {
            label: 'Auto Sell',
            help: 'Automatically places a limit sell order immediately after a buy, targeting a specific profit percentage. The sell order is placed at: buy_price × (1 + profit_target%). If the market resolves before the limit is hit, the position is redeemed at resolution value instead.',
          },
          autoSellProfit: {
            label: 'Profit Target %',
            help: 'The profit percentage at which the auto-sell limit order is placed. Example: 50% means if you bought at $0.40, the sell order is placed at $0.60. The order remains open until filled or the market resolves.',
          },
          minMarketTime: {
            label: 'Min Market Time Left (seconds)',
            help: 'Skip entering a position if the market closes in less than this many seconds. Prevents buying into markets that are about to resolve, where there\'s not enough time to profit. Default: 300s (5 minutes).',
          },
          gtcTimeout: {
            label: 'GTC Fallback Timeout (seconds)',
            help: 'When a FOK order fails (no immediate fill), the strategy places a GTC limit order. This is how long (in seconds) to wait for that GTC order to fill before cancelling it. Default: 60s.',
          },
          redeemInterval: {
            label: 'Redeem Check Interval (seconds)',
            help: 'How often the redeemer service checks for resolved markets. When a market closes, it fetches the outcome, calculates P&L, updates the position status to REDEEMED, and credits your balance. Default: 60s.',
          },
          simBalance: {
            label: 'Simulation Balance (USDC)',
            help: 'Starting virtual balance for simulation mode. This is automatically deducted on each buy and credited back (plus/minus P&L) when positions resolve. Reset to default when clearing sim data.',
          },
          stopLoss: {
            label: 'Stop-Loss % (0 = disabled)',
            help: 'If the current market price drops this many percent below your buy price, the strategy will automatically sell to limit losses. Example: 50 means sell if price falls 50% from entry (e.g. bought at $0.40, sell at $0.20). Set to 0 to disable stop-loss and let the market resolve naturally.',
          },
        },
      },

      marketMaker: {
        label: 'Market Maker',
        description: 'Provides liquidity on both sides (YES and NO) of crypto up/down markets. Splits the CTF position to receive both YES and NO tokens, then places sell orders on both. Profits when the combined sell price exceeds the entry cost.',
        howItWorks: 'For each configured asset (BTC, ETH, etc.), the strategy finds an active up/down market with the specified duration. It buys the combined position (YES + NO) via the CTF contract, then places limit sell orders on both outcomes. If one outcome resolves to $1, the other resolves to $0 — the goal is to sell at least one side above cost before resolution.',
        fields: {
          assets: {
            label: 'Assets',
            help: 'Select the crypto assets to trade. Available: BTC, ETH, SOL, XRP, BNB, DOGE, HYPE. Each selected asset will be independently monitored for up/down markets with the configured duration.',
            placeholder: 'btc,eth,sol',
          },
          duration: {
            label: 'Market Duration',
            help: 'Target the 5-minute or 15-minute crypto up/down markets. 5-minute markets resolve more frequently (higher volume of trades) but have less time for price movement. 15-minute markets allow more time for your limit orders to fill.',
            opt5m: '5 minutes — high frequency',
            opt15m: '15 minutes — lower frequency',
            opt1h: '1 hour — moderate frequency',
            opt4h: '4 hours — low frequency',
          },
          tradeSize: {
            label: 'Trade Size (USDC)',
            help: 'USDC amount to deploy per market. This is split equally between YES and NO sides. Example: $10 means $5 on YES and $5 on NO. The position cost is approximately 2× this value after the CTF split.',
          },
          sellPrice: {
            label: 'Target Sell Price',
            help: 'The price (0.01–0.99) at which to place limit sell orders on both outcomes. If you enter at $0.50 total and set sell price to $0.60, a single successful sell recoups your cost. Lower values fill more easily; higher values maximize profit per fill.',
          },
          cutLossTime: {
            label: 'Cut Loss Time (seconds before close)',
            help: 'If a sell order hasn\'t filled within this many seconds of market close, cancel the position to avoid maximum loss. Example: 60s means cancel and accept the loss 1 minute before the market resolves.',
          },
          adaptiveCL: {
            label: 'Adaptive Cut-Loss',
            help: 'When enabled, the cut-loss threshold adapts based on the current combined price of YES + NO tokens. If the combined price is still above the minimum threshold, it keeps the orders open longer rather than cutting early.',
          },
          dynamicSizingEnabled: {
            label: 'Dynamic Sizing',
            help: 'Enable variable allocation sizes instead of fixed amounts. Picks a random entry chunk between Min and Max Allocation.',
          },
          minAllocation: {
            label: 'Min Allocation (USDC)',
            help: 'Minimum USDC to allocate dynamically per trade.',
          },
          maxAllocation: {
            label: 'Max Allocation (USDC)',
            help: 'Maximum USDC to allocate dynamically per trade.',
          },
          spreadProfitTarget: {
            label: 'Spread Profit Target (USDC)',
            help: 'Take-profit margin above entry price for penny-profit taking (e.g. 0.01 for 1 cent).',
          },
          recoveryBuy: {
            label: 'Recovery Buy',
            help: 'After a cut-loss, if the price of the remaining outcome is above the recovery threshold (suggesting it might still win), place a recovery buy to partially offset the loss. Risky — only enable if you understand the mechanics.',
          },
          pollInterval: {
            label: 'Poll Interval (seconds)',
            help: 'How often the strategy scans for new markets and checks order status. Lower values = faster reaction but more API calls. Default: 30s is a good balance.',
          },
          simBalance: {
            label: 'Simulation Balance (USDC)',
            help: 'Virtual balance used in simulation mode. Deducted on each market entry and credited back (plus/minus P&L) when the position closes. Reset to any value to restart the simulation.',
          },
        },
      },

      sniper: {
        label: 'Sniper',
        description: 'Places low-price GTC (Good-Till-Cancelled) buy orders at 1¢, 2¢, and 3¢ on both YES and NO tokens of crypto up/down markets. Designed to catch extreme mispricing events where a token briefly trades near zero before resolving to $1.',
        howItWorks: 'For each configured asset, the strategy finds the current up/down market and places tiered limit orders at very low prices. If one of these orders fills and the token resolves to $1, the gain is enormous (e.g. buy at 1¢, sell/redeem at $1 = 100× return). The strategy also supports time-based multipliers to scale position sizes based on market hours.',
        fields: {
          assets: {
            label: 'Assets to Snipe',
            help: 'Comma-separated list of assets to run the sniper on. For each asset, the strategy finds the active up/down market and places orders on both YES and NO tokens.',
            placeholder: 'eth,btc,sol',
          },
          tier1Price: {
            label: 'Tier 1 Price (highest price)',
            help: 'Price for the largest share allocation (50% of max shares). Slightly higher probability of filling but lower return multiple. Example: 3¢ → 33× return if the token resolves to $1.',
          },
          tier2Price: {
            label: 'Tier 2 Price',
            help: 'Price for the medium share allocation (30% of max shares). Balances fill probability and return multiple. Example: 2¢ → 50× return if token resolves to $1.',
          },
          tier3Price: {
            label: 'Tier 3 Price (lowest price)',
            help: 'Price for the smallest share allocation (20% of max shares). Least likely to fill but highest return multiple. Example: 1¢ → 100× return if token resolves to $1.',
          },
          maxShares: {
            label: 'Max Shares per Market',
            help: 'Total number of shares to distribute across the 3 tiers per market side (YES or NO). Split: 50% to tier3, 30% to tier2, 20% to tier1. Example: 15 shares → 3 at tier1, 4 at tier2, 8 at tier3.',
          },
          pauseRounds: {
            label: 'Pause Rounds After Win',
            help: 'After a winning position is detected, pause the strategy for this many rounds (cycles). Prevents immediately re-entering a market that just resolved, allowing time for the next market to open.',
          },
          multipliers: {
            label: 'Time-Based Multipliers',
            help: 'Scale position sizes based on time of day. Format: "HH:MM-HH:MM:factor,...". Example: "09:00-11:00:2,14:00-16:00:1.5" doubles shares from 9–11am and uses 1.5× from 2–4pm. Leave empty to always use 1× (no scaling).',
            placeholder: '09:00-11:00:2,14:00-16:00:1.5',
          },
          schedule: {
            label: 'Per-Asset Schedule',
            help: 'Restrict each asset to specific trading hours. Format: "ASSET=HH:MM-HH:MM,...". Example: "ETH=09:00-17:00,BTC=00:00-23:59" only trades ETH during market hours and BTC all day. Leave empty to trade all assets 24/7.',
            placeholder: 'ETH=09:00-17:00,BTC=00:00-23:59',
          },
        },
      },
    },

    positions: {
      title: 'Positions',
      help: 'A position represents shares purchased on a Polymarket prediction market. Each position tracks: the market question, which outcome (YES/NO) was purchased, number of shares, average entry price, total cost, and P&L after resolution.',
      market: 'Market',
      outcome: 'Outcome',
      shares: 'Shares',
      avgPrice: 'Avg Price',
      totalCost: 'Total Cost',
      status: 'Status',
      pnl: 'P&L',
      strategy: 'Strategy',
      age: 'Age',
      noPositions: 'No positions found',
      statusHelp: 'OPEN: position active, awaiting resolution. SELLING: a sell order is pending. SOLD: successfully sold before resolution. REDEEMED: market resolved, P&L settled.',
      pnlHelp: 'Profit/Loss calculated at resolution: WIN = shares × $1 − cost; LOSS = −cost. Only shown for REDEEMED positions.',
    },

    trades: {
      title: 'Trades',
      help: 'Individual buy/sell executions. Each trade belongs to a position. Buy trades create positions; sell trades close them. In simulation mode, trades are virtual but reflect the same market prices.',
      market: 'Market',
      side: 'Side',
      shares: 'Shares',
      price: 'Price',
      cost: 'Cost',
      status: 'Status',
      strategy: 'Strategy',
      time: 'Time',
      noTrades: 'No trades found',
    },

    logs: {
      title: 'Strategy Logs',
      help: 'Real-time log stream from all running strategies. INFO messages show normal activity. WARN messages indicate non-critical issues (e.g. skipped trades). ERROR messages indicate failures that need attention.',
      clear: 'Clear Logs',
      noLogs: 'No logs yet',
      autoScroll: 'Auto-scroll',
    },

    settings: {
      title: 'Settings',
      help: 'All strategy parameters are stored in the database and can be changed while strategies are stopped. Restart the strategy after saving to apply new settings.',
      copyTrade: 'Copy Trade',
      marketMaker: 'Market Maker',
      sniper: 'Sniper',
      telegram: 'Telegram',
      system: 'System',
    },

    telegram: {
      title: 'Telegram Notifications',
      description: 'Receive real-time buy/sell alerts and P&L results directly in Telegram. Create a bot with @BotFather, then send a message to your bot and use @userinfobot to get your Chat ID.',
      enabled: 'Enable Notifications',
      enabledHelp: 'When enabled, the bot will send a message for every buy, sell and market-maker entry/exit.',
      botToken: 'Bot Token',
      botTokenHelp: 'Token provided by @BotFather when you create a bot. Format: 123456789:AAFxxxxxxxx',
      chatId: 'Chat ID',
      chatIdHelp: 'Your personal or group chat ID. Send /start to your bot, then check @userinfobot or use the Telegram API to find your ID.',
      testBtn: 'Send Test Message',
      testSuccess: 'Test message sent!',
      testFail: 'Failed to send — check token and chat ID.',
    },

    simStats: {
      title: 'Simulation Statistics',
      help: 'Tracks performance metrics for each strategy running in simulation mode. Statistics are updated in real-time when markets resolve. Use the reset button (↺) to clear stats for a specific strategy.',
      totalBuys: 'Total Buys',
      totalBuysHelp: 'Total number of buy orders placed (including positions still open).',
      winLoss: 'Win / Loss',
      winLossHelp: 'Number of resolved positions: green = winner (your outcome was correct), red = loser.',
      winRate: 'Win Rate',
      winRateHelp: 'Wins ÷ (Wins + Losses) × 100. Only counts resolved positions.',
      avgPnl: 'Avg P&L / trade',
      avgPnlHelp: 'Total P&L divided by total resolved trades. Positive = profitable on average.',
      pending: 'Pending positions',
      pendingHelp: 'Positions that are still open (not yet resolved). These are not included in win/loss stats.',
    },

    recentActivity: {
      title: 'Recent Activity',
      help: 'Last 50 trades across all strategies. Shows side (BUY/SELL), market, price, cost, and mode (Sim/Live).',
      noActivity: 'No recent activity',
    },

    performanceChart: {
      title: 'P&L Performance',
      help: 'Cumulative profit/loss over time for each strategy. Each point on the chart represents a resolved market. Green area = profit; red area = loss. The chart updates automatically as markets resolve.',
      noData: 'No performance data yet. Performance is recorded when markets resolve.',
    },
  },

  pt: {
    lang: { en: 'English', pt: 'Português' },

    nav: {
      dashboard: 'Painel',
      positions: 'Posições',
      trades: 'Operações',
      logs: 'Registros',
      settings: 'Configurações',
      strategies: 'Estratégias',
    },

    common: {
      save: 'Salvar',
      cancel: 'Cancelar',
      loading: 'Carregando...',
      running: 'Executando',
      stopped: 'Parada',
      start: 'Iniciar',
      stop: 'Parar',
      reset: 'Resetar',
      edit: 'Editar',
      clearing: 'Limpando...',
      clearSimData: 'Limpar Dados de Simulação',
      clearSimDataConfirm: 'Isso vai apagar TODOS os dados de simulação: posições, operações, registros e estatísticas. Essa ação não pode ser desfeita. Continuar?',
      yes: 'Sim',
      no: 'Não',
      dryRun: 'Simulação',
      live: 'Ao Vivo',
      simulated: 'Simulado',
      enabled: 'Ativado',
      disabled: 'Desativado',
      connected: 'Conectado',
      disconnected: 'Desconectado',
      allStatuses: 'Todos os status',
      allStrategies: 'Todas as estratégias',
      noData: 'Nenhum dado encontrado',
    },

    header: {
      connectedHelp: 'Conexão em tempo real com a API via WebSocket. Quando conectado, o painel atualiza instantaneamente quando operações ocorrem ou as estratégias mudam de estado.',
      simMode: 'Modo Simulação',
      simModeHelp: 'Quando LIGADO, o sistema roda globalmente em Simulação (sem usar saldos reais). Quando DESLIGADO, valores reais são usados dependendo de cada estratégia.',
    },

    dashboard: {
      title: 'Painel',
      totalPnl: 'P&L Total',
      totalPnlHelp: 'Lucro/Prejuízo acumulado em todas as estratégias. Calculado como: para ganhos, ações × $1 (valor de resolução) menos o custo total; para perdas, custo total negativo. Apenas posições resolvidas (REDEEMED) são contabilizadas.',
      openPositions: 'Posições Abertas',
      openPositionsHelp: 'Número de posições atualmente abertas (aguardando resolução do mercado). Cada posição representa um lote de ações compradas em um mercado de previsão.',
      totalTrades: 'Total de Operações',
      totalTradesHelp: 'Número total de ordens de compra/venda registradas. No modo simulação, as operações são virtuais e não consomem fundos reais.',
      winRate: 'Taxa de Acerto',
      winRateHelp: 'Percentual de posições resolvidas que foram vencedoras. Uma posição ganha quando o resultado comprado ($1/ação na resolução) supera o custo de entrada. Fórmula: ganhos ÷ (ganhos + perdas) × 100.',
      resolvedMarkets: 'mercados resolvidos',
      simulatedPnl: 'P&L simulado em todas as estratégias',
      totalPositions: 'total',
    },

    balance: {
      title: 'Saldo',
      help: 'No modo simulação, este é o seu saldo virtual de trading — começa em $1.000 por padrão, é debitado a cada compra e creditado quando uma posição é resolvida. No modo ao vivo, reflete o seu saldo real de USDC na carteira Polymarket.',
      simHelp: 'Edite o saldo de simulação para testar diferentes tamanhos de capital. Este saldo é gerenciado automaticamente: debitado ao colocar uma ordem de compra e devolvido (mais/menos P&L) quando o mercado resolve.',
    },

    strategies: {
      title: 'Estratégias',
      modeHelp: 'No modo Simulação (Dry Run), todas as ordens são simuladas — nenhum fundo real é movimentado. Use para validar sua configuração antes de operar ao vivo. No modo Ao Vivo, USDC real é gasto e transações on-chain são realizadas.',

      copyTrade: {
        label: 'Copy Trade',
        description: 'Monitora a carteira de um trader alvo em tempo real e espelha as ações de compra/venda. Quando o trader monitorado compra em um mercado, esta estratégia imediatamente coloca a mesma operação em tamanho proporcional.',
        howItWorks: 'A estratégia consulta a API de dados do Polymarket a cada segundo para detectar novas operações da carteira monitorada. Em sinal de COMPRA: busca metadados do mercado, calcula o tamanho da posição, tenta uma ordem FOK (Fill-or-Kill), com fallback para GTC se necessário. Em sinal de VENDA: cancela ordens limite abertas e encerra a posição.',
        fields: {
          dryRun: {
            label: 'Modo Simulação',
            help: 'Quando ativado, a estratégia monitora operações reais e registra posições simuladas no banco de dados, mas NÃO envia nenhuma ordem ao Polymarket. Use para testar sua configuração sem risco. O saldo simulado é rastreado separadamente.',
          },
          traderAddress: {
            label: 'Endereço da Carteira do Trader',
            help: 'O endereço da proxy wallet (0x...) do Polymarket do trader que você quer copiar. Você pode encontrar isso olhando a atividade do trader no Polymarket. A estratégia verifica esse endereço a cada segundo por novas operações.',
            placeholder: '0xabcdef...',
          },
          sizeMode: {
            label: 'Modo de Tamanho',
            help: '"Valor fixo": sempre entra com o valor exato configurado em USDC, independente do quanto o trader investiu. "Percentual do máximo": usa MAX_POSITION_SIZE como base e aplica o percentual. "Percentual do saldo": usa o saldo atual como base.',
            optFixed: 'Valor fixo (USDC)',
            optPercentage: 'Percentual do máximo',
            optBalance: 'Percentual do saldo',
          },
          fixedAmount: {
            label: 'Valor de Entrada Fixo (USDC)',
            help: 'USDC exato a gastar em cada operação quando o Modo de Tamanho é "Valor fixo". Sempre entra com esse valor independente do que o trader monitorado investiu. Exemplo: coloque $1 para espelhar todas as movimentações do trader com apenas $1 cada, ou $50 para posições maiores.',
          },
          sizePercent: {
            label: '% do Tamanho por Operação',
            help: 'Que percentual do valor base (posição máxima ou saldo) alocar por operação. Exemplo: base = $100 e % = 10, cada operação será $10. Valores menores reduzem o risco por operação.',
          },
          maxPositionSize: {
            label: 'Tamanho Máximo de Posição (USDC)',
            help: 'USDC máximo a gastar em qualquer posição individual. Funciona como teto rígido independente do cálculo de %. Exemplo: base $500 × 20% = $100, mas se Máximo = $50, a ordem fica em $50.',
          },
          minEntryAmount: {
            label: 'Valor Mínimo de Entrada (USDC)',
            help: 'O USDC mínimo necessário para abrir uma posição. Se o tamanho calculado ficar abaixo desse valor, a operação é ignorada. Defina 0 para nunca ignorar. O padrão é $1.',
          },
          maxBalanceUsage: {
            label: 'Uso Máximo do Saldo %',
            help: 'Percentual máximo do saldo total que pode estar investido em posições abertas simultaneamente. Exemplo: 30% significa que, com saldo $1.000, no máximo $300 podem estar investidos. Novas operações são bloqueadas quando esse limite é atingido.',
          },
          sellMode: {
            label: 'Modo de Venda',
            help: '"Mercado (FOK)" vende imediatamente ao melhor preço disponível (Fill-or-Kill). Mais rápido, mas pode executar a um preço pior. "Limite (GTC)" coloca uma ordem limite que fica aberta até ser preenchida. Melhor controle de preço, mas pode não preencher imediatamente.',
            optMarket: 'Mercado (FOK) — preenchimento imediato',
            optLimit: 'Limite (GTC) — controle de preço',
          },
          autoSell: {
            label: 'Venda Automática',
            help: 'Coloca automaticamente uma ordem de venda limite imediatamente após uma compra, visando um percentual de lucro específico. A ordem de venda é colocada em: preço_de_compra × (1 + alvo_de_lucro%). Se o mercado resolver antes do limite ser atingido, a posição é resgatada pelo valor de resolução.',
          },
          autoSellProfit: {
            label: 'Meta de Lucro %',
            help: 'O percentual de lucro no qual a ordem de venda automática é colocada. Exemplo: 50% significa que se você comprou a $0,40, a ordem de venda é colocada a $0,60. A ordem permanece aberta até ser preenchida ou o mercado resolver.',
          },
          minMarketTime: {
            label: 'Tempo Mínimo Restante no Mercado (s)',
            help: 'Ignorar a entrada em uma posição se o mercado fechar em menos de tantos segundos. Evita comprar em mercados prestes a resolver, onde não há tempo suficiente para lucrar. Padrão: 300s (5 minutos).',
          },
          gtcTimeout: {
            label: 'Timeout do Fallback GTC (s)',
            help: 'Quando uma ordem FOK falha (sem preenchimento imediato), a estratégia coloca uma ordem limite GTC. Esse é o tempo (em segundos) de espera pelo preenchimento da GTC antes de cancelá-la. Padrão: 60s.',
          },
          redeemInterval: {
            label: 'Intervalo de Verificação de Resgate (s)',
            help: 'Com que frequência o serviço de resgate verifica mercados resolvidos. Quando um mercado fecha, busca o resultado, calcula o P&L, atualiza o status da posição para REDEEMED e credita o saldo. Padrão: 60s.',
          },
          simBalance: {
            label: 'Saldo de Simulação (USDC)',
            help: 'Saldo virtual inicial para o modo simulação. É automaticamente debitado em cada compra e creditado de volta (mais/menos P&L) quando as posições são resolvidas. Resetado ao limpar dados de simulação.',
          },
          stopLoss: {
            label: 'Stop-Loss % (0 = desabilitado)',
            help: 'Se o preço atual do mercado cair esse percentual abaixo do preço de compra, a estratégia venderá automaticamente para limitar as perdas. Exemplo: 50 significa vender se o preço cair 50% da entrada (ex: comprou a $0,40, vende a $0,20). Defina como 0 para desabilitar o stop-loss e deixar o mercado resolver naturalmente.',
          },
        },
      },

      marketMaker: {
        label: 'Market Maker',
        description: 'Fornece liquidez em ambos os lados (SIM e NÃO) de mercados crypto de alta/baixa. Divide a posição CTF para receber tokens SIM e NÃO, depois coloca ordens de venda em ambos. Lucra quando o preço combinado de venda supera o custo de entrada.',
        howItWorks: 'Para cada ativo configurado (BTC, ETH, etc.), a estratégia encontra um mercado ativo de alta/baixa com a duração especificada. Compra a posição combinada (SIM + NÃO) via contrato CTF, depois coloca ordens de venda limite em ambos os resultados. Se um resultado resolve para $1, o outro resolve para $0 — o objetivo é vender pelo menos um lado acima do custo antes da resolução.',
        fields: {
          assets: {
            label: 'Ativos',
            help: 'Selecione as criptomoedas para operar. Disponíveis: BTC, ETH, SOL, XRP, BNB, DOGE, HYPE. Cada ativo selecionado será monitorado independentemente por mercados de alta/baixa com a duração configurada.',
            placeholder: 'btc,eth,sol',
          },
          duration: {
            label: 'Duração do Mercado',
            help: 'Operações nos mercados de 5 minutos ou 15 minutos de alta/baixa. Mercados de 5 minutos resolvem com mais frequência (maior volume), mas têm menos tempo para movimentação de preço. Mercados de 15 minutos permitem mais tempo para suas ordens limite serem preenchidas.',
            opt5m: '5 minutos — alta frequência',
            opt15m: '15 minutos — baixa frequência',
            opt1h: '1 hora — frequência moderada',
            opt4h: '4 horas — baixa frequência',
          },
          tradeSize: {
            label: 'Tamanho da Operação (USDC)',
            help: 'Valor em USDC a alocar por mercado. Dividido igualmente entre os lados SIM e NÃO. Exemplo: $10 significa $5 no SIM e $5 no NÃO. O custo total da posição é aproximadamente 2× esse valor após a divisão CTF.',
          },
          sellPrice: {
            label: 'Preço Alvo de Venda',
            help: 'O preço (0,01–0,99) para colocar ordens de venda limite em ambos os resultados. Se você entrar a $0,50 total e definir preço de venda para $0,60, uma única venda bem-sucedida recupera o custo. Valores menores preenchem mais facilmente; valores maiores maximizam o lucro por preenchimento.',
          },
          cutLossTime: {
            label: 'Tempo de Corte de Perda (s antes do fechamento)',
            help: 'Se uma ordem de venda não for preenchida dentro deste número de segundos antes do fechamento do mercado, cancela a posição para evitar perda máxima. Exemplo: 60s significa cancelar 1 minuto antes do mercado resolver.',
          },
          adaptiveCL: {
            label: 'Corte de Perda Adaptativo',
            help: 'Quando ativado, o limite de corte de perda se adapta com base no preço combinado atual dos tokens SIM + NÃO. Se o preço combinado ainda estiver acima do limite mínimo, mantém as ordens abertas por mais tempo em vez de cortar cedo.',
          },
          dynamicSizingEnabled: {
            label: 'Alocação Dinâmica',
            help: 'Ativa alocações variáveis e de tamanhos menores ao invés de valores fixos.',
          },
          minAllocation: {
            label: 'Alocação Mínima (USDC)',
            help: 'Mínimo de USDC para alocar dinamicamente.',
          },
          maxAllocation: {
            label: 'Alocação Máxima (USDC)',
            help: 'Máximo de USDC para alocar dinamicamente.',
          },
          spreadProfitTarget: {
            label: 'Margem Alvo de Lucro (USDC)',
            help: 'Lucro alvo em centavos acima do valor de entrada (ex: 0.01 para buscar 1 centavo).',
          },
          recoveryBuy: {
            label: 'Compra de Recuperação',
            help: 'Após um corte de perda, se o preço do resultado restante estiver acima do limite de recuperação (sugerindo que ainda pode ganhar), faz uma compra de recuperação para parcialmente compensar a perda. Arriscado — ative apenas se entender a mecânica.',
          },
          pollInterval: {
            label: 'Intervalo de Verificação (s)',
            help: 'Com que frequência a estratégia verifica novos mercados e o status das ordens. Valores menores = reação mais rápida, mas mais chamadas de API. O padrão de 30s é um bom equilíbrio.',
          },
          simBalance: {
            label: 'Saldo de Simulação (USDC)',
            help: 'Saldo virtual usado no modo de simulação. Debitado em cada entrada de mercado e creditado de volta (mais/menos P&L) quando a posição fecha. Redefina para qualquer valor para reiniciar a simulação.',
          },
        },
      },

      sniper: {
        label: 'Sniper',
        description: 'Coloca ordens de compra GTC (Good-Till-Cancelled) a preços baixos de 1¢, 2¢ e 3¢ nos tokens SIM e NÃO de mercados cripto de alta/baixa. Projetado para capturar eventos de precificação extrema onde um token brevemente negocia perto de zero antes de resolver para $1.',
        howItWorks: 'Para cada ativo configurado, a estratégia encontra o mercado de alta/baixa atual e coloca ordens limite em camadas a preços muito baixos. Se uma dessas ordens for preenchida e o token resolver para $1, o ganho é enorme (ex: comprar a 1¢, resgatar a $1 = retorno 100×). A estratégia também suporta multiplicadores por horário para escalar tamanhos de posição.',
        fields: {
          assets: {
            label: 'Ativos para Snipe',
            help: 'Lista de ativos separada por vírgulas para executar o sniper. Para cada ativo, a estratégia encontra o mercado ativo de alta/baixa e coloca ordens nos tokens SIM e NÃO.',
            placeholder: 'eth,btc,sol',
          },
          tier1Price: {
            label: 'Preço Tier 1 (mais alto)',
            help: 'Preço para a maior alocação de ações (50% do máximo). Probabilidade ligeiramente maior de preenchimento, mas multiplicador de retorno menor. Exemplo: 3¢ → retorno 33× se o token resolver para $1.',
          },
          tier2Price: {
            label: 'Preço Tier 2',
            help: 'Preço para a alocação média de ações (30% do máximo). Equilibra probabilidade de preenchimento e multiplicador de retorno. Exemplo: 2¢ → retorno 50× se o token resolver para $1.',
          },
          tier3Price: {
            label: 'Preço Tier 3 (mais baixo)',
            help: 'Preço para a menor alocação de ações (20% do máximo). Menos provável de ser preenchido, mas maior multiplicador de retorno. Exemplo: 1¢ → retorno 100× se o token resolver para $1.',
          },
          maxShares: {
            label: 'Máximo de Ações por Mercado',
            help: 'Número total de ações a distribuir entre os 3 tiers por lado de mercado (SIM ou NÃO). Divisão: 50% para tier3, 30% para tier2, 20% para tier1. Exemplo: 15 ações → 3 no tier1, 4 no tier2, 8 no tier3.',
          },
          pauseRounds: {
            label: 'Rodadas de Pausa Após Ganho',
            help: 'Após detectar uma posição vencedora, pausar a estratégia por este número de rodadas (ciclos). Evita reentrar imediatamente em um mercado que acabou de resolver, dando tempo para o próximo mercado abrir.',
          },
          multipliers: {
            label: 'Multiplicadores por Horário',
            help: 'Escala os tamanhos de posição com base no horário do dia. Formato: "HH:MM-HH:MM:fator,...". Exemplo: "09:00-11:00:2,14:00-16:00:1.5" dobra as ações de 9–11h e usa 1,5× das 14–16h. Deixe vazio para sempre usar 1× (sem escalonamento).',
            placeholder: '09:00-11:00:2,14:00-16:00:1.5',
          },
          schedule: {
            label: 'Agenda por Ativo',
            help: 'Restrinja cada ativo a horários específicos de negociação. Formato: "ATIVO=HH:MM-HH:MM,...". Exemplo: "ETH=09:00-17:00,BTC=00:00-23:59" só opera ETH no horário comercial e BTC o dia inteiro. Deixe vazio para operar todos os ativos 24/7.',
            placeholder: 'ETH=09:00-17:00,BTC=00:00-23:59',
          },
        },
      },
    },

    positions: {
      title: 'Posições',
      help: 'Uma posição representa ações compradas em um mercado de previsão do Polymarket. Cada posição rastreia: a pergunta do mercado, qual resultado (SIM/NÃO) foi comprado, número de ações, preço médio de entrada, custo total e P&L após resolução.',
      market: 'Mercado',
      outcome: 'Resultado',
      shares: 'Ações',
      avgPrice: 'Preço Médio',
      totalCost: 'Custo Total',
      status: 'Status',
      pnl: 'P&L',
      strategy: 'Estratégia',
      age: 'Idade',
      noPositions: 'Nenhuma posição encontrada',
      statusHelp: 'OPEN: posição ativa, aguardando resolução. SELLING: ordem de venda pendente. SOLD: vendida com sucesso antes da resolução. REDEEMED: mercado resolvido, P&L calculado.',
      pnlHelp: 'Lucro/Prejuízo calculado na resolução: GANHO = ações × $1 − custo; PERDA = −custo. Exibido apenas para posições REDEEMED.',
    },

    trades: {
      title: 'Operações',
      help: 'Execuções individuais de compra/venda. Cada operação pertence a uma posição. Operações de compra criam posições; operações de venda as fecham. No modo simulação, as operações são virtuais, mas refletem os preços reais do mercado.',
      market: 'Mercado',
      side: 'Lado',
      shares: 'Ações',
      price: 'Preço',
      cost: 'Custo',
      status: 'Status',
      strategy: 'Estratégia',
      time: 'Hora',
      noTrades: 'Nenhuma operação encontrada',
    },

    logs: {
      title: 'Registros da Estratégia',
      help: 'Stream de registros em tempo real de todas as estratégias em execução. Mensagens INFO mostram atividade normal. WARN indicam problemas não críticos (ex: operações ignoradas). ERROR indicam falhas que precisam de atenção.',
      clear: 'Limpar Registros',
      noLogs: 'Nenhum registro ainda',
      autoScroll: 'Rolagem automática',
    },

    settings: {
      title: 'Configurações',
      help: 'Todos os parâmetros de estratégia são armazenados no banco de dados e podem ser alterados enquanto as estratégias estão paradas. Reinicie a estratégia após salvar para aplicar as novas configurações.',
      copyTrade: 'Copy Trade',
      marketMaker: 'Market Maker',
      sniper: 'Sniper',
      telegram: 'Telegram',
      system: 'Sistema',
    },

    telegram: {
      title: 'Notificações Telegram',
      description: 'Receba alertas em tempo real de compras, vendas e resultados P&L diretamente no Telegram. Crie um bot com o @BotFather, envie uma mensagem para ele e use o @userinfobot para encontrar seu Chat ID.',
      enabled: 'Ativar Notificações',
      enabledHelp: 'Quando ativo, o bot envia uma mensagem a cada compra, venda e entrada/saída do market maker.',
      botToken: 'Token do Bot',
      botTokenHelp: 'Token fornecido pelo @BotFather ao criar o bot. Formato: 123456789:AAFxxxxxxxx',
      chatId: 'Chat ID',
      chatIdHelp: 'Seu ID pessoal ou de grupo. Envie /start para o seu bot, depois verifique com @userinfobot ou via API do Telegram.',
      testBtn: 'Enviar Mensagem de Teste',
      testSuccess: 'Mensagem de teste enviada!',
      testFail: 'Falha no envio — verifique o token e o Chat ID.',
    },

    simStats: {
      title: 'Estatísticas de Simulação',
      help: 'Acompanha métricas de performance para cada estratégia em modo simulação. As estatísticas são atualizadas em tempo real quando os mercados resolvem. Use o botão de reset (↺) para limpar estatísticas de uma estratégia específica.',
      totalBuys: 'Total de Compras',
      totalBuysHelp: 'Número total de ordens de compra colocadas (incluindo posições ainda abertas).',
      winLoss: 'Ganhos / Perdas',
      winLossHelp: 'Número de posições resolvidas: verde = vencedor (seu resultado estava correto), vermelho = perdedor.',
      winRate: 'Taxa de Acerto',
      winRateHelp: 'Ganhos ÷ (Ganhos + Perdas) × 100. Conta apenas posições resolvidas.',
      avgPnl: 'P&L Médio / operação',
      avgPnlHelp: 'P&L total dividido pelo total de operações resolvidas. Positivo = lucrativo em média.',
      pending: 'Posições pendentes',
      pendingHelp: 'Posições ainda abertas (não resolvidas). Não incluídas nas estatísticas de ganhos/perdas.',
    },

    recentActivity: {
      title: 'Atividade Recente',
      help: 'Últimas 50 operações em todas as estratégias. Mostra lado (COMPRA/VENDA), mercado, preço, custo e modo (Sim/Ao Vivo).',
      noActivity: 'Nenhuma atividade recente',
    },

    performanceChart: {
      title: 'Performance P&L',
      help: 'Lucro/Prejuízo acumulado ao longo do tempo por estratégia. Cada ponto no gráfico representa um mercado resolvido. Área verde = lucro; área vermelha = prejuízo. O gráfico atualiza automaticamente quando os mercados resolvem.',
      noData: 'Ainda não há dados de performance. Os dados são registrados quando os mercados resolvem.',
    },
  },
} as const;

export type Translations = typeof T.en;

// ─── Context ─────────────────────────────────────────────────────────────────

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LangContext = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: T.en,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('polygekko-lang') as Lang | null;
    if (saved === 'en' || saved === 'pt') setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('polygekko-lang', l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang, t: T[lang] as unknown as Translations }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
