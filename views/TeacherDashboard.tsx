
import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { useAuth } from '../App';
import { Score, TeacherSubject, Student, Subject, SchoolClass, SchoolSettings } from '../types';
import { getGrade, getRemark } from '../constants';
import { Save, AlertCircle, Printer, MessageSquare, TrendingUp, Eye, X, BookOpen } from 'lucide-react';

const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();
  const [assignedSubjects, setAssignedSubjects] = useState<TeacherSubject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, Partial<Score>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [studentAllScores, setStudentAllScores] = useState<Score[]>([]);
  
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allClasses, setAllClasses] = useState<SchoolClass[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        const [ts, subs, cls, sets] = await Promise.all([
          db.teacherSubjects.getAll(),
          db.subjects.getAll(),
          db.classes.getAll(),
          db.settings.get()
        ]);
        setAssignedSubjects(ts.filter(t => t.teacher_id === user.id));
        setAllSubjects(subs);
        setAllClasses(cls);
        setSettings(sets);
      }
    };
    fetchData();
  }, [user]);

  const handleSubjectSelect = async (tsId: string) => {
    const ts = assignedSubjects.find(t => t.id === tsId);
    if (!ts) return;
    setSelectedSubject(tsId);
    
    const [allStudents, allScores] = await Promise.all([
      db.students.getAll(),
      db.scores.getAll()
    ]);

    const classStudents = allStudents.filter(s => s.class_id === ts.class_id);
    setStudents(classStudents);

    const existingScores = allScores.filter(s => s.subject_id === ts.subject_id && s.class_id === ts.class_id);
    const scoreMap: Record<string, Score> = {};
    existingScores.forEach(s => scoreMap[s.student_id] = s);
    setScores(scoreMap);
  };

  const handleScoreChange = (studentId: string, field: keyof Score, value: any) => {
    if (field === 'comment') {
      setScores(prev => ({
        ...prev,
        [studentId]: { ...prev[studentId], comment: value }
      }));
      return;
    }

    const numValue = Math.min(Number(value) || 0, field === 'exam' ? 60 : 20);
    setScores(prev => {
      const current = prev[studentId] || {};
      const updated = { ...current, [field]: numValue };
      
      const total = (Number(updated.first_ca) || 0) + (Number(updated.second_ca) || 0) + (Number(updated.exam) || 0);
      if (!updated.comment) {
        if (total >= 70) updated.comment = "Excellent grasp of the subject.";
        else if (total >= 50) updated.comment = "Good performance, keep improving.";
        else if (total < 40 && total > 0) updated.comment = "Requires more focus and study.";
      }

      return { ...prev, [studentId]: updated };
    });
  };

  const openStudentPreview = async (student: Student) => {
    const allScores = await db.scores.getAll();
    const allStudentScores = allScores.filter(s => s.student_id === student.id);
    setStudentAllScores(allStudentScores);
    setViewingStudent(student);
  };

  const saveScores = async () => {
    const ts = assignedSubjects.find(t => t.id === selectedSubject);
    if (!ts) return;

    const currentSettings = settings || await db.settings.get();

    setIsSaving(true);
    const promises = (Object.entries(scores) as [string, Partial<Score>][]).map(async ([studentId, data]) => {
      const scoreObj: Score = {
        id: data.id || crypto.randomUUID(),
        student_id: studentId,
        subject_id: ts.subject_id,
        class_id: ts.class_id,
        first_ca: data.first_ca || 0,
        second_ca: data.second_ca || 0,
        exam: data.exam || 0,
        term: currentSettings.current_term,
        session: currentSettings.current_session,
        is_published: false,
        is_approved_by_form_teacher: false,
        comment: data.comment || ''
      };
      await db.scores.save(scoreObj);
    });

    await Promise.all(promises);
    setIsSaving(false);
    alert('Scores saved successfully!');
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Teacher Portal</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Record continuous assessments and exam scores.</p>
        </div>
        <div className="flex gap-3">
           <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl flex items-center gap-2 border border-blue-100 dark:border-blue-800">
             <TrendingUp className="text-blue-600" size={18} />
             <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">Grading Console</span>
           </div>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm relative transition-all">
        <div className="flex flex-col md:flex-row gap-6 mb-8 no-print">
          <div className="flex-1">
            <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest ml-2">Assigned Class & Subject</label>
            <select 
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              onChange={(e) => handleSubjectSelect(e.target.value)}
              value={selectedSubject}
            >
              <option value="">Select a class...</option>
              {assignedSubjects.map(ts => {
                const sub = allSubjects.find(s => s.id === ts.subject_id);
                const cls = allClasses.find(c => c.id === ts.class_id);
                return (
                  <option key={ts.id} value={ts.id}>{cls?.name} — {sub?.name}</option>
                );
              })}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button 
              disabled={!selectedSubject || isSaving}
              onClick={saveScores}
              className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl shadow-blue-200 dark:shadow-none"
            >
              {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={18} />}
              Commit Records
            </button>
          </div>
        </div>

        {selectedSubject ? (
          <div className="overflow-x-auto border border-slate-100 dark:border-slate-700 rounded-[2rem]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Registry</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase text-center w-24">CA 1 (20)</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase text-center w-24">CA 2 (20)</th>
                  <th className="px-4 py-5 text-[10px] font-black text-slate-500 uppercase text-center w-24">Exam (60)</th>
                  <th className="px-4 py-5 text-[10px] font-black text-blue-600 uppercase text-center w-24">Total</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase">Observations</th>
                  <th className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {students.map(s => {
                  const studentScore = scores[s.id] || {};
                  const total = (Number(studentScore.first_ca) || 0) + (Number(studentScore.second_ca) || 0) + (Number(studentScore.exam) || 0);
                  return (
                    <tr key={s.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                      <td className="px-6 py-5">
                        <div>
                          <p className="text-sm font-bold dark:text-white uppercase tracking-tight">{s.first_name} {s.surname}</p>
                          <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">{s.admission_number}</p>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <input type="number" max="20" className="w-16 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none font-black" value={studentScore.first_ca || ''} onChange={e => handleScoreChange(s.id, 'first_ca', e.target.value)} />
                      </td>
                      <td className="px-4 py-5 text-center">
                        <input type="number" max="20" className="w-16 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none font-black" value={studentScore.second_ca || ''} onChange={e => handleScoreChange(s.id, 'second_ca', e.target.value)} />
                      </td>
                      <td className="px-4 py-5 text-center">
                        <input type="number" max="60" className="w-16 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none font-black" value={studentScore.exam || ''} onChange={e => handleScoreChange(s.id, 'exam', e.target.value)} />
                      </td>
                      <td className="px-4 py-5 text-center">
                         <span className={`text-xs font-black px-3 py-1 rounded-lg ${total >= 40 ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'}`}>
                           {total}
                         </span>
                      </td>
                      <td className="px-6 py-5">
                        <input type="text" placeholder="Note..." className="w-full bg-transparent text-xs border-b border-transparent focus:border-blue-500 outline-none italic py-1" value={studentScore.comment || ''} onChange={e => handleScoreChange(s.id, 'comment', e.target.value)} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button onClick={() => openStudentPreview(s)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm">
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-slate-400 opacity-20">
             <BookOpen size={80} className="mb-4" />
             <p className="font-black uppercase tracking-[0.3em] text-[10px]">Select record to load registry</p>
          </div>
        )}
      </div>

      {viewingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <div className="p-10 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <h3 className="text-2xl font-black dark:text-white uppercase tracking-tighter">Academic Insight</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{viewingStudent.first_name} {viewingStudent.surname}</p>
                </div>
                <button onClick={() => setViewingStudent(null)} className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-2xl shadow-sm transition-all"><X size={24} /></button>
              </div>
              <div className="p-10 max-h-[70vh] overflow-y-auto space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-700 pb-2">Institutional Transcript Preview</h4>
                  {studentAllScores.length > 0 ? (
                    <div className="space-y-3">
                       {studentAllScores.map(score => {
                         const sub = allSubjects.find(s => s.id === score.subject_id);
                         const total = score.first_ca + score.second_ca + score.exam;
                         return (
                           <div key={score.id} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                             <span className="text-sm font-bold dark:text-white uppercase tracking-tight">{sub?.name}</span>
                             <div className="flex items-center gap-6">
                                <span className="text-xs font-black text-slate-400">Total: {total}</span>
                                <span className={`text-[10px] font-black px-4 py-1.5 rounded-lg uppercase tracking-widest ${total >= 40 ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                  {getGrade(total)}
                                </span>
                             </div>
                           </div>
                         );
                       })}
                    </div>
                  ) : (
                    <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/20 rounded-[2rem]">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No published scores available</p>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-[2rem]">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <MessageSquare size={14} /> Teacher's Current Observation
                  </p>
                  <p className="text-sm italic text-amber-700 dark:text-amber-300 font-bold leading-relaxed">
                    "{scores[viewingStudent.id]?.comment || 'No specific insight recorded for this student yet.'}"
                  </p>
                </div>

                <button onClick={() => setViewingStudent(null)} className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl hover:opacity-90 transition-all uppercase tracking-widest text-xs">Dismiss Profile</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
