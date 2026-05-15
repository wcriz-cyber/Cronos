import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Level, Slot, DCAConfig, BotConfig } from '../types';
import { notificationService } from '../services/notificationService';

function calculateLevels(basePrice: number, dca: DCAConfig) {
  let currentCalculatedPrice = basePrice;
  const levels: Level[] = [];
  for (let i = 0; i < 10; i++) {
    let drop_rate = dca.dropsPercent[i] / 100;
    let amount = dca.amounts[i];
    if (i > 0) {
      currentCalculatedPrice = currentCalculatedPrice * (1 - drop_rate);
    }
    let isBought = i === 0;
    let label_drop = i === 0 ? 'Base' : '-' + dca.dropsPercent[i] + '%';
    levels.push({
      level: i + 1,
      dropLabel: label_drop,
      price: currentCalculatedPrice,
      baseAmount: amount,
      status: isBought ? 'Comprado' : 'Espera',
    });
  }
  return levels;
}

interface TradingContextType {
  slots: Slot[];
  dcaConfig: DCAConfig;
  premiumETFs: string[];
  blockedETFs: string[];
  botConfig: BotConfig;
  addSlot: (pair: string, basePrice: number, change: string, badge: string, mode?: 'Manual' | 'Bot' | 'Pausado') => void;
  updateSlot: (id: string, updates: Partial<Slot>) => void;
  removeSlot: (id: string) => void;
  updateDCAConfig: (config: DCAConfig) => void;
  resetSlot: (id: string, newBasePrice?: number) => void;
  sendOrders: (id: string) => void;
  toggleDuplicate: (id: string) => void;
  updatePremiumETFs: (etfs: string[]) => void;
  updateBlockedETFs: (etfs: string[]) => void;
  updateBotConfig: (config: BotConfig) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

const defaultDcaConfig: DCAConfig = {
  dropsPercent: [0, 13, 21, 29, 37, 45, 53, 61, 69, 77],
  amounts: [4, 5, 6, 7, 12, 15, 27, 30, 30, 40],
  takeProfit: 34
};

const defaultBotConfig: BotConfig = {
  scanInterval: 10,
  autoReEntry: true,
  maxUsdtPerUser: 1000,
  pauseAll: false,
};

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dcaConfig, setDcaConfig] = useState<DCAConfig>(defaultDcaConfig);
  const [premiumETFs, setPremiumETFs] = useState<string[]>([]);
  const [blockedETFs, setBlockedETFs] = useState<string[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig>(defaultBotConfig);

  useEffect(() => {
    if (!user) {
      setSlots([]);
      return;
    }
    
    // Listen to user slots
    const unsubSlots = onSnapshot(collection(db, `users/${user.uid}/slots`), (snap) => {
      const loaded: Slot[] = [];
      snap.forEach(d => {
        loaded.push({ id: d.id, ...d.data() } as Slot);
      });
      // Sort by creation date
      loaded.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSlots(loaded);
    });

    // Load global default DCA config if exists
    getDoc(doc(db, 'global_settings', 'dca_strategy')).then(dcaSnap => {
       if (dcaSnap.exists()) {
         setDcaConfig(dcaSnap.data() as DCAConfig);
       }
    });

    // Load Premium ETFs
    const unsubPremium = onSnapshot(doc(db, 'global_settings', 'premium_etfs'), (doc) => {
      if (doc.exists()) {
        setPremiumETFs(doc.data().list || []);
      }
    });

    // Load Blocked ETFs
    const unsubBlocked = onSnapshot(doc(db, 'global_settings', 'blocked_etfs'), (doc) => {
      if (doc.exists()) {
        setBlockedETFs(doc.data().list || []);
      }
    });

    // Load Global Bot Config
    const unsubBot = onSnapshot(doc(db, 'global_settings', 'bot_config'), (docSnap) => {
      if (docSnap.exists()) {
        setBotConfig(docSnap.data() as BotConfig);
      }
    });

    return () => {
      unsubSlots();
      unsubPremium();
      unsubBlocked();
      unsubBot();
    };
  }, [user]);

  const addSlot = async (pair: string, basePrice: number, change: string, badge: string, mode: 'Manual' | 'Bot' | 'Pausado' = 'Manual') => {
    const id = Date.now().toString();
    const levels = calculateLevels(basePrice, dcaConfig);
    const newSlot = {
      pair,
      basePrice,
      change,
      badge,
      isDuplicated: false,
      mode,
      levels,
      operationsCount: 0,
      userId: user ? user.uid : 'local',
      status: 'active',
      createdAt: Date.now()
    };
    
    if (user) {
      await setDoc(doc(db, `users/${user.uid}/slots`, id), { ...newSlot, createdAt: serverTimestamp() });
    } else {
      setSlots(prev => [...prev, { id, ...newSlot } as Slot]);
    }
    notificationService.play('buy');
  };

  const updateSlot = async (id: string, updates: Partial<Slot>) => {
    if (user) {
      await updateDoc(doc(db, `users/${user.uid}/slots`, id), { ...updates, updatedAt: serverTimestamp() });
    } else {
      setSlots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    }
  };

  const removeSlot = async (id: string) => {
    if (user) {
      await deleteDoc(doc(db, `users/${user.uid}/slots`, id));
    } else {
      setSlots(prev => prev.filter(s => s.id !== id));
    }
    notificationService.play('sell');
  };

  const updateDCAConfig = async (config: DCAConfig) => {
    setDcaConfig(config);
    if (user) {
        // Also save to global if admin, but here we just update state for now (AdminPanel handles DB)
    }
  };

  const resetSlot = async (id: string, customBasePrice?: number) => {
    const slot = slots.find(s => s.id === id);
    if (!slot) return;
    const newBasePrice = customBasePrice || (slot.basePrice * 0.95);
    const newLevels = calculateLevels(newBasePrice, dcaConfig).map(l => ({...l, status: 'Espera'}));
    if (user) {
      await updateDoc(doc(db, `users/${user.uid}/slots`, id), {
        basePrice: newBasePrice,
        levels: newLevels,
        operationsCount: 0,
        updatedAt: serverTimestamp()
      });
    } else {
      setSlots(prev => prev.map(s => s.id === id ? { ...s, basePrice: newBasePrice, levels: newLevels, operationsCount: 0 } : s));
    }
    notificationService.play('sell');
  };

  const updatePremiumETFs = async (list: string[]) => {
    setPremiumETFs(list);
    if (user) {
      await setDoc(doc(db, 'global_settings', 'premium_etfs'), { list });
    }
  };

  const updateBlockedETFs = async (list: string[]) => {
    setBlockedETFs(list);
    if (user) {
      await setDoc(doc(db, 'global_settings', 'blocked_etfs'), { list });
    }
  };

  const sendOrders = async (id: string) => {
    const slot = slots.find(s => s.id === id);
    if (!slot) return;
    
    // Check if it's premium
    // coin name could be SUI_USDT or SUI5L_USDT etc. 
    // User mentioned ETF premium list.
    const coinSymbol = slot.pair.split('_')[0]; // e.g. SUI5L
    const isPremium = premiumETFs.some(etf => coinSymbol.toUpperCase().includes(etf.toUpperCase()));
    
    let ordersToSend = isPremium ? 4 : 5;
    let sentCount = 0;
    const newLevels = slot.levels.map(lvl => {
      if (lvl.status === 'Espera' && sentCount < ordersToSend) {
        sentCount++;
        return { ...lvl, status: 'Gate.io' as Level['status'] };
      }
      return lvl;
    });
    if (user) {
      await updateDoc(doc(db, `users/${user.uid}/slots`, id), { levels: newLevels, updatedAt: serverTimestamp() });
    } else {
      setSlots(prev => prev.map(s => s.id === id ? { ...s, levels: newLevels } : s));
    }
    notificationService.play('success');
  };

  const toggleDuplicate = async (id: string) => {
     const slot = slots.find(s => s.id === id);
     if (!slot) return;
     if (user) {
       await updateDoc(doc(db, `users/${user.uid}/slots`, id), { isDuplicated: !slot.isDuplicated, updatedAt: serverTimestamp() });
     } else {
       setSlots(prev => prev.map(s => s.id === id ? { ...s, isDuplicated: !slot.isDuplicated } : s));
     }
  };

  const updateBotConfig = async (config: BotConfig) => {
    setBotConfig(config);
    await setDoc(doc(db, 'global_settings', 'bot_config'), config);
  };

  return (
    <TradingContext.Provider value={{ 
      slots, 
      dcaConfig, 
      premiumETFs,
      blockedETFs,
      botConfig,
      addSlot, 
      updateSlot, 
      removeSlot, 
      updateDCAConfig, 
      resetSlot, 
      sendOrders, 
      toggleDuplicate,
      updatePremiumETFs,
      updateBlockedETFs,
      updateBotConfig
    }}>
      {children}
    </TradingContext.Provider>
  );
}

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (context === undefined) {
    throw new Error("useTrading must be used inside TradingProvider");
  }
  return context;
};
