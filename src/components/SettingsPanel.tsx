import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTrading } from '../contexts/TradingContext';
import { 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  Key, 
  Settings, 
  Palette, 
  Bell, 
  HardDrive, 
  User,
  ChevronDown,
  Cloud,
  Cpu,
  Monitor,
  Zap,
  Globe
} from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';
import AdminPanel from './AdminPanel';
import { motion, AnimatePresence } from 'motion/react';

export default function SettingsPanel() {
  const { user, profile, loading, signIn, signOut, refreshProfile } = useAuth();
  const { slots, removeSlot } = useTrading();

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  
  // Secciones colapsables
  const [openSection, setOpenSection] = useState<string | null>('conexiones');

  useEffect(() => {
    if (profile) {
      setApiKey(profile.gateIoApiKey || '');
      setApiSecret(profile.gateIoApiSecret || '');
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-deep flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
        <div className="text-[10px] font-black text-white/40 tracking-[4px] uppercase animate-pulse">Sincronizando Cronos...</div>
      </div>
    );
  }

  const handleSaveGateIo = async () => {
    if (!user) return;
    setSaving(true);
    const trimmedKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();
    const saveToast = toast.loading('Guardando en la nube...');
    try {
      const docRef = doc(db, 'users', user.uid);
      const payload = {
        gateIoApiKey: trimmedKey,
        gateIoApiSecret: trimmedSecret,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, payload, { merge: true });
      await refreshProfile();
      toast.success('Servidor Sincronizado', { id: saveToast });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
      toast.dismiss(saveToast);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (window.confirm('¿Cerrar sesión en Cronos?')) {
      signOut();
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep pb-24 animate-slide-up">
      {/* Header Sticky */}
      <div className="flex justify-between items-center px-6 py-5 bg-bg-card/50 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20">
        <h2 className="text-sm font-black tracking-[3px] text-white/40 uppercase">Ajustes Generales</h2>
        {user && (
          <button onClick={handleSignOut} className="p-2 rounded-full bg-red-trading/10 text-red-trading">
            <LogOut size={16} />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Admin Panel si es admin */}
        <AdminPanel />

        {!user ? (
          <div className="glass rounded-[32px] p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto shadow-2xl">
              <User size={40} />
            </div>
            <div className="space-y-2">
              <h3 className="font-head font-bold text-2xl">INICIAR SESIÓN</h3>
              <p className="text-xs text-white/40 leading-relaxed font-bold tracking-widest uppercase">Para sincronizar tu escalera DCA y API Keys en todos tus dispositivos.</p>
            </div>
            <button 
              onClick={signIn}
              className="w-full py-5 bg-green-trading hover:bg-[#12b170] text-black font-black rounded-2xl transition-all shadow-xl active:scale-[0.98] tracking-widest"
            >ENTRAR CON GOOGLE</button>
          </div>
        ) : (
          <div className="space-y-3">
             {/* User Profile Summary */}
             <div className="bg-bg-card border border-white/5 rounded-[24px] p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand to-purple-900 border-2 border-white/10 flex items-center justify-center text-white font-head font-bold text-2xl shadow-xl">
                   {(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                   <div className="text-base font-bold text-white truncate">{user.displayName || user.email}</div>
                   <div className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-tighter">
                      <ShieldCheck size={12}/> {profile?.role || 'OPERADOR ESTÁNDAR'}
                   </div>
                </div>
             </div>

             {/* Sections */}
             <SettingsSection 
                id="conexiones"
                title="CONEXIONES" 
                desc="Gate.io API & Cloud Proxy" 
                icon={<Globe size={20} />}
                isOpen={openSection === 'conexiones'}
                onToggle={() => setOpenSection(openSection === 'conexiones' ? null : 'conexiones')}
             >
                <div className="space-y-4 pt-2">
                   <div className="space-y-2">
                      <div className="relative">
                         <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                         <input 
                            type={showKeys ? "text" : "password"}
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder="GATE.IO API KEY"
                            className="w-full bg-bg-deep border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-xs font-mono focus:border-brand/40 outline-none transition-all uppercase"
                         />
                         <button 
                           onClick={() => setShowKeys(!showKeys)}
                           className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 p-2"
                         >{showKeys ? '👁️' : '🔒'}</button>
                      </div>
                      <div className="relative">
                         <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                         <input 
                            type={showKeys ? "text" : "password"}
                            value={apiSecret}
                            onChange={e => setApiSecret(e.target.value)}
                            placeholder="GATE.IO API SECRET"
                            className="w-full bg-bg-deep border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-xs font-mono focus:border-brand/40 outline-none transition-all uppercase"
                         />
                      </div>
                   </div>
                   <button 
                      onClick={handleSaveGateIo}
                      disabled={saving}
                      className="w-full py-4 bg-brand hover:bg-[#7b27cc] text-white font-black text-[11px] rounded-xl tracking-[3px] shadow-lg shadow-brand/20 active:scale-95 transition-all disabled:opacity-50"
                   >
                     {saving ? 'SINCRONIZANDO...' : 'VINCULAR CUENTA REAL'}
                   </button>
                </div>
             </SettingsSection>

             <SettingsSection 
                id="sistema"
                title="SISTEMA" 
                desc="Notificaciones, Sonido y PWA" 
                icon={<Cpu size={20} />}
                isOpen={openSection === 'sistema'}
                onToggle={() => setOpenSection(openSection === 'sistema' ? null : 'sistema')}
             >
                <div className="space-y-3 pt-2">
                   <ToggleButton label="Alertas Críticas" desc="Notificaciones push de ventas" icon={<Bell size={16}/>} />
                   <ToggleButton label="Feedback Háptico" desc="Vibración en cada click" icon={<Zap size={16}/>} defaultOn />
                   <button className="w-full py-3.5 rounded-xl border border-white/5 bg-white/5 text-[10px] font-black tracking-widest text-white/40 uppercase hover:text-white transition-all">
                     Reiniciar Service Worker
                   </button>
                </div>
             </SettingsSection>

             <SettingsSection 
                id="diagnostico"
                title="DIAGNÓSTICO" 
                desc="Mantenimiento y Reseteo" 
                icon={<Monitor size={20} />}
                isOpen={openSection === 'diagnostico'}
                onToggle={() => setOpenSection(openSection === 'diagnostico' ? null : 'diagnostico')}
             >
                <div className="space-y-4 pt-2">
                   <p className="text-[10px] text-white/30 uppercase font-bold leading-relaxed px-1">
                     Solo realiza un Factory Reset si los slots locales no coinciden con la realidad de Gate.io. Esta acción es irreversible.
                   </p>
                   <button 
                     onClick={() => removeSlot('all')} // Logic to be handled in context
                     className="w-full py-4 bg-red-trading/10 hover:bg-red-trading/20 border border-red-trading/30 text-red-trading font-black text-[11px] rounded-xl tracking-[2px] transition-all"
                   >
                     ELIMINAR TODOS LOS REGISTROS
                   </button>
                </div>
             </SettingsSection>
          </div>
        )}

        {/* Brand Footer */}
        <div className="text-center py-10 opacity-20">
          <div className="text-[11px] font-black tracking-[5px] uppercase text-white">Cronos Bot Engine</div>
          <div className="text-[8px] font-bold text-white mt-1">v2.1.0 • ENCRYPTION ACTIVE</div>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ id, title, desc, icon, children, isOpen, onToggle }: any) {
  return (
    <div className={`bg-bg-card border transition-all duration-300 rounded-[24px] ${isOpen ? 'border-brand/40 shadow-2xl' : 'border-white/5'}`}>
       <div 
        onClick={onToggle}
        className="p-5 flex items-center justify-between cursor-pointer active:bg-white/5 rounded-[24px]"
       >
          <div className="flex items-center gap-4">
             <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${isOpen ? 'bg-brand text-white shadow-lg' : 'bg-white/5 text-white/20'}`}>
                {icon}
             </div>
             <div>
                <h3 className="text-xs font-black text-white/80 tracking-widest uppercase">{title}</h3>
                <p className="text-[10px] text-white/30 font-bold uppercase">{desc}</p>
             </div>
          </div>
          <ChevronDown size={20} className={`text-white/20 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand' : ''}`} />
       </div>
       <AnimatePresence>
         {isOpen && (
           <motion.div 
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="overflow-hidden"
           >
              <div className="px-5 pb-6 border-t border-white/5 mt-1">
                {children}
              </div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}

function ToggleButton({ label, desc, icon, defaultOn = false }: any) {
  const [isOn, setIsOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between p-4 bg-bg-deep/40 rounded-2xl border border-white/5">
       <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOn ? 'text-brand' : 'text-white/20'}`}>
             {icon}
          </div>
          <div>
             <div className="text-[11px] font-bold text-white/80 uppercase">{label}</div>
             <div className="text-[9px] text-white/20 font-bold">{desc}</div>
          </div>
       </div>
       <button 
        onClick={() => setIsOn(!isOn)}
        className={`w-10 h-5 rounded-full relative transition-all ${isOn ? 'bg-brand shadow-[0_0_10px_rgba(138,43,226,0.5)]' : 'bg-white/10'}`}
       >
          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isOn ? 'left-6' : 'left-1'}`}></div>
       </button>
    </div>
  );
}
