import React, { useState, useEffect, useMemo } from 'react';
import { db, calculatePositions } from '../db';
import { useAuth } from '../App';
import { Score, TeacherSubject, Student, Subject, SchoolClass, FormTeacherRemark, SchoolSettings, AI_REMARK_PROMPT } from '../types';
import { getGrade, getRemark, getAutoRemark, getOrdinal } from '../constants';
// Fixed: Added Clock to lucide-react imports
import { Save, Printer, X, BookOpen, FileSpreadsheet, GraduationCap, Search, Award, TrendingUp, Hash, AlertCircle, Sparkles, CheckCircle, ShieldCheck, Check, Send, Clock } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { BroadSheetSkeleton, TableSkeleton } from '../components/Skeleton';

const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'grading' | 'form_class'>('grading');
  
  const [assignedSubjects, setAssignedSubjects] = useState<TeacherSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [studentsInSubject, setStudentsInSubject] = useState<Student[]>([]);
  const [subjectScores, setSubjectScores] = useState<Record<string, Partial<Score>>>({});
  
  const [myClass, setMyClass] = useState<SchoolClass | null>(null);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [classScores, setClassScores] = useState<Score[]>([]);
  const [classSubjects, setClassSubjects] = useState<Subject[]>([]);
  const [remarks, setRemarks] = useState<Record<string, FormTeacherRemark>>({});
  
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [selectedReportStudent, setSelectedReportStudent] = useState<Student | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [allClasses, setAllClasses] = useState<SchoolClass[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setIsInitialLoading(true);
      try {
        const s = await db.settings.get();
        setSettings(s);
        const [clsList, subList] = await Promise.all([db.classes.getAll(), db.subjects.getAll()]);
        setAllClasses(clsList);
        setAllSubjects(subList);
        const ts = (await db.teacherSubjects.getAll()).filter(t => t.teacher_id === user.id);
        setAssignedSubjects(ts);
        const cls = clsList.find(c => c.form_teacher_id === user.id);
        if (cls) {
          setMyClass(cls);
          const [allStudents, allScores, allRemarks] = await Promise.all([db.students.getAll(), db.scores.getAll(), db.remarks.getAll()]);
          const stu = allStudents.filter(s => s.class_id === cls.id);
          setClassStudents(stu);
          const scores = allScores.filter(sc => sc.class_id === cls.id && sc.term === s.current_term && sc.session === s.current_session);
          setClassScores(scores);
          setClassSubjects(subList.filter(sub => sub.category === cls.level));
          const existingRemarks = allRemarks.filter(r => r.class_id === cls.id && r.term === s.current_term && r.session === s.current_session);
          const remarkMap: Record<string, FormTeacherRemark> = {};
          existingRemarks.forEach(r => remarkMap[r.student_id] = r);
          setRemarks(remarkMap);
        }
      } catch (err: any) { 
        console.error("Staff Dashboard Load Error:", err);
      } finally { setIsInitialLoading(false); }
    };
    init();
  }, [user]);

  const generateAiRemark = async (student: Student) => {
    // Guidelines: Use process.env.API_KEY directly for model access.
    if (!settings || !process.env.API_KEY) {
        alert("AI Core requires an active API Key.");
        return;
    }
    setIsAiGenerating(student.id);
    const res = computeResults(student.id);
    try {
      // Guidelines: Create a new GoogleGenAI instance right before making an API call using the direct environment variable.
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = AI_REMARK_PROMPT(`${student.first_name} ${student.surname}`, res.average, res.total, res.count, getOrdinal(res.position));
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      // Guidelines: Use the .text property directly.
      const aiText = response.text?.trim().replace(/^"|"$/g, '') || getAutoRemark(res.average);
      const nr: FormTeacherRemark = { id: remarks[student.id]?.id || crypto.randomUUID(), student_id: student.id, class_id: myClass!.id, remark: aiText, term: settings.current_term, session: settings.current_session };
      setRemarks(prev => ({ ...prev, [student.id]: nr }));
      await db.remarks.save(nr);
    } catch (err: any) {
      console.error("AI Generation Error:", err);
    } finally { setIsAiGenerating(null); }
  };

  const handleSubjectSelect = async (tsId: string) => {
    const ts = assignedSubjects.find(t => t.id === tsId);
    if (!ts || !settings) return;
    setSelectedSubject(tsId);
    try {
      const [allStudents, allScores] = await Promise.all([db.students.getAll(), db.scores.getAll()]);
      const stu = allStudents.filter(s => s.class_id === ts.class_id);
      setStudentsInSubject(stu);
      const scores = allScores.filter(s => s.subject_id === ts.subject_id && s.class_id === ts.class_id && s.term === settings.current_term && s.session === settings.current_session);
      const scoreMap: Record<string, Score> = {};
      scores.forEach(s => scoreMap[s.student_id] = s);
      setSubjectScores(scoreMap);
    } catch (err) { console.error("Subject Load Error", err); }
  };

  const handleScoreChange = (studentId: string, field: keyof Score, value: any) => {
    setSubjectScores(prev => {
      const current = prev[studentId] || {};
      return { ...prev, [studentId]: { ...current, [field]: value } };
    });
  };

  const saveSubjectScores = async (autoApprove = false) => {
    const ts = assignedSubjects.find(t => t.id === selectedSubject);
    if (!ts || !settings) return;
    try {
      if (autoApprove) setIsApproving(true);
      const promises = (Object.entries(subjectScores) as [string, Partial<Score>][]).map(async ([studentId, data]) => {
        const scoreObj: Score = {
          id: data.id || crypto.randomUUID(), student_id: studentId, subject_id: ts.subject_id, class_id: ts.class_id,
          first_ca: Number(data.first_ca) || 0, second_ca: Number(data.second_ca) || 0, exam: Number(data.exam) || 0,
          term: settings.current_term, session: settings.current_session, is_published: true, 
          is_approved_by_form_teacher: autoApprove ? true : (data.is_approved_by_form_teacher ?? false),
          comment: data.comment || ''
        };
        await db.scores.save(scoreObj);
      });
      await Promise.all(promises);
      
      // Refresh local state
      const allS = await db.scores.getAll();
      const scores = allS.filter(s => s.subject_id === ts.subject_id && s.class_id === ts.class_id && s.term === settings.current_term && s.session === settings.current_session);
      const scoreMap: Record<string, Score> = {};
      scores.forEach(s => scoreMap[s.student_id] = s);
      setSubjectScores(scoreMap);

      if (myClass) {
          const updatedScores = allS.filter(s => s.class_id === myClass.id && s.term === settings.current_term && s.session === settings.current_session);
          setClassScores(updatedScores);
      }
      
      if (autoApprove) {
        alert('Marks have been approved and are now visible to students.');
      } else {
        alert('Academic records saved to registry.');
      }
    } catch (err: any) {
      alert("Registry Sync Error: " + (err.message || "Unknown error"));
    } finally {
      setIsApproving(false);
    }
  };

  const positions = useMemo(() => {
    if (!settings) return {};
    return calculatePositions(classStudents, classScores, settings.current_term, settings.current_session);
  }, [classStudents, classScores, settings]);

  const computeResults = (studentId: string) => {
    const stuScores = classScores.filter(s => s.student_id === studentId);
    const total = stuScores.reduce((acc, s) => acc + (s.first_ca + s.second_ca + s.exam), 0);
    const average = stuScores.length ? total / stuScores.length : 0;
    const isApproved = stuScores.length > 0 && stuScores.every(s => s.is_approved_by_form_teacher);
    return { total, average, position: positions[studentId] || 0, count: stuScores.length, isApproved };
  };

  const toggleApproval = async (studentId: string, currentStatus: boolean) => {
    try {
      const stuScores = classScores.filter(s => s.student_id === studentId);
      const promises = stuScores.map(sc => db.scores.save({...sc, is_approved_by_form_teacher: !currentStatus}));
      await Promise.all(promises);
      const updated = (await db.scores.getAll()).filter(s => s.class_id === myClass!.id && s.term === settings!.current_term && s.session === settings!.current_session);
      setClassScores(updated);
    } catch (err) { console.error("Approval Toggle Error", err); }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 no-print animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black dark:text-white uppercase tracking-tighter">Academic <span className="text-blue-600">Portal</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">{settings?.current_session || '---'} Session | Term {settings?.current_term || '---'}</p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border dark:border-slate-700">
          <button onClick={() => setActiveTab('grading')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'grading' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>Course Records</button>
          <button onClick={() => setActiveTab('form_class')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'form_class' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>Form Master Registry</button>
        </div>
      </header>

      {isInitialLoading ? (
        <div className="space-y-10">
          {activeTab === 'grading' ? <TableSkeleton /> : <BroadSheetSkeleton />}
        </div>
      ) : (
        <>
          {activeTab === 'grading' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col lg:flex-row gap-4 items-end">
                 <div className="flex-1 w-full">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-2">Classroom & Subject Assignment</label>
                   <select className="w-full px-6 py-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 dark:text-white border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={selectedSubject} onChange={(e) => handleSubjectSelect(e.target.value)}>
                      <option value="">Choose Course...</option>
                      {assignedSubjects.map(ts => (
                        <option key={ts.id} value={ts.id}>
                          {allClasses.find(c => c.id === ts.class_id)?.name} — {allSubjects.find(s => s.id === ts.subject_id)?.name}
                        </option>
                      ))}
                   </select>
                 </div>
                 <div className="flex gap-3 w-full lg:w-auto">
                    <button onClick={() => saveSubjectScores(false)} disabled={!selectedSubject || isApproving} className="flex-1 lg:flex-none px-8 py-4.5 bg-slate-900 dark:bg-slate-700 text-white font-black rounded-2xl hover:opacity-90 disabled:opacity-30 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]">
                        <Save size={18} /> Save Draft
                    </button>
                    <button onClick={() => { if(confirm("Approve and publish these results? Students will be able to view them immediately.")) saveSubjectScores(true); }} disabled={!selectedSubject || isApproving} className="flex-1 lg:flex-none px-8 py-4.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:opacity-30 flex items-center justify-center gap-2 shadow-xl shadow-blue-200 dark:shadow-none uppercase tracking-widest text-[10px]">
                        {isApproving ? <div className="w-4.5 h-4.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheck size={18} />}
                        Approve & Publish
                    </button>
                 </div>
              </div>

              {selectedSubject ? (
                <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50">
                          <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Information</th>
                          <th className="px-4 py-6 text-[10px] font-black text-slate-500 uppercase text-center w-24">CA 1 (20)</th>
                          <th className="px-4 py-6 text-[10px] font-black text-slate-500 uppercase text-center w-24">CA 2 (20)</th>
                          <th className="px-4 py-6 text-[10px] font-black text-slate-500 uppercase text-center w-24">Exam (60)</th>
                          <th className="px-4 py-6 text-[10px] font-black text-blue-600 uppercase text-center w-24">Total</th>
                          <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase text-center">Status</th>
                          <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase">Subject Observation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {studentsInSubject.map(s => {
                          const data = subjectScores[s.id] || {};
                          const total = (Number(data.first_ca) || 0) + (Number(data.second_ca) || 0) + (Number(data.exam) || 0);
                          const isApproved = data.is_approved_by_form_teacher === true;
                          return (
                            <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors group">
                              <td className="px-10 py-5">
                                 <p className="font-bold text-sm dark:text-white uppercase tracking-tight">{s.surname}, {s.first_name}</p>
                                 <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{s.admission_number}</p>
                              </td>
                              <td className="px-4 py-5 text-center"><input type="number" className="w-16 p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-center text-sm font-black outline-none focus:ring-2 focus:ring-blue-600" value={data.first_ca || ''} onChange={e => handleScoreChange(s.id, 'first_ca', e.target.value)} /></td>
                              <td className="px-4 py-5 text-center"><input type="number" className="w-16 p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-center text-sm font-black outline-none focus:ring-2 focus:ring-blue-600" value={data.second_ca || ''} onChange={e => handleScoreChange(s.id, 'second_ca', e.target.value)} /></td>
                              <td className="px-4 py-5 text-center"><input type="number" className="w-16 p-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-center text-sm font-black outline-none focus:ring-2 focus:ring-blue-600" value={data.exam || ''} onChange={e => handleScoreChange(s.id, 'exam', e.target.value)} /></td>
                              <td className="px-4 py-5 text-center font-black text-blue-600">{total}</td>
                              <td className="px-6 py-5 text-center">
                                 {isApproved ? (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        <Check size={12} /> Live
                                    </div>
                                 ) : (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                        <Clock size={12} /> Draft
                                    </div>
                                 )}
                              </td>
                              <td className="px-10 py-5"><input type="text" placeholder="Academic insight..." className="w-full bg-transparent border-b dark:border-slate-700 text-xs italic outline-none focus:border-blue-500 py-1" value={data.comment || ''} onChange={e => handleScoreChange(s.id, 'comment', e.target.value)} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-40 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-[4rem] border border-slate-100 dark:border-slate-700 shadow-inner">
                   <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                     <BookOpen size={48} className="opacity-10" />
                   </div>
                   <p className="font-black uppercase tracking-[0.4em] text-[10px]">Select Assignment to Unlock Registry</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'form_class' && (
            <div className="space-y-6">
              {myClass ? (
                <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                   <div className="p-10 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-8">
                      <div className="flex items-center gap-6">
                         <div className="p-5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-[1.5rem] shadow-sm">
                            <GraduationCap size={32} />
                         </div>
                         <div>
                            <h2 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Classmaster Hub: {myClass.name}</h2>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{classStudents.length} Active Records</p>
                         </div>
                      </div>
                      <button onClick={() => { setIsPrintingSummary(true); setTimeout(() => {window.print(); setIsPrintingSummary(false);},100); }} className="px-10 py-4 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 shadow-2xl transition-all flex items-center gap-2">
                         <FileSpreadsheet size={18} /> Broad Sheet Export
                      </button>
                   </div>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/50">
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Hierarchy</th>
                            <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase text-center w-24">Average</th>
                            <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase text-center w-32">Status</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase">Master Remark (AI Enhanced)</th>
                            <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase text-right">Registry Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {classStudents.map(s => {
                            const res = computeResults(s.id);
                            return (
                              <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                <td className="px-10 py-6">
                                  <div className="flex items-center gap-5">
                                     <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-black text-xs text-slate-400 group-hover:text-blue-600 transition-colors">#{res.position}</div>
                                     <div>
                                       <p className="text-sm font-black dark:text-white uppercase tracking-tight">{s.surname}, {s.first_name}</p>
                                       <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">{s.admission_number}</p>
                                     </div>
                                  </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                   <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] tracking-widest uppercase ${res.average >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                     {res.average.toFixed(1)}%
                                   </span>
                                </td>
                                <td className="px-6 py-6 text-center">
                                   <button onClick={() => toggleApproval(s.id, res.isApproved)} className={`p-2 rounded-lg border transition-all ${res.isApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-300'}`}>
                                      {res.isApproved ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                                   </button>
                                </td>
                                <td className="px-10 py-6">
                                   <div className="flex items-center gap-3">
                                      <input type="text" className="flex-1 bg-transparent text-xs border-b dark:border-slate-700 focus:border-blue-500 outline-none py-1 italic text-slate-600 dark:text-slate-300" placeholder={getAutoRemark(res.average)} value={remarks[s.id]?.remark || ''} onChange={(e) => {
                                        const nr: FormTeacherRemark = { id: remarks[s.id]?.id || crypto.randomUUID(), student_id: s.id, class_id: myClass.id, remark: e.target.value, term: settings.current_term, session: settings.current_session };
                                        setRemarks({...remarks, [s.id]: nr}); db.remarks.save(nr);
                                      }} />
                                      <button onClick={() => generateAiRemark(s)} disabled={isAiGenerating === s.id} className={`p-2 rounded-xl transition-all ${isAiGenerating === s.id ? 'animate-spin text-blue-400' : 'text-blue-500 hover:bg-blue-50'}`} title="Generate AI Remark">
                                         <Sparkles size={16} />
                                      </button>
                                   </div>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <button onClick={() => { setSelectedReportStudent(s); setTimeout(() => {window.print(); setSelectedReportStudent(null);}, 100); }} className="p-3.5 rounded-2xl transition-all text-blue-600 bg-blue-50 dark:bg-blue-900/40 hover:bg-white shadow-sm border border-transparent hover:border-blue-100">
                                     <Printer size={20} />
                                   </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                     </table>
                   </div>
                </div>
              ) : (
                <div className="py-40 text-center text-slate-400 bg-white dark:bg-slate-800 rounded-[4rem] border border-slate-100 dark:border-slate-700 shadow-inner">
                   <GraduationCap size={80} className="mx-auto mb-4 opacity-10" />
                   <p className="font-black uppercase tracking-[0.4em] text-[10px]">Registry Access Denied: Form Master Privileges Not Found</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Broad Sheet Template */}
      {isPrintingSummary && myClass && settings && (
         <div className="print-only fixed inset-0 bg-white z-[100] p-10 font-sans text-slate-900">
            <div className="text-center mb-10 pb-6 border-b-2 border-slate-900">
               <h1 className="text-3xl font-black uppercase tracking-tighter">{settings.name}</h1>
               <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">{settings.motto}</p>
               <div className="mt-4 inline-block bg-slate-900 text-white px-8 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">Institutional Broad Sheet — {myClass.name}</div>
            </div>
            <table className="w-full border-collapse border-2 border-slate-900">
               <thead>
                  <tr className="bg-slate-900 text-white">
                     <th className="p-3 text-[10px] font-black uppercase border-r border-slate-700">Rank</th>
                     <th className="p-3 text-[10px] font-black uppercase border-r border-slate-700">Student</th>
                     <th className="p-3 text-[10px] font-black uppercase border-r border-slate-700">Admission No.</th>
                     <th className="p-3 text-[10px] font-black uppercase border-r border-slate-700">Total</th>
                     <th className="p-3 text-[10px] font-black uppercase border-r border-slate-700">Avg %</th>
                     <th className="p-3 text-[10px] font-black uppercase">Master Remark</th>
                  </tr>
               </thead>
               <tbody>
                  {classStudents.sort((a,b) => (positions[a.id] || 0) - (positions[b.id] || 0)).map(s => {
                     const r = computeResults(s.id);
                     return (
                        <tr key={s.id} className="border-b border-slate-200">
                           <td className="p-3 text-center text-xs font-bold border-r border-slate-200">{r.position}</td>
                           <td className="p-3 text-xs font-black border-r border-slate-200 uppercase">{s.surname}, {s.first_name}</td>
                           <td className="p-3 text-xs border-r border-slate-200 font-mono text-center">{s.admission_number}</td>
                           <td className="p-3 text-center text-xs font-bold border-r border-slate-200">{r.total}</td>
                           <td className="p-3 text-center text-xs font-black border-r border-slate-200">{r.average.toFixed(1)}%</td>
                           <td className="p-3 text-xs italic">{remarks[s.id]?.remark || getAutoRemark(r.average)}</td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      )}

      {/* Report Template */}
      {selectedReportStudent && myClass && settings && (
         <div className="print-only fixed inset-0 bg-white z-[100] p-12 font-serif text-slate-900 overflow-y-auto">
            <div className="flex flex-col items-center text-center mb-10 pb-8 border-b-4 border-double border-slate-900">
               <img src={settings.logo} className="w-40 h-40 object-contain mb-4" />
               <h1 className="text-4xl font-black uppercase tracking-tight">{settings.name}</h1>
               <p className="text-xl font-bold italic text-slate-600 mt-1">"{settings.motto}"</p>
               <div className="mt-8 bg-slate-900 text-white px-12 py-3 rounded-full text-xs font-black uppercase tracking-[0.2em]">Academic Progress Transcript</div>
            </div>
            <div className="grid grid-cols-4 gap-6 mb-12 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200 text-sm">
               <div className="col-span-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Student Identity</p>
                 <p className="text-xl font-black uppercase tracking-tight text-slate-800">{selectedReportStudent.first_name} {selectedReportStudent.surname}</p>
                 <p className="text-xs font-mono text-slate-500 font-bold mt-1">{selectedReportStudent.admission_number}</p>
               </div>
               <div>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Classification</p>
                 <p className="text-lg font-black text-slate-800">{myClass.name}</p>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cycle</p>
                 <p className="text-sm font-bold text-slate-800">Term {settings.current_term}</p>
                 <p className="text-xs font-black uppercase text-blue-600">{settings.current_session}</p>
               </div>
            </div>
            <table className="w-full border-collapse border-2 border-slate-900 mb-10">
               <thead>
                  <tr className="bg-slate-900 text-white">
                     <th className="p-4 text-xs font-black uppercase text-left">Subject</th>
                     <th className="p-4 text-xs font-black uppercase text-center">CA (40)</th>
                     <th className="p-4 text-xs font-black uppercase text-center">Exam (60)</th>
                     <th className="p-4 text-xs font-black uppercase text-center">Total</th>
                     <th className="p-4 text-xs font-black uppercase text-center">Grade</th>
                  </tr>
               </thead>
               <tbody>
                  {classSubjects.map(sub => {
                     const s = classScores.find(sc => sc.student_id === selectedReportStudent.id && sc.subject_id === sub.id);
                     const total = (s?.first_ca || 0) + (s?.second_ca || 0) + (s?.exam || 0);
                     return (
                        <tr key={sub.id} className="border-b border-slate-200">
                           <td className="p-4 text-sm font-black uppercase">{sub.name}</td>
                           <td className="p-4 text-center">{(s?.first_ca || 0) + (s?.second_ca || 0)}</td>
                           <td className="p-4 text-center">{s?.exam || '-'}</td>
                           <td className="p-4 text-center font-black">{total || '-'}</td>
                           <td className="p-4 text-center font-black">{getGrade(total)}</td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      )}
    </div>
  );
};

export default StaffDashboard;