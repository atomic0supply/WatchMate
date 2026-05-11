import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError } from './lib/firebase';
import { OperationType } from './types';
import { Layout } from './components/Navigation';
import { AddContentModal } from './components/AddContentModal';
import { Button } from './components/UI';
import { Film } from 'lucide-react';

// Pages
import Home from './pages/Home';
import Seen from './pages/Seen';
import ToWatch from './pages/ToWatch';
import Profile from './pages/Profile';

function Login() {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
      
      if (!userSnap?.exists()) {
        const payload = {
          id: user.uid,
          name: user.displayName,
          email: user.email,
          createdAt: serverTimestamp(),
          tasteProfile: ''
        };
        try {
          await setDoc(userRef, payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.message && error.message.includes('authInfo')) {
        // This is our handleFirestoreError JSON
        setError("Error de permisos en base de datos. Verifica que tu cuenta de Google esté verificada.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Error de red: Prueba desactivando el bloqueo de cookies de terceros o usa Chrome/Edge. También puedes intentar abrir la app en una pestaña nueva.");
      } else {
        setError(error.message || "Error al iniciar sesión");
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 accent-glow pointer-events-none" />
      <div className="w-20 h-20 bg-accent rounded-[24px] flex items-center justify-center mb-10 rotate-6 shadow-[0_0_60px_rgba(0,245,255,0.2)]">
        <Film size={36} className="text-accent-dark" />
      </div>
      <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">WatchMate</h1>
      <p className="text-zinc-500 mb-12 max-w-xs mx-auto font-medium leading-relaxed">
        Entiende tu gusto. Descubre qué ver esta noche. <span className="text-accent/80">Simple. Pro. Privado.</span>
      </p>
      
      <Button size="lg" className="w-full max-w-sm rounded-2xl py-4 flex gap-3" onClick={handleLogin}>
        Entrar con Google
      </Button>

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl max-w-sm">
          <p className="text-red-400 text-xs font-medium">{error}</p>
        </div>
      )}

      <p className="text-zinc-600 text-[10px] mt-12 uppercase tracking-widest font-bold">
        Sin anuncios • Solo utilidad
      </p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Layout onOpenAdd={() => setIsAddOpen(true)}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/seen" element={<Seen />} />
          <Route path="/to-watch" element={<ToWatch />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
      <AddContentModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
    </BrowserRouter>
  );
}
