import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
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
}
