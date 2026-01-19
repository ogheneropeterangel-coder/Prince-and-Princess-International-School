import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../db';
import { User, UserRole, SchoolClass, Subject, Student, ClassLevel, Gender, TeacherSubject, SchoolSettings } from '../types';
import StatsCard from '../components/StatsCard';
import { StatsSkeleton, TableSkeleton } from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import { 
  Users, GraduationCap, Book, School, Plus, Search, Trash2, Edit2, 
  Link as LinkIcon, Save, X, Phone, MapPin, 
  AlertCircle, AlertTriangle, User as UserIcon, Check, Layers, UserPlus, Home,
  Settings as SettingsIcon, Palette, Calendar, Building2, Image as ImageIcon, Sparkles
} from 'lucide-react';

interface AdminDashboardProps {
  activeTab: 'overview' | 'students' | 'teachers' | 'classes' | 'subjects' | 'assignments' | 'settings' | 'availability';
  onTabChange: (tab: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab, onTabChange }) => {
  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0, subjects: 0 });
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<any | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    type: string;
    id: string;
    title: string;
    message: string;
  }>({ show: false, type: '', id: '', title: '', message: '' });

  // Settings State
  const [settingsData, setSettingsData] = useState<SchoolSettings | null>(null);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Form States
  const [newStudent, setNewStudent] = useState({ 
    first_name: '', 
    surname: '', 
    middle_name: '',
    gender: Gender.MALE, 
    class_id: '',
    parent_phone: '',
    parent_address: '',
    parent_name: ''
  });

  const [newTeacher, setNewTeacher] = useState({ fullName: '', username: '', password: '', role: UserRole.FORM_TEACHER });
  const [newClass, setNewClass] = useState({ name: '', level: ClassLevel.JSS, arm: 'A' as 'A' | 'B', form_teacher_id: '' });
  const [newSubject, setNewSubject] = useState({ name: '', category: ClassLevel.JSS });
  const [mapping, setMapping] = useState({ teacherId: '', classId: '', selectedSubjectIds: [] as string[] });

  const refreshData = useCallback(async (forceAll = false) => {
    setLoading(true);
    try {
      const [stu, profs, cls, subs, ts, s] = await Promise.all([
        db.students.getAll(),
        db.users.getAll(),
        db.classes.getAll(),
        db.subjects.getAll(),
        db.teacherSubjects.getAll(),
        db.settings.get()
      ]);
      
      setStudents(stu);
      setTeachers(profs.filter(u => u.role !== UserRole.STUDENT));
      setClasses(cls);
      setSubjects(subs);
      setTeacherSubjects(ts);
      setSettingsData(s);
      
      setStats({ 
        students: stu.length, 
        teachers: profs.filter(u => u.role !== UserRole.STUDENT).length, 
        classes: cls.length, 
        subjects: subs.length 
      });
    } catch (err: any) {
      console.error('Data Sync Failure:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const fullName = `${s.first_name} ${s.surname}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || s.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = !selectedClassId || s.class_id === selectedClassId;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, selectedClassId]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsData) return;
    setIsUpdatingSettings(true);
    try {
      await db.settings.update(settingsData);
      alert('School configuration updated successfully.');
      document.documentElement.style.setProperty('--brand-primary', settingsData.primary_color);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const randomId = Math.floor(1000 + Math.random() * 9000);
      const admNo = (editingEntity?.admission_number || `PPIS/${currentYear}/${randomId}`).toLowerCase();
      const profileId = editingEntity?.profile_id || editingEntity?.id || crypto.randomUUID();
      const studentId = editingEntity?.id || crypto.randomUUID();

      await db.users.save({ 
        id: profileId, 
        full_name: `${newStudent.first_name} ${newStudent.surname}`, 
        username: admNo, 
        password: newStudent.surname.toLowerCase().trim(), 
        role: UserRole.STUDENT, 
        created_at: editingEntity?.created_at || new Date().toISOString() 
      });

      await db.students.save({ 
        id: studentId, 
        first_name: newStudent.first_name, 
        surname: newStudent.surname, 
        middle_name: newStudent.middle_name,
        gender: newStudent.gender, 
        class_id: newStudent.class_id, 
        admission_number: admNo, 
        profile_id: profileId,
        parent_name: newStudent.parent_name,
        parent_phone: newStudent.parent_phone,
        parent_address: newStudent.parent_address
      });

      setShowAddModal(null);
      refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const id = editingEntity?.id || crypto.randomUUID();
      await db.users.save({ 
        id, 
        full_name: newTeacher.fullName, 
        username: newTeacher.username.toLowerCase().trim(), 
        password: newTeacher.password, 
        role: newTeacher.role, 
        created_at: editingEntity?.created_at || new Date().toISOString() 
      });
      setShowAddModal(null);
      refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await db.classes.save({ 
        id: editingEntity?.id || crypto.randomUUID(), 
        name: newClass.name, 
        level: newClass.level, 
        arm: newClass.arm, 
        form_teacher_id: newClass.form_teacher_id || undefined 
      });
      setShowAddModal(null);
      refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await db.subjects.save({ 
        id: editingEntity?.id || crypto.randomUUID(), 
        name: newSubject.name, 
        category: newSubject.category 
      });
      setShowAddModal(null);
      refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleBulkMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const promises = mapping.selectedSubjectIds.map(subjectId => 
        db.teacherSubjects.save({
          id: crypto.randomUUID(),
          teacher_id: mapping.teacherId,
          subject_id: subjectId,
          class_id: mapping.classId
        })
      );
      await Promise.all(promises);
      setMapping({ teacherId: '', classId: '', selectedSubjectIds: [] });
      setShowAddModal(null);
      refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmation;
    setLoading(true);
    try {
      if (type === 'student') {
        const s = students.find(item => item.id === id);
        if (s?.profile_id) await db.users.remove(s.profile_id);
        await db.students.remove(id);
      } else if (type === 'teacher') {
        await db.users.remove(id);
      } else if (type === 'class') {
        await db.classes.remove(id);
      } else if (type === 'subject') {
        await db.subjects.remove(id);
      } else if (type === 'mapping') {
        await db.teacherSubjects.remove(id);
      }
      setDeleteConfirmation({ ...deleteConfirmation, show: false });
      refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black dark:text-white uppercase tracking-tighter">Admin <span className="text-blue-600">Dashboard</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Registry Management • {activeTab}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'students' && <button onClick={() => { setEditingEntity(null); setNewStudent({ first_name: '', surname: '', middle_name: '', gender: Gender.MALE, class_id: '', parent_phone: '', parent_address: '', parent_name: '' }); setShowAddModal('student'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Enroll Student</button>}
          {activeTab === 'teachers' && <button onClick={() => { setEditingEntity(null); setNewTeacher({ fullName: '', username: '', password: '', role: UserRole.FORM_TEACHER }); setShowAddModal('teacher'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Add Staff</button>}
          {activeTab === 'classes' && <button onClick={() => { setEditingEntity(null); setNewClass({ name: '', level: ClassLevel.JSS, arm: 'A', form_teacher_id: '' }); setShowAddModal('class'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Create Class</button>}
          {activeTab === 'subjects' && <button onClick={() => { setEditingEntity(null); setNewSubject({ name: '', category: ClassLevel.JSS }); setShowAddModal('subject'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Add Subject</button>}
          {activeTab === 'assignments' && <button onClick={() => { setMapping({ teacherId: '', classId: '', selectedSubjectIds: [] }); setShowAddModal('mapping'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><LinkIcon size={18} /> Assign Subjects</button>}
        </div>
      </header>

      {loading && activeTab !== 'settings' ? <TableSkeleton /> : (
        <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden min-h-[500px]">
          {activeTab === 'overview' && (
            <div className="p-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard title="Students" value={stats.students} icon={Users} color="blue" />
              <StatsCard title="Staff" value={stats.teachers} icon={GraduationCap} color="green" />
              <StatsCard title="Classes" value={stats.classes} icon={School} color="amber" />
              <StatsCard title="Subjects" value={stats.subjects} icon={Book} color="purple" />
            </div>
          )}

          {activeTab === 'settings' && settingsData && (
            <div className="p-10 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-10">
                <SettingsIcon size={24} className="text-blue-600" />
                <h2 className="text-2xl font-black uppercase tracking-tighter">System Configuration</h2>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-12">
                <div className="space-y-8 p-8 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-blue-500" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Identity & Branding</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">School Official Name</label>
                      <input required className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={settingsData.name} onChange={e => setSettingsData({...settingsData, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">School Motto</label>
                      <input required className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={settingsData.motto} onChange={e => setSettingsData({...settingsData, motto: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><ImageIcon size={12} /> Logo URL</label>
                      <input required className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-mono text-[10px] outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={settingsData.logo} onChange={e => setSettingsData({...settingsData, logo: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Palette size={12} /> Primary Color</label>
                      <div className="flex gap-2">
                        <input type="color" className="w-14 h-14 rounded-xl cursor-pointer p-1 bg-white border dark:border-slate-700" value={settingsData.primary_color} onChange={e => setSettingsData({...settingsData, primary_color: e.target.value})} />
                        <input className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none uppercase" value={settingsData.primary_color} onChange={e => setSettingsData({...settingsData, primary_color: e.target.value})} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 p-8 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-amber-500" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Academic Calendar</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Active Session</label>
                      <input placeholder="e.g. 2023/2024" required className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={settingsData.current_session} onChange={e => setSettingsData({...settingsData, current_session: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Current Term</label>
                      <select className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={settingsData.current_term} onChange={e => setSettingsData({...settingsData, current_term: Number(e.target.value) as 1|2|3})}>
                        <option value={1}>1st Term</option>
                        <option value={2}>2nd Term</option>
                        <option value={3}>3rd Term</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isUpdatingSettings} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">
                  {isUpdatingSettings ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                  Synchronize System Configuration
                </button>
              </form>
            </div>
          )}

          {activeTab !== 'overview' && activeTab !== 'settings' && (
            <div className="overflow-x-auto">
               <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/30 dark:bg-slate-900/20">
                  <div className="relative w-full md:w-80">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder={`Search ${activeTab}...`} className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-sm outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  {activeTab === 'students' && (
                    <select className="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs font-black uppercase outline-none" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                       <option value="">All Classes</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
               </div>
               <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{activeTab === 'assignments' ? 'Faculty Member' : 'Identity'}</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">{activeTab === 'assignments' ? 'Course & Class' : 'Registry Detail'}</th>
                      <th className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                     {activeTab === 'students' && filteredStudents.map(s => (
                       <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5">
                            <p className="font-bold uppercase dark:text-white">{s.surname}, {s.first_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-widest">{s.admission_number}</p>
                         </td>
                         <td className="px-10 py-5 text-xs font-bold text-blue-600 uppercase">
                            {classes.find(c => c.id === s.class_id)?.name || 'Unassigned'}
                         </td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(s); setNewStudent({ first_name: s.first_name, surname: s.surname, middle_name: s.middle_name || '', gender: s.gender, class_id: s.class_id, parent_phone: s.parent_phone || '', parent_address: s.parent_address || '', parent_name: s.parent_name || '' }); setShowAddModal('student'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'student', id: s.id, title: 'Delete Student', message: `Permanently remove student: ${s.first_name} ${s.surname}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}
                     {activeTab === 'teachers' && teachers.filter(t => t.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                       <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5 font-bold uppercase dark:text-white">{t.full_name}</td>
                         <td className="px-10 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t.role.replace('_', ' ')}</td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(t); setNewTeacher({ fullName: t.full_name, username: t.username, password: '', role: t.role }); setShowAddModal('teacher'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'teacher', id: t.id, title: 'Delete Staff', message: `Revoke system access for: ${t.full_name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}
                     {activeTab === 'classes' && classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                       <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5 font-bold uppercase dark:text-white">{c.name}</td>
                         <td className="px-10 py-5">
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{c.level} — Arm {c.arm}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">Form: {teachers.find(t => t.id === c.form_teacher_id)?.full_name || 'Unassigned'}</p>
                         </td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(c); setNewClass({ name: c.name, level: c.level, arm: c.arm, form_teacher_id: c.form_teacher_id || '' }); setShowAddModal('class'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'class', id: c.id, title: 'Delete Class', message: `Remove academic group: ${c.name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}
                     {activeTab === 'subjects' && subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                       <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5 font-bold uppercase dark:text-white">{s.name}</td>
                         <td className="px-10 py-5 text-[10px] font-black text-purple-600 uppercase tracking-widest">{s.category}</td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(s); setNewSubject({ name: s.name, category: s.category }); setShowAddModal('subject'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'subject', id: s.id, title: 'Delete Subject', message: `Erase curriculum subject: ${s.name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}
                     {activeTab === 'assignments' && teacherSubjects.filter(ts => {
                       const t = teachers.find(t => t.id === ts.teacher_id);
                       const sub = subjects.find(s => s.id === ts.subject_id);
                       return t?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || sub?.name.toLowerCase().includes(searchTerm.toLowerCase());
                     }).map(ts => {
                       const t = teachers.find(t => t.id === ts.teacher_id);
                       const sub = subjects.find(s => s.id === ts.subject_id);
                       const cls = classes.find(c => c.id === ts.class_id);
                       return (
                         <tr key={ts.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-10 py-5 font-bold uppercase dark:text-white">{t?.full_name || 'Legacy Account'}</td>
                            <td className="px-10 py-5 text-xs">
                               <span className="font-black uppercase tracking-tight dark:text-slate-200">{cls?.name}</span>
                               <span className="mx-2 text-slate-300">/</span>
                               <span className="font-bold text-blue-600 uppercase tracking-widest">{sub?.name}</span>
                            </td>
                            <td className="px-10 py-5 text-right">
                               <button onClick={() => setDeleteConfirmation({ show: true, type: 'mapping', id: ts.id, title: 'Revoke Assignment', message: 'Cancel this teaching mapping?' })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                            </td>
                         </tr>
                       );
                     })}
                  </tbody>
               </table>
            </div>
          )}
        </div>
      )}

      {/* Enroll Student Modal */}
      {showAddModal === 'student' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <UserPlus className="text-blue-600" size={32} />
                    {editingEntity ? 'Update Student' : 'Enroll Student'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Registry Enrollment System</p>
               </div>
               <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddStudent} className="space-y-8">
               <div className="grid md:grid-cols-3 gap-4">
                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Surname</label>
                   <input required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.surname} onChange={e => setNewStudent({...newStudent, surname: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">First Name</label>
                   <input required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Middle Name</label>
                   <input className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.middle_name} onChange={e => setNewStudent({...newStudent, middle_name: e.target.value})} />
                 </div>
               </div>
               <div className="grid md:grid-cols-2 gap-4">
                 <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold" value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value as Gender})}>
                   <option value={Gender.MALE}>Male</option><option value={Gender.FEMALE}>Female</option>
                 </select>
                 <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold" value={newStudent.class_id} onChange={e => setNewStudent({...newStudent, class_id: e.target.value})}>
                   <option value="">Target Class...</option>
                   {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
               </div>
               <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                  <div className="grid md:grid-cols-2 gap-4">
                    <input placeholder="Guardian Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold" value={newStudent.parent_name} onChange={e => setNewStudent({...newStudent, parent_name: e.target.value})} />
                    <input placeholder="Guardian Phone" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold" value={newStudent.parent_phone} onChange={e => setNewStudent({...newStudent, parent_phone: e.target.value})} />
                  </div>
                  <textarea placeholder="Residential Address" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold h-24 resize-none" value={newStudent.parent_address} onChange={e => setNewStudent({...newStudent, parent_address: e.target.value})} />
               </div>
               <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                 {editingEntity ? 'Update Registry Entry' : 'Enroll into Registry'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Modals for Staff, Class, Subject, Mapping */}
      {showAddModal === 'teacher' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Update Staff' : 'Add Staff Member'}</h2>
               <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddTeacher} className="space-y-6">
               <input placeholder="Full Legal Name" required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newTeacher.fullName} onChange={e => setNewTeacher({...newTeacher, fullName: e.target.value})} />
               <div className="grid md:grid-cols-2 gap-4">
                  <input placeholder="Staff ID / Username" required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} />
                  <select className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newTeacher.role} onChange={e => setNewTeacher({...newTeacher, role: e.target.value as UserRole})}>
                     <option value={UserRole.FORM_TEACHER}>Faculty Member</option><option value={UserRole.ADMIN}>Administrator</option>
                  </select>
               </div>
               <input placeholder="Initial Portal Password" required={!editingEntity} className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} />
               <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Confirm Personnel Record</button>
            </form>
          </div>
        </div>
      )}

      {showAddModal === 'class' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Modify Group' : 'Create Academic Group'}</h2>
               <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddClass} className="space-y-6">
               <input required placeholder="Class Name (e.g. JSS 1 Alpha)" className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} />
               <div className="grid md:grid-cols-2 gap-4">
                  <select className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newClass.level} onChange={e => setNewClass({...newClass, level: e.target.value as ClassLevel})}>
                    <option value={ClassLevel.JSS}>Junior Secondary</option><option value={ClassLevel.SS}>Senior Secondary</option>
                  </select>
                  <select className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newClass.arm} onChange={e => setNewClass({...newClass, arm: e.target.value as 'A' | 'B'})}>
                    <option value="A">Arm A</option><option value="B">Arm B</option>
                  </select>
               </div>
               <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign Form Master</label>
                  <select className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newClass.form_teacher_id} onChange={e => setNewClass({...newClass, form_teacher_id: e.target.value})}>
                     <option value="">Unassigned</option>
                     {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
               </div>
               <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Finalize Class Creation</button>
            </form>
          </div>
        </div>
      )}

      {showAddModal === 'subject' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Edit Course' : 'Add Curriculum Course'}</h2>
               <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddSubject} className="space-y-6">
               <input placeholder="Subject Name" required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} />
               <select className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newSubject.category} onChange={e => setNewSubject({...newSubject, category: e.target.value as ClassLevel})}>
                  <option value={ClassLevel.JSS}>Junior Curriculum</option>
                  <option value={ClassLevel.SS}>Senior Curriculum</option>
               </select>
               <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Commit Subject Entry</button>
            </form>
          </div>
        </div>
      )}

      {showAddModal === 'mapping' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter">Teaching Assignments</h2>
               <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleBulkMapping} className="space-y-6">
               <div className="grid md:grid-cols-2 gap-4">
                  <select required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold" value={mapping.teacherId} onChange={e => setMapping({...mapping, teacherId: e.target.value})}>
                     <option value="">Choose Staff...</option>
                     {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                  <select required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold" value={mapping.classId} onChange={e => setMapping({...mapping, classId: e.target.value})}>
                     <option value="">Choose Class...</option>
                     {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
               </div>
               <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700 grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {subjects.filter(s => {
                    const c = classes.find(cl => cl.id === mapping.classId);
                    return !mapping.classId || s.category === c?.level;
                  }).map(sub => (
                    <label key={sub.id} className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-all ${mapping.selectedSubjectIds.includes(sub.id) ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'}`}>
                      <input type="checkbox" className="hidden" checked={mapping.selectedSubjectIds.includes(sub.id)} onChange={() => {
                        const cur = mapping.selectedSubjectIds;
                        if(cur.includes(sub.id)) setMapping({...mapping, selectedSubjectIds: cur.filter(id => id !== sub.id)});
                        else setMapping({...mapping, selectedSubjectIds: [...cur, sub.id]});
                      }} />
                      <Layers size={12} />
                      <span className="text-[10px] font-bold uppercase truncate">{sub.name}</span>
                    </label>
                  ))}
               </div>
               <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Synchronize Assignments</button>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 dark:bg-rose-900/20 p-10 flex flex-col items-center text-center gap-4">
              <div className="p-5 bg-rose-500 text-white rounded-[2rem] shadow-xl mb-2"><AlertTriangle size={48} /></div>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter">Registry Alert</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">{deleteConfirmation.message}</p>
            </div>
            <div className="p-10 flex gap-4">
               <button onClick={() => setDeleteConfirmation({...deleteConfirmation, show: false})} className="flex-1 py-4.5 bg-slate-100 dark:bg-slate-700 dark:text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">Abort</button>
               <button onClick={executeDelete} className="flex-1 py-4.5 bg-rose-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;