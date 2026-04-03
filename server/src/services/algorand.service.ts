/**
 * Algorand Service
 * Handles all blockchain interactions for AlgoEscrow
 */

import algosdk from 'algosdk';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';

// State labels mapping
const STATE_LABELS: Record<number, string> = {
  0: 'CREATED',
  1: 'FUNDED',
  2: 'DELIVERED',
  3: 'COMPLETED',
  4: 'DISPUTED',
  5: 'REFUNDED',
  6: 'CANCELLED',
};

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
   * Get current blockchain round
   */
  async getCurrentRound(): Promise<number> {
    const status = await this.algodClient.status().do();
    return Number(status['last-round']);
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
            globalState[key] = Number(value.uint);
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
      try {
        return algosdk.encodeAddress(new Uint8Array(bytes));
      } catch {
        return '';
      }
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
   * Get escrow state by App ID - THE MOST IMPORTANT METHOD
   */
  async getEscrowState(escrowAppId: number) {
    const rawState = await this.getGlobalState(escrowAppId);
    const parsed = this.parseEscrowState(rawState);
    const currentRound = await this.getCurrentRound();
    
    return {
      ...parsed,
      currentRound,
      roundsRemaining: Math.max(0, parsed.deadlineRound - currentRound),
      stateName: STATE_LABELS[parsed.state] || 'UNKNOWN',
      isExpired: currentRound > parsed.deadlineRound,
    };
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
   * Build unsigned fund transactions for buyer to sign
   */
  async buildFundTransactions(appId: number, buyerAddress: string, amountMicroAlgo: number): Promise<string[]> {
    const escrowAddress = this.getApplicationAddress(appId);
    const params = await this.getSuggestedParams();

    // Transaction 1: Payment to escrow address
    const payTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: buyerAddress,
      to: escrowAddress,
      amount: amountMicroAlgo,
      suggestedParams: params,
    });

    // Transaction 2: App call to fund() method
    const fundSelector = new Uint8Array(Buffer.from('fund(pay)void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: buyerAddress,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [fundSelector],
      suggestedParams: params,
    });

    // Group the transactions
    algosdk.assignGroupID([payTxn, appCallTxn]);

    // Return as base64 encoded unsigned transactions
    return [
      Buffer.from(algosdk.encodeUnsignedTransaction(payTxn)).toString('base64'),
      Buffer.from(algosdk.encodeUnsignedTransaction(appCallTxn)).toString('base64'),
    ];
  }

  /**
   * Build unsigned confirm delivery transaction
   */
  async buildConfirmDeliveryTransaction(appId: number, callerAddress: string): Promise<string> {
    const params = await this.getSuggestedParams();
    
    const confirmSelector = new Uint8Array(Buffer.from('confirmDelivery()void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: callerAddress,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [confirmSelector],
      suggestedParams: params,
    });

    return Buffer.from(algosdk.encodeUnsignedTransaction(appCallTxn)).toString('base64');
  }

  /**
   * Build unsigned raise dispute transaction
   */
  async buildRaiseDisputeTransaction(appId: number, disputerAddress: string): Promise<string> {
    const params = await this.getSuggestedParams();
    
    const disputeSelector = new Uint8Array(Buffer.from('raiseDispute()void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: disputerAddress,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [disputeSelector],
      suggestedParams: params,
    });

    return Buffer.from(algosdk.encodeUnsignedTransaction(appCallTxn)).toString('base64');
  }

  /**
   * Oracle: Confirm delivery (backend signs and submits)
   */
  async oracleConfirmDelivery(appId: number): Promise<string> {
    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized');
    }

    const params = await this.getSuggestedParams();
    
    const confirmSelector = new Uint8Array(Buffer.from('confirmDelivery()void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [confirmSelector],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(this.algodClient, txId, 4);
    
    return txId;
  }

  /**
   * Oracle: Submit deliverables hash on-chain
   */
  async oracleSubmitDeliverables(appId: number, deliverablesHash: Uint8Array): Promise<string> {
    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized');
    }

    const params = await this.getSuggestedParams();
    
    const submitSelector = new Uint8Array(Buffer.from('submitDeliverables(byte[32])void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [submitSelector, deliverablesHash],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(this.algodClient, txId, 4);
    
    return txId;
  }

  /**
   * Oracle: Record AI verdict on-chain
   */
  async oracleRecordAiVerdict(appId: number, approved: boolean, score: number, note: string): Promise<string> {
    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized');
    }

    const params = await this.getSuggestedParams();
    
    const verdictSelector = new Uint8Array(Buffer.from('aiVerdict(bool,uint64,string)void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [
        verdictSelector,
        new Uint8Array([approved ? 1 : 0]),
        algosdk.encodeUint64(score),
        new Uint8Array(Buffer.from(note)),
      ],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(this.algodClient, txId, 4);
    
    return txId;
  }

  /**
   * Arbiter: Resolve dispute
   */
  async arbiterResolveDispute(appId: number, releaseToSeller: boolean): Promise<string> {
    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized');
    }

    const params = await this.getSuggestedParams();
    
    const resolveSelector = new Uint8Array(Buffer.from('resolveDispute(bool)void'.slice(0, 4)));
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr,
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [
        resolveSelector,
        new Uint8Array([releaseToSeller ? 1 : 0]),
      ],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = await this.algodClient.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(this.algodClient, txId, 4);
    
    return txId;
  }

  /**
   * Get all escrows for a given wallet address using indexer
   */
  async getEscrowsByAddress(address: string): Promise<any[]> {
    try {
      // Search for applications created by this address or where address is involved
      const result = await this.indexerClient
        .searchForApplications()
        .creator(address)
        .do();

      const escrows = [];
      
      for (const app of result.applications || []) {
        try {
          const state = await this.getEscrowState(app.id);
          // Check if this address is buyer or seller
          if (state.buyer === address || state.seller === address) {
            escrows.push({
              appId: app.id,
              appAddress: this.getApplicationAddress(app.id),
              ...state,
              loraUrl: `https://lora.algokit.io/${process.env.ALGORAND_NETWORK || 'testnet'}/application/${app.id}`,
            });
          }
        } catch (e) {
          // Skip apps that aren't escrows or have issues
        }
      }

      return escrows;
    } catch (error) {
      console.error('Error getting escrows by address:', error);
      return [];
    }
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

  /**
   * Submit multiple signed transactions (atomic group)
   */
  async submitTransactionGroup(signedTxns: Uint8Array[]) {
    try {
      const { txId } = await this.algodClient.sendRawTransaction(signedTxns).do();
      await algosdk.waitForConfirmation(this.algodClient, txId, 4);
      return txId;
    } catch (error) {
      console.error('Error submitting transaction group:', error);
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

  getIndexerClient(): algosdk.Indexer {
    return this.indexerClient;
  }
}

export const algorandService = new AlgorandService();
