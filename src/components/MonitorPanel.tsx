import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingDown, Eye, PlusCircle, X, ChevronRight, Activity, Zap, Ban, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTrading } from '../contexts/TradingContext';
import { useAuth } from '../contexts/AuthContext';
import ChartViewer from './ChartViewer';
import { notificationService } from '../services/notificationService';

interface MonitorPanelProps {
  onSelectChart: (pair: string) => void;
}

export default function MonitorPanel({ onSelectChart }: MonitorPanelProps) {
  const { addSlot, premiumETFs, blockedETFs, updateBlockedETFs } = useTrading();
  const { profile } = useAuth();
  const [etfs, setEtfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEtf, setSelectedEtf] = useState<any>(null);
  const [selectedMode, setSelectedMode] = useState<'Manual' | 'Bot' | 'Pausado'>('Manual');
  const [selectedZone, setSelectedZone] = useState<number>(0); // 0 = Current, 1 = -1%, 2 = -15%, 3 = -34%
  const [notifPermission, setNotifPermission] = useState(false);
  const prevDropsRef = useRef<Record<string, number>>({});

  const zones = [
    { label: 'Actual', value: 0, percent: 0 },
    { label: 'Zona 1', value: 1, percent: -1 },
    { label: 'Zona 2', value: 2, percent: -15 },
    { label: 'Zona 3', value: 3, percent: -34 },
  ];

  useEffect(() => {
    fetchEtfs();
    const interval = setInterval(fetchEtfs, 30000); // Check every 30s
    
    if ('Notification' in window) {
      setNotifPermission(Notification.permission === 'granted');
    }
    
    return () => clearInterval(interval);
  }, []);

  const fetchEtfs = async () => {
    try {
      const res = await fetch('/api/gateio/etfs');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Invalid data format');
      
      const sorted = data.sort((a, b) => parseFloat(a.change_percentage) - parseFloat(b.change_percentage));
      
      // Check for significant drops
      sorted.slice(0, 10).forEach(etf => {
        const drop = parseFloat(etf.change_percentage);
        const pair = etf.currency_pair;
        const prevDrop = prevDropsRef.current[pair] || 0;
        
        // Notify if drop is > 55% AND it's a new lower drop compared to last fetch
        if (drop <= -55.0 && drop < prevDrop - 0.5) {
          notificationService.notify(
             '🚨 ALERTA DE CAÍDA', 
             `${pair.split('_')[0]} ha caído un ${Math.abs(drop).toFixed(2)}%! Oportunidad de compra.`,
             'alert'
          );
        }
        prevDropsRef.current[pair] = drop;
      });

      setEtfs(sorted);
    } catch (e: any) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    setNotifPermission(granted);
    if (granted) {
      toast.success('Notificaciones activadas');
      notificationService.play('success');
    } else {
      toast.error('Permiso denegado');
    }
  };

  const handleAddOperar = () => {
    if (!selectedEtf) return;
    
    const pair = selectedEtf.currency_pair.replace('_', '');
    const currentPrice = parseFloat(selectedEtf.last);
    
    // Calculate entry price based on zone
    const zonePercent = zones.find(z => z.value === selectedZone)?.percent || 0;
    const price = currentPrice * (1 + zonePercent / 100);
    
    const drop = parseFloat(selectedEtf.change_percentage);
    const isRed = drop < 0;
    
    // Improved badge logic
    let badge = 'SPOT';
    const pairStr = selectedEtf.currency_pair;
    if (pairStr.includes('3L')) badge = '3X Long';
    else if (pairStr.includes('3S')) badge = '3X Short';
    else if (pairStr.includes('5L')) badge = '5X Long';
    else if (pairStr.includes('5S')) badge = '5X Short';

    // Add slot with selected mode and calculated price
    addSlot(pair, price, `${isRed ? '' : '+'}${drop.toFixed(2)}%`, badge, selectedMode);
    
    toast.success(`${selectedEtf.currency_pair} agregado en ${zones[selectedZone].label} (${selectedMode})`);
    setSelectedEtf(null);
    setSelectedZone(0); // Reset for next use
  };

  const handleBlockETF = () => {
    if (!selectedEtf) return;
    const coinName = selectedEtf.currency_pair.split('_')[0].toUpperCase();
    if (blockedETFs.includes(coinName)) {
      toast.error('Ya está bloqueado');
      return;
    }
    updateBlockedETFs([...blockedETFs, coinName]);
    toast.success(`${coinName} bloqueado globalmente`);
    setSelectedEtf(null);
  };

  const filteredEtfs = (search 
    ? etfs.filter(e => e.currency_pair.toLowerCase().includes(search.toLowerCase()))
    : etfs.slice(0, 25)) // Show more to give chance to see stuff
    .filter(item => {
      const coinName = item.currency_pair.split('_')[0].toUpperCase();
      return !blockedETFs.includes(coinName);
    });

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] sticky top-0 z-20 transition-all cursor-default">
        <div className="px-3 py-1.5 text-center text-[10px] font-black text-[var(--text-muted)] uppercase border-b border-[var(--border-color)]/50 flex items-center justify-between gap-1.5 opacity-70">
          <div className="flex items-center gap-1.5">
            <TrendingDown size={12} className="text-[var(--red)]" />
            OPORTUNIDADES {search ? 'FILTRADO' : 'TOP CAÍDAS'}
          </div>
          <button 
            onClick={handleRequestPermission}
            className={`p-1 rounded-lg flex items-center gap-1 transition-all ${notifPermission ? 'text-[var(--green)]' : 'text-[var(--red)] hover:bg-[rgba(246,70,93,0.1)]'}`}
          >
            {notifPermission ? <Bell size={12} /> : <BellOff size={12} />}
            <span className="text-[8px]">{notifPermission ? 'ON' : 'ALERTAS OFF'}</span>
          </button>
        </div>
        <div className="relative w-full p-2">
          <Search className="absolute left-4 top-4.5 text-[var(--text-muted)] w-3.5 h-3.5 opacity-50" />
          <input 
            type="text" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Escriba moneda..." 
            className="w-full py-2 pr-3 pl-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-body)] text-[13px] outline-none text-[var(--text-main)] shadow-inner font-medium placeholder:text-[var(--text-muted)]/50 focus:border-[var(--green)] transition-all"
          />
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-[var(--green)] border-opacity-20 rounded-full"></div>
              <div className="w-12 h-12 border-4 border-[var(--green)] border-t-transparent rounded-full animate-spin absolute top-0"></div>
            </div>
            <p className="text-[12px] font-black text-[var(--text-muted)] mt-6 animate-pulse">ESCANEANDO MERCADO 24/7...</p>
          </div>
        ) : filteredEtfs.length > 0 ? (
          <div className="space-y-3">
            {filteredEtfs.map((item, i) => {
              const drop = parseFloat(item.change_percentage);
              const isRed = drop < 0;
              const coinName = item.currency_pair.split('_')[0];
              const isPremium = premiumETFs.some(etf => coinName.toUpperCase().includes(etf.toUpperCase()));
              
              return (
                <div 
                  key={item.currency_pair} 
                  onClick={() => setSelectedEtf(item)}
                  className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-2.5 flex items-center justify-between shadow-sm hover:border-[var(--green)] transition-all cursor-pointer group active:scale-[0.98] mb-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-body)] flex items-center justify-center text-[11px] font-black text-[var(--text-muted)] group-hover:text-[var(--green)] transition-colors opacity-40">
                      {(i + 1).toString().padStart(2, '0')}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-black text-[var(--text-main)] uppercase tracking-tight">{coinName}</span>
                        {isPremium && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--admin-purple)] shadow-[0_0_5px_var(--admin-purple)]"></div>
                        )}
                      </div>
                      <div className="text-[10px] font-bold text-[var(--text-muted)] mt-0.5 opacity-60">
                        VOL: <span className="text-[var(--text-main)] font-mono">${(parseFloat(item.quote_volume) / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className={`text-[11px] font-black ${isRed ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                        {isRed ? '-' : '+'} {Math.abs(drop).toFixed(2)}%
                      </div>
                      <div className="text-[14px] font-black text-[var(--text-main)] font-mono tracking-tighter">
                         ${parseFloat(item.last).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] opacity-50">
            <Search size={48} className="mb-4" />
            <p className="text-[14px] font-black uppercase tracking-widest text-center">No se encontraron<br/>oportunidades</p>
          </div>
        )}
      </div>

      {/* Detail Window / Modal */}
      {selectedEtf && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-body)]">
           <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)] px-4 py-2 flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-3">
                 <button onClick={() => setSelectedEtf(null)} className="p-2 -ml-2 rounded-full hover:bg-[var(--bg-body)] transition-colors opacity-60">
                    <X size={18} className="text-[var(--text-main)]" />
                 </button>
                 <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                       <h2 className="text-[14px] font-black text-[var(--text-main)] tracking-tight uppercase">{selectedEtf.currency_pair.split('_')[0]}</h2>
                       <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[var(--bg-body)] text-[var(--text-muted)] border border-[var(--border-color)]/50 uppercase tracking-tighter">SPOT ETF</span>
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                 {profile?.role === 'admin' && (
                    <button 
                      onClick={handleBlockETF}
                      className="p-2 bg-[rgba(246,70,93,0.1)] text-[var(--red)] border border-[var(--red)]/20 rounded-lg hover:bg-[var(--red)] hover:text-white transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter"
                    >
                       <Ban size={14} />
                       BLOQUEAR
                    </button>
                 )}
                 <div className="flex flex-col items-end">
                    <span className="text-[16px] font-black text-[var(--text-main)] font-mono tracking-tighter">${parseFloat(selectedEtf.last).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</span>
                    <span className={`text-[9px] font-black ${parseFloat(selectedEtf.change_percentage) < 0 ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
                       {parseFloat(selectedEtf.change_percentage) < 0 ? '▼' : '▲'} {Math.abs(parseFloat(selectedEtf.change_percentage)).toFixed(2)}%
                    </span>
                 </div>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto">
              <div className="bg-[var(--bg-card)] border-b border-[var(--border-color)]">
                 <ChartViewer pair={selectedEtf.currency_pair} livePrice={parseFloat(selectedEtf.last)} />
              </div>

              <div className="px-4 pt-2 pb-6">
                 <div className="mb-4">
                    <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2 opacity-70 flex items-center gap-2">
                       ESTRATEGIA DE ENTRADA
                       <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--border-color)] to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                       {zones.map((zone) => (
                          <button
                            key={zone.value}
                            onClick={() => setSelectedZone(zone.value)}
                            className={`flex flex-col items-center justify-center py-2.5 rounded-xl transition-all border border-transparent cursor-pointer ${selectedZone === zone.value ? 'bg-[var(--green)] text-white shadow-lg' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] opacity-60'}`}
                          >
                             <span className="text-[9px] font-black uppercase">{zone.label}</span>
                             <span className={`text-[8px] font-black ${selectedZone === zone.value ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{zone.percent}%</span>
                          </button>
                       ))}
                    </div>
                    {selectedZone > 0 && (
                       <div className="mt-2 text-center">
                          <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-wider opacity-60">
                             Precio de entrada: <span className="text-[var(--text-main)] font-mono">${(parseFloat(selectedEtf.last) * (1 + zones[selectedZone].percent / 100)).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}</span>
                          </span>
                       </div>
                    )}
                 </div>

                 <div className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-2 opacity-70 flex items-center gap-2">
                    MODO DE OPERACIÓN
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--border-color)] to-transparent"></div>
                 </div>
                 <div className="grid grid-cols-3 gap-1.5 p-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl mb-5">
                    <button 
                      onClick={() => setSelectedMode('Manual')}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-none cursor-pointer ${selectedMode === 'Manual' ? 'bg-[var(--bg-body)] text-[var(--text-main)] shadow-sm' : 'bg-transparent text-[var(--text-muted)] opacity-40'}`}
                    >
                       <Zap size={14} className={selectedMode === 'Manual' ? 'text-[var(--orange)] mb-1' : 'mb-1'} />
                       <span className="text-[9px] font-black uppercase">Manual</span>
                    </button>
                    <button 
                      onClick={() => setSelectedMode('Bot')}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-none cursor-pointer ${selectedMode === 'Bot' ? 'bg-[#8a2be2] text-white shadow-md' : 'bg-transparent text-[var(--text-muted)] opacity-40'}`}
                    >
                       <Activity size={14} className="mb-1" />
                       <span className="text-[9px] font-black uppercase">Bot AI</span>
                    </button>
                    <button 
                      onClick={() => setSelectedMode('Pausado')}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all border-none cursor-pointer ${selectedMode === 'Pausado' ? 'bg-[var(--bg-body)] text-[var(--red)] shadow-sm' : 'bg-transparent text-[var(--text-muted)] opacity-40'}`}
                    >
                       <PlusCircle size={14} className="mb-1 rotate-45" />
                       <span className="text-[9px] font-black uppercase">Frio</span>
                    </button>
                 </div>

                 <button 
                   onClick={handleAddOperar}
                   className="w-full bg-[var(--green)] dark:bg-[var(--green)] hover:opacity-90 text-white py-4 rounded-xl font-black text-[11px] shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-[0.1em]"
                 >
                    INICIAR OPERACIÓN
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
