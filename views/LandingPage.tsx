import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { supabase } from '../lib/supabase';
import { UserRole } from '../types';
import { LogIn, UserPlus, AlertCircle, ChevronRight, GraduationCap, Users, BookOpen, Target, Heart, ShieldCheck, MapPin, Calendar, Clock, Sparkles, LayoutGrid, FileSpreadsheet, ArrowDown } from 'lucide-react';

const LandingPage: React.FC = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', fullName: '' });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToPortal = () => {
    document.getElementById('portal-section')?.scrollIntoView({ behavior: 'smooth' });
  };

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
              setError(signUpError.message);
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
    <div className="min-h-screen bg-white selection:bg-[#002366] selection:text-white">
      {/* Navigation Header */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${scrolled ? 'bg-white/95 backdrop-blur-2xl border-b border-slate-100 py-3 shadow-md' : 'bg-transparent py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl transition-all duration-500 transform group-hover:rotate-6 ${scrolled ? 'bg-[#002366] text-white shadow-xl shadow-[#002366]/20' : 'bg-white text-[#002366] shadow-2xl shadow-black/20'}`}>P</div>
            <div className={`transition-all duration-500 ${scrolled ? 'text-slate-900' : 'text-white'}`}>
              <h1 className="text-lg font-black uppercase tracking-tighter leading-none">PPISMS</h1>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-50 mt-1">Portal Executive</p>
            </div>
          </div>
          <button 
            onClick={scrollToPortal}
            className={`px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all duration-500 transform hover:scale-105 active:scale-95 ${scrolled ? 'bg-[#002366] text-white hover:bg-black shadow-lg shadow-[#002366]/20' : 'bg-white text-[#002366] shadow-2xl hover:bg-[#FFD700]'}`}
          >
            Access Portal
          </button>
        </div>
      </nav>

      {/* Hero Section with Transparent Student Overlay */}
      <section className="relative h-screen flex items-center overflow-hidden bg-[#002366]">
        {/* Advanced Background Layers */}
        <div className="absolute inset-0 z-0">
          {/* Base Brand Depth */}
          <div className="absolute inset-0 bg-[#002366]" />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#00123a] via-[#002366] to-[#00318f]" />
          
          {/* Refined Transparent Student Image Overlay */}
          <div className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none overflow-hidden select-none">
            <img 
              src="https://images.unsplash.com/photo-1544717297-fa95b3ee51f3?auto=format&fit=crop&q=80&w=1470" 
              alt="Transparent Student Background" 
              className="w-full h-full object-cover object-center scale-110 blur-[1px] grayscale contrast-125"
            />
          </div>

          {/* Glowing Accents */}
          <div className="absolute top-1/4 -right-20 w-[600px] h-[600px] bg-blue-500/10 blur-[160px] rounded-full" />
          <div className="absolute bottom-1/4 -left-20 w-[400px] h-[400px] bg-[#FFD700]/5 blur-[120px] rounded-full" />

          {/* Vignette Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#002366] via-transparent to-transparent opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#00123a]/60 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-4xl space-y-12 animate-in fade-in slide-in-from-bottom-16 duration-1000 fill-mode-both">
            <div className="space-y-6">
              <h2 className="text-7xl md:text-[9rem] font-black text-white leading-[0.85] tracking-tighter">
                Prince & Princess <br />
                <span className="text-[#FFD700] drop-shadow-[0_20px_40px_rgba(255,215,0,0.2)]">International School</span>
              </h2>
              <div className="flex items-center gap-4 text-white/50 font-black uppercase tracking-[0.4em] text-[11px] ml-2">
                <div className="w-12 h-[2px] bg-[#FFD700]/30" />
                <MapPin size={16} className="text-[#FFD700]" />
                <span>Wukari, Taraba State, Nigeria</span>
              </div>
            </div>

            <p className="text-xl md:text-3xl text-white/70 font-light leading-relaxed max-w-2xl">
              Nurturing tomorrow's visionaries through an elite curriculum, moral excellence, and a global outlook.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 pt-10">
              <button 
                onClick={scrollToPortal}
                className="group px-14 py-6 bg-white text-[#002366] rounded-[2rem] font-black uppercase tracking-[0.2em] text-[12px] hover:bg-[#FFD700] hover:scale-105 transition-all duration-500 shadow-[0_25px_50px_-12px_rgba(255,255,255,0.15)] flex items-center justify-center gap-4"
              >
                Enter Student Portal <ChevronRight size={20} className="transition-transform duration-500 group-hover:translate-x-2" />
              </button>
              <button className="px-14 py-6 bg-white/5 backdrop-blur-2xl border border-white/10 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[12px] hover:bg-white/10 transition-all duration-500">
                School Registry
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
           <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30 mb-2">Explore</p>
           <div className="w-[1px] h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-28 bg-[#002366] border-y border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-16 text-center">
            {[
              { label: 'Students', val: '500+', desc: 'Enrolled Learners' },
              { label: 'Faculty', val: '40+', desc: 'Master Educators' },
              { label: 'Classes', val: '12', desc: 'Digital Labs' },
              { label: 'Courses', val: '23', desc: 'Active Subjects' }
            ].map((stat, i) => (
              <div key={i} className="space-y-4 group">
                <p className="text-5xl md:text-7xl font-black text-white tracking-tighter group-hover:text-[#FFD700] transition-colors duration-500">{stat.val}</p>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[11px] font-black text-[#FFD700] uppercase tracking-[0.3em]">{stat.label}</p>
                  <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{stat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-32 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-end justify-between mb-28 gap-12">
            <div className="max-w-2xl space-y-8">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-slate-100 text-[#002366] rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200">
                <Sparkles size={14} className="text-[#FFD700]" />
                Institutional Philosophy
              </div>
              <h3 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.85]">Inspiring Minds. Building Character.</h3>
            </div>
            <p className="text-slate-500 font-medium text-xl max-w-sm leading-relaxed border-l-4 border-[#FFD700] pl-8">
              We bridge the gap between academic theory and real-world leadership through innovative pedagogy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: Target, title: 'Vision', desc: 'To be the hallmark of excellence in Taraba State, fostering students who redefine societal norms through integrity.' },
              { icon: Heart, title: 'Mission', desc: 'Creating a high-performance ecosystem where moral fiber and cognitive power are developed in unison.' },
              { icon: ShieldCheck, title: 'Values', desc: 'The PPIS code: Excellence, Integrity, and Service. These aren\'t just words; they are our operational pillars.' }
            ].map((val, i) => (
              <div key={i} className="group p-14 rounded-[4rem] bg-slate-50 border border-slate-100 hover:bg-[#002366] hover:scale-[1.03] transition-all duration-700 shadow-sm hover:shadow-[0_40px_80px_-20px_rgba(0,35,102,0.3)]">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-lg flex items-center justify-center text-[#002366] mb-12 group-hover:scale-110 group-hover:bg-[#FFD700] transition-all duration-500">
                  <val.icon size={40} />
                </div>
                <h4 className="text-3xl font-black text-slate-900 group-hover:text-white uppercase tracking-tighter mb-6">{val.title}</h4>
                <p className="text-slate-500 group-hover:text-white/70 font-medium text-lg leading-relaxed">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Section */}
      <section id="portal-section" className="py-40 bg-[#00123a] relative overflow-hidden">
        {/* Cinematic Decor */}
        <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-blue-600/10 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-[#FFD700]/5 blur-[150px] rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-32 items-center">
            <div className="space-y-16">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 px-6 py-2 bg-white/5 text-[#FFD700] rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-white/10">
                  Cloud Ecosystem
                </div>
                <h3 className="text-7xl md:text-[7rem] font-black text-white tracking-tighter leading-[0.8]">The PPISMS Gateway</h3>
                <p className="text-blue-100/50 text-2xl font-light max-w-lg leading-relaxed">
                  Our unified digital management system connects students, parents, and faculty on a single high-security platform.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-10">
                 {[
                   { icon: ShieldCheck, label: 'Administration', desc: 'Strategic Oversight' },
                   { icon: BookOpen, label: 'Educators', desc: 'Academic Management' },
                   { icon: GraduationCap, label: 'Form Masters', desc: 'Result Compilation' },
                   { icon: Users, label: 'Students', desc: 'Performance Access' }
                 ].map((item, i) => (
                   <div key={i} className="flex items-start gap-6 group">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FFD700] group-hover:bg-[#FFD700] group-hover:text-[#002366] transition-all duration-500 shrink-0">
                         <item.icon size={26} />
                      </div>
                      <div>
                        <h5 className="text-white font-black uppercase text-sm tracking-widest">{item.label}</h5>
                        <p className="text-blue-200/30 text-[11px] mt-1 font-bold uppercase tracking-widest">{item.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            <div className="relative">
              {/* Ultra Modern Glass Login Card */}
              <div className="bg-white/95 backdrop-blur-3xl p-12 md:p-20 rounded-[4rem] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.6)] relative z-10 border-t-[14px] border-[#FFD700]">
                 <div className="text-center mb-16 space-y-4">
                    <p className="text-[10px] font-black text-[#002366]/40 uppercase tracking-[0.5em]">Authorization Terminal</p>
                    <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter leading-none">
                      {isLogin ? 'Log In' : 'Sign Up'}
                    </h2>
                    <div className="w-16 h-1.5 bg-[#FFD700] mx-auto mt-8 rounded-full" />
                 </div>

                 <form onSubmit={handleSubmit} className="space-y-8">
                    {!isLogin && (
                      <div className="space-y-2 group">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-6 group-focus-within:text-[#002366] transition-colors">Full Legal Name</label>
                        <input
                          required
                          type="text"
                          placeholder="e.g. Adebayo Kunle"
                          className="w-full px-10 py-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 text-slate-900 font-black outline-none focus:ring-4 focus:ring-[#002366]/10 focus:border-[#002366] transition-all text-sm"
                          value={formData.fullName}
                          onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="space-y-2 group">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-6 group-focus-within:text-[#002366] transition-colors">Registry ID / Admission</label>
                      <input
                        required
                        type="text"
                        placeholder="PPIS/2026/001"
                        className="w-full px-10 py-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 text-slate-900 font-mono text-xs font-black outline-none focus:ring-4 focus:ring-[#002366]/10 focus:border-[#002366] transition-all"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 group">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-6 group-focus-within:text-[#002366] transition-colors">System Password</label>
                      <input
                        required
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-10 py-6 rounded-[2.5rem] bg-slate-50 border border-slate-100 text-slate-900 font-black outline-none focus:ring-4 focus:ring-[#002366]/10 focus:border-[#002366] transition-all text-sm"
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>

                    {error && (
                      <div className="p-6 rounded-[2.5rem] bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-4 text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
                        <AlertCircle size={22} className="shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button 
                      disabled={loading}
                      type="submit"
                      className="w-full py-7 bg-[#002366] text-white rounded-[2.5rem] font-black uppercase tracking-[0.4em] text-[12px] shadow-[0_25px_50px_-10px_rgba(0,35,102,0.4)] hover:bg-black hover:scale-[1.02] transition-all duration-500 flex items-center justify-center gap-4 active:scale-95 disabled:opacity-50"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          {isLogin ? <LogIn size={22} /> : <UserPlus size={22} />}
                          <span>{isLogin ? 'Initiate Registry Access' : 'Create Identity'}</span>
                        </>
                      )}
                    </button>
                 </form>

                 <div className="mt-16 pt-12 border-t border-slate-100 text-center space-y-6">
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">{isLogin ? "Registry Account Not Active?" : "Credentials Already Setup?"}</p>
                    <button 
                      onClick={() => { setIsLogin(!isLogin); setError(''); }}
                      className="px-14 py-4 rounded-[1.5rem] border-2 border-slate-100 text-[11px] font-black uppercase tracking-[0.3em] text-[#002366] hover:bg-[#002366] hover:text-white hover:border-[#002366] transition-all duration-500"
                    >
                      {isLogin ? "Activation Hub" : "Back to Registry"}
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-16">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-[#002366] text-white rounded-[1.5rem] flex items-center justify-center font-black text-3xl shadow-2xl">P</div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.5em] text-[#002366]">PPIS Academy</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">&copy; {new Date().getFullYear()} Prince & Princess International. All Rights Reserved.</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-12">
            {['Privacy Hub', 'Academic Support', 'Governance', 'Contact Registry'].map((link, i) => (
              <a key={i} href="#" className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-[#002366] transition-all duration-500 hover:translate-y-[-2px]">{link}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;