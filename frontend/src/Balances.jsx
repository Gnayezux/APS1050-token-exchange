import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import tokensConfig from './tokensConfig.json';
import { RefreshCw, AlertCircle, PlusCircle, Coins } from 'lucide-react';

export default function Balances({ account }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [minting, setMinting] = useState({}); // tracking minting state by address
  const [mintAmounts, setMintAmounts] = useState({});

  useEffect(() => {
    if (account) {
      fetchBalances();
    }
  }, [account]);

  const fetchBalances = async () => {
    if (!window.ethereum) {
      setError("MetaMask not found!");
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
        } catch (switchError) {
          setError("Please switch to the Sepolia network in MetaMask.");
          setLoading(false);
          return;
        }
      }

      const tokenData = await Promise.all(
        tokensConfig.map(async (tokenDef) => {
          const address = tokenDef.address;
          
          if (!ethers.isAddress(address)) {
              return {
                  ...tokenDef,
                  balance: '0',
                  decimals: 18,
                  error: 'Invalid or placeholder address'
              };
          }

          const abi = [
            "function balanceOf(address account) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
            "function name() view returns (string)"
          ];
          
          const contract = new ethers.Contract(address, abi, provider);
          
          let balance = '0';
          let decimals = 18;
          let symbol = tokenDef.symbol;
          let name = tokenDef.name;
          let fetchError = null;
          
          try {
            decimals = await contract.decimals();
            const bal = await contract.balanceOf(account);
            balance = ethers.formatUnits(bal, decimals);
            
            try { symbol = await contract.symbol(); } catch(e) {}
            try { name = await contract.name(); } catch(e) {}
            
          } catch (e) {
            console.warn(`Failed to fetch for ${address}`, e);
            fetchError = "Failed to fetch contract data";
          }
          
          return {
            ...tokenDef,
            symbol: symbol || tokenDef.symbol,
            name: name || tokenDef.name,
            balance,
            decimals: Number(decimals),
            error: fetchError
          };
        })
      );
      
      setTokens(tokenData);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch balances. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async (token) => {
    if (!window.ethereum) return;
    
    const amountStr = mintAmounts[token.address] || '10'; // Default to 10 tokens
    if (!amountStr || isNaN(amountStr)) {
        alert("Please enter a valid amount");
        return;
    }

    try {
      setMinting(prev => ({ ...prev, [token.address]: true }));
      setError(null);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const amountToMint = ethers.parseUnits(amountStr, token.decimals);

      // Use a common set of possible mint function with different parameters
      const abi = [
        `function _mint(address to, uint256 amount) public`,
        `function _mint(uint256 amount) public`,
      ];
      
      const contract = new ethers.Contract(token.address, abi, signer);
      
      let tx;
      try {
        // Try (address, uint256) first
        tx = await contract.getFunction(`_mint(address,uint256)`)(account, amountToMint);
      } catch (err1) {
        console.warn(`Failed _mint(address,uint256)`, err1);
        try {
          tx = await contract.getFunction(`_mint(uint256)`)(amountToMint);
        } catch (err2) {
          console.warn(`Failed _mint(uint256)`, err2);
          console.error(`All mint signatures failed for _mint`, err2); 
          throw new Error(`Could not call _mint. Ensure the contract has a valid mint function.`);
        }
      }
      
      await tx.wait();
      alert(`Successfully minted ${amountStr} ${token.symbol}!`);
      fetchBalances(); // Refresh balances after successful mint
      
    } catch (err) {
      console.error(err);
      setError(`Failed to mint ${token.symbol}: ` + (err.reason || err.message));
    } finally {
      setMinting(prev => ({ ...prev, [token.address]: false }));
    }
  };

  const updateMintAmount = (address, val) => {
      setMintAmounts(prev => ({ ...prev, [address]: val }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Token Balances</h2>
          <p className="text-slate-500 text-sm">View your balances and mint test tokens.</p>
        </div>
        
        <button 
          onClick={fetchBalances}
          disabled={loading}
          className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-50 border border-slate-200"
          title="Refresh Balances"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start border border-red-100">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading && tokens.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-500">Fetching token balances...</p>
        </div>
      )}

      {!loading && tokens.length === 0 && (
         <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Coins className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500">No tokens configured. Add tokens to <code className="bg-slate-200 px-1 py-0.5 rounded">tokensConfig.json</code>.</p>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tokens.map((token, idx) => (
          <div key={token.address + idx} className="p-5 border border-slate-200 bg-slate-50 rounded-xl hover:shadow-md transition-all relative overflow-hidden flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg">
                  {token.symbol ? token.symbol.charAt(0) : '?'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{token.name || token.symbol || 'Unknown Token'}</h3>
                  <p className="text-xs font-mono text-slate-500" title={token.address}>
                    {token.address.substring(0, 8)}...{token.address.substring(token.address.length - 6)}
                  </p>
                </div>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                 <span className="text-xs text-slate-500 block mb-0.5 text-right">Balance</span>
                 <span className="font-bold text-slate-800">
                    {token.error ? <span className="text-red-500 text-sm" title={token.error}>Error</span> : token.balance} <span className="text-xs font-normal text-slate-500">{token.symbol}</span>
                 </span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-200">
              <div className="flex flex-col space-y-2">
                <div className="flex space-x-2">
                  <input 
                    type="number"
                    min="1"
                    placeholder="Amount (e.g. 100)"
                    value={mintAmounts[token.address] !== undefined ? mintAmounts[token.address] : '10'}
                    onChange={(e) => updateMintAmount(token.address, e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    disabled={minting[token.address] || !!token.error}
                  />
                  <button
                    onClick={() => handleMint(token)}
                    disabled={minting[token.address] || !!token.error}
                    className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
                  >
                    {minting[token.address] ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4 mr-1.5" />
                        Mint
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
