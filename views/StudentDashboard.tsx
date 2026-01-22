
import React, { useState, useEffect, useMemo } from 'react';
import { db, calculatePositions } from '../db';
import { useAuth } from '../App';
import { Score, Student, Subject, SchoolClass, FormTeacherRemark, User, SchoolSettings } from '../types';
import { getGrade, getOrdinal, getAutoRemark } from '../constants';
import { StatsSkeleton, TableSkeleton } from '../components/Skeleton';
import { 
  Award, Printer, User as UserIcon, TrendingUp, BookOpen, Eye, X, 
  AlertCircle, Clock, ShieldAlert, CheckCircle2, FileText, Fingerprint, Building2, Crown, Sparkles, LayoutDashboard, ShieldCheck 
} from 'lucide-react';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'results'>('overview');
  const [studentInfo, setStudentInfo] = useState<Student | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [formTeacher, setFormTeacher] = useState<User | null>(null);
  const [remark, setRemark] = useState<FormTeacherRemark | null>(null);
  const [classSize, setClassSize] = useState(0);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const s = await db.settings.get();
        setSettings(s);

        const allStudents = await db.students.getAll();
        const normalizedAuthUsername = user.username.toLowerCase().replace(/\//g, '_');
        
        const student = allStudents.find(stu => {
          const isIdMatch = stu.profile_id === user.id || stu.id === user.id;
          const stuAdmNormalized = stu.admission_number.toLowerCase().replace(/\//g, '_');
          const isUsernameMatch = stuAdmNormalized === normalizedAuthUsername;
          return isIdMatch || isUsernameMatch;
        });

        if (student) {
          setStudentInfo(student);
          const allScores = await db.scores.getAll();
          
          const currentScores = allScores.filter(sc => 
            sc.student_id === student.id && 
            sc.term === s.current_term && 
            sc.session === s.current_session
          );
          setScores(currentScores);
          
          const allClasses = await db.classes.getAll();
          const studentCls = allClasses.find(c => c.id === student.class_id);
          if (studentCls) {
            setCls(studentCls);
            const allUsers = await db.users.getAll();
            const teacher = allUsers.find(u => u.id === studentCls.form_teacher_id);
            setFormTeacher(teacher || null);
            
            const classFiltered = allStudents.filter(stu => stu.class_id === studentCls.id);
            setClassSize(classFiltered.length);
            
            const scoresFiltered = allScores.filter(sc => 
              sc.class_id === studentCls.id && 
              sc.term === s.current_term && 
              sc.session === s.current_session
            );
            const ranks = calculatePositions(classFiltered, scoresFiltered, s.current_term, s.current_session);
            setPosition(ranks[student.id] || 0);
          }
          
          const allSubjects = await db.subjects.getAll();
          setSubjects(allSubjects);
          
          const allRemarks = await db.remarks.getAll();
          const r = allRemarks.find(rem => 
            rem.student_id === student.id && 
            rem.term === s.current_term && 
            rem.session === s.current_session
          );
          setRemark(r || null);
        } else {
          setHasError(true);
        }
      } catch (err) {
        console.error("Dashboard Init Error:", err);
        setHasError(true);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user]);

  const handlePrint = () => {
    // Small delay ensures state is consistent before print dialog
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const totalScore = scores.reduce((acc, s) => acc + (s.first_ca + s.second_ca + s.exam), 0);
  const average = scores.length ? totalScore / scores.length : 0;

  if (loading) return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10">
      <div className="flex justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-[2rem]" />
          <div className="space-y-2">
            <div className="w-48 h-6 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md" />
            <div className="w-32 h-3 animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md" />
          </div>
        </div>
      </div>
      <StatsSkeleton />
      <TableSkeleton />
    </div>
  );

  if (hasError || !studentInfo || !settings) return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-center p-10 max-w-md mx-auto">
      <div className="p-8 bg-rose-50 dark:bg-rose-900/20 rounded-[3rem] border border-rose-100 dark:border-rose-800 mb-8">
        <AlertCircle size={64} className="text-rose-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Registry Mismatch</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-4 font-medium leading-relaxed">
        We couldn't locate an active student profile linked to your account ID ({user?.id.split('-')[0]}...).
      </p>
      <div className="mt-8 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl w-full border dark:border-slate-700">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Authenticated Identity</p>
        <p className="font-mono text-xs dark:text-white">{user?.username || 'Guest'}</p>
        <p className="text-[9px] text-slate-400 mt-2">Registry Search Format: {user?.username.toLowerCase().replace(/\//g, '_')}</p>
      </div>
      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-8">Please contact the School Admin Office to verify your admission number</p>
    </div>
  );

  const ModernReportCard = () => (
    <div className="bg-white p-10 md:p-14 font-sans text-black w-full max-w-4xl min-h-[1100px] flex flex-col relative overflow-hidden rounded-[1.5rem] border border-slate-100 print:shadow-none print:border-none print:m-0 print:p-8">
      {/* Central Branding Header */}
      <div className="flex flex-col items-center text-center mb-10 relative z-10 text-black">
          <div className="w-20 h-20 rounded-2xl bg-[#1e1b4b] flex items-center justify-center shadow-xl mb-4">
             {settings.logo ? (
                <img src={settings.logo} alt="Logo" className="w-12 h-12 object-contain" />
             ) : (
                <Building2 className="text-white" size={32} />
             )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-black mb-1 leading-none">{settings.name}</h1>
          <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-[0.4em] pt-1">Official Academic Terminal Record</p>
          <p className="text-[8px] font-bold text-[#1e1b4b] uppercase tracking-widest mt-2">{settings.current_session} Session • Term {settings.current_term}</p>
      </div>

      {/* Student Identification Bar */}
      <div className="grid grid-cols-4 gap-0 mb-8 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative z-10 text-black">
          <div className="p-4 border-r border-slate-200">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</p>
            <p className="text-xs font-semibold text-black uppercase truncate">{studentInfo.first_name} {studentInfo.surname}</p>
          </div>
          <div className="p-4 border-r border-slate-200">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Adm Number</p>
            <p className="text-xs font-semibold text-black uppercase font-mono">{studentInfo.admission_number}</p>
          </div>
          <div className="p-4 border-r border-slate-200">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class Level</p>
            <p className="text-xs font-semibold text-black uppercase">{cls?.name || '---'}</p>
          </div>
          <div className="p-4 text-right">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gender</p>
            <p className="text-xs font-semibold text-black uppercase">{studentInfo.gender}</p>
          </div>
      </div>

      {/* Subject Performance Matrix */}
      <div className="flex-1 relative z-10 mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white text-black">
        <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1e1b4b] text-white">
                <th className="py-3.5 px-6 text-[9px] font-black uppercase tracking-widest">Subject Discipline</th>
                <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16 border-l border-white/5">CA 1</th>
                <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16 border-l border-white/5">CA 2</th>
                <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16 border-l border-white/5">Exam</th>
                <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16 border-l border-white/5 bg-[#312e81]">Total</th>
                <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-widest text-center w-20 border-l border-white/5">Grade</th>
                <th className="py-3.5 px-6 text-[9px] font-black uppercase tracking-widest text-center w-20 border-l border-white/5">Pos.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-black">
              {subjects.filter(sub => sub.category === cls?.level).map((sub, idx) => {
                const s = scores.find(score => score.subject_id === sub.id);
                const total = (s?.first_ca || 0) + (s?.second_ca || 0) + (s?.exam || 0);
                const grade = getGrade(total);
                const pos = idx + 1;
                return (
                  <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6 font-semibold text-[11px] uppercase tracking-tight text-black">{sub.name}</td>
                    <td className="py-3 px-3 text-center text-[10px] font-medium text-slate-600 border-l border-slate-50">{s?.first_ca ?? '0'}</td>
                    <td className="py-3 px-3 text-center text-[10px] font-medium text-slate-600 border-l border-slate-50">{s?.second_ca ?? '0'}</td>
                    <td className="py-3 px-3 text-center text-[10px] font-medium text-slate-600 border-l border-slate-50">{s?.exam ?? '0'}</td>
                    <td className="py-3 px-3 text-center font-bold text-[#1e1b4b] bg-slate-50/30 text-[12px] border-l border-slate-100">{total || '0'}</td>
                    <td className="py-3 px-4 text-center border-l border-slate-100">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[9px] uppercase border ${
                        total >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                        total >= 60 ? 'bg-blue-50 border-blue-200 text-blue-700' : 
                        total >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {grade}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-center text-[9px] font-medium text-slate-400 uppercase italic border-l border-slate-100">
                      {getOrdinal(pos)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
        </table>
      </div>

      {/* Performance Metrics Summary */}
      <div className="grid grid-cols-3 gap-6 mb-8 relative z-10 text-black">
          <div className="bg-[#1e1b4b] p-6 rounded-2xl text-white shadow-lg flex flex-col justify-center">
            <p className="text-[7px] font-bold text-white/40 uppercase tracking-[0.3em] mb-1">Aggregate</p>
            <p className="text-xl font-bold tracking-tighter">{totalScore.toFixed(0)} <span className="text-[10px] opacity-30">/ {subjects.filter(sub => sub.category === cls?.level).length * 100}</span></p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Average Score</p>
            <p className="text-xl font-bold text-[#1e1b4b] tracking-tighter">{average.toFixed(1)}%</p>
          </div>
          <div className="bg-[#eff6ff] p-6 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[7px] font-bold text-blue-500 uppercase tracking-[0.3em] mb-1">Class Position</p>
              <p className="text-xl font-bold text-blue-900 tracking-tighter">{getOrdinal(position)}</p>
            </div>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-500 border border-amber-50 shadow-inner">
              <Crown size={18} fill="currentColor" />
            </div>
          </div>
      </div>

      {/* Institutional Remarks */}
      <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 relative z-10 text-black">
        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.5em] mb-2 flex items-center gap-2">
          <Sparkles size={10} className="text-[#1e1b4b]" /> Faculty Master Remark & Insight
        </p>
        <p className="text-sm font-medium italic text-black leading-relaxed">
          "{remark?.remark || getAutoRemark(average)}"
        </p>
      </div>
      
      {/* Registry Signatures */}
      <div className="mt-auto grid grid-cols-2 gap-16 pt-10 border-t-2 border-dotted border-slate-200 relative z-10 text-black">
          <div className="space-y-3">
            <div className="h-[1px] bg-slate-300 w-full" />
            <p className="text-[8px] font-semibold uppercase tracking-[0.4em] text-slate-500 text-center">Class Teacher Signature</p>
          </div>
          <div className="space-y-3">
            <div className="h-[1px] bg-slate-300 w-full" />
            <p className="text-[8px] font-semibold uppercase tracking-[0.4em] text-slate-500 text-center">Principal's Attestation</p>
          </div>
      </div>

      {/* Portal Metadata */}
      <div className="mt-10 flex justify-between items-center text-slate-300 no-print">
        <p className="text-[6px] font-bold uppercase tracking-[0.6em]">{settings.name} Registry Management System</p>
        <div className="flex items-center gap-2">
          <Fingerprint size={8} />
          <p className="text-[6px] font-bold uppercase tracking-[0.3em]">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="flex items-center gap-6">
           <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-200 dark:shadow-none">
             {studentInfo.first_name[0]}
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Academic Portal</h1>
             <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{studentInfo.first_name} {studentInfo.surname} • {studentInfo.admission_number}</p>
           </div>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border dark:border-slate-700">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <LayoutDashboard size={14} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('results')} 
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'results' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}
          >
            <FileText size={14} /> Results
          </button>
        </div>
      </header>

      {activeTab === 'overview' && (
        <div className="space-y-10 no-print animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
             <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-xl shadow-blue-200 dark:shadow-none">
                <Award className="mb-4 opacity-80" size={28} />
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest">Rank</p>
                <h3 className="text-3xl font-black mt-1">{getOrdinal(position)} <span className="text-xs opacity-60">of {classSize}</span></h3>
             </div>
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                <TrendingUp className="text-emerald-500 mb-4" size={28} />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Average</p>
                <h3 className="text-2xl font-black dark:text-white mt-1">{average.toFixed(1)}%</h3>
             </div>
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                <UserIcon className="text-blue-500 mb-4" size={28} />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Classroom</p>
                <h3 className="text-2xl font-black dark:text-white mt-1 uppercase tracking-tighter">{cls?.name || '---'}</h3>
             </div>
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                <BookOpen className="text-purple-500 mb-4" size={28} />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Disciplines</p>
                <h3 className="text-2xl font-black dark:text-white mt-1">{scores.length}</h3>
             </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-10 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
               <div>
                  <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">Academic Ledger (Real-time)</h2>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">{settings.current_session} Session</p>
               </div>
               <div className="flex items-center gap-3">
                 <button 
                    onClick={handlePrint}
                    className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white shadow-sm transition-all flex items-center gap-2 border border-blue-100"
                  >
                    <Printer size={14} /> Print Report Card
                  </button>
                  <span className="px-6 py-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black rounded-xl uppercase tracking-widest">
                    Term {settings.current_term}
                  </span>
               </div>
            </div>
            
            {scores.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                      <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Subject Discipline</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">CA (40)</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Exam (60)</th>
                      <th className="px-10 py-6 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">Aggregate</th>
                      <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {scores.map(s => {
                      const sub = subjects.find(sub => sub.id === s.subject_id);
                      const total = s.first_ca + s.second_ca + s.exam;
                      const isApproved = s.is_approved_by_form_teacher;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors group">
                          <td className="px-10 py-6">
                             <div className="flex items-center gap-3">
                               <p className="text-sm font-black dark:text-white uppercase tracking-tight">{sub?.name}</p>
                               {isApproved ? (
                                 <CheckCircle2 size={12} className="text-emerald-500" />
                               ) : (
                                 <Clock size={12} className="text-amber-500" />
                               )}
                             </div>
                             <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                               {isApproved ? 'Verified Record' : 'Registry Processing'}
                             </p>
                          </td>
                          <td className="px-10 py-6 text-sm text-center font-bold text-slate-500 dark:text-slate-400">{s.first_ca + s.second_ca}</td>
                          <td className="px-10 py-6 text-sm text-center font-bold text-slate-500 dark:text-slate-400">{s.exam}</td>
                          <td className="px-10 py-6 text-sm text-center font-black text-blue-600">{total}</td>
                          <td className="px-10 py-6 text-center">
                            <span className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase ${total >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {getGrade(total)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-slate-400 space-y-6">
                 <div className="p-10 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                   <ShieldAlert size={64} className="opacity-20 text-amber-500" />
                 </div>
                 <div className="text-center px-6">
                   <p className="font-black uppercase tracking-[0.3em] text-[10px] text-slate-500">Academic Registry Synchronizing</p>
                   <p className="text-[10px] font-bold mt-2 uppercase tracking-widest opacity-40 max-w-sm mx-auto">Results will appear here automatically as soon as subject masters upload them to the system.</p>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-8 no-print animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center">
           <div className="w-full max-w-4xl flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                 <ShieldCheck size={20} />
               </div>
               <div>
                 <p className="text-xs font-black uppercase tracking-tight dark:text-white">Official Transcript Portal</p>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Verified Academic Record</p>
               </div>
             </div>
             <button 
                onClick={handlePrint}
                className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center gap-2"
              >
                <Printer size={16} /> Print Transcript
              </button>
           </div>
           
           <div className="scale-90 md:scale-100 origin-top">
             <ModernReportCard />
           </div>
        </div>
      )}

      {/* Persistent hidden container for high-fidelity printing */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
        <ModernReportCard />
      </div>
    </div>
  );
};

export default StudentDashboard;
