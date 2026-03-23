import { Injectable } from '@nestjs/common';

interface MultiplierWindow {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  factor: number;
}

@Injectable()
export class SniperSizingService {
  private windows: MultiplierWindow[] = [];

  parseMultipliers(config: string) {
    this.windows = [];
    if (!config) return;
    for (const part of config.split(',')) {
      const match = part.trim().match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2}):(\d+\.?\d*)$/);
      if (!match) continue;
      this.windows.push({
        startHour: parseInt(match[1]),
        startMin: parseInt(match[2]),
        endHour: parseInt(match[3]),
        endMin: parseInt(match[4]),
        factor: parseFloat(match[5]),
      });
    }
  }

  getCurrentMultiplier(): number {
    // Convert current UTC time to UTC+8
    const now = new Date();
    const utc8 = new Date(now.getTime() + 8 * 3600 * 1000);
    const hour = utc8.getUTCHours();
    const min = utc8.getUTCMinutes();
    const totalMin = hour * 60 + min;

    for (const w of this.windows) {
      const start = w.startHour * 60 + w.startMin;
      const end = w.endHour * 60 + w.endMin;
      if (totalMin >= start && totalMin < end) return w.factor;
    }
    return 1.0;
  }

  isInSchedule(asset: string, scheduleConfig: string): boolean {
    if (!scheduleConfig) return true;
    const assetUpper = asset.toUpperCase();
    const parts = scheduleConfig.split(',');
    for (const part of parts) {
      const [assetPart, windows] = part.split('=');
      if (!assetPart || !windows) continue;
      if (assetPart.trim().toUpperCase() !== assetUpper) continue;

      const now = new Date();
      const utc8 = new Date(now.getTime() + 8 * 3600 * 1000);
      const hour = utc8.getUTCHours();
      const min = utc8.getUTCMinutes();
      const totalMin = hour * 60 + min;

      for (const window of windows.split(';')) {
        const match = window.trim().match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
        if (!match) continue;
        const start = parseInt(match[1]) * 60 + parseInt(match[2]);
        const end = parseInt(match[3]) * 60 + parseInt(match[4]);
        if (totalMin >= start && totalMin < end) return true;
      }
      return false;
    }
    return true; // Not in schedule config means always active
  }
}
