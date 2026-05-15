import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, orderBy, query, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useTrading } from '../contexts/TradingContext';
import toast from 'react-hot-toast';
import { Plus, X, Cpu, PlayCircle, PauseCircle, Settings2, Ban, Users, Shield, Zap, Filter, LayoutGrid, ListFilter } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/errorHandlers';

type TabType = 'strategy' | 'bot' | 'filters' | 'users';

export default function AdminPanel() {
  const { profile, user } = useAuth();
  const { dcaConfig, updateDCAConfig, premiumETFs, updatePremiumETFs, botConfig, updateBotConfig, blockedETFs, updateBlockedETFs } = useTrading();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [localDCA, setLocalDCA] = useState(dcaConfig);
  const [localBot, setLocalBot] = useState(botConfig);
  const [newETF, setNewETF] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [whitelist, setWhitelist] = useState<string[]>([]);

  useEffect(() => {
    setLocalDCA(dcaConfig);
  }, [dcaConfig]);

  useEffect(() => {
    setLocalBot(botConfig);
  }, [botConfig]);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers();
      
      const unsubWhitelist = onSnapshot(doc(db, 'global_settings', 'whitelist'), (docSnap) => {
        if (docSnap.exists()) {
          setWhitelist(docSnap.data().emails || []);
        }
      });
      return () => unsubWhitelist();
    }
  }, [profile]);

  const saveDCAConfig = async () => {
    try {
      await setDoc(doc(db, 'global_settings', 'dca_strategy'), localDCA);
      updateDCAConfig(localDCA);
      toast.success('Estrategia DCA global actualizada');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'global_settings/dca_strategy');
    }
  };

  const handleAddETF = () => {
    if (!newETF) return;
    const etf = newETF.trim().toUpperCase();
    if (premiumETFs.includes(etf)) {
      toast.error('Ya está en la lista');
      return;
    }
    updatePremiumETFs([...premiumETFs, etf]);
    setNewETF('');
    toast.success(`${etf} añadido a Premium`);
  };

  const handleRemoveETF = (etf: string) => {
    updatePremiumETFs(premiumETFs.filter(e => e !== etf));
    toast.success(`${etf} eliminado de Premium`);
  };

  const handleUnblockETF = (etf: string) => {
    updateBlockedETFs(blockedETFs.filter(e => e !== etf));
    toast.success(`${etf} desbloqueado globalmente`);
  };

  const saveBotConfig = async () => {
    try {
      await updateBotConfig(localBot);
      toast.success('Configuración del bot actualizada');
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    }
  };

  const handleAddWhitelist = async () => {
    if (!newUserEmail) return;
    const email = newUserEmail.toLowerCase().trim();
    if (whitelist.includes(email)) {
      toast.error('Ya está autorizado');
      return;
    }
    try {
      const newList = [...whitelist, email];
      const docRef = doc(db, 'global_settings', 'whitelist');
      await setDoc(docRef, { emails: newList }, { merge: true });
      setNewUserEmail('');
      toast.success('Usuario autorizado');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'global_settings/whitelist');
    }
  };

  const handleRemoveWhitelist = async (email: string) => {
    try {
      const newList = whitelist.filter(e => e !== email);
      const docRef = doc(db, 'global_settings', 'whitelist');
      await setDoc(docRef, { emails: newList }, { merge: true });
      toast.success('Autorización removida');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'global_settings/whitelist');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario y todos sus datos?')) return;
    try {
      const slotsSnap = await getDocs(collection(db, `users/${userId}/slots`));
      const deletePromises = slotsSnap.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
      await deleteDoc(doc(db, 'users', userId));
      toast.success('Usuario eliminado permanentemente');
      fetchUsers();
    } catch (e: any) {
      toast.error('Error al eliminar: ' + e.message);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      const usersData: any[] = [];
      for (const userDoc of usersSnap.docs) {
        const slotsSnap = await getDocs(collection(db, `users/${userDoc.id}/slots`));
        usersData.push({ id: userDoc.id, ...userDoc.data(), activeSlotsCount: slotsSnap.size });
      }
      setUsers(usersData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'admin' && user?.email?.toLowerCase() !== 'wcriz@proton.me') return null;

  return (
    <div className="bg-bg-card border border-brand/20 rounded-[32px] overflow-hidden shadow-2xl mb-6 animate-slide-up">
      {/* Admin Header */}
      <div className="bg-gradient-to-r from-brand to-purple-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-white" />
          <div>
            <h3 className="text-[14px] font-black text-white uppercase tracking-wider">Centro de Control Admin</h3>
            <div className="text-[8px] font-bold text-white/50 uppercase">Operational Mode: Superuser</div>
          </div>
        </div>
        <button 
          onClick={() => {
            fetch('/api/notifications/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: 'Aviso Global', body: 'Mensaje urgente del administrador.' })
            }).then(() => toast.success('Alerta global enviada'));
          }}
          className="text-[9px] font-black bg-white text-brand px-3 py-1.5 rounded-lg hover:scale-105 active:scale-95 transition-all shadow-md"
        >
          PUSH ALERT
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--border-color)] bg-[var(--bg-body)]/50 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase transition-all whitespace-nowrap border-b-2 ${activeTab === 'users' ? 'border-[#8a2be2] text-[#8a2be2] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          <Users size={14} /> Usuarios
        </button>
        <button 
          onClick={() => setActiveTab('strategy')}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase transition-all whitespace-nowrap border-b-2 ${activeTab === 'strategy' ? 'border-[#8a2be2] text-[#8a2be2] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          <Settings2 size={14} /> Estrategia
        </button>
        <button 
          onClick={() => setActiveTab('bot')}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase transition-all whitespace-nowrap border-b-2 ${activeTab === 'bot' ? 'border-[#8a2be2] text-[#8a2be2] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          <Cpu size={14} /> Motor Bot
        </button>
        <button 
          onClick={() => setActiveTab('filters')}
          className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase transition-all whitespace-nowrap border-b-2 ${activeTab === 'filters' ? 'border-[#8a2be2] text-[#8a2be2] bg-[var(--bg-card)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
        >
          <Filter size={14} /> Filtros
        </button>
      </div>

      <div className="p-4 bg-[var(--bg-card)]">
        {activeTab === 'users' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border-color)]">
              <h4 className="text-[11px] font-black text-[var(--text-muted)] uppercase mb-3 flex items-center gap-2">
                <Shield size={12} /> Autorizar Nuevo Usuario
              </h4>
              <div className="flex gap-2">
                <input 
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="ejemplo@email.com"
                  className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[12px] text-[var(--text-main)] outline-none focus:border-[#8a2be2] transition-all"
                />
                <button 
                  onClick={handleAddWhitelist}
                  className="bg-[#8a2be2] text-white px-4 py-2 rounded-lg text-[10px] font-black hover:opacity-90 active:scale-95 transition-all"
                >
                  AUTORIZAR
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center py-8 opacity-50">
                  <Cpu className="animate-spin mb-2" size={24} />
                  <span className="text-[10px] font-black">CONSULTANDO FIREBASE...</span>
                </div>
              ) : users.map(u => (
                <div key={u.id} className="bg-[var(--bg-body)] border border-[var(--border-color)] p-3 rounded-xl flex items-center justify-between group hover:border-[#8a2be2]/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-main)] font-black text-[10px]">
                      {u.displayName ? u.displayName[0] : 'U'}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-[var(--text-main)]">{u.displayName || 'Anonimo'}</span>
                        {whitelist.includes(u.email?.toLowerCase()) && (
                          <span className="text-[7px] text-[var(--green)] font-black bg-[rgba(14,203,129,0.1)] px-1.5 py-0.5 rounded-full border border-[var(--green)]/20 uppercase tracking-tighter">Acceso Total</span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{u.email}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] font-black">{u.activeSlotsCount} SLOTS</span>
                        {u.gateIoApiKey && <span className="text-[8px] text-[var(--green)] font-black">● API OK</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!whitelist.includes(u.email?.toLowerCase()) ? (
                      <button 
                        onClick={() => { setNewUserEmail(u.email); handleAddWhitelist(); }}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--green)] hover:bg-[rgba(14,203,129,0.1)] rounded-lg transition-all"
                        title="Autorizar"
                      >
                        <Plus size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleRemoveWhitelist(u.email)}
                        className="p-2 text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[rgba(246,70,93,0.1)] rounded-lg transition-all"
                        title="Revocar"
                      >
                        <Ban size={16} />
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[rgba(246,70,93,0.1)] rounded-lg transition-all"
                      title="Eliminar"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border-color)]">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[11px] font-black text-[var(--text-muted)] uppercase">Estrategia DCA Maestra</h4>
                <div className="bg-[rgba(255,165,0,0.1)] text-[var(--orange)] text-[9px] font-black px-2 py-1 rounded border border-[var(--orange)]/20">MODO HIGH GROWTH</div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)]">
                  <label className="text-[9px] text-[var(--text-muted)] font-black uppercase mb-1 block tracking-widest">Take Profit (%)</label>
                  <input 
                    type="number" 
                    className="w-full bg-transparent border-b border-[var(--border-color)] p-1 text-[16px] font-black text-[#8a2be2] outline-none"
                    value={localDCA.takeProfit}
                    onChange={e => setLocalDCA({...localDCA, takeProfit: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="bg-[var(--bg-card)] rounded-xl overflow-hidden border border-[var(--border-color)]">
                <div className="grid grid-cols-[40px_1fr_1fr] bg-[var(--bg-body)] p-2">
                  <div className="text-[9px] font-black text-[var(--text-muted)] uppercase text-center">NV</div>
                  <div className="text-[9px] font-black text-[var(--text-muted)] uppercase text-center">Trigger (%)</div>
                  <div className="text-[9px] font-black text-[var(--text-muted)] uppercase text-center">USD Order</div>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[40px_1fr_1fr] border-t border-[var(--border-color)]/50 items-center hover:bg-[var(--bg-body)]/40 transition-colors">
                      <div className="text-[10px] text-[var(--text-muted)] font-black text-center">{i + 1}</div>
                      <input 
                        type="number" 
                        className="bg-transparent p-3 text-[12px] text-[var(--text-main)] text-center font-bold outline-none border-x border-[var(--border-color)]/30"
                        value={localDCA.dropsPercent[i] || 0}
                        onChange={e => {
                          const newDrops = [...localDCA.dropsPercent];
                          newDrops[i] = Number(e.target.value);
                          setLocalDCA({...localDCA, dropsPercent: newDrops});
                        }}
                        disabled={i === 0}
                      />
                      <input 
                        type="number" 
                        className="bg-transparent p-3 text-[12px] text-[var(--text-main)] text-center font-bold outline-none"
                        value={localDCA.amounts[i] || 0}
                        onChange={e => {
                          const newAmts = [...localDCA.amounts];
                          newAmts[i] = Number(e.target.value);
                          setLocalDCA({...localDCA, amounts: newAmts});
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={saveDCAConfig} 
                className="w-full mt-4 bg-[var(--green)] hover:bg-[#12b170] text-white font-black py-3 rounded-xl text-[11px] uppercase tracking-widest shadow-lg transition-all active:scale-[0.98]"
              >
                Actualizar Estrategia Global
              </button>
            </div>
          </div>
        )}

        {activeTab === 'bot' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border-color)] space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h4 className="text-[12px] font-black text-[var(--text-main)] uppercase tracking-tight">Motor Automatizado 24/7</h4>
                  <p className="text-[10px] text-[var(--text-muted)]">Control de liquidez y ejecución distribuida</p>
                </div>
                <button 
                  onClick={() => setLocalBot({...localBot, pauseAll: !localBot.pauseAll})}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all shadow-md ${localBot.pauseAll ? 'bg-[rgba(246,70,93,0.1)] text-[var(--red)] border border-[var(--red)]/20' : 'bg-[rgba(14,203,129,0.1)] text-[var(--green)] border border-[var(--green)]/20'}`}
                >
                  {localBot.pauseAll ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                  {localBot.pauseAll ? 'REANUDAR MOTOR' : 'PAUSAR MOTOR'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)]">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-[var(--orange)]" />
                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Escaneo (Seg)</span>
                  </div>
                  <input 
                    type="number" 
                    className="w-full bg-transparent text-[24px] font-black text-[#8a2be2] outline-none"
                    value={localBot.scanInterval}
                    onChange={e => setLocalBot({...localBot, scanInterval: Number(e.target.value)})}
                  />
                </div>
                <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)]">
                  <div className="flex items-center gap-2 mb-2">
                    <ListFilter size={14} className="text-[var(--blue)]" />
                    <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Cupos USDT</span>
                  </div>
                  <input 
                    type="number" 
                    className="w-full bg-transparent text-[24px] font-black text-[#8a2be2] outline-none"
                    value={localBot.maxUsdtPerUser}
                    onChange={e => setLocalBot({...localBot, maxUsdtPerUser: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-color)] flex items-center justify-between">
                <div>
                  <div className="text-[12px] font-black text-[var(--text-main)]">Auto Re-Entry</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Reinicia el ciclo de compra tras un Take Profit</div>
                </div>
                <label className="relative inline-block w-10 h-6 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="opacity-0 w-0 h-0 peer" 
                    checked={localBot.autoReEntry}
                    onChange={e => setLocalBot({...localBot, autoReEntry: e.target.checked})}
                  />
                  <span className="absolute inset-0 bg-[var(--border-color)] rounded-full transition-all peer-checked:bg-[#8a2be2] before:absolute before:content-[''] before:h-4 before:w-4 before:left-[4px] before:bottom-[4px] before:bg-white before:rounded-full before:transition-transform peer-checked:before:translate-x-[16px]"></span>
                </label>
              </div>

              <button onClick={saveBotConfig} className="w-full bg-[#8a2be2] text-white font-black py-3 rounded-xl text-[11px] uppercase tracking-widest shadow-xl transition-all active:scale-[0.98]">
                Sincronizar Motor Bot
              </button>
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Premium Section */}
            <div className="bg-[var(--bg-body)] p-4 rounded-xl border border-[var(--border-color)]">
              <h4 className="text-[11px] font-black text-[var(--orange)] uppercase mb-3 flex items-center gap-2">
                <LayoutGrid size={14} /> CAPITAL X3 (ACTIVOS PREMIUM)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {premiumETFs.map(etf => (
                  <div key={etf} className="flex justify-between items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg pl-3 pr-1 py-1.5 shadow-sm group">
                    <span className="text-[11px] font-black text-[var(--text-main)]">{etf}</span>
                    <button 
                      onClick={() => handleRemoveETF(etf)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--red)] transition-colors opacity-40 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Añadir ETF (ej: SOL5L)"
                  value={newETF}
                  onChange={e => setNewETF(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddETF()}
                  className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[11px] text-[var(--text-main)] outline-none focus:border-[var(--orange)] transition-all"
                />
                <button onClick={handleAddETF} className="bg-[var(--orange)] text-white font-black px-4 py-2 rounded-lg text-[10px] hover:opacity-90">ADD</button>
              </div>
            </div>

            {/* Blocked Section */}
            <div className="bg-[rgba(246,70,93,0.02)] p-4 rounded-xl border border-[rgba(246,70,93,0.2)]">
              <h4 className="text-[11px] font-black text-[var(--red)] uppercase mb-3 flex items-center gap-2">
                <Ban size={14} /> BLACKLIST GLOBAL (OCULTOS)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {blockedETFs.map(etf => (
                  <div key={etf} className="flex justify-between items-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 shadow-sm">
                    <span className="text-[11px] font-black text-[var(--text-main)] opacity-60 line-through italic">{etf}</span>
                    <button 
                      onClick={() => handleUnblockETF(etf)}
                      className="text-[9px] font-black text-[var(--green)] hover:underline"
                    >
                      UNBLOCK
                    </button>
                  </div>
                ))}
                {blockedETFs.length === 0 && <span className="text-[10px] text-[var(--text-muted)] col-span-full text-center py-2 italic font-bold">No hay bloqueos activos</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
