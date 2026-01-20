import React, { useState } from 'react';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { LogIn, UserPlus, AlertCircle, ShieldCheck } from 'lucide-react';

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
    const normalizedUsername = input.toLowerCase().replace(/\//g, '_');
    const emailToUse = !input.includes('@') ? `${normalizedUsername}@ppisms.edu` : input;

    try {
      if (isLogin) {
        const { success, error: authError } = await login(emailToUse, formData.password);
        if (success) return;

        const { data: registryProfile } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${input.toLowerCase()},username.ilike.${normalizedUsername}`)
          .maybeSingle();

        if (registryProfile) {
          if (registryProfile.password === formData.password) {
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
                setError('Account Active: This profile is already in use.');
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
            setError('Registry Mismatch: Incorrect Password.');
          }
        } else {
          setError('Registry ID not located.');
        }
      } else {
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
          setError(signUpError.message);
          return;
        }
        
        if (authData.user) {
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
      setError(err.message || 'System error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 overflow-hidden bg-white dark:bg-slate-950">
      {/* Left Panel: Brand Experience */}
      <div className="hidden lg:flex flex-col justify-between p-16 text-white relative overflow-hidden">
        {/* Background Image with Brand Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1470" 
            alt="Student studying" 
            className="w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-700/90 via-blue-600/85 to-blue-900/90 mix-blend-multiply" />
        </div>

        {/* Brand Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-blue-600 font-black text-3xl shadow-2xl shadow-blue-900/20">P</div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">PPISMS</h1>
              <p className="text-blue-100 text-[10px] opacity-80 uppercase tracking-[0.3em] font-black">Portal System v3.0</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
            <ShieldCheck size={16} className="text-blue-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-50">Authorized Personnel Only</span>
          </div>
          <h2 className="text-6xl font-black leading-[1.1] mb-8 tracking-tighter">Nurturing Excellence in Every Learner.</h2>
          <p className="text-xl text-blue-50/90 leading-relaxed font-light">Join the ranks of Prince and Princess International School's digital ecosystem for seamless academic management.</p>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-8">
          <div className="text-[10px] text-blue-200/60 font-black uppercase tracking-[0.3em]">&copy; {new Date().getFullYear()} PPIS ACADEMY</div>
          <div className="flex gap-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200/40">Privacy</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200/40">Terms</span>
          </div>
        </div>
      </div>

      {/* Right Panel: Auth Form */}
      <div className="flex items-center justify-center p-8 md:p-12 lg:p-24 relative overflow-y-auto">
        {/* Decorative background for mobile */}
        <div className="lg:hidden absolute top-0 left-0 w-full h-40 bg-blue-600 -skew-y-3 -mt-20 z-0"></div>
        
        <div className="w-full max-w-md space-y-12 relative z-10">
          <div className="text-center lg:text-left space-y-2">
            <h1 className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter leading-none">
              Prince and Princess International School
            </h1>
            <h2 className="text-4xl md:text-5xl font-black text-slate-800 dark:text-white tracking-tighter">
              {isLogin ? 'Login' : 'Activate Profile'}
            </h2>
            <div className="w-16 h-1.5 bg-blue-600 rounded-full hidden lg:block"></div>
            <p className="text-slate-500 dark:text-slate-400 font-medium pt-2">
              {isLogin ? 'Institutional Access Portal' : 'Register your academic identity'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2 group">
                <label className="text-xs font-black text-slate-400 group-focus-within:text-blue-600 uppercase tracking-widest ml-1 transition-colors">Official Legal Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Emmanuel"
                  className="w-full px-6 py-5 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-bold transition-all focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none shadow-sm"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            )}
            
            <div className="space-y-2 group">
              <label className="text-xs font-black text-slate-400 group-focus-within:text-blue-600 uppercase tracking-widest ml-1 transition-colors">Registry ID / Admission No.</label>
              <input
                required
                type="text"
                placeholder="PPIS/2026/001"
                className="w-full px-6 py-5 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-mono text-sm transition-all focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none shadow-sm"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2 group">
              <label className="text-xs font-black text-slate-400 group-focus-within:text-blue-600 uppercase tracking-widest ml-1 transition-colors">Portal Password</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                className="w-full px-6 py-5 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white transition-all focus:ring-4 focus:ring-blue-600/10 focus:border-blue-600 outline-none shadow-sm"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && (
              <div className={`p-5 rounded-2xl text-xs font-bold flex items-center gap-4 border animate-in slide-in-from-top-2 duration-300 ${error.toLowerCase().includes('success') || error.toLowerCase().includes('created') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                <div className={`p-2 rounded-full ${error.toLowerCase().includes('success') ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                   <AlertCircle size={18} className="shrink-0" />
                </div>
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full py-5 bg-blue-600 text-white rounded-[1.25rem] font-black uppercase tracking-[0.2em] text-[11px] hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all shadow-2xl shadow-blue-200 dark:shadow-blue-900/20 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                  <span>{isLogin ? 'Unlock Institutional Access' : 'Begin Activation'}</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-8 border-t border-slate-100 dark:border-slate-800">
            <p className="text-slate-400 text-sm mb-4">
              {isLogin ? "New to the portal?" : "Already have an active profile?"}
            </p>
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="px-8 py-3 bg-slate-50 dark:bg-slate-900 dark:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:bg-blue-600 hover:text-white transition-all border border-slate-200 dark:border-slate-800"
            >
              {isLogin ? "Self-Activation Hub" : "Return to Login"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;