import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Props {
  pair: string;
  defaultTimeframe?: string;
  avgPrice?: number;
  targetPrice?: number;
  livePrice?: number;
}

export default function ChartViewer({ pair, defaultTimeframe = '30m', avgPrice, targetPrice, livePrice }: Props) {
  const [activeTf, setActiveTf] = useState(defaultTimeframe);
  const [klines, setKlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const tfs = [
    { label: '30M', value: '30m' },
    { label: '1H', value: '1h' },
    { label: '4H', value: '4h' },
    { label: '1D', value: '1d' }
  ];

  useEffect(() => {
    fetchKlines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, activeTf]);

  const fetchKlines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gateio/klines?pair=${pair}&interval=${activeTf}&limit=40`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fetch failed');
      setKlines(data);
    } catch (e: any) {
      toast.error('Error cargando gráfico: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCandles = () => {
    if (loading || klines.length === 0) return <div className="text-[12px] text-[var(--text-muted)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">Cargando Velas...</div>;
    
    // Reverse because gate.io might return oldest first, or newest first. Need to check API docs.
    // By default, usually gate.io returns [oldest, ..., newest]. Let's assume standard order.
    // We want to scale them to height: 260px.
    const highs = klines.map(k => parseFloat(k[3]));
    const lows = klines.map(k => parseFloat(k[4]));
    
    let maxHigh = Math.max(...highs);
    let minLow = Math.min(...lows);
    
    // Include the extra lines in maxHigh/minLow so they fit in the chart
    if (avgPrice) {
      maxHigh = Math.max(maxHigh, avgPrice);
      minLow = Math.min(minLow, avgPrice);
    }
    if (targetPrice) {
      maxHigh = Math.max(maxHigh, targetPrice);
      minLow = Math.min(minLow, targetPrice);
    }
    if (livePrice) {
      maxHigh = Math.max(maxHigh, livePrice);
      minLow = Math.min(minLow, livePrice);
    }
    
    const range = maxHigh - minLow || 1;

    // Helper to calculate Y position (bottom-based)
    const getBottomPos = (val: number) => ((val - minLow) / range) * 220 + 20;
    
    // Scale for volume bars (bottom 25%)
    const maxVol = Math.max(...klines.map(k => parseFloat(k[1]))) || 1;

    // Time Labels step
    const step = 8;

    return (
       <>
         {/* Background Grid */}
         <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-[0.03] dark:opacity-[0.07]">
            {[...Array(24)].map((_, i) => (
              <div key={i} className="border-r border-b border-[var(--text-main)]"></div>
            ))}
         </div>

         {/* Grid lines Labels */}
         <div className="absolute w-full left-0 border-t border-dashed top-[25%] border-[var(--border-color)] z-[5]">
           <div className="absolute right-1 -top-3 text-[8px] font-mono text-[var(--text-muted)]">${(minLow + range * 0.75).toFixed(6)}</div>
         </div>
         <div className="absolute w-full left-0 border-t border-dashed top-[50%] border-[var(--border-color)] z-[5]">
           <div className="absolute right-1 -top-3 text-[8px] font-mono text-[var(--text-muted)] font-bold">${((maxHigh+minLow)/2).toFixed(6)}</div>
         </div>
         <div className="absolute w-full left-0 border-t border-dashed top-[75%] border-[var(--border-color)] z-[5]">
           <div className="absolute right-1 -top-3 text-[8px] font-mono text-[var(--text-muted)]">${(minLow + range * 0.25).toFixed(6)}</div>
         </div>

         {/* Time Labels X-Axis */}
         <div className="absolute bottom-1 left-0 w-full h-[12px] flex items-center px-1 z-20 pointer-events-none border-t border-[var(--border-color)] border-opacity-20 translate-y-[2px]">
            {klines.map((k, i) => {
              if (i % step !== 0) return <div key={i} className="flex-1"></div>;
              const date = new Date(parseInt(k[0]) * 1000);
              const label = activeTf === '1d' 
                ? `${date.getMonth() + 1}/${date.getDate()}` 
                : `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
              
              return (
                <div key={i} className="flex-1 flex justify-center">
                  <span className="text-[7px] font-black text-[var(--text-muted)] opacity-80 whitespace-nowrap bg-[var(--bg-card)] px-1 rounded-sm border border-[var(--border-color)]">
                    {label}
                  </span>
                </div>
              );
            })}
         </div>

         {/* Volume Profile (Subtle) */}
         <div className="absolute bottom-0 left-0 w-full h-[60px] flex items-end justify-between px-1 opacity-10 pointer-events-none">
            {klines.map((k, i) => {
              const vol = parseFloat(k[1]);
              const h = (vol / maxVol) * 100;
              return <div key={i} className="flex-1 mx-[1px] bg-[var(--text-muted)]" style={{ height: `${h}%` }}></div>;
            })}
         </div>

         {/* Extra Lines with better styling */}
         {avgPrice && (
           <div className="absolute w-full left-0 transition-all duration-500 z-[6]" style={{ bottom: `${getBottomPos(avgPrice)}px` }}>
             <div className="w-full border-t border-dashed border-[#f59e0b] opacity-50"></div>
             <div className="absolute right-1 -top-2.5 text-[8px] font-black px-1.5 py-0.5 rounded text-white bg-[#f59e0b] shadow-sm z-10">P. PROM: ${avgPrice.toFixed(6)}</div>
           </div>
         )}
         {targetPrice && (
           <div className="absolute w-full left-0 transition-all duration-500 z-[6]" style={{ bottom: `${getBottomPos(targetPrice)}px` }}>
             <div className="w-full border-t border-dashed border-[var(--green)] opacity-50"></div>
             <div className="absolute right-1 -top-2.5 text-[8px] font-black px-1.5 py-0.5 rounded text-white bg-[var(--green)] shadow-sm z-10">META TP: ${targetPrice.toFixed(6)}</div>
           </div>
         )}
         {livePrice && (
           <div className="absolute w-full left-0 transition-all duration-500 z-[8]" style={{ bottom: `${getBottomPos(livePrice)}px` }}>
             <div className="w-full border-t border-[var(--text-main)] shadow-[0_0_10px_rgba(0,0,0,0.1)]"></div>
             <div className="absolute left-1 -top-2.5 text-[8px] font-black px-1.5 py-0.5 rounded text-white bg-[var(--text-main)] shadow-lg z-10 animate-pulse">VIVO: ${livePrice.toFixed(6)}</div>
           </div>
         )}

         <div className="flex w-full h-full items-end justify-between px-1 z-10 relative">
            {klines.map((k, i) => {
               const open = parseFloat(k[5]);
               const close = parseFloat(k[2]);
               const high = parseFloat(k[3]);
               const low = parseFloat(k[4]);
               
               const isRed = close < open;
               
               const candleHeight = Math.max(1, ((Math.abs(close - open)) / range) * 220); 
               const wickHeight = Math.max(1, ((high - low) / range) * 220);
               
               const wickBottom = getBottomPos(low);
               const candleBottom = getBottomPos(Math.min(open, close));
               
               return (
                  <div key={i} className="flex-1 h-full flex flex-col items-center relative group">
                     {/* Hover Tooltip/Line */}
                     <div className="absolute inset-0 group-hover:bg-[var(--text-main)] group-hover:opacity-[0.03] transition-opacity pointer-events-none"></div>

                     {/* Wick */}
                     <div 
                       className={`w-[1px] absolute ${isRed ? 'bg-[var(--red)]' : 'bg-[var(--green)]'} opacity-60`} 
                       style={{ height: `${wickHeight}px`, bottom: `${wickBottom}px` }}
                     ></div>
                     {/* Body */}
                     <div 
                       className={`w-[80%] absolute rounded-[2px] ${isRed ? 'bg-gradient-to-t from-[var(--red)] to-[#ff6b6b]' : 'bg-gradient-to-t from-[var(--green)] to-[#2ecc71]'} shadow-sm`} 
                       style={{ height: `${candleHeight}px`, bottom: `${candleBottom}px` }}
                     ></div>
                  </div>
               );
            })}
         </div>
       </>
    );
  };

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-between bg-[var(--bg-card)] px-3 py-1.5 border-b border-[var(--border-color)]">
        <div className="flex gap-2">
          {tfs.map(tf => (
            <div 
              key={tf.value} 
              onClick={() => setActiveTf(tf.value)}
              className={`px-3 py-1 text-[10px] font-black rounded-lg cursor-pointer transition-all duration-200 border ${activeTf === tf.value ? 'bg-[var(--text-main)] text-white border-[var(--text-main)] shadow-md' : 'bg-transparent text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)]'}`}
            >
              {tf.label}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse"></div>
           <span className="text-[9px] font-black text-[var(--text-main)] uppercase tracking-widest">Live Trade</span>
        </div>
      </div>
      <div className="bg-[var(--bg-card)] px-2 pt-1.5 pb-0.5">
        <div className="relative h-[280px] bg-[#fff] dark:bg-[#050505] border border-[var(--border-color)] rounded-2xl overflow-hidden shadow-inner">
          {renderCandles()}
        </div>
      </div>
    </div>
  );
}
