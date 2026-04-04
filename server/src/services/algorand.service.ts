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
    const configuredMnemonic = String(process.env.ESCROW_MNEMONIC || process.env.ORACLE_MNEMONIC || '').trim();
    const hasConfiguredMnemonic = configuredMnemonic.length > 0 && !/REPLACE_WITH_/i.test(configuredMnemonic);

    const loadMnemonicAccount = (): boolean => {
      if (!hasConfiguredMnemonic) return false;

      try {
        this.oracleAccount = algosdk.mnemonicToSecretKey(configuredMnemonic);
        console.log(`✅ Escrow custody account from mnemonic: ${this.oracleAccount.addr}`);
        return true;
      } catch (error) {
        console.error('❌ Invalid ESCROW_MNEMONIC/ORACLE_MNEMONIC format:', error);
        return false;
      }
    };
    
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
        if (!loadMnemonicAccount()) {
          console.warn('⚠️  On-chain refund is not configured. Set ESCROW_MNEMONIC for the escrow custody account in server/.env');
        }
      }
    } else {
      if (!loadMnemonicAccount()) {
        console.warn('⚠️  On-chain refund is not configured. Set ESCROW_MNEMONIC for the escrow custody account in server/.env');
      }
    }
  }

  /**
   * Get current blockchain round
   */
  async getCurrentRound(): Promise<number> {
    const status = await this.algodClient.status().do();
    return Number((status as any)['last-round'] ?? (status as any).lastRound ?? 0);
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

      const rawGlobalState = (appInfo.params as any)['global-state'] ?? (appInfo.params as any).globalState;
      if (rawGlobalState) {
        for (const item of rawGlobalState) {
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
    return algosdk.getApplicationAddress(appId).toString();
  }

  /**
   * Get suggested transaction params
   */
  async getSuggestedParams() {
    return await this.algodClient.getTransactionParams().do();
  }

  /**
   * Create escrow via factory (backend/oracle signed)
   */
  async createEscrowViaFactory(
    seller: string,
    itemName: string,
    escrowType: number,
    deadlineRounds: number,
    requirementsHash: Uint8Array
  ): Promise<{ appId: number; txId: string }> {
    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized');
    }

    if (!this.factoryAppId || this.factoryAppId <= 0) {
      throw new Error('Factory App ID is not configured');
    }

    const params = await this.getSuggestedParams();
    const selector = algosdk
      .ABIMethod
      .fromSignature('createEscrow(address,byte[],uint64,uint64,byte[],uint64)uint64')
      .getSelector();
    const encode = (type: string, value: any) => algosdk.ABIType.from(type).encode(value);

    const factoryState = await this.getGlobalState(this.factoryAppId).catch(() => ({} as Record<string, any>));
    const decodeAddressFromState = (key: string): string | null => {
      const raw = factoryState?.[key];
      if (!raw || !(raw instanceof Buffer)) return null;
      try {
        return algosdk.encodeAddress(new Uint8Array(raw));
      } catch {
        return null;
      }
    };

    const treasuryAddress = decodeAddressFromState('platform_treasury') || process.env.PLATFORM_TREASURY_ADDRESS || '';
    const arbiterAddress = decodeAddressFromState('arbiter_address') || process.env.ARBITER_ADDRESS || '';
    const appAccounts = Array.from(new Set([
      seller,
      treasuryAddress,
      arbiterAddress,
    ].filter((address) => !!address && algosdk.isValidAddress(address))));

    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr.toString(),
      appIndex: this.factoryAppId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      accounts: appAccounts,
      foreignApps: [this.templateAppId],
      appArgs: [
        selector,
        encode('address', seller),
        encode('byte[]', new Uint8Array(Buffer.from(itemName, 'utf-8'))),
        encode('uint64', BigInt(escrowType)),
        encode('uint64', BigInt(deadlineRounds)),
        encode('byte[]', requirementsHash),
        encode('uint64', BigInt(this.templateAppId)),
      ],
      suggestedParams: {
        ...params,
        fee: 4000,
        flatFee: true,
      },
    });

    const signed = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signed).do()) as any;
    const confirmation: any = await algosdk.waitForConfirmation(this.algodClient, txId, 4);

    const newAppId = Number(confirmation?.['inner-txns']?.[0]?.['application-index'] || 0);
    if (!newAppId) {
      throw new Error('Factory call succeeded but no child app id was returned');
    }

    return { appId: newAppId, txId };
  }

  /**
   * Create escrow directly from template program as a fallback when factory/template ABI is incompatible.
   */
  async createEscrowDirectFromTemplate(
    seller: string,
    itemName: string,
    escrowType: number,
    deadlineRounds: number,
    requirementsHash: Uint8Array,
  ): Promise<{ appId: number; txId: string }> {
    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized');
    }

    if (!this.templateAppId || this.templateAppId <= 0) {
      throw new Error('Template App ID is not configured');
    }

    const templateAppInfo: any = await this.getApplicationInfo(this.templateAppId);
    const templateParams: any = templateAppInfo?.params || {};
    const globalSchema: any = templateParams['global-state-schema'] || templateParams.globalStateSchema || {};
    const localSchema: any = templateParams['local-state-schema'] || templateParams.localStateSchema || {};

    const decodeProgram = (value: unknown, label: string): Uint8Array => {
      if (value instanceof Uint8Array) return value;
      if (Buffer.isBuffer(value)) return new Uint8Array(value);
      if (typeof value === 'string' && value.length > 0) return new Uint8Array(Buffer.from(value, 'base64'));
      throw new Error(`Template ${label} is missing or invalid`);
    };

    const approvalProgram = decodeProgram(
      templateParams['approval-program'] || templateParams.approvalProgram,
      'approval program',
    );
    const clearProgram = decodeProgram(
      templateParams['clear-state-program'] || templateParams.clearStateProgram,
      'clear program',
    );

    const numGlobalInts = Number(globalSchema['num-uint'] ?? globalSchema.numUint ?? 0);
    const numGlobalByteSlices = Number(globalSchema['num-byte-slice'] ?? globalSchema.numByteSlice ?? 0);
    const numLocalInts = Number(localSchema['num-uint'] ?? localSchema.numUint ?? 0);
    const numLocalByteSlices = Number(localSchema['num-byte-slice'] ?? localSchema.numByteSlice ?? 0);
    const extraPages = Number(templateParams['extra-program-pages'] ?? templateParams.extraProgramPages ?? 0);

    const factoryState = this.factoryAppId > 0
      ? await this.getGlobalState(this.factoryAppId).catch(() => ({} as Record<string, any>))
      : ({} as Record<string, any>);

    const decodeAddressFromState = (key: string): string | null => {
      const raw = factoryState?.[key];
      if (!raw || !(raw instanceof Buffer)) return null;
      try {
        return algosdk.encodeAddress(new Uint8Array(raw));
      } catch {
        return null;
      }
    };

    const treasuryAddress = decodeAddressFromState('platform_treasury') || process.env.PLATFORM_TREASURY_ADDRESS || seller;
    const arbiterAddress = decodeAddressFromState('arbiter_address') || process.env.ARBITER_ADDRESS || seller;
    const feeBpsFromState = Number(factoryState?.platform_fee_bps ?? 0);
    const feeBps = feeBpsFromState > 0 ? feeBpsFromState : Number(process.env.PLATFORM_FEE_BPS || 50);

    const currentRound = await this.getCurrentRound();
    const deadlineRound = currentRound + Math.max(1, Number(deadlineRounds || 1));
    const params = await this.getSuggestedParams();
    const encode = (type: string, value: any) => algosdk.ABIType.from(type).encode(value);
    const createSelector = algosdk
      .ABIMethod
      .fromSignature('createApplication(address,byte[],uint64,uint64,byte[],uint64,address,address)void')
      .getSelector();

    const appCreateTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr.toString(),
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram,
      clearProgram,
      numGlobalInts,
      numGlobalByteSlices,
      numLocalInts,
      numLocalByteSlices,
      extraPages,
      accounts: [seller, treasuryAddress, arbiterAddress],
      appArgs: [
        createSelector,
        encode('address', seller),
        encode('byte[]', new Uint8Array(Buffer.from(itemName, 'utf-8'))),
        encode('uint64', BigInt(escrowType)),
        encode('uint64', BigInt(deadlineRound)),
        encode('byte[]', requirementsHash),
        encode('uint64', BigInt(feeBps)),
        encode('address', treasuryAddress),
        encode('address', arbiterAddress),
      ],
      suggestedParams: {
        ...params,
        fee: 4000,
        flatFee: true,
      },
    });

    const signed = appCreateTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signed).do()) as any;
    const confirmation: any = await algosdk.waitForConfirmation(this.algodClient, txId, 4);
    const newAppId = Number(confirmation?.['application-index'] || 0);

    if (!newAppId) {
      throw new Error('Direct template create succeeded but no app id was returned');
    }

    return { appId: newAppId, txId };
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
    const fundSelector = algosdk.ABIMethod.fromSignature('fund(pay)void').getSelector();
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
   * Ensure application account has at least its protocol-required minimum balance.
   * This is required for low-value escrows where fund() amount can be below min balance.
   */
  async ensureApplicationAccountMinBalance(appId: number): Promise<{
    appAddress: string;
    currentBalance: number;
    minBalance: number;
    topUpAmount: number;
    toppedUp: boolean;
    txId?: string;
  }> {
    const appAddress = this.getApplicationAddress(appId);
    const accountInfo: any = await this.getAccountInfo(appAddress);
    const currentBalance = Number(accountInfo?.amount || 0);
    const minBalance = Number(accountInfo?.['min-balance'] ?? accountInfo?.minBalance ?? 100_000);

    if (currentBalance >= minBalance) {
      return {
        appAddress,
        currentBalance,
        minBalance,
        topUpAmount: 0,
        toppedUp: false,
      };
    }

    if (!this.oracleAccount) {
      throw new Error('Oracle account not initialized for app min-balance top-up');
    }

    const topUpAmount = minBalance - currentBalance;
    const params = await this.getSuggestedParams();
    const topUpTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: this.oracleAccount.addr.toString(),
      to: appAddress,
      amount: topUpAmount,
      suggestedParams: params,
    });

    const signed = topUpTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signed).do()) as any;
    await algosdk.waitForConfirmation(this.algodClient, txId, 4);

    return {
      appAddress,
      currentBalance,
      minBalance,
      topUpAmount,
      toppedUp: true,
      txId,
    };
  }

  /**
   * Build unsigned confirm delivery transaction
   */
  async buildConfirmDeliveryTransaction(appId: number, callerAddress: string): Promise<string> {
    const params = await this.getSuggestedParams();
    
    const confirmSelector = algosdk.ABIMethod.fromSignature('confirmDelivery()void').getSelector();
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
    
    const disputeSelector = algosdk.ABIMethod.fromSignature('raiseDispute()void').getSelector();
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
    
    const confirmSelector = algosdk.ABIMethod.fromSignature('confirmDelivery()void').getSelector();
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr.toString(),
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [confirmSelector],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signedTxn).do()) as any;
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
    const encode = (type: string, value: any) => algosdk.ABIType.from(type).encode(value);
    const submitSelector = algosdk.ABIMethod.fromSignature('submitDeliverables(byte[])void').getSelector();
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr.toString(),
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [submitSelector, encode('byte[]', deliverablesHash)],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signedTxn).do()) as any;
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
    const encode = (type: string, value: any) => algosdk.ABIType.from(type).encode(value);
    const verdictSelector = algosdk.ABIMethod.fromSignature('aiVerdict(bool,uint64,byte[])void').getSelector();
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr.toString(),
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [
        verdictSelector,
        encode('bool', approved),
        encode('uint64', BigInt(score)),
        encode('byte[]', new Uint8Array(Buffer.from(note, 'utf-8'))),
      ],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signedTxn).do()) as any;
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
    const encode = (type: string, value: any) => algosdk.ABIType.from(type).encode(value);
    const resolveSelector = algosdk.ABIMethod.fromSignature('arbitrate(bool)void').getSelector();
    const appCallTxn = algosdk.makeApplicationCallTxnFromObject({
      from: this.oracleAccount.addr.toString(),
      appIndex: appId,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      appArgs: [
        resolveSelector,
        encode('bool', releaseToSeller),
      ],
      suggestedParams: params,
    });

    const signedTxn = appCallTxn.signTxn(this.oracleAccount.sk);
    const { txId } = (await this.algodClient.sendRawTransaction(signedTxn).do()) as any;
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
          const appId = Number((app as any).id);
          const state = await this.getEscrowState(appId);
          // Check if this address is buyer or seller
          if (state.buyer === address || state.seller === address) {
            escrows.push({
              appId,
              appAddress: this.getApplicationAddress(appId),
              ...state,
              loraUrl: `https://lora.algokit.io/${process.env.ALGORAND_NETWORK || 'testnet'}/application/${appId}`,
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
      const { txId } = (await this.algodClient.sendRawTransaction(signedTxn).do()) as any;
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
      const { txId } = (await this.algodClient.sendRawTransaction(signedTxns).do()) as any;
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
    return this.oracleAccount?.addr?.toString() || null;
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

type FundingTransaction = {
  txId: string;
  sender: string;
  receiver: string;
  amount: number;
  confirmedRound?: number;
};

const getNetworkLabel = () => process.env.ALGORAND_NETWORK || 'localnet';

export const toLoraAppUrl = (appId?: number | null): string => {
  if (!appId || appId <= 0) return '';
  return `https://lora.algokit.io/${getNetworkLabel()}/application/${appId}`;
};

export const toTransactionExplorerUrl = (txId?: string): string => {
  if (!txId) return '';
  return `https://lora.algokit.io/${getNetworkLabel()}/transaction/${txId}`;
};

export const prepareFundingTransaction = async (input: {
  sender: string;
  receiver: string;
  amount: number;
  escrowId?: string;
}) => {
  const params = await algorandService.getSuggestedParams();
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: input.sender,
    to: input.receiver,
    amount: input.amount,
    note: new TextEncoder().encode(`escrow:${input.escrowId || ''}`),
    suggestedParams: params,
  });

  return {
    txId: txn.txID(),
    unsignedTransaction: Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString('base64'),
  };
};

export const verifyFundingTransaction = async (txId: string): Promise<FundingTransaction> => {
  const response: any = await algorandService.getIndexerClient().lookupTransactionByID(txId).do();
  const txn = response?.transaction;
  if (!txn) throw new Error(`Transaction ${txId} not found`);

  const payment = txn['payment-transaction'];
  if (!payment) throw new Error('Transaction is not a payment transaction');

  return {
    txId: txn.id || txId,
    sender: txn.sender,
    receiver: payment.receiver,
    amount: Number(payment.amount || 0),
    confirmedRound: txn['confirmed-round'],
  };
};

export const discoverFundingTransaction = async (input: {
  sender: string;
  receiver: string;
  amount: number;
}): Promise<FundingTransaction | null> => {
  const minAmount = Math.max(0, Number(input.amount) - 1);
  const maxAmount = Number(input.amount) + 1;

  const search: any = algorandService
    .getIndexerClient()
    .searchForTransactions()
    .txType('pay')
    .address(input.sender)
    .addressRole('sender')
    .currencyGreaterThan(minAmount)
    .currencyLessThan(maxAmount)
    .limit(20);

  const result: any = await search.do();
  const txns: any[] = Array.isArray(result?.transactions) ? result.transactions : [];

  const match = txns.find((txn) => {
    const payment = txn?.['payment-transaction'];
    return (
      payment &&
      txn.sender === input.sender &&
      payment.receiver === input.receiver &&
      Number(payment.amount || 0) === Number(input.amount)
    );
  });

  if (!match) return null;

  return {
    txId: match.id,
    sender: match.sender,
    receiver: match['payment-transaction'].receiver,
    amount: Number(match['payment-transaction'].amount || 0),
    confirmedRound: match['confirmed-round'],
  };
};
