
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { db } from './db';
import { User, UserRole } from './types';
import { supabase } from './lib/supabase';
import LandingPage from './views/LandingPage';
import AuthPage from './views/AuthPage';
import AdminDashboard from './views/AdminDashboard';
import StaffDashboard from './views/StaffDashboard';
import StudentDashboard from './views/StudentDashboard';
import { LogOut, Sun, Moon, Menu, X, User as UserIcon, LayoutDashboard, Users, GraduationCap, School, BookOpen, Settings, Link as LinkIcon, AlertCircle, FileText, TrendingUp } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: any }>;
  logout: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentView: 'landing' | 'auth';
  authMode: 'login' | 'signup';
  navigateTo: (view: 'landing' | 'auth', mode?: 'login' | 'signup') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [adminTab, setAdminTab] = useState('overview');
  const [currentView, setCurrentView] = useState<'landing' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  
  const lastProcessedId = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (lastProcessedId.current !== session.user.id) {
          lastProcessedId.current = session.user.id;
          fetchProfile(session.user.id, session.user.email);
        }
      } else {
        lastProcessedId.current = null;
        setUser(null);
        setLoading(false);
      }
    });

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (id: string, email?: string) => {
    try {
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      
      const emailPrefix = email?.split('@')[0].toLowerCase() || "";
      const normalizedUsernameSlash = emailPrefix.replace(/_/g, '/');
      const normalizedUsernameUnderscore = emailPrefix;

      const { data: legacy } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.${normalizedUsernameSlash},username.ilike.${normalizedUsernameUnderscore}`)
        .neq('id', id)
        .maybeSingle();

      if (legacy) {
        await Promise.allSettled([
          supabase.from('students').update({ profile_id: id }).eq('profile_id', legacy.id),
          supabase.from('students').update({ profile_id: id }).eq('id', legacy.id),
          supabase.from('classes').update({ form_teacher_id: id }).eq('form_teacher_id', legacy.id),
          supabase.from('teacher_subjects').update({ teacher_id: id }).eq('teacher_id', legacy.id)
        ]);

        const { data: reconciled, error: upsertError } = await supabase
          .from('profiles')
          .upsert({ 
            id,
            username: legacy.username,
            full_name: legacy.full_name,
            role: legacy.role, 
            password: null 
          })
          .select()
          .single();

        if (!upsertError && reconciled) {
          profile = reconciled;
          await supabase.from('profiles').delete().eq('id', legacy.id);
        }
      }

      setUser(profile as User || null);
    } catch (err: any) {
      console.error("Registry Sync Failure:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return { success: false, error };
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setCurrentView('landing');
    } catch (err) {
      console.error("Logout error:", err);
      window.location.reload(); 
    }
  };

  const navigateTo = (view: 'landing' | 'auth', mode: 'login' | 'signup' = 'signup') => {
    setCurrentView(view);
    setAuthMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center dark:bg-slate-900 bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading Registry...</p>
    </div>
  );

  if (!user) {
    return (
      <AuthContext.Provider value={{ user, loading, login, logout, isDarkMode, toggleDarkMode, currentView, authMode, navigateTo }}>
        {currentView === 'landing' ? <LandingPage /> : <AuthPage />}
      </AuthContext.Provider>
    );
  }

  const renderDashboard = () => {
    switch (user.role) {
      case UserRole.ADMIN: return <AdminDashboard activeTab={adminTab as any} onTabChange={setAdminTab} />;
      case UserRole.FORM_TEACHER: return <StaffDashboard />;
      case UserRole.STUDENT: return <StudentDashboard />;
      default: return (
        <div className="h-screen flex items-center justify-center dark:bg-slate-900 bg-slate-50 p-10">
          <div className="text-center space-y-4">
             <AlertCircle size={48} className="mx-auto text-rose-500" />
             <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter">Permission Restricted</h3>
             <p className="text-sm text-slate-500">Unrecognized Registry Role: <span className="font-mono">{user.role}</span></p>
             <button onClick={logout} className="px-6 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Logout</button>
          </div>
        </div>
      );
    }
  };

  const NavItem = ({ icon: Icon, label, id }: { icon: any, label: string, id: string }) => (
    <button
      onClick={() => {
        if (user.role === UserRole.ADMIN) setAdminTab(id);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        (user.role === UserRole.ADMIN ? adminTab === id : true)
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none' 
          : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 dark:text-slate-400'
      }`}
    >
      <Icon size={18} />
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isDarkMode, toggleDarkMode, currentView, authMode, navigateTo }}>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">P</div>
            <span className="font-bold text-slate-800 dark:text-white uppercase tracking-tighter">PPISMS</span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <aside className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-40 transition-transform duration-300 flex flex-col no-print`}>
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 hidden md:block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">P</div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 dark:text-white leading-tight uppercase tracking-tighter">PPISMS</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Institutional Hub</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
             <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <UserIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate dark:text-white uppercase tracking-tight">{user.full_name}</p>
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black opacity-60">{user.role.replace('_', ' ')}</p>
                  </div>
                </div>
             </div>

             <nav className="space-y-1">
               <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Portal Access</div>
               {user.role === UserRole.ADMIN && (
                 <>
                   <NavItem icon={LayoutDashboard} label="Overview" id="overview" />
                   <NavItem icon={Users} label="Students" id="students" />
                   <NavItem icon={GraduationCap} label="Staff" id="teachers" />
                   <NavItem icon={School} label="Classes" id="classes" />
                   <NavItem icon={BookOpen} label="Subjects" id="subjects" />
                   <NavItem icon={FileText} label="Results" id="results" />
                   <NavItem icon={TrendingUp} label="Promotion" id="promotion" />
                   <NavItem icon={LinkIcon} label="Mapping" id="assignments" />
                   <NavItem icon={Settings} label="Settings" id="settings" />
                 </>
               )}
               {user.role !== UserRole.ADMIN && (
                 <NavItem icon={LayoutDashboard} label="Dashboard" id="portal" />
               )}
             </nav>
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
            <button 
              onClick={toggleDarkMode}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              <span className="text-xs font-bold uppercase tracking-widest">{isDarkMode ? 'Light' : 'Dark'} Mode</span>
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            >
              <LogOut size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Logout Portal</span>
            </button>
          </div>
        </aside>

        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30" onClick={() => setIsSidebarOpen(false)} />
        )}

        <main className="flex-1 min-w-0 h-screen overflow-y-auto relative">
          {renderDashboard()}
        </main>
      </div>
    </AuthContext.Provider>
  );
};

export default App;
