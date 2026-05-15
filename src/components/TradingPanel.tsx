import React, { useState, useEffect } from 'react';
import { useTrading } from '../contexts/TradingContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  ChevronLeft, 
  Bot, 
  User as UserIcon, 
  Pause, 
  RotateCcw, 
  Copy, 
  Send, 
  XCircle,
  TrendingUp,
  Target
} from 'lucide-react';
import ChartViewer from './ChartViewer';
import { motion, AnimatePresence } from 'motion/react';

export default function TradingPanel({ slotId, viewingPair, onBack }: { slotId: string | null, viewingPair?: string | null, onBack: () => void }) {
  const { user } = useAuth();
  const { slots, resetSlot, removeSlot, sendOrders, toggleDuplicate, updateSlot, dcaConfig, premiumETFs } = useTrading();
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [selectedZone, setSelectedZone] = useState<number | null>(null);
  
  const slot = slots.find(s => s.id === slotId);

  // Estados de Transición
  const [tempMode, setTempMode] = useState<'Manual' | 'Bot' | 'Pausado' | undefined>(slot?.mode);

  useEffect(() => {
    if (slot) setTempMode(slot.mode);
  }, [slot?.id, slot?.mode]);

  if (!slot && !viewingPair) return null;

  // Lógica de Precios
  const coinSymbol = slot?.pair.split('_')[0].toUpperCase() || '';
  const isPremium = premiumETFs.some(etf => coinSymbol.includes(etf.toUpperCase()));
  const multiplier = (isPremium ? 3 : 1) * (slot?.isDuplicated ? 2 : 1);

  let totalInv = 0;
  let coinsAcc = 0;
  slot?.levels.forEach(lvl => {
    if (lvl.status === 'Comprado') {
      const amount = lvl.baseAmount * multiplier;
      totalInv += amount;
      coinsAcc += amount / lvl.price;
    }
  });

  const avgPrice = coinsAcc > 0 ? totalInv / coinsAcc : (slot?.basePrice || 0);
  const livePrice = (slot?.basePrice || 0) * (1 + (parseFloat(slot?.change || '0')) / 100);
  const targetPrice = avgPrice * (1 + (dcaConfig.takeProfit || 34) / 100);
  const profitEst = totalInv * ((dcaConfig.takeProfit || 34) / 100);

  const handleAction = async (action: string) => {
    if (!slot) return;
    if (action === 'send') {
      if (tempMode) await updateSlot(slot.id, { mode: tempMode });
      sendOrders(slot.id);
      toast.success('Órdenes sincronizadas con Gate.io', { icon: '🚀' });
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep pb-12 animate-slide-up">
      {/* Mini Top Bar */}
      <div className="flex justify-between items-center px-4 py-3 glass sticky top-0 z-40 border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-all">
          <ChevronLeft size={24} />
        </button>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="font-head font-bold text-lg text-white leading-none tracking-wider">{coinSymbol}</span>
            <span className="text-[10px] font-black bg-brand px-1.5 py-0.5 rounded text-white shadow-[0_0_10px_#8a2be2]">
              {slot?.badge}
            </span>
          </div>
          <div className="text-[9px] font-black text-white/30 uppercase tracking-[2px] mt-0.5">SLOT ENGINE v2</div>
        </div>

        <div className="text-right">
           <div className="text-[14px] font-mono font-bold text-green-trading leading-none">
             ${livePrice < 1 ? livePrice.toFixed(6) : livePrice.toLocaleString()}
           </div>
           <div className={`text-[10px] font-black ${parseFloat(slot?.change || '0') < 0 ? 'text-red-trading' : 'text-green-trading'} flex items-center justify-end gap-1`}>
             {slot?.change}
           </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-[280px] bg-black/40 relative border-b border-white/5">
        <ChartViewer 
          pair={slot?.pair || ''} 
          avgPrice={avgPrice} 
          targetPrice={targetPrice} 
          livePrice={livePrice} 
        />
      </div>

      {/* Control Deck */}
      <div className="p-4 space-y-4">
        {/* Quick Summary Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-3 shadow-lg hover:border-brand/30 transition-all group">
             <div className="p-2.5 rounded-xl bg-brand/10 text-brand group-hover:bg-brand/20 transition-colors">
               <Target size={20} />
             </div>
             <div>
                <div className="text-[10px] font-black text-white/30 uppercase tracking-wider">OBJETIVO (+{dcaConfig.takeProfit}%)</div>
                <div className="text-sm font-mono font-bold text-white">${targetPrice < 1 ? targetPrice.toFixed(6) : targetPrice.toLocaleString()}</div>
             </div>
          </div>
          <div className="bg-bg-card border border-white/5 rounded-2xl p-4 flex items-center gap-3 shadow-lg hover:border-green-trading/30 transition-all group">
             <div className="p-2.5 rounded-xl bg-green-trading/10 text-green-trading group-hover:bg-green-trading/20 transition-colors">
               <TrendingUp size={20} />
             </div>
             <div>
                <div className="text-[10px] font-black text-white/30 uppercase tracking-wider">PROFIT EST.</div>
                <div className="text-sm font-mono font-bold text-green-trading">+${profitEst.toFixed(2)}</div>
             </div>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="bg-bg-card border border-white/5 rounded-3xl p-1.5 flex gap-1 shadow-inner ring-1 ring-white/5">
          <ModeButton active={tempMode === 'Manual'} icon={<UserIcon size={16}/>} label="MANUAL" color="white" onClick={() => setTempMode('Manual')} />
          <ModeButton active={tempMode === 'Bot'} icon={<Bot size={16}/>} label="BOT AI" color="brand" onClick={() => setTempMode('Bot')} />
          <ModeButton active={tempMode === 'Pausado'} icon={<Pause size={16}/>} label="PAUSAR" color="red-trading" onClick={() => setTempMode('Pausado')} />
        </div>

        {/* DCA Levels */}
        <div className="space-y-2 pt-2">
           <div className="flex items-center justify-between px-1 mb-4">
             <h3 className="text-[10px] font-black text-white/30 tracking-[3px] uppercase">Plan de Ejecución DCA</h3>
             {totalInv > 0 && <span className="text-[10px] font-mono text-brand font-bold">AVG Cost: ${avgPrice.toFixed(6)}</span>}
           </div>
           
           {slot?.levels.map((lvl, index) => (
             <LevelRow 
                key={index} 
                level={lvl} 
                index={index} 
                multiplier={multiplier} 
                isPremium={isPremium}
             />
           ))}
        </div>

        {/* Sticky Action Footer */}
        <div className="fixed bottom-6 left-4 right-4 z-40 bg-bg-card/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex gap-2 shadow-2xl brand-glow animate-slide-up">
           <button 
             onClick={() => setShowResetModal(true)} 
             className="flex-1 py-4 px-4 bg-white/5 rounded-xl text-white/60 font-black text-[10px] tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
           >
             <RotateCcw size={14} /> REINICIAR
           </button>
           <button 
             onClick={() => handleAction('send')}
             className="flex-[2] py-4 px-4 bg-green-trading hover:bg-[#12b170] rounded-xl text-white font-black text-[11px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95 group"
           >
             <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> 
             SINCRONIZAR GATE.IO
           </button>
        </div>
      </div>

      {/* Reset Modal - Estilo Helius */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4">
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             className="bg-bg-card w-full max-w-sm rounded-[32px] border border-white/10 p-6 space-y-6"
           >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-red-trading/10 text-red-trading rounded-full flex items-center justify-center mx-auto">
                   <RotateCcw size={32} />
                </div>
                <h3 className="font-head font-bold text-xl text-white">REINICIAR SLOT</h3>
                <p className="text-xs text-white/40 leading-relaxed uppercase font-bold tracking-wider">Selecciona la nueva zona de entrada para recalcular la escalera DCA.</p>
              </div>

              <div className="space-y-2">
                 <button onClick={() => setSelectedZone(1)} className={`w-full p-4 rounded-2xl border transition-all text-left flex justify-between items-center ${selectedZone === 1 ? 'bg-green-trading/20 border-green-trading text-green-trading' : 'bg-white/5 border-white/5 text-white/60 hover:border-white/10'}`}>
                    <span className="font-bold text-sm">ZONA 1 (PRECIO ACTUAL)</span>
                    <span className="font-mono text-xs">-1%</span>
                 </button>
                 <button onClick={() => setSelectedZone(15)} className={`w-full p-4 rounded-2xl border transition-all text-left flex justify-between items-center ${selectedZone === 15 ? 'bg-orange-trading/20 border-orange-trading text-orange-trading' : 'bg-white/5 border-white/5 text-white/60 hover:border-white/10'}`}>
                    <span className="font-bold text-sm">ZONA 2 (MODERADA)</span>
                    <span className="font-mono text-xs">-15%</span>
                 </button>
                 <button onClick={() => setSelectedZone(34)} className={`w-full p-4 rounded-2xl border transition-all text-left flex justify-between items-center ${selectedZone === 34 ? 'bg-red-trading/20 border-red-trading text-red-trading' : 'bg-white/5 border-white/5 text-white/60 hover:border-white/10'}`}>
                    <span className="font-bold text-sm">ZONA 3 (DIP FUERTE)</span>
                    <span className="font-mono text-xs">-34%</span>
                 </button>
              </div>

              <div className="flex gap-2">
                 <button onClick={() => setShowResetModal(false)} className="flex-1 py-4 rounded-2xl bg-white/5 font-black text-[11px] text-white/30 tracking-widest">CANCELAR</button>
                 <button className="flex-[2] py-4 rounded-2xl bg-brand text-white font-black text-[11px] tracking-widest shadow-xl ring-1 ring-brand/50 active:scale-95 transition-all">CONFIRMAR REINICIO</button>
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
}

function ModeButton({ active, icon, label, color, onClick }: any) {
  const getColorClasses = () => {
    if (!active) return "text-white/30 hover:text-white/60 hover:bg-white/5";
    if (color === 'brand') return "bg-brand text-white shadow-[0_0_15px_rgba(138,43,226,0.3)] ring-1 ring-white/20";
    if (color === 'red-trading') return "bg-red-trading text-white shadow-[0_0_15px_rgba(247,44,91,0.3)] ring-1 ring-white/20";
    return "bg-white text-black font-black";
  };

  return (
    <button onClick={onClick} className={`flex-1 py-3 px-2 rounded-2xl flex items-center justify-center gap-2 transition-all ${getColorClasses()}`}>
      <span className={active ? 'animate-pulse-soft' : ''}>{icon}</span>
      <span className="text-[10px] font-black tracking-widest">{label}</span>
    </button>
  );
}

function LevelRow({ level, index, multiplier, isPremium }: any) {
  const isFilled = level.status === 'Comprado';
  const isPending = level.status === 'Gate.io';
  
  return (
    <div className={`group relative rounded-2xl border transition-all p-3.5 flex items-center gap-4 ${isFilled ? 'bg-green-trading/[0.04] border-green-trading/30' : isPending ? 'bg-orange-trading/[0.04] border-orange-trading/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
       <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono font-bold text-xs ${isFilled ? 'bg-green-trading border-green-trading text-black' : isPending ? 'bg-orange-trading border-orange-trading text-black animate-pulse' : 'bg-white/5 border-white/10 text-white/30'}`}>
          {index + 1}
       </div>
       
       <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="min-w-0">
             <div className="text-[13px] font-mono font-bold text-white/90 truncate">${level.price.toFixed(6)}</div>
             <div className="text-[9px] font-black text-white/20 uppercase tracking-tighter">DROPCALC: {level.dropLabel}</div>
          </div>
          
          <div className="text-right">
             <div className="text-xs font-mono font-bold text-white/80">${(level.baseAmount * multiplier).toFixed(1)} <span className="opacity-30 text-[10px]">USDT</span></div>
             <div className={`text-[9px] font-black uppercase tracking-widest ${isFilled ? 'text-green-trading' : isPending ? 'text-orange-trading' : 'text-white/20'}`}>
               {isFilled ? 'EJECUTADO' : isPending ? 'EN GATE.IO' : 'EN ESPERA'}
             </div>
          </div>
       </div>
    </div>
  );
}
