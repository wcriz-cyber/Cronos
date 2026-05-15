import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { TradingProvider } from './contexts/TradingContext';
import DashboardPanel from './components/DashboardPanel';
import TradingPanel from './components/TradingPanel';
import MonitorPanel from './components/MonitorPanel';
import SettingsPanel from './components/SettingsPanel';
import BottomNav from './components/BottomNav';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from './contexts/AuthContext';

function MainApp() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(() => localStorage.getItem('lastSlotId'));
  const [selectedViewingPair, setSelectedViewingPair] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-deep flex flex-col items-center justify-center p-4">
         <div className="w-16 h-16 relative">
            <div className="absolute inset-0 border-4 border-brand/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
         </div>
         <div className="mt-8 space-y-2 text-center">
            <div className="text-[12px] font-black text-white tracking-[6px] uppercase animate-pulse">Iniciando Cronos</div>
            <div className="text-[8px] font-bold text-white/20 uppercase tracking-[4px]">Sincronizando con el servidor...</div>
         </div>
      </div>
    );
  }

  const handleGoToTrading = (slotId: string) => {
    setSelectedSlotId(slotId);
    localStorage.setItem('lastSlotId', slotId);
    setSelectedViewingPair(null);
    setActiveTab(1);
  };

  const handleGoToChart = (pair: string) => {
    setSelectedViewingPair(pair);
    setActiveTab(1);
  };

  const handleTabChange = (index: number) => {
    if (index !== 1) {
      setSelectedViewingPair(null);
    }
    setActiveTab(index);
  };

  return (
    <div className="bg-bg-deep min-h-screen relative overflow-x-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="pb-[80px]"
        >
          {activeTab === 0 && <DashboardPanel onSelectSlot={handleGoToTrading} onSelectChart={handleGoToChart} />}
          {activeTab === 1 && <TradingPanel slotId={selectedSlotId} viewingPair={selectedViewingPair} onBack={() => setActiveTab(0)} />}
          {activeTab === 2 && <MonitorPanel onSelectChart={handleGoToChart} />}
          {activeTab === 3 && <SettingsPanel />}
        </motion.div>
      </AnimatePresence>

      <BottomNav activeTab={activeTab} onChange={handleTabChange} />
      
      <Toaster 
        position="top-center" 
        toastOptions={{
          className: 'glass text-white border border-white/10 rounded-2xl font-black text-xs tracking-widest',
          duration: 3000,
          style: {
            background: '#141414',
            color: '#fff',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)'
          }
        }} 
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TradingProvider>
        <MainApp />
      </TradingProvider>
    </AuthProvider>
  );
}
