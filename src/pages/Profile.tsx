import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { doc, onSnapshot, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { SectionTitle, Button, cn, hapticFeedback } from '../components/UI';
import { generateTasteProfile } from '../lib/gemini';
import { UserProfile, ContentItem, OperationType } from '../types';
import { User, Sparkles, LogOut, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, `users/${auth.currentUser.uid}`), (snap) => {
      if (snap.exists()) {
        setProfile({ id: snap.id, ...snap.data() } as UserProfile);
      }
    }, err => handleFirestoreError(err, OperationType.GET, 'user'));
    return () => unsub();
  }, []);

  const handleRecalculate = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      // Get history
      const q = query(collection(db, `users/${auth.currentUser.uid}/content`), where('status', '==', 'watched'));
      const snap = await getDocs(q);
      const history = snap.docs.map(d => d.data() as ContentItem);
      
      const newTaste = await generateTasteProfile(history);
      await updateDoc(doc(db, `users/${auth.currentUser.uid}`), {
        tasteProfile: newTaste
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <SectionTitle subtitle={auth.currentUser?.email}>Tu perfil</SectionTitle>

      <div className="flex flex-col items-center mb-12">
        <div className="w-24 h-24 bg-gradient-to-tr from-accent/20 to-zinc-800 rounded-[32px] flex items-center justify-center mb-5 border border-white/5 shadow-2xl relative">
          <User size={40} className="text-accent" />
          <div className="absolute -bottom-2 -right-2 bg-accent text-accent-dark p-1.5 rounded-xl border-4 border-surface-bg shadow-xl">
             <Settings size={14} strokeWidth={2.5} />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white tracking-tight">{auth.currentUser?.displayName || 'Cinéfilo'}</h3>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1">Miembro desde {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : '2026'}</p>
      </div>

      <div className="sleek-card p-6 mb-8 relative overflow-hidden bg-gradient-to-br from-white/[0.03] to-transparent">
        <div className="absolute top-0 right-0 p-4 opacity-10 blur-sm">
          <Sparkles size={80} />
        </div>
        
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-5 flex items-center gap-2">
          <Sparkles size={14} strokeWidth={2.5} /> Tu perfil de contenido
        </h4>
        
        {profile?.tasteProfile ? (
          <div className="prose prose-invert prose-sm text-zinc-400 leading-relaxed max-w-none prose-p:mb-4">
            <ReactMarkdown>{profile.tasteProfile}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-zinc-500 italic text-sm text-center py-4 bg-white/5 rounded-2xl border border-white/5">
            Aún no hemos analizado tus gustos.<br/>Añade películas y pulsa recalcular.
          </p>
        )}

        <Button 
          variant="primary" 
          className="w-full mt-8 gap-2 py-4" 
          onClick={handleRecalculate}
          disabled={loading}
        >
          <Sparkles size={18} /> {loading ? 'Analizando...' : 'Recalcular perfil'}
        </Button>
      </div>

      <div className="sleek-card p-6 mb-8">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-6">Visualización Home</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              hapticFeedback();
              updateDoc(doc(db, `users/${auth.currentUser!.uid}`), { homeViewMode: 'grid' });
            }}
            className={cn(
              "p-4 rounded-2xl border text-center transition-all",
              (profile?.homeViewMode || 'grid') === 'grid' 
                ? "bg-accent/10 border-accent text-accent shadow-[0_0_20px_rgba(0,245,255,0.1)]"
                : "bg-white/5 border-white/5 text-zinc-500"
            )}
          >
            <div className="font-bold text-sm mb-1">Cuadrícula</div>
            <div className="text-[10px] opacity-60">Exploración clásica</div>
          </button>
          <button
            onClick={() => {
              hapticFeedback();
              updateDoc(doc(db, `users/${auth.currentUser!.uid}`), { homeViewMode: 'swipe' });
            }}
            className={cn(
              "p-4 rounded-2xl border text-center transition-all",
              profile?.homeViewMode === 'swipe' 
                ? "bg-accent/10 border-accent text-accent shadow-[0_0_20px_rgba(0,245,255,0.1)]"
                : "bg-white/5 border-white/5 text-zinc-500"
            )}
          >
            <div className="font-bold text-sm mb-1">Swipe</div>
            <div className="text-[10px] opacity-60">Estilo Tinder</div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" className="gap-2 text-zinc-400">
          <Settings size={16} /> Ajustes
        </Button>
        <Button variant="outline" className="gap-2 text-red-400 border-red-500/20 bg-red-500/5" onClick={() => auth.signOut()}>
          <LogOut size={16} /> Salir
        </Button>
      </div>
    </motion.div>
  );
}
