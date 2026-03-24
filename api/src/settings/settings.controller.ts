import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  getAll(@Query('category') category?: string) {
    if (category) return this.settingsService.getByCategory(category);
    return this.settingsService.getAll();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get settings change history' })
  getHistory(@Query('limit') limit?: string) {
    return this.settingsService.getHistory(limit ? +limit : 100);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all settings grouped by category with descriptions' })
  async exportSettings() {
    const settings = await this.settingsService.getAll();

    const CATEGORY_LABELS: Record<string, string> = {
      copy_trade: 'Copy Trade',
      market_maker: 'Market Maker',
      sniper: 'Sniper',
      system: 'System',
      telegram: 'Telegram',
    };

    const byCategory = new Map<string, typeof settings>();
    for (const s of settings) {
      const cat = s.category ?? 'general';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(s);
    }

    const categories = Array.from(byCategory.entries()).map(([category, fields]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      fields: fields.map(s => ({
        key: s.key,
        value: s.value,
        description: s.description ?? '',
      })),
    }));

    return { exportedAt: new Date().toISOString(), categories };
  }

  @Post('import')
  @ApiOperation({ summary: 'Import settings — accepts both the new grouped format and the legacy flat format' })
  async importSettings(@Body() body: any) {
    // Normalize: accept { categories: [...] } (new) or { settings: { KEY: VALUE } } (legacy) or plain { KEY: VALUE }
    let flat: Record<string, string>;

    if (Array.isArray(body?.categories)) {
      // New format: { categories: [{ fields: [{ key, value }] }] }
      flat = {};
      for (const cat of body.categories) {
        for (const field of cat.fields ?? []) {
          if (field.key) flat[field.key] = String(field.value ?? '');
        }
      }
    } else if (body?.settings && typeof body.settings === 'object') {
      // Legacy format: { settings: { KEY: VALUE } }
      flat = body.settings;
    } else if (typeof body === 'object' && !Array.isArray(body)) {
      // Bare flat object: { KEY: VALUE }
      flat = body;
    } else {
      return { imported: 0, skipped: 0, message: 'Invalid payload format.' };
    }

    const all = await this.settingsService.getAll();
    const knownKeys = new Set(all.map(s => s.key));
    const entries = Object.entries(flat).filter(([key]) => knownKeys.has(key));
    await this.settingsService.bulkSet(entries.map(([key, value]) => ({ key, value })));
    const skipped = Object.keys(flat).length - entries.length;
    return {
      imported: entries.length,
      skipped,
      message: `Imported ${entries.length} settings${skipped > 0 ? `, skipped ${skipped} unknown keys` : ''}.`,
    };
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  getOne(@Param('key') key: string) {
    return this.settingsService.get(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update setting by key' })
  update(@Param('key') key: string, @Body() body: { value: string }) {
    return this.settingsService.set(key, body.value);
  }

  @Patch()
  @ApiOperation({ summary: 'Bulk update settings' })
  bulkUpdate(@Body() body: Array<{ key: string; value: string }>) {
    return this.settingsService.bulkSet(body);
  }
}
