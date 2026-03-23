import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { ethers } from 'ethers';

@Injectable()
export class ClobService implements OnModuleInit {
  private readonly logger = new Logger(ClobService.name);
  private client: ClobClient | null = null;

  async onModuleInit() {
    await this.initClient();
  }

  private async initClient() {
    try {
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        this.logger.warn('PRIVATE_KEY not set – CLOB client not initialized');
        return;
      }
      const wallet = new ethers.Wallet(privateKey);
      this.client = new ClobClient('https://clob.polymarket.com', 137, wallet);
      await this.client.deriveApiKey();
      this.logger.log('CLOB client initialized');
    } catch (err) {
      this.logger.error(`Failed to init CLOB client: ${err.message}`);
    }
  }

  getClient(): ClobClient | null {
    return this.client;
  }

  async getBalance(): Promise<number> {
    if (!this.client) return 0;
    try {
      const resp = await fetch(
        `https://clob.polymarket.com/balance?address=${process.env.PROXY_WALLET_ADDRESS}`,
      );
      const data = await resp.json();
      return parseFloat(data.balance || '0');
    } catch {
      return 0;
    }
  }

  async getMidpoint(tokenId: string): Promise<number> {
    try {
      // Public endpoint — no auth required, works in dry-run mode too
      const resp = await fetch(`https://clob.polymarket.com/midpoint?token_id=${tokenId}`);
      if (!resp.ok) return 0;
      const data = await resp.json();
      return parseFloat(data.mid || '0');
    } catch {
      return 0;
    }
  }

  async placeFOKOrder(tokenId: string, side: 'BUY' | 'SELL', price: number, size: number): Promise<any> {
    if (!this.client) throw new Error('CLOB client not initialized');
    const order = await this.client.createMarketOrder({
      tokenID: tokenId,
      side: side === 'BUY' ? Side.BUY : Side.SELL,
      amount: size,
      price,
    });
    return this.client.postOrder(order, OrderType.FOK);
  }

  async placeGTCOrder(tokenId: string, side: 'BUY' | 'SELL', price: number, size: number): Promise<any> {
    if (!this.client) throw new Error('CLOB client not initialized');
    const order = await this.client.createOrder({
      tokenID: tokenId,
      side: side === 'BUY' ? Side.BUY : Side.SELL,
      size,
      price,
    });
    return this.client.postOrder(order, OrderType.GTC);
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.cancelOrder({ orderID: orderId });
    } catch (err) {
      this.logger.warn(`Cancel order ${orderId} failed: ${err.message}`);
    }
  }

  async cancelAllOrders(tokenId: string): Promise<void> {
    if (!this.client) return;
    try {
      const orders = await this.client.getOpenOrders({ asset_id: tokenId });
      await Promise.all(
        (orders as any[]).map(o => this.cancelOrder(o.id)),
      );
    } catch (err) {
      this.logger.warn(`Cancel all orders for ${tokenId} failed: ${err.message}`);
    }
  }

  async getOpenOrders(tokenId: string): Promise<any[]> {
    if (!this.client) return [];
    try {
      return (await this.client.getOpenOrders({ asset_id: tokenId })) as any[];
    } catch {
      return [];
    }
  }

  async getOrderStatus(orderId: string): Promise<any> {
    if (!this.client) return null;
    try {
      return await this.client.getOrder(orderId);
    } catch {
      return null;
    }
  }
}
