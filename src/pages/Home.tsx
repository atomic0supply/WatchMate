import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { SectionTitle, Card, Button } from '../components/UI';
import { getPosterUrl, searchTMDB } from '../lib/tmdb';
import { generateAIRecommendations } from '../lib/gemini';
import { Recommendation, ContentItem, OperationType } from '../types';
import { Sparkles, Check, Bookmark, X, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { AddContentModal } from '../components/AddContentModal';

export default function Home() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [history, setHistory] = useState<ContentItem[]>([]);
  const [toWatch, setToWatch] = useState<ContentItem[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  
  // Swipe state
  const [swipeIndex, setSwipeIndex] = useState(0);
  const [dragProgress, setDragProgress] = useState(0); // -1 left, 0 center, 1 right
  
  // Rating flow
  const [ratingTarget, setRatingTarget] = useState<any>(null);
  
  // Details flow
  const [detailsTarget, setDetailsTarget] = useState<any>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const profileSub = onSnapshot(doc(db, `users/${auth.currentUser.uid}`), (snap) => {
      setProfile(snap.data());
    });

    const historyQ = query(collection(db, `users/${auth.currentUser.uid}/content`), where('status', '==', 'watched'));
    const toWatchQ = query(collection(db, `users/${auth.currentUser.uid}/content`), where('status', '==', 'to_watch'));
    const recsQ = query(collection(db, `users/${auth.currentUser.uid}/recommendations`), where('status', '==', 'suggested'));

    const unsubH = onSnapshot(historyQ, (snap) => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentItem)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'history'));

    const unsubT = onSnapshot(toWatchQ, (snap) => {
      setToWatch(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentItem)));
    }, err => handleFirestoreError(err, OperationType.LIST, 'toWatch'));

    const unsubR = onSnapshot(recsQ, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Recommendation));
      setRecs(docs);
      setSwipeIndex(0);
      setLoading(false);
    }, err => handleFirestoreError(err, OperationType.LIST, 'recommendations'));

    return () => { unsubH(); unsubT(); unsubR(); profileSub(); };
  }, []);

  const handleRefreshRecs = async () => {
    if (!auth.currentUser) return;
    setRefreshing(true);
    
    try {
      const userSnap = await getDoc(doc(db, `users/${auth.currentUser.uid}`));
      const tasteProfile = userSnap.data()?.tasteProfile || "General interest";
      
      // Get all dismissed recommendations to find "ignored" titles
      const dismissedQ = query(collection(db, `users/${auth.currentUser.uid}/recommendations`), where('status', '==', 'dismissed'));
      const dismissedSnap = await getDocs(dismissedQ);
      const dismissedDocs = dismissedSnap.docs.map(d => d.data());
      
      // Count titles
      const titleCounts: Record<string, number> = {};
      dismissedDocs.forEach(d => {
        titleCounts[d.title] = (titleCounts[d.title] || 0) + 1;
      });
      
      const ignoredTitles = Object.keys(titleCounts).filter(t => titleCounts[t] >= 4);

      // Delete old suggested recommendations first
      for (const r of recs) {
        await updateDoc(doc(db, `users/${auth.currentUser.uid}/recommendations/${r.id}`), { status: 'dismissed' });
      }

      const aiRecs = await generateAIRecommendations(history, tasteProfile, toWatch, ignoredTitles);
      
      for (const r of aiRecs) {
        // Find poster and metadata in TMDB with better logic
        let match = null;
        try {
          // Clean title for better search
          const cleanTitle = (r.title || '').replace(/[:()]/g, '').trim();
          const searchResults = await searchTMDB(cleanTitle);
          match = searchResults.find(m => 
            (m.title?.toLowerCase() === r.title?.toLowerCase()) || 
            (m.name?.toLowerCase() === r.title?.toLowerCase())
          ) || searchResults[0];
          
          // If match found but no poster, try reaching out for any match with poster
          if (!match?.poster_path && searchResults.length > 0) {
             match = searchResults.find(m => m.poster_path) || match;
          }
        } catch (err) {
          console.error("TMDB error during rec generation:", err);
        }
        
        await addDoc(collection(db, `users/${auth.currentUser.uid}/recommendations`), {
          ...r,
          userId: auth.currentUser.uid,
          status: 'suggested',
          posterPath: match?.poster_path || null,
          tmdbId: String(match?.id || ''),
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const markDismissed = async (id: string) => {
    if (!auth.currentUser) return;
    await updateDoc(doc(db, `users/${auth.currentUser.uid}/recommendations/${id}`), { status: 'dismissed' });
  };

  const markToWatch = async (rec: Recommendation) => {
    if (!auth.currentUser) return;
    const path = `users/${auth.currentUser.uid}/content`;
    await addDoc(collection(db, path), {
      userId: auth.currentUser.uid,
      title: rec.title,
      type: rec.type,
      status: 'to_watch',
      posterPath: rec.posterPath || null,
      tmdbId: rec.tmdbId || null,
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, `users/${auth.currentUser.uid}/recommendations/${rec.id}`), { status: 'to_watch' });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <SectionTitle 
        subtitle="Basado en lo que has visto"
        action={
          <Button variant="ghost" size="icon" onClick={handleRefreshRecs} disabled={refreshing}>
            <Sparkles size={20} className={refreshing ? "animate-pulse text-accent" : "text-zinc-400"} />
          </Button>
        }
      >
        ¿Qué vemos hoy?
      </SectionTitle>

      {recs.length === 0 && !loading && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 text-center">
          <p className="text-zinc-500 mb-4">Añade algunas películas para que la IA aprenda tu gusto.</p>
          <Button variant="secondary" onClick={handleRefreshRecs} disabled={refreshing}>
            {refreshing ? 'Generando...' : 'Generar recomendaciones'}
          </Button>
        </div>
      )}

      {profile?.homeViewMode === 'swipe' && recs.length > 0 && swipeIndex < recs.length ? (
        <div className="relative h-[65vh] flex items-center justify-center perspective-1000 mt-4">
          <AnimatePresence mode="popLayout">
            {recs.slice(swipeIndex, swipeIndex + 2).reverse().map((rec, idx) => {
              const itemsInStack = recs.slice(swipeIndex, swipeIndex + 2).length;
              const isTop = idx === (itemsInStack - 1);
              
              return (
                <motion.div
                  key={rec.id}
                  style={{ zIndex: isTop ? 10 : idx }}
                  initial={{ scale: 0.9, opacity: 0, y: 10 }}
                  animate={{ 
                    scale: isTop ? 1 : 0.92, 
                    opacity: 1, 
                    y: isTop ? 0 : 25,
                    rotate: isTop ? 0 : (idx % 2 === 0 ? -1 : 1)
                  }}
                  exit={{ 
                    x: dragProgress > 0 ? 500 : -500, 
                    opacity: 0, 
                    rotate: dragProgress > 0 ? 45 : -45,
                    transition: { duration: 0.4, ease: "easeIn" }
                  }}
                  drag={isTop ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  onDrag={(e, info) => {
                    const progress = Math.min(Math.max(info.offset.x / 100, -1), 1);
                    setDragProgress(progress);
                  }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 120) {
                      markToWatch(rec);
                      setSwipeIndex(prev => prev + 1);
                    } else if (info.offset.x < -120) {
                      markDismissed(rec.id);
                      setSwipeIndex(prev => prev + 1);
                    }
                    setDragProgress(0);
                  }}
                  className="absolute w-full px-4 active:cursor-grabbing"
                >
                  <Card 
                    title={rec.title}
                    subtitle={`${rec.type === 'movie' ? 'Película' : 'Serie'} • ${rec.year || ''}`}
                    poster={getPosterUrl(rec.posterPath)}
                    className="shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/5 h-full"
                    swipeOverlay={isTop && Math.abs(dragProgress) > 0.1 && (
                      <div className="flex inset-3 justify-center items-center h-48 pointer-events-none">
                         {dragProgress > 0 ? (
                           <motion.div 
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: dragProgress, scale: 0.5 + dragProgress * 0.5 }}
                            className="bg-accent text-accent-dark px-8 py-3 rounded-full font-black text-2xl uppercase tracking-tighter flex items-center gap-3 backdrop-blur-md shadow-2xl"
                           >
                             <Bookmark size={32} /> Guardar
                           </motion.div>
                         ) : (
                           <motion.div 
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: Math.abs(dragProgress), scale: 0.5 + Math.abs(dragProgress) * 0.5 }}
                            className="bg-red-500 text-white px-8 py-3 rounded-full font-black text-2xl uppercase tracking-tighter flex items-center gap-3 backdrop-blur-md shadow-2xl"
                           >
                             <X size={32} /> Pasar
                           </motion.div>
                         )}
                      </div>
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         <div className="px-2 py-1 rounded bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest leading-none">
                           Match: {rec.matchScore}%
                         </div>
                       </div>
                       <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-zinc-500 h-auto p-0" onClick={() => setDetailsTarget(rec)}>
                          Detalles
                       </Button>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between pointer-events-none">
                       <div className="flex flex-col items-center opacity-20">
                          <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center mb-1">
                             <X size={20} />
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest">Pasa</span>
                       </div>
                       <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-[0.3em]">Desliza para decidir</p>
                       <div className="flex flex-col items-center opacity-20">
                          <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center mb-1">
                             <Bookmark size={20} />
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest">Guarda</span>
                       </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {swipeIndex >= recs.length && (
            <div className="text-center px-8">
              <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-[40px] shadow-inner mb-6">
                 <Sparkles size={48} className="text-accent mx-auto mb-4 opacity-50" />
                 <h4 className="text-xl font-bold text-white mb-2">¡Todo al día!</h4>
                 <p className="text-zinc-500 text-sm leading-relaxed">Has revisado todas tus recomendaciones actuales. Genera nuevas basadas en tu historial.</p>
              </div>
              <Button className="w-full py-4 text-lg" onClick={handleRefreshRecs} disabled={refreshing}>
                {refreshing ? 'Generando...' : 'Nuevas Recomendaciones'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {recs.map((rec) => (
            <Card 
              key={rec.id}
              title={rec.title}
              subtitle={`${rec.type === 'movie' ? 'Película' : 'Serie'} • ${rec.year || ''}`}
              poster={getPosterUrl(rec.posterPath)}
              className="cursor-pointer"
              onClick={() => setDetailsTarget(rec)}
            >
              <div className="flex items-center justify-between mb-4">
                 <span className="px-2 py-1 rounded bg-accent/10 text-accent text-[10px] font-bold tracking-widest uppercase border border-accent/20">
                   Match: {rec.matchScore}%
                 </span>
                 <button 
                  onClick={(e) => { e.stopPropagation(); setExpandedRec(expandedRec === rec.id ? null : rec.id); }}
                  className="text-zinc-500 hover:text-white flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest"
                 >
                   {expandedRec === rec.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                   {expandedRec === rec.id ? 'Cerrar' : 'Por qué'}
                 </button>
              </div>

              <AnimatePresence>
                {expandedRec === rec.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-zinc-400 mb-5 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5 italic">
                      {rec.reason}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 gap-2 border-white/5"
                  onClick={(e) => { e.stopPropagation(); markToWatch(rec); }}
                >
                  <Bookmark size={14} /> Pendiente
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="flex-1 gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRatingTarget(rec);
                    updateDoc(doc(db, `users/${auth.currentUser!.uid}/recommendations/${rec.id}`), { status: 'watched' });
                  }}
                >
                  <Check size={14} strokeWidth={2.5} /> Ya vista
                </Button>
                <Button 
                  variant="secondary" 
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); markDismissed(rec.id); }}
                  className="bg-zinc-900 border border-white/5"
                >
                  <X size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddContentModal 
        isOpen={!!ratingTarget} 
        onClose={() => setRatingTarget(null)} 
        preSelected={ratingTarget}
      />

      {/* Details Modal */}
      <AnimatePresence>
        {detailsTarget && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailsTarget(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-zinc-900 border-t border-white/10 rounded-t-[40px] md:rounded-[40px] md:border w-full max-w-lg overflow-hidden relative shadow-2xl safe-bottom mt-20"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mt-4 mb-2 md:hidden" />
              
              <div className="flex flex-col h-full max-h-[85vh] overflow-y-auto">
                <div className="aspect-[4/3] relative">
                  <img src={getPosterUrl(detailsTarget.posterPath, 'w780')} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
                  <button 
                    onClick={() => setDetailsTarget(null)} 
                    className="absolute top-6 right-6 p-2 bg-black/50 backdrop-blur-xl rounded-full text-white/50 hover:text-white border border-white/10"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="px-8 pb-12 pt-4">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-3xl font-black text-white mb-1 tracking-tight leading-none">{detailsTarget.title}</h2>
                      <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest">{detailsTarget.type === 'movie' ? 'Película' : 'Serie'} • {detailsTarget.year}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-8">
                    <div className="px-3 py-1.5 rounded-full bg-accent text-accent-dark text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,245,255,0.2)]">
                      Match Score: {detailsTarget.matchScore}%
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-4">¿Por qué WatchMate te lo recomienda?</h4>
                      <p className="text-zinc-300 leading-relaxed font-medium bg-white/5 p-6 rounded-3xl border border-white/5 relative">
                         <span className="absolute -top-3 left-6 px-2 bg-zinc-900 text-[10px] font-black text-accent uppercase tracking-widest">IA Insight</span>
                        "{detailsTarget.reason}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pb-6">
                      <Button 
                        variant="primary" 
                        className="py-5 rounded-2xl text-base shadow-[0_10px_30px_rgba(0,245,255,0.1)]" 
                        onClick={() => {
                          markToWatch(detailsTarget);
                          setDetailsTarget(null);
                        }}
                      >
                        Lo veré
                      </Button>
                      <Button 
                        variant="secondary" 
                        className="py-5 rounded-2xl text-base bg-white/5"
                        onClick={() => {
                          setRatingTarget(detailsTarget);
                          setDetailsTarget(null);
                        }}
                      >
                        Ya visto
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
