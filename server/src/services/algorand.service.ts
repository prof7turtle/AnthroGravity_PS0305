/**
 * Algorand Service
 * Handles all blockchain interactions for AlgoEscrow
 */

import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';

class AlgorandService {
  private algorand: AlgorandClient;
  private algodClient: algosdk.Algodv2;
  private indexerClient: algosdk.Indexer;
  private factoryAppId: number;
  private templateAppId: number;
  private oracleAccount: algosdk.Account | null = null;

  constructor() {
    const network = process.env.ALGORAND_NETWORK || 'localnet';
    const algodUrl = process.env.ALGORAND_ALGOD_URL || 'http://localhost:4001';
    const algodToken = process.env.ALGORAND_ALGOD_TOKEN || 'a'.repeat(64);
    const indexerUrl = process.env.ALGORAND_INDEXER_URL || 'http://localhost:8980';

    // Initialize clients
    this.algodClient = new algosdk.Algodv2(algodToken, algodUrl, '');
    this.indexerClient = new algosdk.Indexer('', indexerUrl, '');
    
    this.algorand = AlgorandClient.fromClients({
      algod: this.algodClient,
      indexer: this.indexerClient,
    });

    // Load App IDs
    this.factoryAppId = parseInt(process.env.ESCROW_FACTORY_APP_ID || '0');
    this.templateAppId = parseInt(process.env.ESCROW_CONTRACT_TEMPLATE_APP_ID || '0');

    if (!this.factoryAppId || !this.templateAppId) {
      console.warn('⚠️  Warning: App IDs not set in environment variables');
    }

    console.log(`✅ Algorand Service initialized:`);
    console.log(`   Network: ${network}`);
    console.log(`   Factory App ID: ${this.factoryAppId}`);
    console.log(`   Template App ID: ${this.templateAppId}`);
  }

  /**
   * Initialize oracle account for backend operations
   */
  async initializeOracle(): Promise<void> {
    const network = process.env.ALGORAND_NETWORK || 'localnet';
    
    if (network === 'localnet') {
      try {
        const kmdAccount = await this.algorand.account.fromKmd('unencrypted-default-wallet');
        this.oracleAccount = {
          addr: kmdAccount.addr,
          sk: new Uint8Array(0),
        } as any;
        console.log(`✅ Oracle account from KMD: ${kmdAccount.addr}`);
      } catch (error) {
        console.error('❌ Failed to get KMD account:', error);
      }
    } else {
      const mnemonic = process.env.ORACLE_MNEMONIC;
      if (mnemonic) {
        this.oracleAccount = algosdk.mnemonicToSecretKey(mnemonic);
        console.log(`✅ Oracle account from mnemonic: ${this.oracleAccount.addr}`);
      } else {
        console.warn('⚠️  Oracle mnemonic not set');
      }
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(address: string) {
    try {
      return await this.algodClient.accountInformation(address).do();
    } catch (error) {
      console.error(`Error getting account info for ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get application information
   */
  async getApplicationInfo(appId: number) {
    try {
      return await this.algodClient.getApplicationByID(appId).do();
    } catch (error) {
      console.error(`Error getting app info for ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Get global state of an application
   */
  async getGlobalState(appId: number): Promise<Record<string, any>> {
    try {
      const appInfo = await this.getApplicationInfo(appId);
      const globalState: Record<string, any> = {};

      if (appInfo.params['global-state']) {
        for (const item of appInfo.params['global-state']) {
          const key = Buffer.from(item.key, 'base64').toString('utf-8');
          const value = item.value;

          if (value.type === 1) {
            globalState[key] = Buffer.from(value.bytes, 'base64');
          } else if (value.type === 2) {
            globalState[key] = value.uint;
          }
        }
      }

      return globalState;
    } catch (error) {
      console.error(`Error getting global state for app ${appId}:`, error);
      throw error;
    }
  }

  /**
   * Parse escrow global state into readable format
   */
  parseEscrowState(rawState: Record<string, any>) {
    const parseAddress = (bytes: Buffer): string => {
      return algosdk.encodeAddress(new Uint8Array(bytes));
    };

    return {
      buyer: rawState.buyer ? parseAddress(rawState.buyer) : null,
      seller: rawState.seller ? parseAddress(rawState.seller) : null,
      amount: rawState.amount || 0,
      state: rawState.state || 0,
      escrowType: rawState.escrow_type || 0,
      itemName: rawState.item_name ? rawState.item_name.toString('utf-8') : '',
      createdRound: rawState.created_round || 0,
      deadlineRound: rawState.deadline_round || 0,
      platformFeeBps: rawState.platform_fee_bps || 0,
      platformTreasury: rawState.platform_treasury ? parseAddress(rawState.platform_treasury) : null,
      arbiter: rawState.arbiter ? parseAddress(rawState.arbiter) : null,
      requirementsHash: rawState.requirements_hash || null,
      deliverablesHash: rawState.deliverables_hash || null,
      aiScore: rawState.ai_score || 0,
      aiVerdictNote: rawState.ai_verdict_note ? rawState.ai_verdict_note.toString('utf-8') : '',
      disputeRaisedBy: rawState.dispute_raised_by ? parseAddress(rawState.dispute_raised_by) : null,
      lastTxnNote: rawState.last_txn_note ? rawState.last_txn_note.toString('utf-8') : '',
    };
  }

  /**
   * Get escrow state by App ID
   */
  async getEscrowState(escrowAppId: number) {
    const rawState = await this.getGlobalState(escrowAppId);
    return this.parseEscrowState(rawState);
  }

  /**
   * Get application address (contract address)
   */
  getApplicationAddress(appId: number): string {
    return algosdk.getApplicationAddress(appId);
  }

  /**
   * Get suggested transaction params
   */
  async getSuggestedParams() {
    return await this.algodClient.getTransactionParams().do();
  }

  /**
   * Submit signed transaction
   */
  async submitTransaction(signedTxn: Uint8Array) {
    try {
      const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
      await algosdk.waitForConfirmation(this.algodClient, txId, 4);
      return txId;
    } catch (error) {
      console.error('Error submitting transaction:', error);
      throw error;
    }
  }

  getFactoryAppId(): number {
    return this.factoryAppId;
  }

  getTemplateAppId(): number {
    return this.templateAppId;
  }

  getOracleAddress(): string | null {
    return this.oracleAccount?.addr || null;
  }

  getAlgorandClient(): AlgorandClient {
    return this.algorand;
  }

  getAlgodClient(): algosdk.Algodv2 {
    return this.algodClient;
  }
}

export const algorandService = new AlgorandService();
