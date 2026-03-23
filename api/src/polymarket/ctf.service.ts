import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { SettingsService } from '../settings/settings.service';

const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const GAS_BUFFER_PCT = 130; // 30% safety buffer over estimated gas
const GAS_FALLBACK = 300000;

const CTF_ABI = [
  'function splitPosition(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount)',
  'function mergePositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] partition, uint256 amount)',
  'function redeemPositions(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] indexSets)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function getOutcomeSlotCount(bytes32 conditionId) view returns (uint256)',
  'function payoutNumerators(bytes32 conditionId, uint256 index) view returns (uint256)',
  'function payoutDenominator(bytes32 conditionId) view returns (uint256)',
];

const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

@Injectable()
export class CtfService implements OnModuleInit {
  private readonly logger = new Logger(CtfService.name);
  private provider: ethers.providers.JsonRpcProvider | null = null;
  private signer: ethers.Wallet | null = null;

  constructor(private settings: SettingsService) {}

  async onModuleInit() {
    await this.initProvider();
  }

  async initProvider() {
    try {
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        this.logger.warn('PRIVATE_KEY not set – CTF service not initialized');
        return;
      }

      // Prefer DB setting, fall back to env var, then public endpoint
      const dbRpc = await this.settings.get('POLYGON_RPC_URL').catch(() => '');
      const rpcUrl = (dbRpc && dbRpc.trim())
        ? dbRpc.trim()
        : (process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com');

      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`CTF service initialized — RPC: ${rpcUrl}`);
    } catch (err) {
      this.logger.error(`CTF init error: ${err.message}`);
    }
  }

  async getTokenBalance(tokenId: string, address?: string): Promise<number> {
    if (!this.provider) return 0;
    try {
      const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.provider);
      const addr = address || process.env.PROXY_WALLET_ADDRESS;
      const raw = await ctf.balanceOf(addr, tokenId);
      return parseFloat(ethers.utils.formatUnits(raw, 6));
    } catch {
      return 0;
    }
  }

  async getPayoutNumerator(conditionId: string, outcomeIndex: number): Promise<number> {
    if (!this.provider) return 0;
    try {
      const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.provider);
      const num = await ctf.payoutNumerators(conditionId, outcomeIndex);
      return num.toNumber();
    } catch {
      return 0;
    }
  }

  async splitPosition(conditionId: string, amount: number): Promise<string | null> {
    if (!this.signer) return null;
    try {
      const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.signer);
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      const args = [USDC_ADDRESS, ethers.constants.HashZero, conditionId, [1, 2], amountWei] as const;

      const gasLimit = await ctf.estimateGas.splitPosition(...args)
        .then(e => e.mul(GAS_BUFFER_PCT).div(100))
        .catch(() => ethers.BigNumber.from(GAS_FALLBACK));

      const tx = await ctf.splitPosition(...args, { gasLimit });
      const receipt = await tx.wait();
      this.logger.log(`splitPosition tx: ${receipt.transactionHash}`);
      return receipt.transactionHash as string;
    } catch (err) {
      this.logger.error(`splitPosition error: ${err.message}`);
      return null;
    }
  }

  async mergePositions(conditionId: string, amount: number): Promise<string | null> {
    if (!this.signer) return null;
    try {
      const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.signer);
      const amountWei = ethers.utils.parseUnits(amount.toString(), 6);
      const args = [USDC_ADDRESS, ethers.constants.HashZero, conditionId, [1, 2], amountWei] as const;

      const gasLimit = await ctf.estimateGas.mergePositions(...args)
        .then(e => e.mul(GAS_BUFFER_PCT).div(100))
        .catch(() => ethers.BigNumber.from(GAS_FALLBACK));

      const tx = await ctf.mergePositions(...args, { gasLimit });
      const receipt = await tx.wait();
      this.logger.log(`mergePositions tx: ${receipt.transactionHash}`);
      return receipt.transactionHash as string;
    } catch (err) {
      this.logger.error(`mergePositions error: ${err.message}`);
      return null;
    }
  }

  async redeemPositions(conditionId: string): Promise<string | null> {
    if (!this.signer) return null;
    try {
      const ctf = new ethers.Contract(CTF_ADDRESS, CTF_ABI, this.signer);
      const args = [USDC_ADDRESS, ethers.constants.HashZero, conditionId, [1, 2]] as const;

      const gasLimit = await ctf.estimateGas.redeemPositions(...args)
        .then(e => e.mul(GAS_BUFFER_PCT).div(100))
        .catch(() => ethers.BigNumber.from(GAS_FALLBACK));

      const tx = await ctf.redeemPositions(...args, { gasLimit });
      const receipt = await tx.wait();
      this.logger.log(`redeemPositions tx: ${receipt.transactionHash}`);
      return receipt.transactionHash as string;
    } catch (err) {
      this.logger.error(`redeemPositions error: ${err.message}`);
      return null;
    }
  }
}
