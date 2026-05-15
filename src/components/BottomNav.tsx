import React from 'react';
import { LayoutGrid, Binary, LineChart, Cpu } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  activeTab: number;
  onChange: (tab: number) => void;
}

export default function BottomNav({ activeTab, onChange }: Props) {
  const tabs = [
    { id: 0, label: 'GENERAL', icon: <LayoutGrid size={18} /> },
    { id: 1, label: 'MOTOR', icon: <Binary size={18} /> },
    { id: 2, label: 'SCANNER', icon: <LineChart size={18} /> },
    { id: 3, label: 'SISTEMA', icon: <Cpu size={18} /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/5 pb-[env(safe-area-inset-bottom)] px-2">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative flex flex-col items-center justify-center w-full py-1 gap-1 transition-all active:scale-90"
          >
            <div className={`transition-all duration-300 ${activeTab === tab.id ? 'text-brand scale-110' : 'text-white/30'}`}>
              {tab.icon}
            </div>
            <span className={`text-[9px] font-black tracking-[1.5px] transition-all duration-300 ${activeTab === tab.id ? 'text-white' : 'text-white/20'}`}>
              {tab.label}
            </span>
            
            {activeTab === tab.id && (
              <motion.div 
                layoutId="nav-dot"
                className="absolute -top-1 w-8 h-[2px] bg-brand shadow-[0_0_10px_#8a2be2] rounded-full"
              />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
