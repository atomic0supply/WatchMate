import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Star, Heart, HeartOff, MinusCircle } from 'lucide-react';
import { Button, Card, cn } from './UI';
import { searchTMDB, getPosterUrl, mapGenres, getSeriesDetails } from '../lib/tmdb';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { OperationType, ContentStatus, styleLikedType } from '../types';

export function AddContentModal({ isOpen, onClose, preSelected }: { isOpen: boolean, onClose: () => void, preSelected?: any }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  // Form state
  const [status, setStatus] = useState<ContentStatus>('watched');
  const [rating, setRating] = useState(5);
  const [styleLiked, setStyleLiked] = useState<styleLikedType>('yes');
  const [seasonsCount, setSeasonsCount] = useState(0);
  const [watchedSeasons, setWatchedSeasons] = useState<number[]>([]);

  useEffect(() => {
    const fetchSeasons = async () => {
      if (selected && (selected.media_type === 'tv' || selected.type === 'series') && (selected.id || selected.tmdbId)) {
        const details = await getSeriesDetails(String(selected.id || selected.tmdbId));
        setSeasonsCount(details.seasons_count);
        // Default to first season if watching a new series
        if (details.seasons_count > 0 && watchedSeasons.length === 0) {
          setWatchedSeasons([1]);
        }
      } else {
        setSeasonsCount(0);
        setWatchedSeasons([]);
      }
    };
    fetchSeasons();
  }, [selected]);

  useEffect(() => {
    if (preSelected) {
      setSelected(preSelected);
      setStatus('watched');
      setRating(5); // Default to 5 hearts if seen? Or 0. Let's do 0.
      setStyleLiked('yes');
    } else {
      setSelected(null);
      setQuery('');
    }
  }, [preSelected, isOpen]);

  const handleAdd = async () => {
    if (!selected || !auth.currentUser) return;

    const path = `users/${auth.currentUser.uid}/content`;
    try {
      await addDoc(collection(db, path), {
        userId: auth.currentUser.uid,
        title: selected.title || selected.name,
        type: selected.media_type === 'tv' || selected.type === 'series' ? 'series' : 'movie',
        year: String(selected.release_date || selected.first_air_date || selected.year || '').split('-')[0],
        genres: selected.genre_ids ? mapGenres(selected.genre_ids) : (selected.genres || []),
        rating: status === 'watched' ? rating : 0,
        styleLiked: status === 'watched' ? styleLiked : 'neutral',
        status: status,
        posterPath: selected.poster_path || selected.posterPath,
        tmdbId: String(selected.id || selected.tmdbId),
        seasonsCount: seasonsCount > 0 ? seasonsCount : null,
        watchedSeasons: status === 'watched' && seasonsCount > 0 ? watchedSeasons : [],
        createdAt: serverTimestamp(),
      });
      onClose();
      setSelected(null);
      setQuery('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed inset-x-0 bottom-0 top-12 bg-surface-bg border-t border-white/10 rounded-t-[40px] z-[101] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="absolute inset-0 accent-glow pointer-events-none opacity-50" />
            <div className="relative p-6 flex flex-col h-full z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold tracking-tight text-white">¿Qué has visto?</h2>
                <Button variant="outline" size="icon" onClick={onClose} className="rounded-full border-white/5 bg-white/5">
                  <X size={20} />
                </Button>
              </div>

              {!selected ? (
                <>
                  <div className="relative mb-8">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    <input
                      autoFocus
                      placeholder="Busca película o serie..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all font-medium text-white placeholder:text-zinc-600"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        const timer = setTimeout(async () => {
                          if (e.target.value.length > 2) {
                            setLoading(true);
                            const res = await searchTMDB(e.target.value);
                            setResults(res);
                            setLoading(false);
                          } else {
                            setResults([]);
                          }
                        }, 500);
                      }}
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pb-8">
                    {loading && <p className="text-zinc-500 text-center py-12 animate-pulse">Buscando...</p>}
                    {results.map((res) => (
                      <div 
                        key={res.id} 
                        onClick={() => setSelected(res)}
                        className="flex items-start gap-5 p-4 rounded-3xl hover:bg-white/5 border border-transparent hover:border-white/5 cursor-pointer transition-all group"
                      >
                        <div className="w-16 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-zinc-900 shadow-lg group-hover:scale-105 transition-transform">
                          <img src={getPosterUrl(res.poster_path, 'w92')} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 py-1">
                          <h4 className="font-bold text-white group-hover:text-accent transition-colors">{res.title || res.name}</h4>
                          <p className="text-zinc-500 text-xs font-semibold">
                            {res.media_type === 'movie' ? 'PELÍCULA' : 'SERIE'} • {(res.release_date || res.first_air_date || '').split('-')[0]}
                          </p>
                          <p className="text-zinc-500 text-xs line-clamp-2 mt-2 leading-relaxed">{res.overview}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col overflow-y-auto pb-8">
                  <div className="flex gap-5 p-5 bg-white/5 border border-white/5 rounded-[32px] mb-10 shadow-inner">
                    <img src={getPosterUrl(selected.poster_path || selected.posterPath, 'w185')} alt="" className="w-24 h-36 rounded-2xl object-cover shadow-2xl" referrerPolicy="no-referrer" />
                    <div className="flex-1 py-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-3 -ml-2 text-accent font-bold">
                        ← Cambiar
                      </Button>
                      <h3 className="text-2xl font-black tracking-tighter leading-none mb-1">{selected.title || selected.name}</h3>
                      <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">{(selected.release_date || selected.first_air_date || selected.year || '').split('-')[0]}</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <div>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Estado</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['watched', 'to_watch'] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={cn(
                              "py-4 rounded-2xl border text-sm font-bold uppercase tracking-widest transition-all",
                              status === s 
                                ? "bg-white text-black border-white shadow-[0_0_30px_rgba(255,255,255,0.1)]" 
                                : "bg-white/5 text-zinc-500 border-white/5"
                            )}
                          >
                            {s === 'watched' ? 'Visto' : 'Pendiente'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {status === 'watched' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
                        <div>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Tu puntuación</p>
                          <div className="flex justify-between items-center bg-white/5 border border-white/5 p-6 rounded-3xl">
                             <div className="flex gap-2">
                               {[1, 2, 3, 4, 5].map((star) => (
                                 <button key={star} onClick={() => setRating(star)} className="transition-transform active:scale-90">
                                   <Star 
                                      size={32} 
                                      className={cn("transition-all duration-300", star <= rating ? "fill-accent text-accent drop-shadow-[0_0_10px_rgba(0,245,255,0.5)]" : "text-zinc-800")} 
                                   />
                                 </button>
                               ))}
                             </div>
                             <span className="text-3xl font-black text-accent">{rating}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">¿Te gusta este estilo?</p>
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { id: 'yes', icon: Heart, label: 'Sí' },
                              { id: 'neutral', icon: MinusCircle, label: 'Meh' },
                              { id: 'no', icon: HeartOff, label: 'No' }
                            ].map((item) => (
                              <button
                                key={item.id}
                                onClick={() => setStyleLiked(item.id as any)}
                                className={cn(
                                  "py-5 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                                  styleLiked === item.id 
                                    ? "bg-accent/10 border-accent/40 text-accent" 
                                    : "bg-white/5 border-white/5 text-zinc-600"
                                )}
                              >
                                <item.icon size={22} strokeWidth={2.5} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {status === 'watched' && seasonsCount > 0 && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Temporadas vistas</p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: seasonsCount }, (_, i) => i + 1).map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                setWatchedSeasons(prev => 
                                  prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s].sort((a,b) => a-b)
                                );
                              }}
                              className={cn(
                                "w-10 h-10 rounded-lg border text-[10px] font-bold transition-all",
                                watchedSeasons.includes(s)
                                  ? "bg-accent text-black border-accent"
                                  : "bg-white/5 text-zinc-500 border-white/5"
                              )}
                            >
                              S{s}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    <Button className="w-full py-5 text-lg font-black uppercase tracking-widest rounded-2xl shadow-[0_10px_40px_rgba(0,245,255,0.2)]" onClick={handleAdd}>
                      {status === 'watched' ? 'Guardar visto' : 'Añadir a pendientes'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
