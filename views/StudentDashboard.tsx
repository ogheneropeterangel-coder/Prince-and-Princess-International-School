import React, { useState, useEffect, useMemo } from 'react';
import { db, calculatePositions } from '../db';
import { useAuth } from '../App';
import { Score, Student, Subject, SchoolClass, FormTeacherRemark, User, SchoolSettings } from '../types';
import { getGrade, getOrdinal, getAutoRemark } from '../constants';
import { StatsSkeleton, TableSkeleton } from '../components/Skeleton';
import { Award, Printer, User as UserIcon, TrendingUp, BookOpen, Eye, X, AlertCircle, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [studentInfo, setStudentInfo] = useState<Student | null>(null);
  const [scores, setScores] = useState<Score[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [formTeacher, setFormTeacher] = useState<User | null>(null);
  const [remark, setRemark] = useState<FormTeacherRemark | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [classSize, setClassSize] = useState(0);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const brandColor = settings?.primary_color || "#002366";

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const s = await db.settings.get();
        setSettings(s);

        const allStudents = await db.students.getAll();
        
        // Improved lookup: handling both underscores and slashes
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

  const totalScore = scores.reduce((acc, s) => acc + (s.first_ca + s.second_ca + s.exam), 0);
  const average = scores.length ? totalScore / scores.length : 0;
  const allApproved = scores.length > 0 && scores.every(s => s.is_approved_by_form_teacher);

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

  const ReportCardLayout = () => (
    <div className="bg-white p-12 font-serif text-black border shadow-2xl mx-auto max-w-4xl min-h-[1050px] flex flex-col relative overflow-hidden">
        <div className="absolute inset-4 border-4 border-double pointer-events-none" style={{ borderColor: brandColor }}></div>
        <div className="absolute inset-8 border border-slate-200 pointer-events-none"></div>

        <div className="flex flex-col items-center text-center mb-10 pb-8 border-b-4 border-double relative z-10" style={{ borderColor: brandColor }}>
           <img src={settings.logo} alt="School Logo" className="w-40 h-40 object-contain mb-4" />
           <h1 className="text-4xl font-black uppercase tracking-tight" style={{ color: brandColor }}>{settings.name}</h1>
           <p className="text-lg font-bold italic text-slate-600 mt-1">"{settings.motto}"</p>
           <div className="mt-6 border-2 px-10 py-2.5 rounded-full text-sm font-black uppercase tracking-widest shadow-sm" style={{ borderColor: brandColor, color: brandColor }}>
             Academic Progress Transcript
           </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-12 bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-sm relative z-10 text-black">
           <div className="col-span-2">
             <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: brandColor }}>Full Student Name</p>
             <p className="text-xl font-black uppercase tracking-tight">{studentInfo.first_name} {studentInfo.surname}</p>
             <p className="text-xs font-mono text-slate-500 font-bold">{studentInfo.admission_number}</p>
           </div>
           <div>
             <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: brandColor }}>Class</p>
             <p className="text-lg font-black">{cls?.name || 'Unassigned'}</p>
           </div>
           <div className="text-right">
             <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: brandColor }}>Term / Session</p>
             <p className="text-sm font-bold">Term {settings.current_term}</p>
             <p className="text-xs font-black uppercase" style={{ color: brandColor }}>{settings.current_session}</p>
           </div>
        </div>

        <div className="flex-1 relative z-10 text-black">
          <table className="w-full text-left border-collapse border-2 mb-12 shadow-sm" style={{ borderColor: brandColor }}>
             <thead className="bg-slate-50">
                <tr>
                   <th className="p-4 text-xs font-black uppercase tracking-widest border-b" style={{ color: brandColor, borderColor: brandColor }}>Academic Discipline</th>
                   <th className="p-4 text-xs font-black uppercase tracking-widest text-center border-b" style={{ color: brandColor, borderColor: brandColor }}>CA (40)</th>
                   <th className="p-4 text-xs font-black uppercase tracking-widest text-center border-b" style={{ color: brandColor, borderColor: brandColor }}>Exam (60)</th>
                   <th className="p-4 text-xs font-black uppercase tracking-widest text-center border-b" style={{ color: brandColor, borderColor: brandColor }}>Total (100)</th>
                   <th className="p-4 text-xs font-black uppercase tracking-widest text-center border-b" style={{ color: brandColor, borderColor: brandColor }}>Grade</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-200">
                {scores.map(s => {
                   const sub = subjects.find(sub => sub.id === s.subject_id);
                   const total = s.first_ca + s.second_ca + s.exam;
                   const isFail = total < 40;
                   return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 font-black text-sm uppercase tracking-tight">{sub?.name}</td>
                         <td className="p-4 text-center font-bold">{s.first_ca + s.second_ca}</td>
                         <td className="p-4 text-center font-bold">{s.exam}</td>
                         <td className="p-4 text-center font-black" style={{ color: isFail ? '#dc2626' : 'black' }}>{total}</td>
                         <td className="p-4 text-center font-black text-sm">
                           <span className={`px-4 py-1.5 rounded-lg border border-slate-200 ${isFail ? 'text-red-600 border-red-200' : 'text-black'}`}>{getGrade(total)}</span>
                         </td>
                      </tr>
                   );
                })}
             </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-8 mb-12 relative z-10 text-black">
           <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-5 shadow-sm">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-xl" style={{ color: brandColor }}>Σ</div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: brandColor }}>Aggregate</p><p className="text-2xl font-black">{totalScore.toFixed(0)}</p></div>
           </div>
           <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-5 shadow-sm">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-xl" style={{ color: brandColor }}>%</div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: brandColor }}>Average</p><p className="text-2xl font-black">{average.toFixed(1)}%</p></div>
           </div>
           <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-5 shadow-sm">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-xl" style={{ color: brandColor }}>#</div>
              <div><p className="text-[10px] font-black uppercase tracking-widest" style={{ color: brandColor }}>Position</p><p className="text-2xl font-black">{getOrdinal(position)} <span className="text-xs text-slate-400">of {classSize}</span></p></div>
           </div>
        </div>

        <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 mb-12 relative z-10 text-black">
           <div className="absolute top-0 right-12 -translate-y-1/2 bg-white px-6 py-1 rounded-full border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">Institutional Feedback</div>
           <p className="text-sm font-bold italic text-slate-700 leading-relaxed text-center">
             "{remark?.remark || getAutoRemark(average)}"
           </p>
        </div>

        <div className="grid grid-cols-2 gap-20 mt-auto pt-16 relative z-10 text-black">
           <div className="text-center pt-8 border-t border-slate-300">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Form Teacher's Signature</p>
              <p className="text-lg font-bold">{formTeacher?.full_name || 'Verified Master'}</p>
           </div>
           <div className="text-center pt-8 border-t border-slate-300 flex flex-col items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Principal's Attestation</p>
              <p className="text-4xl italic" style={{ fontFamily: "'Brush Script MT', cursive", color: brandColor }}>PPIS</p>
           </div>
        </div>

        <div className="mt-8 text-center relative z-10">
           <p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.4em]">Verified Official Transcript — PPISMS Portal — {new Date().toLocaleDateString()}</p>
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
        <div className="flex gap-3">
          {scores.length > 0 ? (
            <>
              {!allApproved && (
                <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[9px] font-black uppercase tracking-widest animate-pulse">
                  <Clock size={14} /> Live Feed Active
                </div>
              )}
              <button 
                onClick={() => setShowFullReport(true)}
                className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 shadow-xl shadow-blue-100 dark:shadow-none"
              >
                <Eye size={16} />
                Transcript
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 shadow-xl"
              >
                <Printer size={16} />
                Export
              </button>
            </>
          ) : (
             <div className="flex items-center gap-2 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px]">
                <Clock size={16} />
                Awaiting First Entry
             </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print animate-in slide-in-from-top-4 duration-500">
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

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden no-print">
        <div className="p-10 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
           <div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight">Academic Ledger (Real-time)</h2>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">{settings.current_session} Session</p>
           </div>
           <span className="px-6 py-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black rounded-full uppercase tracking-widest">
             Term {settings.current_term}
           </span>
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

      {showFullReport && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[60] flex flex-col p-4 no-print overflow-y-auto items-center">
          <div className="w-full max-w-4xl flex justify-between items-center mb-6">
            <h3 className="text-white font-black uppercase tracking-widest text-[10px]">Registry Transcript Preview</h3>
            <button 
              onClick={() => setShowFullReport(false)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/10"
            >
              <X size={24} />
            </button>
          </div>
          <div className="scale-75 md:scale-100 origin-top pb-20">
            <ReportCardLayout />
          </div>
        </div>
      )}

      <div className="print-only">
        <ReportCardLayout />
      </div>
    </div>
  );
};

export default StudentDashboard;