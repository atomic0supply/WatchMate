import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { SectionTitle, Button, cn } from '../components/UI';
import { getPosterUrl } from '../lib/tmdb';
import { ContentItem, OperationType } from '../types';
import { Check, Trash2, Clock } from 'lucide-react';

export default function ToWatch() {
  const [items, setItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/content`), 
      where('status', '==', 'to_watch'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentItem)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'toWatch'));
    return () => unsub();
  }, []);

  const markAsWatched = async (id: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/content/${id}`;
    try {
      // In a real app we'd open a rating modal first, but for MVP we just mark it
      await updateDoc(doc(db, path), { 
        status: 'watched',
        createdAt: serverTimestamp() // move to top of seen
      });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, path); }
  };

  const remove = async (id: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/content/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, path); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <SectionTitle subtitle="Planeas ver esto pronto">Pendiente</SectionTitle>

      <div className="space-y-4">
        {items.length === 0 && (
          <div className="text-center py-20">
            <Clock size={48} className="mx-auto text-zinc-800 mb-4" />
            <p className="text-zinc-500">Tu lista está vacía.</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="sleek-card overflow-hidden flex flex-col hover:border-white/20 transition-all">
            <div className="p-3 flex gap-4">
              <div className="w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-950 border border-white/5 shadow-xl">
                <img src={getPosterUrl(item.posterPath, 'w92')} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 py-1">
                <h4 className="font-bold text-white line-clamp-1">{item.title}</h4>
                <p className="text-zinc-500 text-xs font-medium">{item.year} • {item.type === 'movie' ? 'Película' : 'Serie'}</p>
                <div className="mt-3 flex gap-1.5">
                  {item.genres?.slice(0, 2).map(g => (
                    <span key={g} className="text-[10px] uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded text-zinc-500 font-semibold border border-white/5 leading-none">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex border-t border-white/5 transition-all">
              <button 
                onClick={() => markAsWatched(item.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 text-xs font-bold uppercase tracking-widest text-[#00F5FF] hover:bg-accent/5 transition-colors"
              >
                <Check size={14} strokeWidth={2.5} /> Vista
              </button>
              <div className="w-[1px] bg-white/5" />
              <button 
                onClick={() => remove(item.id)}
                className="px-5 flex items-center justify-center text-zinc-600 hover:text-red-500 hover:bg-red-500/5 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
