import React, { useState } from 'react';
import { ethers } from 'ethers';
import tokensConfig from './tokensConfig.json';
import { EXCHANGE_ADDRESS, EXCHANGE_ABI, EIP712_DOMAIN, EIP712_TYPES, ERC20_ABI } from './exchangeConfig';
import { XCircle, AlertCircle, CheckCircle } from 'lucide-react';

export default function CancelOrder({ account }) {
  const [form, setForm] = useState({
    tokenSold: tokensConfig[0]?.address || '',
    tokenWant: tokensConfig[1]?.address || '',
    amountSold: '',
    amountWant: '',
    expiry: '',
    nonce: '',
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCancel = async () => {
    if (!window.ethereum) return;
    if (!form.amountSold || !form.amountWant || !form.expiry || !form.nonce) {
      setStatus({ type: 'error', message: 'Please fill in all fields exactly as they were when the order was created.' });
      return;
    }

    try {
      setLoading(true);
      setStatus(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tokenSoldContract = new ethers.Contract(form.tokenSold, ERC20_ABI, provider);
      const decimals = await tokenSoldContract.decimals();
      const amountSoldWei = ethers.parseUnits(form.amountSold, decimals);

      const tokenWantContract = new ethers.Contract(form.tokenWant, ERC20_ABI, provider);
      const decimalsWant = await tokenWantContract.decimals();
      const amountWantWei = ethers.parseUnits(form.amountWant, decimalsWant);

      const expiryTs = BigInt(Math.floor(new Date(form.expiry).getTime() / 1000));
      const nonce = BigInt(form.nonce);

      setStatus({ type: 'info', message: 'Step 1/2: Sign the cancellation in MetaMask...' });
      const sig = await signer.signTypedData(EIP712_DOMAIN, EIP712_TYPES, {
        tokenSold: form.tokenSold,
        tokenWant: form.tokenWant,
        amountSold: amountSoldWei,
        amountWant: amountWantWei,
        expiry: expiryTs,
        nonce,
      });

      setStatus({ type: 'info', message: 'Step 2/2: Submitting cancellation to blockchain...' });
      const exchange = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
      const tx = await exchange.cancelOrder(
        form.tokenSold,
        form.tokenWant,
        amountSoldWei,
        amountWantWei,
        expiryTs,
        nonce,
        sig,
      );
      await tx.wait();

      setStatus({ type: 'success', message: `Order cancelled! Tx: ${tx.hash}` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err.reason || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Cancel Order</h2>
      <p className="text-slate-500 text-sm mb-6">
        Enter the exact same values used when you created the order.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Token Sold</label>
          <select
            value={form.tokenSold}
            onChange={e => set('tokenSold', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {tokensConfig.map(t => (
              <option key={t.address} value={t.address}>{t.symbol} — {t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount Sold</label>
          <input
            type="number" min="0" placeholder="e.g. 100"
            value={form.amountSold}
            onChange={e => set('amountSold', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Token Wanted</label>
          <select
            value={form.tokenWant}
            onChange={e => set('tokenWant', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {tokensConfig.map(t => (
              <option key={t.address} value={t.address}>{t.symbol} — {t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount Wanted</label>
          <input
            type="number" min="0" placeholder="e.g. 50"
            value={form.amountWant}
            onChange={e => set('amountWant', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Expiry</label>
          <input
            type="datetime-local"
            value={form.expiry}
            onChange={e => set('expiry', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nonce</label>
          <input
            type="number" min="0" placeholder="Nonce used when creating the order"
            value={form.nonce}
            onChange={e => set('nonce', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <p className="text-xs text-slate-400 mt-1">Check the PostedOrder event to find the nonce.</p>
        </div>

        {status && (
          <div className={`p-4 rounded-xl flex items-start border text-sm ${
            status.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' :
            status.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' :
            'bg-indigo-50 text-indigo-700 border-indigo-100'
          }`}>
            {status.type === 'error' && <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />}
            {status.type === 'success' && <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />}
            <p className="break-all">{status.message}</p>
          </div>
        )}

        <button
          onClick={handleCancel}
          disabled={loading}
          className="w-full flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold transition-colors shadow-sm"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <XCircle className="w-5 h-5 mr-2" />
              Cancel Order
            </>
          )}
        </button>
      </div>
    </div>
  );
}
