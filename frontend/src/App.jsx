import React, { useState, useEffect } from 'react';
import { Wallet, Coins, PlusCircle, XCircle, Search, ArrowRightLeft } from 'lucide-react';
import Balances from './Balances';
import CreateOrder from './CreateOrder';

function App() {
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeView, setActiveView] = useState('home');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        setIsConnecting(true);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      } catch (error) {
        console.error("Error connecting to MetaMask:", error);
      } finally {
        setIsConnecting(false);
      }
    } else {
      alert("MetaMask not found. Please install the extension.");
    }
  };

  useEffect(() => {
    // Check if wallet is already connected
    const checkConnection = async () => {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      }
    };
    checkConnection();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount('');
          setActiveView('home');
        }
      });
    }
  }, []);

  const formatAddress = (addr) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const renderContent = () => {
        if (activeView === 'balances') return <Balances account={account} />;
        if (activeView === 'create') return <CreateOrder account={account} />;
    
    // Default home view
    return (
        <div className="max-w-4xl w-full mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
              Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">TokenSwap</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              A decentralized, peer-to-peer token exchange platform. Connect your wallet to start creating and exploring orders seamlessly.
            </p>
          </div>

          {!account && (
            <div className="pt-8">
              <button 
                onClick={connectWallet}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-lg px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center mx-auto"
              >
                <Wallet className="w-6 h-6 mr-3" />
                Connect Wallet to Get Started
              </button>
            </div>
          )}

          {account && (
            <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div 
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group flex flex-col items-center"
                onClick={() => setActiveView('create')}
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                  <PlusCircle className="w-6 h-6 text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Create New Order</h3>
                <p className="text-slate-500 text-sm">Offer your tokens in exchange for others with custom rates.</p>
              </div>
              <div 
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group flex flex-col items-center"
                onClick={() => setActiveView('explore')}
              >
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
                  <Search className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Explore Market</h3>
                <p className="text-slate-500 text-sm">Discover and fill orders created by other users on the network.</p>
              </div>
            </div>
          )}
        </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-800 bg-slate-50">
      {/* Navbar */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView('home')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <ArrowRightLeft className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-indigo-900">TokenSwap</span>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              <button 
                onClick={() => setActiveView('create')}
                className={`font-medium flex items-center transition-colors ${activeView === 'create' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
              >
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Create Order
              </button>
              <button 
                onClick={() => setActiveView('cancel')}
                className={`font-medium flex items-center transition-colors ${activeView === 'cancel' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Cancel Order
              </button>
              <button 
                onClick={() => setActiveView('explore')}
                className={`font-medium flex items-center transition-colors ${activeView === 'explore' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
              >
                <Search className="w-4 h-4 mr-1.5" />
                Explore Orders
              </button>
              <button 
                onClick={() => setActiveView('balances')}
                className={`font-medium flex items-center transition-colors ${activeView === 'balances' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`}
              >
                <Coins className="w-4 h-4 mr-1.5" />
                Token Balances
              </button>
            </nav>

            <div className="flex items-center">
              {account ? (
                <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded-full px-4 py-2 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                  <span className="text-sm font-semibold text-indigo-800">
                    {formatAddress(account)}
                  </span>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-75"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-6 w-full">
        {renderContent()}
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>© 2026 TokenSwap DApp. Built for APS1050H.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;