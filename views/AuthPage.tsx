
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { db } from '../db';
import { LogIn, UserPlus, AlertCircle, ArrowLeft, Crown, Eye, EyeOff, MoveRight } from 'lucide-react';

const AuthPage: React.FC = () => {
  const { login, navigateTo, authMode } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logo, setLogo] = useState<string>('');

  useEffect(() => {
    if (authMode === 'login') {
      setIsLogin(true);
    }
    db.settings.get().then(settings => {
      if (settings?.logo) setLogo(settings.logo);
    });
  }, [authMode]);

  // Utility to handle Supabase's 6-character minimum requirement transparently
  const getAuthPassword = (raw: string) => {
    if (!raw) return '';
    // If password is too short, we append a consistent internal suffix
    // This allows students with short surnames to use them as passwords
    return raw.length < 6 ? `${raw.toLowerCase().trim()}_ppis` : raw;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const input = formData.email.trim();
    const normalizedUsername = input.toLowerCase().replace(/\//g, '_');
    const emailToUse = !input.includes('@') ? `${normalizedUsername}@ppisms.edu` : input;
    
    // The password we send to Supabase Auth
    const securePassword = getAuthPassword(formData.password);

    try {
      if (isLogin) {
        const { success, error: authError } = await login(emailToUse, securePassword);
        if (success) return;

        // If direct login fails, check if this is a first-time activation from registry
        const { data: registryProfile } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${input.toLowerCase()},username.ilike.${normalizedUsername}`)
          .maybeSingle();

        if (registryProfile) {
          // Check against the plaintext password stored in registry
          if (registryProfile.password === formData.password.toLowerCase().trim()) {
            // Found in registry, but not in Auth yet. Start activation.
            const tempUniqueId = `__sync_${normalizedUsername}_${crypto.randomUUID().split('-')[0]}`;
            await supabase.from('profiles').update({ username: tempUniqueId }).eq('id', registryProfile.id);

            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: emailToUse,
              password: securePassword,
              options: { 
                data: { fullName: registryProfile.full_name, role: registryProfile.role } 
              }
            });

            if (signUpError) {
              await supabase.from('profiles').update({ username: registryProfile.username }).eq('id', registryProfile.id);
              setError(signUpError.message);
              return;
            }

            if (signUpData.user) {
              await login(emailToUse, securePassword);
              return;
            }
          } else {
            setError('Registry Mismatch: Incorrect Password.');
          }
        } else {
          setError('Registry ID not located.');
        }
      } else {
        // Manual Sign Up path
        const { data: registryCheck } = await supabase
          .from('profiles')
          .select('*')
          .or(`username.ilike.${input.toLowerCase()},username.ilike.${normalizedUsername}`)
          .maybeSingle();

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: emailToUse,
          password: securePassword,
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
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-4 font-sans selection:bg-school-royal selection:text-white">
      <div className="absolute top-6 left-6">
        <button 
          onClick={() => navigateTo('landing')}
          className="flex items-center gap-2 text-slate-400 hover:text-school-royal transition-colors text-xs font-bold uppercase tracking-widest"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="w-full max-w-[480px]">
        <div className="bg-white rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 p-8 md:p-12">
          <div className="flex flex-col items-center text-center space-y-4 mb-8">
            <div className="w-24 h-24 rounded-full bg-white border-4 border-school-gold flex items-center justify-center shadow-lg overflow-hidden">
              {logo ? (
                <img src={logo} alt="School Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="w-full h-full bg-school-royal flex items-center justify-center">
                  <Crown size={48} className="text-school-gold fill-school-gold" />
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-school-royal font-serif">Prince & Princess</h1>
              <p className="text-slate-500 text-sm font-medium">Secondary School, Wukari</p>
              <p className="text-school-gold text-xs font-black uppercase tracking-widest">Excellence in Education</p>
            </div>

            <div className="pt-2">
              <h2 className="text-3xl font-bold text-[#001D4D] font-serif">{isLogin ? 'School Portal' : 'Portal Activation'}</h2>
              <p className="text-slate-400 text-sm mt-1">{isLogin ? 'Sign in with Registry ID' : 'Verify your registry ID to begin'}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 ml-1">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:ring-2 focus:ring-school-royal/10 focus:border-school-royal outline-none transition-all placeholder:text-slate-300"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 ml-1">{isLogin ? 'Registry ID / Email' : 'Registry / Admission ID'}</label>
              <input
                required
                type="text"
                placeholder={isLogin ? "PPIS/2026/XXX or Email" : "PPIS/2026/XXX"}
                className="w-full px-4 py-3.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:ring-2 focus:ring-school-royal/10 focus:border-school-royal outline-none transition-all placeholder:text-slate-300"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-bold text-slate-700">Password / Surname</label>
              </div>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3.5 rounded-lg bg-white border border-slate-200 text-slate-900 focus:ring-2 focus:ring-school-royal/10 focus:border-school-royal outline-none transition-all placeholder:text-slate-300"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-xs font-bold">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button 
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-school-royal text-white rounded-lg font-bold text-sm hover:bg-[#001D4D] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 shadow-md"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  <span>{isLogin ? 'Sign In' : 'Activate Account'}</span>
                  <MoveRight size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              Students should use their <strong>Surname</strong> as the default password.<br />
              Contact the school office if you need help.
            </p>
            
            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-center gap-4">
              <button 
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-xs font-bold text-school-royal hover:underline"
              >
                {isLogin ? "Need to activate your registry ID?" : "Already have an account?"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-slate-300 text-[10px] font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} Prince & Princess International School • PPISMS v2.0
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
