import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { SectionTitle, Button, Card, cn } from '../components/UI';
import { getPosterUrl } from '../lib/tmdb';
import { ContentItem, OperationType } from '../types';
import { Star, Trash2, Plus, Minus } from 'lucide-react';

export default function Seen() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'movie' | 'series'>('all');

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, `users/${auth.currentUser.uid}/content`), 
      where('status', '==', 'watched'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentItem)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'seen'));
    return () => unsub();
  }, []);

  const filtered = items.filter(i => filter === 'all' || i.type === filter);

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/content/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (e) { handleFirestoreError(e, OperationType.DELETE, path); }
  };

  const toggleSeason = async (item: ContentItem, season: number) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/content/${item.id}`;
    const current = item.watchedSeasons || [];
    const updated = current.includes(season) 
      ? current.filter(s => s !== season)
      : [...current, season].sort((a,b) => a-b);
    
    try {
      await updateDoc(doc(db, path), { watchedSeasons: updated });
    } catch (e) { handleFirestoreError(e, OperationType.UPDATE, path); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <SectionTitle subtitle={`${items.length} obras registradas`}>Visto</SectionTitle>
      
      <div className="flex gap-2 mb-6">
        {['all', 'movie', 'series'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold transition-all uppercase tracking-wider",
              filter === f ? "bg-white text-black" : "bg-zinc-900 text-zinc-500"
            )}
          >
            {f === 'all' ? 'Todo' : f === 'movie' ? 'Películas' : 'Series'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((item) => (
          <div key={item.id} className="sleek-card p-3 flex gap-4 hover:border-white/20 transition-all cursor-default">
            <div className="w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-950 border border-white/5">
              <img src={getPosterUrl(item.posterPath, 'w92')} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-white line-clamp-1 group-hover:text-accent transition-colors">{item.title}</h4>
                  <p className="text-zinc-500 text-xs font-medium">{item.year} • {item.type === 'movie' ? 'Película' : 'Serie'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-white/5 border border-white/5 px-2 py-1 rounded-lg">
                    <Star size={12} className="fill-accent text-accent" />
                    <span className="text-xs font-bold text-accent">{item.rating}</span>
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {item.type === 'series' && item.seasonsCount && (
                <div className="mt-3 bg-white/5 border border-white/5 rounded-xl p-2">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-2 ml-1">Temporadas vistas</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: item.seasonsCount }, (_, i) => i + 1).map(s => (
                      <button
                        key={s}
                        onClick={() => toggleSeason(item, s)}
                        className={cn(
                          "w-7 h-7 rounded text-[10px] font-bold transition-all",
                          (item.watchedSeasons || []).includes(s)
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-black/40 text-zinc-600 border border-white/5 hover:border-white/10"
                        )}
                      >
                        S{s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 flex gap-1.5 px-1">
                {item.genres?.slice(0, 2).map(g => (
                  <span key={g} className="text-[10px] uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded text-zinc-400 font-semibold border border-white/5 leading-none">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
