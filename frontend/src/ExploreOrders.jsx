import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {EXCHANGE_ADDRESS, EXCHANGE_TX_HASH, EXCHANGE_ABI, ERC20_ABI} from './exchangeConfig.js';
import { RefreshCw, AlertCircle, Clock } from 'lucide-react';

export default function ExploreOrders({ account }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenMeta, setTokenMeta] = useState({});
  
  // New state variables for filtering and sorting
  const [showExpired, setShowExpired] = useState(false);
  const [sortByExpiry, setSortByExpiry] = useState('desc');

  useEffect(() => {
    fetchOrders();
  }, [account]);

  const fetchOrders = async () => {
    if (!window.ethereum) {
      setError("MetaMask not found!");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, provider);

      // Query past events based on orders created
      const filter = contract.filters.PostedOrder();

      let logs = [];
      try {
        let creationBlock = 0;

        if (EXCHANGE_TX_HASH) {
          try {
              const txReceipt = await provider.getTransactionReceipt(EXCHANGE_TX_HASH);
              if (txReceipt) creationBlock = txReceipt.blockNumber;
          } catch(e) {
              console.log("Could not fetch tx receipt", e);
          }
        }

        const currentBlockNumber = await provider.getBlockNumber();
        
        // If we still don't have a fromBlock, start from 100k blocks ago
        if (creationBlock === 0) {
          creationBlock = Math.max(0, currentBlockNumber - 100000);

        }

        // Fetch logs in chunks of 50000 blocks to avoid public RPC limit errors
        const maxChunkSize = 50000;
        for (let i = creationBlock; i <= currentBlockNumber; i += maxChunkSize) {
          const toBlock = Math.min(i + maxChunkSize - 1, currentBlockNumber);
          try {
            const chunkLogs = await contract.queryFilter(filter, i, toBlock);
            logs.push(...chunkLogs);
          } catch (chunkError) {
            console.warn(`Failed to fetch logs chunk ${i}-${toBlock}`, chunkError);
          }
        }
      } catch (err) {
        console.warn("Failed block range log fetching, falling back...", err);
        logs = await contract.queryFilter(filter, -10000, "latest").catch(() => []);
      }

      const parsedOrders = logs.map(log => {
        return {
          seller: log.args[0],
          tokenSold: log.args[1],
          tokenWant: log.args[2],
          amountSold: log.args[3],
          amountWant: log.args[4],
          expiry: log.args[5] * 1000n,
          nonce: log.args[6],
          sig: log.args[7],
          hash: log.args[8],
        };
      });

      // Fetch remaining amounts
      const ordersWithData = await Promise.all(
        parsedOrders.map(async (order) => {
          const data = await contract.hashToData(order.hash);
          let soldLeft = data.soldLeft;

          return {
            ...order,
            soldLeft,
            buyerNonce: data.buyerNonce
          };
        })
      );

      // Extract unique tokens to fetch metadata
      const tokenAddresses = new Set();
      ordersWithData.forEach(o => {
        tokenAddresses.add(o.tokenSold);
        tokenAddresses.add(o.tokenWant);
      });

      const meta = { ...tokenMeta };
      await Promise.all(
        Array.from(tokenAddresses).map(async (addr) => {
          if (!meta[addr]) {
            try {
              const tokenContract = new ethers.Contract(addr, ERC20_ABI, provider);
              const symbol = await tokenContract.symbol();
              const decimals = await tokenContract.decimals();
              meta[addr] = { symbol, decimals: Number(decimals) };
            } catch (e) {
              console.warn("Could not fetch meta for token", addr, e);
              // Fallback if token doesn't support symbol/decimals
              meta[addr] = { 
                symbol: `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`, 
                decimals: 18 
              };
            }
          }
        })
      );
      setTokenMeta(meta);
      setOrders(ordersWithData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch orders. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  const getTokenSymbol = (addr) => tokenMeta[addr]?.symbol || formatAddress(addr);
  const getTokenDecimals = (addr) => tokenMeta[addr]?.decimals || 18;

  // Filter and sort the displayed orders dynamically
  const now = BigInt(Date.now());
  
  let displayedOrders = orders.filter(o => o.soldLeft > 0n);
  
  if (!showExpired) {
    displayedOrders = displayedOrders.filter(o => o.expiry > now);
  }

  // Sort orders by expiry
  displayedOrders.sort((a, b) => {
    if (sortByExpiry === 'desc') {
      return Number(b.expiry - a.expiry);
    } else {
      return Number(a.expiry - b.expiry);
    }
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Explore Orders</h2>
          <p className="text-slate-500 text-sm">
            Discover and fill orders on the network 
            <br></br> 
            Orders with 0 tokens available for buying are not displayed. 
          </p>
        </div>
        
        {/* Sorting and Filtering Controls */}
        <div className="flex items-center space-x-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
          <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer hover:text-slate-900 transition-colors">
            <input 
              type="checkbox" 
              checked={showExpired} 
              onChange={(e) => setShowExpired(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            />
            <span className="font-medium">Show Expired</span>
          </label>
          
          <div className="h-6 w-px bg-slate-200"></div>
          
          <select 
            value={sortByExpiry}
            onChange={(e) => setSortByExpiry(e.target.value)}
            className="text-sm border-0 bg-transparent text-slate-600 focus:ring-0 cursor-pointer font-medium hover:text-slate-900 transition-colors outline-none"
          >
            <option value="desc">Expiry: Newest First</option>
            <option value="asc">Expiry: Oldest First</option>
          </select>

          <div className="h-6 w-px bg-slate-200"></div>

          <button 
            onClick={fetchOrders}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg transition-all disabled:opacity-50 shadow-sm border border-slate-200"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start border border-red-100">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading && !error && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Scanning the blockchain for orders...</p>
        </div>
      )}

      {!loading && !error && displayedOrders.length === 0 && (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <p className="text-slate-500">No active orders found.</p>
        </div>
      )}

      {!loading && !error && displayedOrders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedOrders.map((order, i) => {
            const isExpired = order.expiry <= now;
            
            return (
              <div key={order.hash + i} className={`p-5 border ${isExpired ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300'} rounded-xl hover:shadow-md transition-all group relative overflow-hidden`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-2">
                    <div className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isExpired ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      Sell
                    </div>
                    <span className="font-semibold text-sm text-slate-700" title={order.tokenSold}>
                      {getTokenSymbol(order.tokenSold)}
                    </span>
                  </div>
                  <div className={`flex items-center space-x-1.5 ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
                    {isExpired && <span className="text-[10px] font-bold uppercase tracking-wider">Expired</span>}
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">
                      Exp: {new Date(Number(order.expiry)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className={`flex items-center justify-between mb-4 ${isExpired ? 'opacity-70' : ''}`}>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500 mb-1">Amount Available</span>
                    <span className="text-lg font-bold text-slate-900">
                      {ethers.formatUnits(order.soldLeft, getTokenDecimals(order.tokenSold))} <span className="text-sm font-normal text-slate-500">{getTokenSymbol(order.tokenSold)}</span>
                    </span>
                  </div>
                  <div className="w-8 flex items-center justify-center">
                    <div className={`h-px w-full ${isExpired ? 'bg-red-200' : 'bg-slate-300'}`}></div>
                    <div className={`mx-2 ${isExpired ? 'text-red-300' : 'text-slate-400'}`}>→</div>
                    <div className={`h-px w-full ${isExpired ? 'bg-red-200' : 'bg-slate-300'}`}></div>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs text-slate-500 mb-1">You Pay (Total)</span>
                    <span className="text-lg font-bold text-slate-900">
                      {ethers.formatUnits(order.amountWant, getTokenDecimals(order.tokenWant))} <span className="text-sm font-normal text-slate-500">{getTokenSymbol(order.tokenWant)}</span>
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs flex items-center">
                    <span className="mr-1">Exchange Rate: 1 {getTokenSymbol(order.tokenSold)} to </span>
                    <span className="mr-1">{ethers.formatUnits(order.amountWant, getTokenDecimals(order.tokenWant)) / ethers.formatUnits(order.amountSold, getTokenDecimals(order.tokenSold))} {getTokenSymbol(order.tokenWant)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200/60 mt-2">
                  <div className="text-xs text-slate-500 flex items-center">
                    <span className="mr-1">Seller:</span>
                    <span className="font-mono">{formatAddress(order.seller)}</span>
                  </div>
                  <button 
                    disabled={isExpired}
                    className={`${isExpired ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'} px-4 py-2 rounded-lg text-sm font-semibold transition-colors`}
                    // TODO: Implement order filling
                  >
                    {isExpired ? 'Expired' : 'Fill Order'}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
