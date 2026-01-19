
import React, { useState, useEffect, useMemo } from 'react';
import { db, calculatePositions } from '../db';
import { useAuth } from '../App';
import { Student, Score, Subject, SchoolClass, FormTeacherRemark, SchoolSettings } from '../types';
import { getGrade, getRemark, getAutoRemark, getOrdinal } from '../constants';
import { Printer, CheckCircle, Search, FileText, ChevronRight, LayoutGrid, List, Award, TrendingUp, Calendar, Hash, X, FileSpreadsheet, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

const FormTeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const [myClass, setMyClass] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [remarks, setRemarks] = useState<Record<string, FormTeacherRemark>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [isProcessingApproval, setIsProcessingApproval] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [currentTerm, setCurrentTerm] = useState<number>(1);
  const [currentSession, setCurrentSession] = useState<string>('');

  const refreshData = async () => {
    const s = await db.settings.get();
    setSettings(s);
    setCurrentTerm(s.current_term);
    setCurrentSession(s.current_session);

    if (user) {
      const allClasses = await db.classes.getAll();
      const cls = allClasses.find(c => c.form_teacher_id === user.id);
      if (cls) {
        setMyClass(cls);
        const [allStudents, allScoresRaw, allSubjectsRaw, allRemarksRaw] = await Promise.all([
          db.students.getAll(),
          db.scores.getAll(),
          db.subjects.getAll(),
          db.remarks.getAll()
        ]);

        const classStudents = allStudents.filter(stu => stu.class_id === cls.id);
        setStudents(classStudents);
        
        const scores = allScoresRaw.filter(sc => sc.class_id === cls.id && sc.term === s.current_term && sc.session === s.current_session);
        setAllScores(scores);
        
        setSubjects(allSubjectsRaw.filter(sub => sub.category === cls.level));
        
        const existingRemarks = allRemarksRaw.filter(r => r.class_id === cls.id && r.term === s.current_term && r.session === s.current_session);
        const remarkMap: Record<string, FormTeacherRemark> = {};
        existingRemarks.forEach(r => remarkMap[r.student_id] = r);
        setRemarks(remarkMap);
      }
    }
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  const positions = useMemo(() => {
    return calculatePositions(students, allScores, currentTerm, currentSession);
  }, [students, allScores, currentTerm, currentSession]);

  const computeStudentResults = (studentId: string) => {
    const studentScores = allScores.filter(s => s.student_id === studentId);
    const total = studentScores.reduce((acc, s) => acc + (s.first_ca + s.second_ca + s.exam), 0);
    const average = studentScores.length ? total / studentScores.length : 0;
    
    // Check if ALL subjects for this student are approved
    const isApproved = studentScores.length > 0 && studentScores.every(s => s.is_approved_by_form_teacher);
    const someApproved = studentScores.some(s => s.is_approved_by_form_teacher);
    
    return { total, average, count: studentScores.length, position: positions[studentId] || 0, isApproved, someApproved };
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    const res = computeStudentResults(studentId);
    const newRemark: FormTeacherRemark = {
      id: remarks[studentId]?.id || crypto.randomUUID(),
      student_id: studentId,
      class_id: myClass!.id,
      remark,
      term: currentTerm as 1 | 2 | 3,
      session: currentSession,
      position: res.position
    };
    setRemarks(prev => ({ ...prev, [studentId]: newRemark }));
    db.remarks.save(newRemark);
  };

  const toggleStudentApproval = async (studentId: string, currentStatus: boolean) => {
    if (!myClass) return;
    setIsProcessingApproval(studentId);
    try {
      const studentScores = allScores.filter(s => s.student_id === studentId);
      const promises = studentScores.map(score => 
        db.scores.save({ ...score, is_approved_by_form_teacher: !currentStatus })
      );
      await Promise.all(promises);
      await refreshData();
    } catch (err) {
      console.error("Approval Toggle Error:", err);
    } finally {
      setIsProcessingApproval(null);
    }
  };

  const publishResults = async () => {
    if (!myClass) return;
    if (confirm("Approve all results for this class and finalize transcript publishing?")) {
      await db.scores.updateByClass(myClass.id, { is_approved_by_form_teacher: true });
      await refreshData();
      alert('Class transcripts published successfully.');
    }
  };

  const printReport = (student: Student) => {
    setIsPrintingSummary(false);
    setSelectedStudent(student);
    setTimeout(() => {
      window.print();
      setSelectedStudent(null);
    }, 100);
  };

  const printClassSummary = () => {
    setSelectedStudent(null);
    setIsPrintingSummary(true);
    setTimeout(() => {
      window.print();
      setIsPrintingSummary(false);
    }, 100);
  };

  if (!myClass || !settings) {
    return (
      <div className="p-20 text-center space-y-4 dark:text-white">
        <h2 className="text-2xl font-black uppercase tracking-tight">{!myClass ? 'No Class Assigned' : 'Loading registry...'}</h2>
        <p className="text-slate-500 font-medium italic">Consult your administrator for Form Teacher designation.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black dark:text-white uppercase tracking-tight">Form Teacher Portal</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">{myClass.name} — {currentSession} — Term {currentTerm}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={printClassSummary} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">
            <FileSpreadsheet size={18} /> Broad Sheet
          </button>
          <button onClick={publishResults} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 dark:shadow-none">
            <CheckCircle size={18} /> Approve All Results
          </button>
        </div>
      </header>

      {/* Broad Sheet View */}
      {isPrintingSummary && (
        <div className="print-only fixed inset-0 bg-white z-[100] p-10 font-sans text-slate-900">
           <div className="text-center mb-8 pb-6 border-b-2 border-slate-900">
              <h1 className="text-2xl font-black uppercase tracking-tight">{settings.name}</h1>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-600">{settings.motto}</p>
              <div className="mt-4 inline-block bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                Academic Performance Broad Sheet
              </div>
           </div>

           <div className="grid grid-cols-3 gap-10 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Classification</p>
                 <p className="text-lg font-black text-slate-800">{myClass.name}</p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Year</p>
                 <p className="text-lg font-black text-slate-800">{currentSession}</p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</p>
                 <p className="text-lg font-black text-slate-800">Term {currentTerm}</p>
              </div>
           </div>

           <div className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-slate-900 text-white">
                       <th className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-slate-700 w-12 text-center">S/N</th>
                       <th className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Student Identity</th>
                       <th className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-slate-700">Registry ID</th>
                       <th className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-slate-700 text-center">Aggregate</th>
                       <th className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-slate-700 text-center">Avg %</th>
                       <th className="p-3 text-[10px] font-black uppercase tracking-widest text-center">Rank</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-200">
                    {students
                      .sort((a, b) => (positions[a.id] || 999) - (positions[b.id] || 999))
                      .map((s, index) => {
                        const res = computeStudentResults(s.id);
                        return (
                           <tr key={s.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-3 text-center text-xs font-bold border-r border-slate-200">{index + 1}</td>
                              <td className="p-3 text-xs font-black border-r border-slate-200 uppercase">{s.first_name} {s.surname}</td>
                              <td className="p-3 text-xs font-bold text-slate-500 border-r border-slate-200 font-mono">{s.admission_number}</td>
                              <td className="p-3 text-center text-xs font-black border-r border-slate-200">{res.total.toFixed(0)}</td>
                              <td className="p-3 text-center text-xs font-black border-r border-slate-200">{res.average.toFixed(1)}%</td>
                              <td className="p-3 text-center text-xs font-black">{getOrdinal(res.position)}</td>
                           </tr>
                        );
                    })}
                 </tbody>
              </table>
           </div>

           <div className="mt-12 grid grid-cols-2 gap-20">
              <div className="pt-8 text-center border-t border-slate-400">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Form Teacher Signature</p>
                 <p className="text-xs font-bold text-slate-800 mt-2">{user?.full_name}</p>
              </div>
              <div className="pt-8 text-center border-t border-slate-400 flex flex-col items-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Institutional Principal</p>
                 <p className="text-3xl italic" style={{ fontFamily: "'Brush Script MT', cursive", color: settings.primary_color }}>PPIS</p>
              </div>
           </div>
        </div>
      )}

      {/* Individual Report Card */}
      {selectedStudent && (
        <div className="print-only fixed inset-0 bg-white z-[100] p-12 font-serif text-slate-900 overflow-y-auto min-h-screen">
           <div className="flex flex-col items-center text-center mb-10 pb-8 border-b-4 border-double border-slate-900">
              <img src={settings.logo} alt="School Logo" className="w-40 h-40 object-contain mb-6" />
              <h1 className="text-4xl font-black uppercase tracking-tight text-slate-900">{settings.name}</h1>
              <p className="text-xl font-bold italic text-slate-600 mt-2">"{settings.motto}"</p>
              <div className="mt-6 bg-slate-900 text-white px-12 py-2.5 rounded-full text-sm font-black uppercase tracking-widest shadow-md">
                Official Academic Progress Transcript
              </div>
           </div>

           <div className="grid grid-cols-4 gap-6 mb-12 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 shadow-sm text-sm">
              <div className="col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student Identity</p>
                <p className="text-xl font-black uppercase tracking-tight text-slate-800">{selectedStudent.first_name} {selectedStudent.surname}</p>
                <p className="text-xs font-mono text-slate-500 font-bold mt-1">{selectedStudent.admission_number}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classification</p>
                <p className="text-lg font-black text-slate-800">{myClass.name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Academic Cycle</p>
                <p className="text-sm font-bold text-slate-800">Term {currentTerm}</p>
                <p className="text-xs font-black uppercase text-blue-600">{currentSession}</p>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-8 mb-12">
              <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-5 shadow-sm">
                 <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl">Σ</div>
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aggregate</p>
                   <p className="text-2xl font-black">{computeStudentResults(selectedStudent.id).total.toFixed(0)}</p>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-5 shadow-sm">
                 <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-2xl">%</div>
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average</p>
                   <p className="text-2xl font-black">{computeStudentResults(selectedStudent.id).average.toFixed(1)}%</p>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex items-center gap-5 shadow-sm">
                 <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-black text-2xl">#</div>
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Position</p>
                   <p className="text-2xl font-black">{getOrdinal(computeStudentResults(selectedStudent.id).position)}</p>
                 </div>
              </div>
           </div>

           <table className="w-full text-left border-collapse border-2 border-slate-900 mb-12 shadow-md">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-4 text-xs font-black uppercase tracking-widest">Academic Discipline</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-center">CA (40)</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-center">Exam (60)</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-center">Total (100)</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-center">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                 {subjects.map(sub => {
                   const s = allScores.find(score => score.student_id === selectedStudent.id && score.subject_id === sub.id);
                   const total = (s?.first_ca || 0) + (s?.second_ca || 0) + (s?.exam || 0);
                   return (
                     <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-4 font-black text-sm uppercase tracking-tight">{sub.name}</td>
                       <td className="p-4 text-center font-bold text-slate-700">{(s?.first_ca || 0) + (s?.second_ca || 0)}</td>
                       <td className="p-4 text-center font-bold text-slate-700">{s?.exam || '-'}</td>
                       <td className="p-4 text-center font-black text-blue-800">{total || '-'}</td>
                       <td className="p-4 text-center">
                         <span className="font-black text-sm bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-200 uppercase">{getGrade(total)}</span>
                       </td>
                     </tr>
                   );
                 })}
              </tbody>
           </table>

           <div className="p-10 bg-slate-50 rounded-[3rem] border-2 border-slate-100 mb-12 relative">
              <div className="absolute top-0 right-12 -translate-y-1/2 bg-white px-8 py-1.5 rounded-full border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">Institutional Feedback</div>
              <p className="text-base font-bold italic text-slate-700 leading-relaxed text-center">
                "{remarks[selectedStudent.id]?.remark || getAutoRemark(computeStudentResults(selectedStudent.id).average)}"
              </p>
           </div>
           
           <div className="grid grid-cols-2 gap-20 mt-auto pt-16">
              <div className="text-center pt-8 border-t border-slate-300">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Form Teacher Signature</p>
                 <p className="text-lg font-bold text-slate-800">{user?.full_name}</p>
              </div>
              <div className="text-center pt-8 border-t border-slate-300 flex flex-col items-center">
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Institutional Principal</p>
                 <p className="text-4xl italic" style={{ fontFamily: "'Brush Script MT', cursive", color: settings.primary_color }}>PPIS</p>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden no-print animate-in fade-in duration-500">
        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-6 items-center justify-between">
           <div className="flex items-center gap-5">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-[1.5rem] shadow-sm">
                <List size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Class Registry</h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Academic oversight for {myClass.name}</p>
              </div>
           </div>
           <div className="relative w-full md:w-80">
             <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Locate student record..." className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-600 font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Rank & Identity</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase text-center">Status</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase text-center">Average</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase text-center">Registry</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">Master's Insight</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {students.filter(s => `${s.first_name} ${s.surname}`.toLowerCase().includes(searchTerm.toLowerCase())).map(s => {
                const results = computeStudentResults(s.id);
                const currentRemark = remarks[s.id]?.remark || '';
                return (
                  <tr key={s.id} className="group hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-5">
                        <span className="text-[10px] font-black text-slate-300 group-hover:text-blue-500 transition-colors">#{results.position}</span>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm uppercase">
                          {s.first_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black dark:text-white uppercase tracking-tight">{s.first_name} {s.surname}</p>
                          <p className="text-[10px] font-bold text-slate-400 font-mono">{s.admission_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                       {results.isApproved ? (
                         <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shadow-sm animate-in fade-in duration-300">
                           <ShieldCheck size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Approved</span>
                         </div>
                       ) : results.someApproved ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shadow-sm">
                           <Clock size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Partial</span>
                         </div>
                       ) : (
                         <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-lg border border-slate-100">
                           <ShieldAlert size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Pending</span>
                         </div>
                       )}
                    </td>
                    <td className="px-8 py-5 text-center">
                       <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] tracking-widest uppercase ${results.average >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                         {results.average.toFixed(1)}%
                       </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{results.count} Recorded</span>
                    </td>
                    <td className="px-8 py-5">
                       <input 
                         type="text" 
                         placeholder={getAutoRemark(results.average)}
                         className="w-full text-xs bg-transparent border-b border-transparent focus:border-blue-500 outline-none italic text-slate-600 dark:text-slate-300"
                         value={currentRemark}
                         onChange={(e) => handleRemarkChange(s.id, e.target.value)}
                       />
                    </td>
                    <td className="px-8 py-5 text-right flex justify-end gap-2">
                      <button 
                        disabled={isProcessingApproval === s.id}
                        onClick={() => toggleStudentApproval(s.id, results.isApproved)}
                        className={`p-3 rounded-xl shadow-sm transition-all border ${results.isApproved ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-400 hover:text-emerald-600 border-slate-100'}`}
                        title={results.isApproved ? "Revoke Approval" : "Approve Student Results"}
                      >
                        {isProcessingApproval === s.id ? <div className="w-4.5 h-4.5 border-2 border-slate-300 border-t-white rounded-full animate-spin"></div> : <ShieldCheck size={18} />}
                      </button>
                      <button onClick={() => printReport(s)} className="p-3 text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-white shadow-sm transition-all border border-transparent" title="Print Report Card">
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FormTeacherDashboard;
