import React, { useState } from 'react';
import { ethers } from 'ethers';
import tokensConfig from './tokensConfig.json';
import { EXCHANGE_ADDRESS, EXCHANGE_ABI, EIP712_DOMAIN, EIP712_TYPES, ERC20_ABI } from './exchangeConfig';
import { PlusCircle, AlertCircle, CheckCircle, PenLine, Copy, Check } from 'lucide-react';

export default function CreateOrder({ account }) {
  const [form, setForm] = useState({
    tokenSold: tokensConfig[0]?.address || '',
    tokenWant: tokensConfig[1]?.address || '',
    amountSold: '',
    amountWant: '',
    expiry: '',
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    if (form.tokenSold === form.tokenWant) {
      setStatus({ type: 'error', message: 'Token sold and token wanted cannot be the same.' });
      return null;
    }
    if (!form.amountSold || !form.amountWant || !form.expiry) {
      setStatus({ type: 'error', message: 'Please fill in all fields.' });
      return null;
    }
    const expiryTs = Math.floor(new Date(form.expiry).getTime() / 1000);
    if (expiryTs <= Math.floor(Date.now() / 1000)) {
      setStatus({ type: 'error', message: 'Expiry must be in the future.' });
      return null;
    }
    return expiryTs;
  };

  const getSignerAndAmounts = async () => {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    const signer = await provider.getSigner();

    const tokenSoldContract = new ethers.Contract(form.tokenSold, ERC20_ABI, signer);
    const decimals = Number(await tokenSoldContract.decimals());
    const amountSoldWei = ethers.parseUnits(form.amountSold, decimals);

    const tokenWantContract = new ethers.Contract(form.tokenWant, ERC20_ABI, signer);
    const decimalsWant = Number(await tokenWantContract.decimals());
    const amountWantWei = ethers.parseUnits(form.amountWant, decimalsWant);

    return { signer, tokenSoldContract, amountSoldWei, amountWantWei, decimals, decimalsWant };
  };

  // Approve + sign + publish on-chain
  const handleCreate = async () => {
    if (!window.ethereum) return;
    const expiryTs = validate();
    if (!expiryTs) return;

    try {
      setLoading(true);
      setStatus(null);

      const { signer, tokenSoldContract, amountSoldWei, amountWantWei } = await getSignerAndAmounts();
      const nonce = BigInt(Date.now());

      setStatus({ type: 'info', message: 'Step 1/3: Approving Exchange to spend your tokens...' });
      const allowance = await tokenSoldContract.allowance(account, EXCHANGE_ADDRESS);
      if (allowance < amountSoldWei) {
        const approveTx = await tokenSoldContract.approve(EXCHANGE_ADDRESS, amountSoldWei);
        await approveTx.wait();
      }

      setStatus({ type: 'info', message: 'Step 2/3: Sign the order in MetaMask...' });
      const sig = await signer.signTypedData(EIP712_DOMAIN, EIP712_TYPES, {
        tokenSold: form.tokenSold,
        tokenWant: form.tokenWant,
        amountSold: amountSoldWei,
        amountWant: amountWantWei,
        expiry: BigInt(expiryTs),
        nonce,
      });

      setStatus({ type: 'info', message: 'Step 3/3: Submitting order to blockchain...' });
      const exchange = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
      const tx = await exchange.createOrder(
        form.tokenSold,
        form.tokenWant,
        amountSoldWei,
        amountWantWei,
        BigInt(expiryTs),
        nonce,
        sig,
      );
      await tx.wait();

      setStatus({ type: 'success', message: `Order created! Tx: ${tx.hash}` });
      setForm(prev => ({ ...prev, amountSold: '', amountWant: '', expiry: '' }));
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: err.reason || err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Create Order</h2>
      <p className="text-slate-500 text-sm mb-6">Offer your tokens in exchange for another token.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Token to Sell</label>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Sell</label>
          <input
            type="number" min="0" placeholder="e.g. 100"
            value={form.amountSold}
            onChange={e => set('amountSold', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Token to Receive</label>
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount to Receive</label>
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

        {form.amountSold && form.amountWant && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
            Rate: <span className="font-semibold">1 {tokensConfig.find(t => t.address === form.tokenSold)?.symbol}</span>
            {' = '}
            <span className="font-semibold">
              {(parseFloat(form.amountWant) / parseFloat(form.amountSold)).toFixed(4)}{' '}
              {tokensConfig.find(t => t.address === form.tokenWant)?.symbol}
            </span>
          </div>
        )}

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

        <div className="flex gap-3 pt-1">
          {/* Approve + sign + publish */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-semibold text-sm transition-colors shadow-sm"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                Publish On-Chain
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-400 text-center">
          <span className="font-medium text-slate-500">Publish On-Chain</span> — visible in Explore Orders to everyone.
        </p>
      </div>
    </div>
  );
}
