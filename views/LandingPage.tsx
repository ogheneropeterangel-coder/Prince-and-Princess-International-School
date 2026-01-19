import React, { useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { LogIn, UserPlus, Info, AlertCircle } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const input = formData.email.trim();
    // Standardize identity: replace slashes with underscores for email-compatible usernames
    const normalizedUsername = input.toLowerCase().replace(/\//g, '_');
    const emailToUse = !input.includes('@') ? `${normalizedUsername}@ppisms.edu` : input;

    try {
      if (isLogin) {
        // Attempt standard login first
        const { success, error: authError } = await login(emailToUse, formData.password);
        
        if (success) return;

        // If Auth login fails (first time user), check if the user exists in the Registry (profiles table)
        const { data: registryProfile } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${input.toLowerCase()},username.ilike.${normalizedUsername}`)
          .maybeSingle();

        if (registryProfile) {
          // Verify against the plain-text password stored by Admin in the Registry
          if (registryProfile.password === formData.password) {
            console.log("[Activation] Verified registry entry. Initializing Auth handoff...");
            
            // Temporary rename to avoid unique constraint conflict during signUp
            const tempUniqueId = `__sync_${normalizedUsername}_${crypto.randomUUID().split('-')[0]}`;
            await supabase.from('profiles').update({ username: tempUniqueId }).eq('id', registryProfile.id);

            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: emailToUse,
              password: formData.password,
              options: { 
                data: { fullName: registryProfile.full_name, role: registryProfile.role } 
              }
            });

            if (signUpError) {
              await supabase.from('profiles').update({ username: registryProfile.username }).eq('id', registryProfile.id);
              if (signUpError.message.includes('already registered')) {
                setError('Account Active: This profile is already in use. Try a different password.');
              } else {
                throw signUpError;
              }
              return;
            }

            if (signUpData.user) {
              await login(emailToUse, formData.password);
              return;
            }
          } else {
            setError('Registry Mismatch: Incorrect Password. Please contact your Admin.');
          }
        } else {
          setError('Registry ID not located. Please contact the Admissions/Staffing Office.');
        }
      } else {
        // Manual Activation Path (Self-onboarding)
        // CRITICAL FIX: Check if this username is already in the registry to adopt the correct role
        const { data: registryCheck } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${input.toLowerCase()},username.ilike.${normalizedUsername}`)
          .maybeSingle();

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: emailToUse,
          password: formData.password,
          options: { 
            data: { 
              fullName: registryCheck?.full_name || formData.fullName,
              role: registryCheck?.role || UserRole.STUDENT 
            } 
          }
        });

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setError('This identity is already registered. Please go to Log In.');
          } else {
            throw signUpError;
          }
          return;
        }
        
        if (authData.user) {
          // If they exist in registry, the App.tsx bridge will handle the ID sync
          // If they don't, we create the profile here
          const { data: existing } = await supabase.from('profiles').select('*').eq('username', normalizedUsername).maybeSingle();
          if (!existing && !registryCheck) {
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const role = (count === 0) ? UserRole.ADMIN : UserRole.STUDENT;
            await supabase.from('profiles').insert({
              id: authData.user.id,
              full_name: formData.fullName,
              username: normalizedUsername,
              role: role
            });
          }
          setError('Profile created! You may now log in.');
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      console.error("[Portal Auth Error]:", err);
      setError(`Critical System Alert: ${err.message || 'The registry is temporarily locked.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-blue-600 p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 font-black text-2xl shadow-xl shadow-blue-700">P</div>
          <div><h1 className="text-2xl font-bold uppercase tracking-tight">PPISMS</h1><p className="text-blue-100 text-[10px] opacity-80 uppercase tracking-widest font-black">Portal Core</p></div>
        </div>
        <div className="relative max-w-lg">
          <h2 className="text-6xl font-black leading-none mb-8">Excellence in Registry.</h2>
          <p className="text-xl text-blue-100/90 leading-relaxed font-light">Advanced result computation, staff oversight, and institutional management for Prince and Princess International School.</p>
        </div>
        <div className="relative text-[10px] text-blue-200/60 font-black uppercase tracking-[0.3em]">&copy; {new Date().getFullYear()} PPIS. All rights reserved.</div>
      </div>
      <div className="flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">{isLogin ? 'Log In' : 'Activate'}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3 font-medium">{isLogin ? 'Enter your institutional credentials.' : 'Complete your academic profile activation.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Official Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  className="w-full px-5 py-4 rounded-2xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white font-bold transition-all focus:ring-2 focus:ring-blue-600 outline-none"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Registry ID / Admission No.</label>
              <input
                required
                type="text"
                placeholder="e.g. PPIS/2026/001"
                className="w-full px-5 py-4 rounded-2xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white font-mono text-sm transition-all focus:ring-2 focus:ring-blue-600 outline-none"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Secure Password</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                className="w-full px-5 py-4 rounded-2xl border dark:bg-slate-800 dark:border-slate-700 dark:text-white transition-all focus:ring-2 focus:ring-blue-600 outline-none"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && (
              <div className={`p-4 rounded-2xl text-[10px] font-bold flex items-start gap-3 border animate-in slide-in-from-top-2 duration-300 ${error.toLowerCase().includes('success') || error.toLowerCase().includes('created') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (isLogin ? <LogIn size={18} /> : <UserPlus size={18} />)}
              {isLogin ? 'Unlock Portal' : 'Activate Profile'}
            </button>
          </form>

          <div className="text-center pt-4 border-t dark:border-slate-800">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors"
            >
              {isLogin ? "Profile not activated?" : "Back to Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;