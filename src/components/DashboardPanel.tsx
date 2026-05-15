import React, { useEffect, useState, useCallback } from 'react';
import { useTrading } from '../contexts/TradingContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  ChevronRight, 
  RefreshCw, 
  Wallet, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Power,
  Search,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DashboardPanel({ onSelectSlot, onSelectChart }: { onSelectSlot: (id: string) => void, onSelectChart: (pair: string) => void }) {
  const { slots, premiumETFs, removeSlot } = useTrading();
  const { profile, user } = useAuth();
  
  const [balances, setBalances] = useState({ total: 0, libre: 0, enJuego: 0, pnlHoy: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [tickerData, setTickerData] = useState<Record<string, any>>({});

  // 1. Fetch de Precios Live (Tickers)
  const fetchTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/gateio/tickers');
      const data = await res.json();
      if (Array.isArray(data)) {
        const map: Record<string, any> = {};
        data.forEach(t => map[t.currency_pair] = t);
        setTickerData(map);
      }
    } catch (e) {
      console.warn("Ticker fetch failed");
    }
  }, []);

  // 2. Fetch de Balances desde Proxy
  const fetchGatewayData = useCallback(async (silent = false) => {
    if (!profile?.gateIoApiKey || !profile?.gateIoApiSecret) return;
    if (!silent) setIsLoading(true);
    
    try {
      const res = await fetch('/api/gateio/balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: profile.gateIoApiKey, 
          apiSecret: profile.gateIoApiSecret 
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gate.io connection error');
      }
      
      const data = await res.json();
      const libre = parseFloat(data.available) || 0;
      const total = parseFloat(data.available) + parseFloat(data.locked || 0);
      
      // Calcular "En Juego" basado en slots locales
      let enJuego = 0;
      slots.forEach(s => {
        s.levels.forEach(l => {
          if (l.status === 'Comprado') enJuego += l.baseAmount;
        });
      });

      setBalances(prev => ({
        ...prev,
        libre,
        total,
        enJuego
      }));

      if (!silent) toast.success('Conexión Gate.io OK', { icon: '⚡' });
    } catch (e: any) {
      if (!silent) toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [profile, slots]);

  useEffect(() => {
    fetchTickers();
    fetchGatewayData(true);
    const itv = setInterval(fetchTickers, 10000);
    return () => clearInterval(itv);
  }, [fetchTickers, fetchGatewayData]);

  // Formateadores
  const fC = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  const fP = (val: number) => (val >= 0 ? '+' : '') + val.toFixed(2) + '%';

  return (
    <div className="min-h-screen bg-bg-deep pb-24">
      {/* Header Premium - Helius Design Style */}
      <header className="sticky top-0 z-30 glass border-b border-white/5 px-4 pt-4 pb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand/20 flex items-center justify-center border border-brand/30 shadow-lg shadow-brand/20">
              <Activity size={20} className="text-brand animate-pulse" />
            </div>
            <div>
              <h1 className="font-head font-bold text-lg tracking-[2px] text-white leading-none">CRONOS <span className="text-brand opacity-60 text-sm">v2.1</span></h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-trading shadow-[0_0_8px_#10b981]"></div>
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Motor Activo</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => fetchGatewayData()} 
            disabled={isLoading}
            className={`w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all ${isLoading ? 'opacity-50' : 'active:scale-90'}`}
          >
            <RefreshCw size={18} className={`text-brand ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Global Balance Card */}
        <div className="bg-gradient-to-br from-brand/10 to-transparent border border-white/5 rounded-3xl p-5 mb-4 shadow-2xl relative overflow-hidden group">
           <div className="absolute -right-10 -top-10 w-32 h-32 bg-brand/10 blur-[50px] group-hover:bg-brand/20 transition-all"></div>
           <div className="relative z-10">
              <div className="flex items-center gap-2 text-[10px] font-black text-white/30 uppercase tracking-[4px] mb-2">
                 <Wallet size={12} /> Balance Real Total
              </div>
              <div className="flex items-baseline gap-2">
                 <span className="text-3xl font-mono font-bold text-white tracking-tighter">{fC(balances.total)}</span>
                 <span className="text-xs font-head font-bold text-green-trading bg-green-trading/10 px-2 py-0.5 rounded-full">LIVE</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/5">
                 <div className="space-y-1">
                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">En Operación</div>
                    <div className="text-sm font-mono font-bold text-orange-trading">{fC(balances.enJuego)}</div>
                 </div>
                 <div className="space-y-1 text-right">
                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">USDT Disponible</div>
                    <div className="text-sm font-mono font-bold text-white/80">{fC(balances.libre)}</div>
                 </div>
              </div>
           </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-5">
        {/* Search Bar stylized */}
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-brand transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="FILTRAR ÓRDENES ACTIVAS..." 
            className="w-full bg-bg-card border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-head font-black tracking-[4px] focus:border-brand/40 outline-none transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-white/40 tracking-[3px] uppercase">
            <LayoutGrid size={12} />
            Escalera DCA (DAP)
          </div>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-mono text-brand font-bold uppercase tracking-widest">
            {slots.filter(s => s.levels.some(l => l.status === 'Comprado')).length} / {slots.length} Slots
          </div>
        </div>

        {/* Slots List */}
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {slots.map((slot, idx) => (
              <SlotCard 
                key={slot.id} 
                slot={slot} 
                ticker={tickerData[slot.pair]} 
                onClick={() => onSelectSlot(slot.id)}
                delay={idx * 0.05}
              />
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, subValue, color }: { label: string, value: string, subValue: string, color: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 text-center">
      <div className="text-[8px] font-black text-white/30 uppercase tracking-[2px] mb-1">{label}</div>
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
      <div className="text-[9px] font-head font-medium text-white/20 mt-0.5">{subValue}</div>
    </div>
  );
}

function SlotCard({ slot, ticker, onClick, delay }: { slot: any, ticker: any, onClick: () => void, delay: number }) {
  const isUp = ticker && parseFloat(ticker.change_percentage) >= 0;
  const price = ticker ? parseFloat(ticker.last) : 0;
  
  let invested = 0;
  slot.levels.forEach((l: any) => { if (l.status === 'Comprado') invested += l.baseAmount; });
  
  const stepCount = slot.levels.filter((l: any) => l.status === 'Comprado').length;
  const isActive = invested > 0;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border transition-all active:scale-[0.98] ${isActive ? 'bg-bg-card border-white/10 hover:border-brand/40 shadow-xl' : 'bg-white/[0.02] border-white/5 opacity-60'}`}
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-head font-bold text-white tracking-wider text-base">{slot.pair.replace('_USDT', '')}</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10 uppercase">
                {slot.badge}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-trading animate-pulse' : 'bg-white/10'}`}></div>
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                {isActive ? 'Operación Activa' : 'Slot Disponible'}
              </span>
            </div>
          </div>

          {ticker && (
            <div className="text-right">
              <div className="text-sm font-mono font-bold text-white">
                ${price < 1 ? price.toFixed(6) : price.toLocaleString()}
              </div>
              <div className={`text-[11px] font-black flex items-center justify-end gap-1 ${isUp ? 'text-green-trading' : 'text-red-trading'}`}>
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {parseFloat(ticker.change_percentage).toFixed(2)}%
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-[9px] font-black text-white/20 uppercase">Invertido</div>
            <div className="text-xs font-mono font-bold text-white/80">${invested.toFixed(1)} USDT</div>
          </div>
          <div className="space-y-1 text-right">
            <div className="text-[9px] font-black text-white/20 uppercase">DCA PROGRESO</div>
            <div className="flex items-center justify-end gap-2">
               <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < stepCount ? 'bg-brand' : 'bg-white/10'}`}></div>
                  ))}
               </div>
               <span className="text-xs font-mono font-bold text-white/80">{stepCount}/{slot.levels.length}</span>
            </div>
          </div>
        </div>
      </div>

      {isActive && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-brand shadow-[0_0_10px_#8a2be2]"></div>
      )}
    </motion.div>
  );
}
