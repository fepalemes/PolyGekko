import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TelegramService } from './telegram.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private telegram: TelegramService) {}

  @Post('telegram/test')
  @ApiOperation({ summary: 'Send a Telegram test message' })
  async testTelegram() {
    await this.telegram.send(
      `🤖 <b>PolyGekko — Teste de Notificação</b>\n\n` +
      `✅ Conexão com o Telegram configurada com sucesso!\n\n` +
      `Você receberá alertas de:\n` +
      `• 🟢 Compras executadas\n` +
      `• 🔴 Vendas / saídas\n` +
      `• 🟣 Entradas no Market Maker\n` +
      `• ✅ / ❌ Resultados de P&amp;L`,
    );
    return { ok: true };
  }
}
