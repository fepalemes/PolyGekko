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

  @Get('history')
  @ApiOperation({ summary: 'Get settings change history' })
  getHistory(@Query('limit') limit?: string) {
    return this.settingsService.getHistory(limit ? +limit : 100);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all settings as JSON' })
  async exportSettings() {
    const settings = await this.settingsService.getAll();
    return {
      exportedAt: new Date().toISOString(),
      settings: Object.fromEntries(settings.map(s => [s.key, s.value])),
    };
  }

  @Post('import')
  @ApiOperation({ summary: 'Import settings from a JSON export (keys that exist will be overwritten; unknown keys are ignored)' })
  async importSettings(@Body() body: { settings: Record<string, string> }) {
    if (!body?.settings || typeof body.settings !== 'object') {
      return { imported: 0, message: 'Invalid payload — expected { settings: { KEY: VALUE } }' };
    }
    const all = await this.settingsService.getAll();
    const knownKeys = new Set(all.map(s => s.key));
    const entries = Object.entries(body.settings).filter(([key]) => knownKeys.has(key));
    await this.settingsService.bulkSet(entries.map(([key, value]) => ({ key, value: String(value) })));
    const skipped = Object.keys(body.settings).length - entries.length;
    return {
      imported: entries.length,
      skipped,
      message: `Imported ${entries.length} settings${skipped > 0 ? `, skipped ${skipped} unknown keys` : ''}.`,
    };
  }
}
