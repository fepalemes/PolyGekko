import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClobClient, Side, OrderType } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
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

      const proxyAddress = process.env.PROXY_WALLET_ADDRESS_MAIN;
      if (!proxyAddress) {
        this.logger.warn('PROXY_WALLET_ADDRESS_MAIN not set – CLOB client not initialized');
        return;
      }

      // SIGNATURE_TYPE: 0=EOA, 1=POLY_PROXY (standard proxy), 2=POLY_GNOSIS_SAFE (relayer/Safe)
      const sigTypeEnv = parseInt(process.env.SIGNATURE_TYPE ?? '1', 10);
      const signatureType: SignatureType = [0, 1, 2].includes(sigTypeEnv)
        ? (sigTypeEnv as SignatureType)
        : SignatureType.POLY_PROXY;

      // Normalize: strip 0x prefix if present, left-pad to 64 hex chars, then re-add 0x
      // (Polymarket relayer may return a 63-char key missing a leading zero)
      const hexKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      const normalizedKey = `0x${hexKey.padStart(64, '0')}`;
      const wallet = new ethers.Wallet(normalizedKey);
      // Step 1: temp client (no creds) to derive/create the API key
      // Per clob-client issue #202: derive first, create only if key is missing
      const tempClient = new ClobClient('https://clob.polymarket.com', 137, wallet, undefined, signatureType, proxyAddress);
      let rawCreds = await tempClient.deriveApiKey() as any;
      if (!rawCreds.key) {
        this.logger.log('No existing API key for nonce 0 — creating new one');
        rawCreds = await tempClient.createApiKey() as any;
      }

      // SDK returns .key but ClobClient uses .apiKey internally for authenticated requests
      // Pass both fields to satisfy all internal checks (issue #202)
      const resolvedKey = rawCreds.key ?? rawCreds.apiKey;
      const creds = {
        key: resolvedKey,
        apiKey: resolvedKey,
        secret: rawCreds.secret,
        passphrase: rawCreds.passphrase,
      };

      // Step 2: real client with credentials attached
      this.client = new ClobClient('https://clob.polymarket.com', 137, wallet, creds, signatureType, proxyAddress);
      this.logger.log(`CLOB client initialized (signatureType=${SignatureType[signatureType]}, proxy=${proxyAddress}, apiKey=${creds.key?.slice(0, 8)}...)`);
    } catch (err) {
      this.logger.error(`Failed to init CLOB client: ${err.message}`);
    }
  }

  getClient(): ClobClient | null {
    return this.client;
  }

  isClientInitialized(): boolean {
    return this.client !== null;
  }

  async ping(): Promise<boolean> {
    try {
      const resp = await fetch('https://clob.polymarket.com/ok', { signal: AbortSignal.timeout(5000) });
      return resp.ok;
    } catch {
      return false;
    }
  }

  async getBalance(): Promise<number> {
    if (!this.client) return 0;
    try {
      const address = process.env.PROXY_WALLET_ADDRESS_MAIN;
      if (!address) return 0;
      
      const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const usdcAbi = ['function balanceOf(address account) view returns (uint256)'];
      const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC.e
      const usdc = new ethers.Contract(usdcAddress, usdcAbi, provider);

      const raw = await usdc.balanceOf(address);
      return parseFloat(ethers.utils.formatUnits(raw, 6));
    } catch (e) {
      this.logger.warn(`Failed to fetch wallet balance: ${e.message}`);
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
