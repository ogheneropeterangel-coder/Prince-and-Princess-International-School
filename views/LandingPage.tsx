import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { 
  ChevronRight, Target, ShieldCheck, MapPin, Sparkles, 
  BookOpen, Award, Compass, Mail, Phone, Menu, X, CheckCircle2,
  GraduationCap, Users, Clock, Library, School, Building, Lightbulb, Briefcase, Star
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const { navigateTo } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'About Us', href: '#about' },
    { name: 'Academics', href: '#academics' },
    { name: 'Vision & Mission', href: '#vision' },
    { name: 'Why Choose Us', href: '#why-us' },
    { name: 'Contact', href: '#contact' }
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white selection:bg-school-royal selection:text-white font-sans text-slate-900 scroll-smooth">
      {/* Navigation Header */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${scrolled ? 'bg-white/95 backdrop-blur-xl border-b border-slate-200 py-3 shadow-lg' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-black text-xl transition-all duration-500 shadow-xl ${scrolled ? 'bg-school-royal text-white' : 'bg-white text-school-royal'}`}>P</div>
            <div className={`${scrolled ? 'text-slate-900' : 'text-white'}`}>
              <h1 className="text-sm md:text-lg font-black uppercase tracking-tighter leading-none">Prince & Princess</h1>
              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] opacity-80">International School</p>
            </div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                onClick={(e) => handleNavClick(e, link.href)}
                className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:text-school-gold ${scrolled ? 'text-slate-600' : 'text-white/90'}`}
              >
                {link.name}
              </a>
            ))}
            <button 
              onClick={() => navigateTo('auth', 'signup')}
              className={`px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-widest transition-all duration-500 hover:scale-105 active:scale-95 flex items-center gap-2 ${scrolled ? 'bg-school-royal text-white hover:bg-black shadow-lg shadow-school-royal/20' : 'bg-white text-school-royal shadow-2xl hover:bg-school-gold hover:text-school-royal'}`}
            >
              <Users size={14} /> Access Portal
            </button>
          </div>

          {/* Mobile Toggle */}
          <button className="lg:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className={scrolled ? 'text-slate-900' : 'text-white'} /> : <Menu className={scrolled ? 'text-slate-900' : 'text-white'} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 p-6 space-y-6 shadow-2xl animate-in slide-in-from-top-4 duration-300">
            {navLinks.map((link) => (
              <a key={link.name} href={link.href} onClick={(e) => handleNavClick(e, link.href)} className="block text-sm font-black uppercase tracking-widest text-slate-600 hover:text-school-royal">
                {link.name}
              </a>
            ))}
            <button onClick={() => navigateTo('auth', 'signup')} className="w-full py-4 bg-school-royal text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <Users size={18} /> Access Portal
            </button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden bg-school-royal">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1544717297-fa95b3ee51f3?auto=format&fit=crop&q=80&w=1600" 
            alt="Real Nigerian Students in classroom" 
            className="w-full h-full object-cover opacity-30 mix-blend-overlay scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-school-royal via-school-royal/60 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full pt-20">
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white/90 text-[10px] font-black uppercase tracking-[0.3em]">
                <Sparkles size={14} className="text-school-gold" />
                Wukari's Center of Excellence
              </div>
              <h2 className="text-5xl md:text-8xl font-black text-white leading-[0.9] tracking-tighter">
                Nurturing Leaders of <br />
                <span className="text-school-gold italic">Tomorrow</span>
              </h2>
              <p className="text-lg md:text-2xl text-white/80 font-medium max-w-3xl leading-relaxed">
                Welcome to Prince and Princess International School, Wukari. A center dedicated to academic success, moral uprightness, and lifelong achievement. Every child is a leader in the making.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => navigateTo('auth', 'signup')}
                className="group px-10 py-5 bg-white text-school-royal rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-school-gold hover:scale-105 transition-all duration-500 shadow-2xl flex items-center justify-center gap-3"
              >
                Join Our Academy <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button 
                onClick={() => {
                  const el = document.querySelector('#about');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="px-10 py-5 bg-white/5 backdrop-blur-xl border border-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all duration-500"
              >
                Explore More
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 pt-10 border-t border-white/10 max-w-2xl">
              {[
                { label: 'Academic Levels', val: 'JSS 1 – SSS 3' },
                { label: 'Location', val: 'Wukari, Taraba State' },
                { label: 'Philosophy', val: 'Character & Skill' }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-school-gold text-[9px] font-black uppercase tracking-[0.2em]">{item.label}</p>
                  <p className="text-white font-bold text-sm tracking-tight">{item.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Motto Bar */}
      <div className="bg-school-gold py-10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            <h3 className="text-school-royal font-black text-xl uppercase tracking-tighter opacity-60">School Motto:</h3>
            <p className="text-school-royal font-black text-3xl md:text-5xl italic tracking-tighter leading-none">Character, Skill and Career</p>
          </div>
          <div className="h-12 w-[1px] bg-school-royal/20 hidden md:block" />
          <p className="text-school-royal font-black uppercase tracking-[0.3em] text-[10px] bg-white/30 px-6 py-2 rounded-full border border-school-royal/10">
            Nigeria Educational Excellence
          </p>
        </div>
      </div>

      {/* About Us Section */}
      <section id="about" className="py-24 md:py-32 bg-slate-50 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Animated Side Bar Section */}
            <div className="relative group min-h-[400px] md:min-h-[550px] flex items-center justify-center">
              <div className="absolute -top-10 -left-10 w-64 h-64 bg-school-gold/20 rounded-full blur-[100px]" />
              
              {/* Replacement for large image with animations and text */}
              <div className="relative z-10 w-full h-full min-h-[400px] md:min-h-[500px] rounded-[3.5rem] bg-gradient-to-br from-school-royal to-[#001D4D] shadow-2xl border-[12px] border-white overflow-hidden flex flex-col items-center justify-center p-12 text-center transition-all duration-700 group-hover:scale-[1.01] group-hover:shadow-school-royal/20">
                <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                   <div className="absolute top-10 left-10 animate-pulse duration-[3000ms]"><BookOpen size={48} className="text-white" /></div>
                   <div className="absolute bottom-20 right-10 animate-bounce duration-[4000ms]"><GraduationCap size={64} className="text-white" /></div>
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"><School size={300} className="text-white" /></div>
                   <div className="absolute top-20 right-20 animate-pulse duration-[2500ms]"><Star size={32} className="text-school-gold" /></div>
                </div>
                
                <div className="relative z-20 space-y-8">
                  <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl mx-auto flex items-center justify-center border border-white/20 animate-pulse">
                    <Sparkles className="text-school-gold" size={40} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">
                      Academic <br />
                      <span className="text-school-gold italic">Excellence</span>
                    </h3>
                    <div className="h-1.5 w-24 bg-school-gold mx-auto rounded-full" />
                    <p className="text-white/60 text-[10px] md:text-xs font-black uppercase tracking-[0.4em] leading-relaxed">
                      Knowledge • Integrity • Success
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Maintained Co-Ed Badge */}
              <div className="absolute -bottom-8 -right-8 bg-school-royal p-8 rounded-[2.5rem] shadow-2xl z-20 text-white max-w-[210px] border-4 border-white animate-in zoom-in-50 duration-700 delay-300">
                <p className="text-4xl font-black text-school-gold leading-none">Co-Ed</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mt-3">Established for holistic secondary development</p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-school-royal/5 rounded-full text-school-royal text-[10px] font-black uppercase tracking-widest">
                  <Library size={14} /> Who We Are
                </div>
                <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-[0.85] text-slate-900">
                  Established for Quality <br />
                  <span className="text-school-royal">Education</span>
                </h2>
                <div className="space-y-6 text-lg text-slate-600 leading-relaxed font-medium">
                  <p>
                    Prince and Princess International School, Wukari is a co-educational secondary school established to provide quality education rooted in sound moral values and academic excellence.
                  </p>
                  <p>
                    We offer both Junior Secondary School (JSS 1–3) and Senior Secondary School (SSS 1–3) programs in line with the Nigerian educational curriculum. Our goal is to raise students who are intellectually sound, morally disciplined, socially responsible, and career-focused.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  "Qualified & Experienced Teachers",
                  "Strong Discipline & Moral Training",
                  "Conducive Learning Environment",
                  "Student-centered Approach",
                  "Academic & Personal Growth"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group transition-all hover:bg-school-royal hover:text-white">
                    <CheckCircle2 className="text-school-gold shrink-0" size={20} />
                    <span className="text-xs font-black uppercase tracking-tight">{item}</span>
                  </div>
                ))}
              </div>
              
              <p className="text-sm text-slate-500 italic border-l-4 border-school-gold pl-6 py-2">
                "We work closely with parents and guardians to ensure that every child reaches their full potential."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission & Motto Details */}
      <section id="vision" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-10">
            {/* Vision */}
            <div className="p-12 bg-school-royal rounded-[4rem] text-white space-y-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-110">
                <Target size={120} />
              </div>
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-school-gold shadow-xl">
                <Target size={32} />
              </div>
              <div className="space-y-4 relative z-10">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Our Vision</h3>
                <p className="text-lg text-white/80 leading-relaxed font-medium">
                  To be a leading secondary school in Taraba State, recognized for academic excellence, strong moral values, and the production of confident, skilled, and responsible future leaders.
                </p>
              </div>
            </div>

            {/* Mission */}
            <div className="p-12 bg-slate-50 border border-slate-100 rounded-[4rem] space-y-8 shadow-sm group">
              <div className="w-16 h-16 bg-school-royal rounded-2xl flex items-center justify-center text-school-gold shadow-xl">
                <Compass size={32} />
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Our Mission</h3>
                <ul className="space-y-4">
                  {[
                    "Provide high-quality education meeting global standards",
                    "Instill discipline and integrity in every student",
                    "Equip students with practical critical thinking skills",
                    "Prepare learners for future higher education",
                    "Encourage creativity and leadership confidence"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-600 font-bold text-sm uppercase tracking-tight">
                      <div className="mt-1 w-2 h-2 rounded-full bg-school-gold shrink-0 shadow-sm" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Motto Detail */}
            <div className="p-12 bg-school-gold rounded-[4rem] space-y-8 shadow-xl group">
              <div className="w-16 h-16 bg-school-royal rounded-2xl flex items-center justify-center text-white shadow-xl">
                <Award size={32} />
              </div>
              <div className="space-y-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter text-school-royal">Our Motto</h3>
                <div className="space-y-6">
                  {[
                    { label: 'Character', icon: ShieldCheck, desc: 'Building morally upright, disciplined, and responsible students' },
                    { label: 'Skill', icon: Lightbulb, desc: 'Developing academic, practical, and life skills' },
                    { label: 'Career', icon: Briefcase, desc: 'Preparing students for professions and leadership roles' }
                  ].map((m, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-2 text-school-royal font-black uppercase tracking-widest text-xs">
                        <m.icon size={16} /> {m.label}
                      </div>
                      <p className="text-sm text-school-royal/80 font-semibold leading-snug">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Academic Programmes */}
      <section id="academics" className="py-32 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full text-school-gold text-[10px] font-black uppercase tracking-widest border border-white/10">
              <BookOpen size={14} /> Academic Excellence
            </div>
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">Curriculum Focus</h2>
            <p className="text-white/60 font-medium text-lg leading-relaxed">
              We offer a robust academic program designed to meet national and global standards, preparing students for excellence in WAEC, NECO, and beyond.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Junior Section */}
            <div className="bg-white/5 border border-white/10 p-12 rounded-[4rem] space-y-12 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute -top-20 -right-20 p-8 opacity-5 transition-transform group-hover:scale-125">
                <Library size={300} />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-school-gold">Junior Secondary</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Levels: JSS 1 – JSS 3</p>
                </div>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Library className="text-white" size={32} />
                </div>
              </div>
              <p className="text-white/70 font-medium relative z-10 leading-relaxed">Our junior secondary program lays a strong foundation for future academic rigor through specialized core subjects.</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 relative z-10">
                {[
                  "English Language", "Mathematics", "Basic Science", 
                  "Social Studies", "Business Studies", "Computer Studies",
                  "Civic Education", "Religious Studies", "Cultural & Creative Arts"
                ].map((s) => (
                  <div key={s} className="flex items-center gap-3 text-xs font-black text-white/60 uppercase tracking-tight">
                    <div className="w-2 h-2 rounded-full bg-school-gold shadow-sm" />
                    {s}
                  </div>
                ))}
              </div>
            </div>

            {/* Senior Section */}
            <div className="bg-white/5 border border-white/10 p-12 rounded-[4rem] space-y-12 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute -top-20 -right-20 p-8 opacity-5 transition-transform group-hover:scale-125">
                <GraduationCap size={300} />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter text-school-gold">Senior Secondary</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Levels: SSS 1 – SSS 3</p>
                </div>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                  <GraduationCap className="text-white" size={32} />
                </div>
              </div>
              <p className="text-white/70 font-medium relative z-10 leading-relaxed">Preparing students for WAEC, NECO, and future professional careers with a focus on core science and humanities disciplines.</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 relative z-10">
                {[
                  "English Language", "Mathematics", "Biology", 
                  "Chemistry", "Physics", "Economics",
                  "Government", "Literature in English", "Computer Studies"
                ].map((s) => (
                  <div key={s} className="flex items-center gap-3 text-xs font-black text-white/60 uppercase tracking-tight">
                    <div className="w-2 h-2 rounded-full bg-school-gold shadow-sm" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="why-us" className="py-32 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row gap-20 items-center">
            <div className="lg:w-1/2 space-y-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-school-royal/5 rounded-full text-school-royal text-[10px] font-black uppercase tracking-widest">
                  <Award size={14} /> Our Unique Strengths
                </div>
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none text-slate-900">Why Every Leader Starts Here</h2>
                <p className="text-slate-600 font-medium text-xl leading-relaxed">
                  We believe every child is a leader in the making. Our environment is engineered to bring out the absolute best in every learner.
                </p>
              </div>

              <div className="space-y-6">
                {[
                  { title: "Excellent Academic Performance", icon: Award, color: 'text-school-gold' },
                  { title: "Strong Moral & Character Training", icon: ShieldCheck, color: 'text-emerald-500' },
                  { title: "Qualified & Caring Teachers", icon: Users, color: 'text-blue-500' },
                  { title: "Safe & Disciplined School Environment", icon: Clock, color: 'text-purple-500' },
                  { title: "Focus on Academics & Personal Growth", icon: Lightbulb, color: 'text-amber-500' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-2xl hover:scale-[1.02] group">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0 group-hover:bg-school-royal group-hover:text-white transition-all">
                      <item.icon size={28} className={item.color} />
                    </div>
                    <span className="text-lg font-black uppercase tracking-tight text-slate-800">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="lg:w-1/2 relative">
               <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-6 pt-12">
                     <img src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800" className="rounded-[3rem] shadow-2xl border-4 border-slate-100" alt="Nigerian Student portrait" />
                     <div className="bg-school-gold p-8 rounded-[3rem] text-school-royal shadow-xl">
                        <Users size={40} className="mb-4" />
                        <h4 className="text-2xl font-black tracking-tighter">Supportive Community</h4>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-70 mt-2">Nurturing potential together</p>
                     </div>
                  </div>
                  <div className="space-y-6">
                     <div className="bg-school-royal p-8 rounded-[3rem] text-white shadow-xl">
                        <CheckCircle2 size={40} className="mb-4 text-school-gold" />
                        <h4 className="text-2xl font-black tracking-tighter">Academic Success</h4>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-50 mt-2">Excellence in every step</p>
                     </div>
                     <img src="https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&q=80&w=800" className="rounded-[3rem] shadow-2xl border-4 border-slate-100" alt="Nigerian Student Reading" />
                  </div>
               </div>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-school-gold rounded-full opacity-20 blur-[80px]" />
            </div>
          </div>
        </div>
      </section>

      {/* Access Portal CTA */}
      <section className="py-24 bg-school-royal relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=1200" 
            alt="Collaborative Learning" 
            className="w-full h-full object-cover opacity-10"
          />
        </div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-10">
           <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">Ready to Begin Your <br /> Academic <span className="text-school-gold italic">Journey?</span></h2>
           <p className="text-xl text-white/70 font-medium">Access your results, manage enrollments, and connect with the school registry through our modern management portal.</p>
           <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => navigateTo('auth', 'signup')}
                className="w-full sm:w-auto px-12 py-5 bg-white text-school-royal rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-school-gold hover:scale-105 transition-all duration-500 shadow-2xl flex items-center justify-center gap-3"
              >
                Access Student Portal <ChevronRight size={18} />
              </button>
              <button 
                onClick={() => navigateTo('auth', 'login')}
                className="w-full sm:w-auto px-12 py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white/20 transition-all duration-500"
              >
                Staff Registry Login
              </button>
           </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
          <div className="grid md:grid-cols-4 gap-16">
            <div className="md:col-span-2 space-y-10">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-school-royal text-white rounded-2xl flex items-center justify-center font-black text-3xl shadow-xl">P</div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-1">Prince & Princess</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">International School</p>
                </div>
              </div>
              <p className="text-slate-500 font-bold text-lg leading-relaxed max-w-md">
                Dedicated to academic success, moral uprightness, and lifelong achievement. Empowering the next generation of Nigerian leaders since inception.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => alert("Connecting to Registry Hotline...")}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-school-royal hover:bg-school-royal hover:text-white transition-all shadow-sm hover:shadow-xl"
                >
                  <Phone size={20} />
                </button>
                <button 
                  onClick={() => window.location.href = 'mailto:info@ppisms.edu'}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-school-royal hover:bg-school-royal hover:text-white transition-all shadow-sm hover:shadow-xl"
                >
                  <Mail size={20} />
                </button>
                <button 
                  onClick={() => window.open('https://maps.google.com/?q=Wukari,Taraba,Nigeria', '_blank')}
                  className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-school-royal hover:bg-school-royal hover:text-white transition-all shadow-sm hover:shadow-xl"
                >
                  <MapPin size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 border-b-2 border-school-gold pb-2 w-fit">Navigation</h4>
              <ul className="space-y-4">
                {navLinks.slice(1).map((link) => (
                  <li key={link.name}>
                    <a href={link.href} onClick={(e) => handleNavClick(e, link.href)} className="text-sm font-bold text-slate-500 hover:text-school-royal transition-colors uppercase tracking-widest">{link.name}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-8">
              <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-900 border-b-2 border-school-gold pb-2 w-fit">Location & Visit</h4>
              <div className="space-y-6">
                <div className="flex gap-4 items-start text-slate-600">
                  <MapPin className="text-school-gold shrink-0 mt-1" size={24} />
                  <p className="text-sm font-bold leading-relaxed uppercase tracking-tight">
                    Prince & Princess International <br />
                    Wukari, Taraba State, <br />
                    Nigeria.
                  </p>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Enquiries & Admissions</p>
                   <p className="text-xs font-bold text-slate-700 leading-relaxed italic">
                     For admissions and enquiries, please visit the school premises or contact the school management.
                   </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-24 pt-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              &copy; {new Date().getFullYear()} Prince and Princess International School. Built for Educational Integrity.
            </p>
            <div className="flex items-center gap-8 text-[9px] font-black uppercase tracking-[0.4em] text-slate-300">
              <span className="hover:text-school-royal transition-colors cursor-default">Knowledge</span>
              <span className="hover:text-school-royal transition-colors cursor-default">Moral</span>
              <span className="hover:text-school-royal transition-colors cursor-default">Skill</span>
              <span className="hover:text-school-royal transition-colors cursor-default">Career</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;