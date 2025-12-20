import { ethers } from 'ethers';
import { EventEmitter } from 'events';

export interface EthereumConfig {
  rpcUrl: string;
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer?: string;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  nonce: number;
  data: string;
  chainId: number;
}

export class EthereumConnector extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private config: EthereumConfig;
  private blockSubscription: any;

  constructor(config: EthereumConfig) {
    super();
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      const network = await this.provider.getNetwork();
      console.log(`Connected to ${this.config.chainName}:`, network.chainId);

      // Subscribe to new blocks
      this.subscribeToBlocks();

      this.emit('connected', { chainId: this.config.chainId });
    } catch (error) {
      console.error('Failed to connect to Ethereum:', error);
      throw error;
    }
  }

  private subscribeToBlocks(): void {
    this.provider.on('block', async (blockNumber) => {
      const block = await this.provider.getBlock(blockNumber);
      this.emit('block', block);
    });
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    try {
      const erc20Abi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ];

      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await contract.balanceOf(walletAddress);
      const decimals = await contract.decimals();

      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Failed to get token balance:', error);
      throw error;
    }
  }

  async sendTransaction(
    privateKey: string,
    to: string,
    value: string,
    data?: string
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);

      const tx = await wallet.sendTransaction({
        to,
        value: ethers.parseEther(value),
        data: data || '0x',
      });

      console.log('Transaction sent:', tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt?.hash);

      return tx.hash;
    } catch (error) {
      console.error('Failed to send transaction:', error);
      throw error;
    }
  }

  async sendTokens(
    privateKey: string,
    tokenAddress: string,
    to: string,
    amount: string
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(privateKey, this.provider);

      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
      ];

      const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
      const decimals = await contract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);

      const tx = await contract.transfer(to, amountInWei);
      console.log('Token transfer sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('Token transfer confirmed:', receipt?.hash);

      return tx.hash;
    } catch (error) {
      console.error('Failed to send tokens:', error);
      throw error;
    }
  }

  async estimateGas(
    from: string,
    to: string,
    value: string,
    data?: string
  ): Promise<string> {
    try {
      const gasEstimate = await this.provider.estimateGas({
        from,
        to,
        value: ethers.parseEther(value),
        data: data || '0x',
      });

      return gasEstimate.toString();
    } catch (error) {
      console.error('Failed to estimate gas:', error);
      throw error;
    }
  }

  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.provider.getFeeData();
      return ethers.formatUnits(feeData.gasPrice || 0, 'gwei');
    } catch (error) {
      console.error('Failed to get gas price:', error);
      throw error;
    }
  }

  async getTransaction(txHash: string): Promise<Transaction | null> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      
      if (!tx) return null;

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        gasPrice: ethers.formatUnits(tx.gasPrice || 0, 'gwei'),
        gasLimit: tx.gasLimit.toString(),
        nonce: tx.nonce,
        data: tx.data,
        chainId: Number(tx.chainId),
      };
    } catch (error) {
      console.error('Failed to get transaction:', error);
      throw error;
    }
  }

  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<any> {
    try {
      const receipt = await this.provider.waitForTransaction(txHash, confirmations);
      return receipt;
    } catch (error) {
      console.error('Failed to wait for transaction:', error);
      throw error;
    }
  }

  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async getBlock(blockNumber: number): Promise<any> {
    return await this.provider.getBlock(blockNumber);
  }

  disconnect(): void {
    if (this.blockSubscription) {
      this.provider.off('block', this.blockSubscription);
    }
    this.removeAllListeners();
    console.log('Ethereum connector disconnected');
  }
}

// Pre-configured connectors for different chains
export const ethereumMainnet = new EthereumConnector({
  rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  chainId: 1,
  chainName: 'Ethereum Mainnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://etherscan.io',
});

export const polygon = new EthereumConnector({
  rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  chainId: 137,
  chainName: 'Polygon',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  blockExplorer: 'https://polygonscan.com',
});

export const arbitrum = new EthereumConnector({
  rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  chainId: 42161,
  chainName: 'Arbitrum One',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://arbiscan.io',
});

export const optimism = new EthereumConnector({
  rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  chainId: 10,
  chainName: 'Optimism',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://optimistic.etherscan.io',
});

export const base = new EthereumConnector({
  rpcUrl: process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
  chainId: 8453,
  chainName: 'Base',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  blockExplorer: 'https://basescan.org',
});
