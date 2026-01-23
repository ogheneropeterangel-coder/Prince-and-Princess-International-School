import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db, calculatePositions } from '../db';
import { User, UserRole, SchoolClass, Subject, Student, ClassLevel, Gender, TeacherSubject, SchoolSettings, Score, FormTeacherRemark } from '../types';
import StatsCard from '../components/StatsCard';
import { StatsSkeleton, TableSkeleton } from '../components/Skeleton';
import { supabase } from '../lib/supabase';
import { getGrade, getOrdinal, getAutoRemark } from '../constants';
import { 
  Users, GraduationCap, Book, School, Plus, Search, Trash2, Edit2, 
  Link as LinkIcon, Save, X, Phone, MapPin, 
  AlertCircle, AlertTriangle, User as UserIcon, Check, Layers, UserPlus, Home,
  Settings as SettingsIcon, Palette, Calendar, Building2, Image as ImageIcon, Sparkles,
  Download, FileSpreadsheet, Upload, FileType, FileText, Printer, Eye, Award, BarChart3, Fingerprint, Crown, TrendingUp, CheckCircle2, Clock, Send, ShieldCheck, ShieldAlert, Activity, PieChart, Ticket
} from 'lucide-react';

interface AdminDashboardProps {
  activeTab: 'overview' | 'students' | 'teachers' | 'classes' | 'subjects' | 'assignments' | 'settings' | 'availability' | 'results' | 'promotion' | 'permits';
  onTabChange: (tab: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeTab, onTabChange }) => {
  const [stats, setStats] = useState({ 
    students: 0, 
    teachers: 0, 
    classes: 0, 
    subjects: 0,
    totalScores: 0,
    publishedScores: 0,
    approvedScores: 0
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [allScores, setAllScores] = useState<Score[]>([]);
  const [allRemarks, setAllRemarks] = useState<FormTeacherRemark[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<any | null>(null);
  const [selectedReportStudent, setSelectedReportStudent] = useState<Student | null>(null);
  const [selectedPermitStudent, setSelectedPermitStudent] = useState<Student | null>(null);
  const [viewingResultStudent, setViewingResultStudent] = useState<Student | null>(null);
  const [viewingPermitStudent, setViewingPermitStudent] = useState<Student | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    type: string;
    id: string;
    title: string;
    message: string;
  }>({ show: false, type: '', id: '', title: '', message: '' });

  // Promotion State
  const [promotionSourceClassId, setPromotionSourceClassId] = useState<string>('');
  const [promotionTargetClassId, setPromotionTargetClassId] = useState<string>('');
  const [selectedPromotionStudentIds, setSelectedPromotionStudentIds] = useState<Set<string>>(new Set());
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionConfirmData, setPromotionConfirmData] = useState<{
    show: boolean;
    count: number;
    targetClassName: string;
    individualStudent?: Student;
  }>({ show: false, count: 0, targetClassName: '' });

  // Student Edit Confirmation State
  const [studentEditConfirm, setStudentEditConfirm] = useState<{
    show: boolean;
    name: string;
    isSaving: boolean;
  }>({ show: false, name: '', isSaving: false });

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

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        db.students.getAll(),
        db.users.getAll(),
        db.classes.getAll(),
        db.subjects.getAll(),
        db.teacherSubjects.getAll(),
        db.settings.get(),
        db.scores.getAll(),
        db.remarks.getAll()
      ]);
      
      const [stu, profs, cls, subs, ts, s, scs, rems] = results.map(r => r.status === 'fulfilled' ? r.value : []);
      
      setStudents(stu as Student[]);
      setTeachers((profs as User[]).filter(u => u.role !== UserRole.STUDENT));
      setClasses(cls as SchoolClass[]);
      setSubjects(subs as Subject[]);
      setTeacherSubjects(ts as TeacherSubject[]);
      setSettingsData(s as SchoolSettings);
      setAllScores(scs as Score[]);
      setAllRemarks(rems as FormTeacherRemark[]);
      
      const scoresArray = scs as Score[];
      setStats({ 
        students: (stu as Student[]).length, 
        teachers: (profs as User[]).filter(u => u.role !== UserRole.STUDENT).length, 
        classes: (cls as SchoolClass[]).length, 
        subjects: (subs as Subject[]).length,
        totalScores: scoresArray.length,
        publishedScores: scoresArray.filter(s => s.is_published).length,
        approvedScores: scoresArray.filter(s => s.is_approved_by_form_teacher).length
      });
      
      if (s?.primary_color) {
        document.documentElement.style.setProperty('--school-royal', s.primary_color);
      }
    } catch (err: any) {
      console.error('Data Sync Failure:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData, activeTab]);

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const fullName = `${s.first_name} ${s.surname}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || s.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = !selectedClassId || s.class_id === selectedClassId;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, selectedClassId]);

  const computeStudentResults = useCallback((studentId: string) => {
    if (!settingsData) return { total: 0, average: 0, count: 0, position: 0 };
    const studentScores = allScores.filter(s => s.student_id === studentId && s.term === settingsData.current_term && s.session === settingsData.current_session);
    const total = studentScores.reduce((acc, s) => acc + (Number(s.first_ca) + Number(s.second_ca) + Number(s.exam)), 0);
    const count = studentScores.length;
    const average = count ? total / count : 0;
    
    const studentInfo = students.find(st => st.id === studentId);
    const classStudents = students.filter(s => s.class_id === studentInfo?.class_id);
    const classPositions = calculatePositions(classStudents, allScores, settingsData.current_term, settingsData.current_session);
    const position = classPositions[studentId] || 0;

    return { total, average, count, position };
  }, [allScores, settingsData, students]);

  // Reliable Printing Logic using Effects
  useEffect(() => {
    if (selectedReportStudent) {
      const timer = setTimeout(() => {
        window.print();
        setSelectedReportStudent(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedReportStudent]);

  useEffect(() => {
    if (selectedPermitStudent) {
      const timer = setTimeout(() => {
        window.print();
        setSelectedPermitStudent(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedPermitStudent]);

  const handlePrintStudent = (student: Student) => {
    setSelectedReportStudent(student);
  };

  const handlePrintPermit = (student: Student) => {
    setSelectedPermitStudent(student);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && settingsData) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Logo file is too large. Please select an image under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettingsData({ ...settingsData, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsData) return;

    if (!/^\d{4}\/\d{4}$/.test(settingsData.current_session)) {
      alert("Please enter session in format YYYY/YYYY (e.g. 2025/2026)");
      return;
    }

    setIsUpdatingSettings(true);
    try {
      await db.settings.update(settingsData);
      document.documentElement.style.setProperty('--school-royal', settingsData.primary_color);
      alert('Settings Synchronized.');
      await refreshData();
    } catch (err: any) { alert(err.message); } finally { setIsUpdatingSettings(false); }
  };

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.first_name || !newStudent.surname || !newStudent.class_id) {
      alert("Please fill all required fields");
      return;
    }
    setStudentEditConfirm({
      show: true,
      name: `${newStudent.first_name} ${newStudent.surname}`,
      isSaving: false
    });
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name) {
      alert("Class name is required.");
      return;
    }
    setLoading(true);
    try {
      await db.classes.save({
        id: editingEntity?.id || crypto.randomUUID(),
        ...newClass
      });
      setShowAddModal(null);
      await refreshData();
    } catch (err: any) {
      alert("Registry Sync Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name) {
      alert("Subject name is required.");
      return;
    }
    setLoading(true);
    try {
      await db.subjects.save({
        id: editingEntity?.id || crypto.randomUUID(),
        ...newSubject
      });
      setShowAddModal(null);
      await refreshData();
    } catch (err: any) {
      alert("Registry Sync Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacher.fullName || !newTeacher.username || (!editingEntity && !newTeacher.password)) {
      alert("Please fill all required fields");
      return;
    }
    setLoading(true);
    try {
      const teacherId = editingEntity?.id || crypto.randomUUID();
      await db.users.save({
        id: teacherId,
        full_name: newTeacher.fullName,
        username: newTeacher.username,
        password: newTeacher.password || editingEntity?.password || newTeacher.fullName.split(' ')[0].toLowerCase(),
        role: newTeacher.role as UserRole,
        created_at: editingEntity?.created_at || new Date().toISOString()
      });
      setShowAddModal(null);
      await refreshData();
    } catch (err: any) {
      alert("Staff Registry Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapping.teacherId || !mapping.classId || mapping.selectedSubjectIds.length === 0) {
      alert("Please select a teacher, class, and at least one subject.");
      return;
    }
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
      await refreshData();
      alert("Teaching assignments synchronized successfully.");
    } catch (err: any) { 
      alert("Assignment Error: " + err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const executePromotion = async () => {
    if (!promotionTargetClassId || selectedPromotionStudentIds.size === 0) return;
    setIsPromoting(true);
    try {
      const promises = Array.from(selectedPromotionStudentIds).map(id => {
        const student = students.find(s => s.id === id);
        if (student) {
          return db.students.save({ ...student, class_id: promotionTargetClassId });
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
      alert(`${selectedPromotionStudentIds.size} students promoted successfully.`);
      setSelectedPromotionStudentIds(new Set());
      setPromotionConfirmData({ ...promotionConfirmData, show: false });
      await refreshData();
    } catch (err: any) {
      alert("Promotion Error: " + err.message);
    } finally {
      setIsPromoting(false);
    }
  };

  const executeStudentSave = async () => {
    setStudentEditConfirm(prev => ({ ...prev, isSaving: true }));
    try {
      const currentYear = new Date().getFullYear();
      const admNo = (editingEntity?.admission_number || `PPIS/${currentYear}/${Math.floor(1000 + Math.random() * 9000)}`).toLowerCase();
      const profileId = editingEntity?.profile_id || editingEntity?.id || crypto.randomUUID();
      const studentId = editingEntity?.id || crypto.randomUUID();

      await db.users.save({ 
        id: profileId, full_name: `${newStudent.first_name} ${newStudent.surname}`, 
        username: admNo, password: editingEntity?.password || newStudent.surname.toLowerCase().trim(), 
        role: UserRole.STUDENT, created_at: editingEntity?.created_at || new Date().toISOString() 
      });

      await db.students.save({ 
        id: studentId, ...newStudent, admission_number: admNo, profile_id: profileId
      });

      setStudentEditConfirm({ show: false, name: '', isSaving: false });
      setShowAddModal(null);
      await refreshData();
    } catch (err: any) { 
      alert("Error: " + err.message); 
      setStudentEditConfirm(prev => ({ ...prev, isSaving: false }));
    }
  };

  const executeDelete = async () => {
    const { type, id } = deleteConfirmation;
    setLoading(true);
    try {
      if (type === 'student') {
        const s = students.find(item => item.id === id);
        if (s?.profile_id) await db.users.remove(s.profile_id);
        await db.students.remove(id);
      } else if (type === 'teacher') await db.users.remove(id);
      else if (type === 'class') await db.classes.remove(id);
      else if (type === 'subject') await db.subjects.remove(id);
      else if (type === 'mapping') await db.teacherSubjects.remove(id);
      setDeleteConfirmation({ ...deleteConfirmation, show: false });
      await refreshData();
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  }

  const promotionSourceStudents = useMemo(() => {
    if (!promotionSourceClassId) return [];
    return students.filter(s => s.class_id === promotionSourceClassId);
  }, [students, promotionSourceClassId]);

  // Activity Bar Component for Chart
  const ActivityBar = ({ label, value, max, colorClass, icon: Icon }: any) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="flex-1 flex flex-col items-center gap-3 group relative">
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 rounded-2xl h-48 relative overflow-hidden border border-slate-100 dark:border-slate-700/50">
          <div 
            className={`absolute bottom-0 left-0 right-0 ${colorClass} transition-all duration-1000 ease-out flex flex-col items-center justify-start pt-2 shadow-inner`}
            style={{ height: `${percentage}%` }}
          >
             <span className="text-[10px] font-black text-white drop-shadow-sm">{value}</span>
          </div>
        </div>
        <div className="flex flex-col items-center text-center">
           <div className={`p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm mb-1 group-hover:scale-110 transition-transform`}>
              <Icon size={14} className="text-slate-500" />
           </div>
           <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600 transition-colors">{label}</p>
        </div>
      </div>
    );
  };

  const ModernExamPermit = ({ student }: { student: Student }) => {
    if (!settingsData) return null;
    const cls = classes.find(c => c.id === student.class_id);
    return (
      <div className="w-full max-w-2xl bg-white border-[6px] border-double border-[#1e1b4b] p-8 font-sans text-black relative overflow-hidden rounded-3xl print:m-0 print:border-4">
        {/* Aesthetic Background Watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <Building2 size={400} />
        </div>

        {/* Header Section */}
        <div className="flex items-center gap-6 mb-8 pb-6 border-b-2 border-slate-100">
          <div className="w-20 h-20 bg-[#1e1b4b] rounded-2xl flex items-center justify-center shadow-lg p-2">
            {settingsData.logo ? <img src={settingsData.logo} alt="Logo" className="w-full h-full object-contain" /> : <Building2 className="text-white" size={32} />}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{settingsData.name}</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] mb-3">{settingsData.motto}</p>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#1e1b4b] text-white rounded-full">
              <Ticket size={12} className="text-amber-400" />
              <span className="text-[9px] font-black uppercase tracking-widest">Examination Permit Card</span>
            </div>
          </div>
        </div>

        {/* Identity Grid */}
        <div className="grid grid-cols-3 gap-6 relative z-10">
          <div className="col-span-2 space-y-6">
            <div className="space-y-1">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Candidate Full Name</p>
              <p className="text-lg font-black uppercase text-slate-800">{student.first_name} {student.surname} {student.middle_name || ''}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Admission Number</p>
                <p className="text-sm font-black font-mono text-blue-600 uppercase">{student.admission_number}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Class Level</p>
                <p className="text-sm font-black uppercase text-slate-800">{cls?.name || '---'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Gender</p>
                <p className="text-sm font-black uppercase text-slate-800">{student.gender}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Academic Year</p>
                <p className="text-sm font-black uppercase text-slate-800">{settingsData.current_session}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between border-l-2 border-slate-100 pl-6">
             <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden">
                <UserIcon size={64} className="text-slate-200" />
                <p className="absolute bottom-2 text-[6px] font-black uppercase tracking-widest text-slate-300">Identity Photo</p>
             </div>
             <div className="w-full text-center space-y-1 mt-4">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Exam Period</p>
                <p className="text-xs font-black uppercase text-[#1e1b4b]">Term {settingsData.current_term}</p>
             </div>
          </div>
        </div>

        {/* Footer & Rules */}
        <div className="mt-8 pt-6 border-t-2 border-slate-100 grid grid-cols-2 gap-8 items-end">
           <div className="space-y-3">
              <p className="text-[7px] font-bold text-slate-400 uppercase leading-relaxed max-w-[220px]">
                This permit must be presented at the examination hall. Candidates without this card may be restricted from sitting for exams.
              </p>
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={12} />
                <span className="text-[8px] font-black uppercase tracking-widest">System Verified Registry</span>
              </div>
           </div>
           <div className="text-right space-y-4">
              <div className="h-0.5 bg-slate-200 w-full" />
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Registry Controller Signature</p>
           </div>
        </div>

        {/* Decorative corner bar */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#1e1b4b] -mr-12 -mt-12 rotate-45" />
      </div>
    );
  };

  const ModernReportCard = ({ student }: { student: Student }) => {
    const res = computeStudentResults(student.id);
    const cls = classes.find(c => c.id === student.class_id);
    const remark = allRemarks.find(rem => rem.student_id === student.id && rem.term === settingsData?.current_term && rem.session === settingsData?.current_session);
    
    if (!settingsData) return null;

    return (
      <div className="bg-white p-10 md:p-14 font-sans text-black w-full max-w-4xl min-h-[1100px] flex flex-col relative overflow-hidden rounded-[1.5rem] border border-slate-100 print:shadow-none print:border-none print:m-0 print:p-8">
        {/* Central Branding Header */}
        <div className="flex flex-col items-center text-center mb-10 relative z-10 text-black">
            <div className="w-20 h-20 rounded-2xl bg-[#1e1b4b] flex items-center justify-center shadow-xl mb-4">
               {settingsData.logo ? (
                  <img src={settingsData.logo} alt="Logo" className="w-12 h-12 object-contain" />
               ) : (
                  <Building2 className="text-white" size={32} />
               )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-black mb-1 leading-none">{settingsData.name}</h1>
            <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-[0.4em] pt-1">Official Academic Terminal Record</p>
            <p className="text-[8px] font-bold text-[#1e1b4b] uppercase tracking-widest mt-2">{settingsData.current_session} Session • Term {settingsData.current_term}</p>
        </div>

        {/* Student Identification Bar */}
        <div className="grid grid-cols-4 gap-0 mb-8 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative z-10 text-black">
            <div className="p-4 border-r border-slate-200">
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</p>
              <p className="text-xs font-semibold text-black uppercase truncate">{student.first_name} {student.surname}</p>
            </div>
            <div className="p-4 border-r border-slate-200">
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Adm Number</p>
              <p className="text-xs font-semibold text-black uppercase font-mono">{student.admission_number}</p>
            </div>
            <div className="p-4 border-r border-slate-200">
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class Level</p>
              <p className="text-xs font-semibold text-black uppercase">{cls?.name || '---'}</p>
            </div>
            <div className="p-4 text-right">
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gender</p>
              <p className="text-xs font-semibold text-black uppercase">{student.gender}</p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-black">
                {subjects.filter(sub => sub.category === cls?.level).map((sub) => {
                  const s = allScores.find(score => score.student_id === student.id && score.subject_id === sub.id && score.term === settingsData.current_term && score.session === settingsData.current_session);
                  const total = (s?.first_ca || 0) + (s?.second_ca || 0) + (s?.exam || 0);
                  const grade = getGrade(total);
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
              <p className="text-xl font-bold tracking-tighter">{res.total.toFixed(0)} <span className="text-[10px] opacity-30">/ {subjects.filter(sub => sub.category === cls?.level).length * 100}</span></p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Average Score</p>
              <p className="text-xl font-bold text-[#1e1b4b] tracking-tighter">{res.average.toFixed(1)}%</p>
            </div>
            <div className="bg-[#eff6ff] p-6 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[7px] font-bold text-blue-500 uppercase tracking-[0.3em] mb-1">Class Position</p>
                <p className="text-xl font-bold text-blue-900 tracking-tighter">{getOrdinal(res.position)}</p>
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
            "{remark?.remark || getAutoRemark(res.average)}"
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
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-4xl font-black dark:text-white uppercase tracking-tighter">Admin <span className="text-blue-600">Dashboard</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Registry Management • {activeTab}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'students' && (
            <button onClick={() => { setEditingEntity(null); setNewStudent({ first_name: '', surname: '', middle_name: '', gender: Gender.MALE, class_id: '', parent_phone: '', parent_address: '', parent_name: '' }); setShowAddModal('student'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Enroll Student</button>
          )}
          {activeTab === 'teachers' && <button onClick={() => { setEditingEntity(null); setNewTeacher({ fullName: '', username: '', password: '', role: UserRole.FORM_TEACHER }); setShowAddModal('teacher'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Add Staff</button>}
          {activeTab === 'classes' && <button onClick={() => { setEditingEntity(null); setNewClass({ name: '', level: ClassLevel.JSS, arm: 'A', form_teacher_id: '' }); setShowAddModal('class'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Create Class</button>}
          {activeTab === 'subjects' && <button onClick={() => { setEditingEntity(null); setNewSubject({ name: '', category: ClassLevel.JSS }); setShowAddModal('subject'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Add Subject</button>}
          {activeTab === 'assignments' && <button onClick={() => { setMapping({ teacherId: '', classId: '', selectedSubjectIds: [] }); setShowAddModal('mapping'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><LinkIcon size={18} /> Assign Subjects</button>}
        </div>
      </header>

      {loading && activeTab !== 'settings' && activeTab !== 'promotion' && activeTab !== 'permits' ? <TableSkeleton /> : (
        <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden min-h-[500px] no-print">
          {activeTab === 'overview' && (
            <div className="p-10 space-y-12">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatsCard title="Total Students" value={stats.students} icon={Users} color="blue" />
                 <StatsCard title="Faculty Staff" value={stats.teachers} icon={GraduationCap} color="green" />
                 <StatsCard title="Active Classes" value={stats.classes} icon={School} color="amber" />
                 <StatsCard title="Subjects" value={stats.subjects} icon={Book} color="purple" />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Registry Fulfillment Chart */}
                  <div className="bg-white dark:bg-slate-800/50 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <Activity className="text-blue-600" size={24} />
                           <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">Registry Fulfillment</h3>
                        </div>
                        <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Term Records</div>
                     </div>
                     
                     <div className="flex items-end justify-around gap-6 pt-4">
                        <ActivityBar label="Recorded" value={stats.totalScores} max={Math.max(stats.totalScores, 20)} colorClass="bg-slate-200 dark:bg-slate-600" icon={FileText} />
                        <ActivityBar label="Published" value={stats.publishedScores} max={Math.max(stats.totalScores, 20)} colorClass="bg-blue-500" icon={Send} />
                        <ActivityBar label="Approved" value={stats.approvedScores} max={Math.max(stats.totalScores, 20)} colorClass="bg-emerald-500" icon={ShieldCheck} />
                     </div>

                     <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl flex items-center justify-between border border-blue-100/50 dark:border-blue-800/30">
                        <div className="flex items-center gap-3">
                           <CheckCircle2 size={20} className="text-blue-600" />
                           <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest">Global Fulfillment Rate</p>
                        </div>
                        <p className="text-xl font-black text-blue-900 dark:text-blue-100">
                           {stats.totalScores > 0 ? ((stats.approvedScores / stats.totalScores) * 100).toFixed(0) : 0}%
                        </p>
                     </div>
                  </div>

                  {/* Institutional Breakdown Chart */}
                  <div className="bg-white dark:bg-slate-800/50 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <PieChart className="text-purple-600" size={24} />
                           <h3 className="text-lg font-black uppercase tracking-tight dark:text-white">Growth Metrics</h3>
                        </div>
                     </div>

                     <div className="space-y-6 pt-4">
                        {[
                          { label: 'Learner Base', val: stats.students, max: Math.max(stats.students, 500), color: 'bg-blue-500', icon: Users },
                          { label: 'Faculty Body', val: stats.teachers, max: Math.max(stats.students, 500), color: 'bg-emerald-500', icon: GraduationCap },
                          { label: 'Active Classes', val: stats.classes, max: Math.max(stats.students, 500), color: 'bg-amber-500', icon: School },
                          { label: 'Curriculum', val: stats.subjects, max: Math.max(stats.students, 500), color: 'bg-purple-500', icon: Book },
                        ].map((item, idx) => (
                          <div key={idx} className="space-y-2">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                <div className="flex items-center gap-2">
                                   <item.icon size={12} className="text-slate-400" />
                                   <span className="text-slate-500">{item.label}</span>
                                </div>
                                <span className="dark:text-white">{item.val}</span>
                             </div>
                             <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-full h-2.5 overflow-hidden border dark:border-slate-700">
                                <div 
                                  className={`${item.color} h-full rounded-full transition-all duration-1000 ease-out`}
                                  style={{ width: `${(item.val / item.max) * 100}%` }}
                                />
                             </div>
                          </div>
                        ))}
                     </div>

                     <div className="flex items-center gap-4 text-slate-400 mt-auto pt-4">
                        <Sparkles size={16} className="text-amber-500 animate-pulse" />
                        <p className="text-[9px] font-bold uppercase tracking-widest">Insights update automatically across all registry cycles.</p>
                     </div>
                  </div>
               </div>
               
               <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2.5rem] border dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black dark:text-white uppercase tracking-tight">Active Academic Cycle</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{settingsData?.current_session || '---'} • Term {settingsData?.current_term || '-'}</p>
                    </div>
                  </div>
                  <button onClick={() => onTabChange('settings')} className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Configure Session</button>
               </div>
            </div>
          )}

          {activeTab === 'promotion' && (
            <div className="p-10 space-y-10 animate-in fade-in duration-500">
               <div className="grid md:grid-cols-2 gap-8 bg-slate-50 dark:bg-slate-900/40 p-10 rounded-[3rem] border dark:border-slate-700">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Source Class (Current Location)</label>
                    <select className="w-full p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={promotionSourceClassId} onChange={e => { setPromotionSourceClassId(e.target.value); setSelectedPromotionStudentIds(new Set()); }}>
                       <option value="">Select current class...</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Target Class (Promotion Destination)</label>
                    <select className="w-full p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={promotionTargetClassId} onChange={e => setPromotionTargetClassId(e.target.value)}>
                       <option value="">Select target class...</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
               </div>

               {promotionSourceClassId && (
                 <div className="space-y-6">
                    <div className="flex items-center justify-between px-6">
                       <h3 className="text-xl font-black dark:text-white uppercase tracking-tighter">Student Selection Registry</h3>
                       <div className="flex gap-4">
                          <button onClick={() => setSelectedPromotionStudentIds(new Set(promotionSourceStudents.map(s => s.id)))} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Select All</button>
                          <button onClick={() => setSelectedPromotionStudentIds(new Set())} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:underline">Clear Selection</button>
                       </div>
                    </div>
                    <div className="border dark:border-slate-700 rounded-[2.5rem] overflow-hidden">
                       <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-slate-900/50">
                             <tr>
                                <th className="px-10 py-5 w-16">
                                   <div className="w-5 h-5" />
                                </th>
                                <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Student Identity</th>
                                <th className="px-10 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Performance (Avg)</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                             {promotionSourceStudents.map(s => {
                               const isSelected = selectedPromotionStudentIds.has(s.id);
                               const res = computeStudentResults(s.id);
                               return (
                                 <tr key={s.id} onClick={() => {
                                   const next = new Set(selectedPromotionStudentIds);
                                   if(isSelected) next.delete(s.id);
                                   else next.add(s.id);
                                   setSelectedPromotionStudentIds(next);
                                 }} className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50/50'}`}>
                                    <td className="px-10 py-4">
                                       <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-200 dark:border-slate-600'}`}>
                                          {isSelected && <Check size={14} className="text-white" />}
                                       </div>
                                    </td>
                                    <td className="px-10 py-4">
                                       <p className="font-bold uppercase dark:text-white">{s.surname}, {s.first_name}</p>
                                       <p className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">{s.admission_number}</p>
                                    </td>
                                    <td className="px-10 py-4">
                                       <span className={`px-4 py-1.5 rounded-xl font-black text-[9px] tracking-widest uppercase ${res.average >= 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                         {res.average.toFixed(1)}%
                                       </span>
                                    </td>
                                 </tr>
                               );
                             })}
                          </tbody>
                       </table>
                    </div>
                    <button disabled={selectedPromotionStudentIds.size === 0 || !promotionTargetClassId} onClick={() => setPromotionConfirmData({ show: true, count: selectedPromotionStudentIds.size, targetClassName: classes.find(c => c.id === promotionTargetClassId)?.name || '---' })} className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-30 flex items-center justify-center gap-4">
                       <TrendingUp size={20} />
                       Promote {selectedPromotionStudentIds.size} Students to {classes.find(c => c.id === promotionTargetClassId)?.name || '---'}
                    </button>
                 </div>
               )}
            </div>
          )}

          {(activeTab === 'students' || activeTab === 'teachers' || activeTab === 'classes' || activeTab === 'subjects' || activeTab === 'results' || activeTab === 'assignments' || activeTab === 'permits') && (
            <div className="overflow-x-auto">
               <div className="p-8 border-b dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30 dark:bg-slate-900/20">
                  <div className="relative w-full md:w-80">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder={`Search in ${activeTab}...`} className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-sm outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  {(activeTab === 'students' || activeTab === 'results' || activeTab === 'permits') && (
                    <select className="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-700 text-xs font-black uppercase outline-none" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                       <option value="">Filter by Class...</option>
                       {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
               </div>

               <table className="w-full text-left table-fixed">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <th className={`py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 ${activeTab === 'results' ? 'px-8 w-[40%]' : 'px-10'}`}>{activeTab === 'assignments' ? 'Faculty Member' : 'Identity & ID'}</th>
                      <th className={`py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 ${activeTab === 'results' ? 'px-8 w-[40%]' : 'px-10'}`}>{activeTab === 'assignments' ? 'Course & Class' : 'Primary Detail'}</th>
                      <th className={`py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right ${activeTab === 'results' ? 'px-8 w-[20%]' : 'px-10'}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                     {activeTab === 'students' && filteredStudents.map(s => (
                       <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5">
                            <p className="font-bold uppercase dark:text-white truncate">{s.surname}, {s.first_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{s.admission_number}</p>
                         </td>
                         <td className="px-10 py-5">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{classes.find(c => c.id === s.class_id)?.name || 'Unassigned'}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{s.gender}</p>
                         </td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(s); setNewStudent({ first_name: s.first_name, surname: s.surname, middle_name: s.middle_name || '', gender: s.gender, class_id: s.class_id, parent_phone: s.parent_phone || '', parent_address: s.parent_address || '', parent_name: s.parent_name || '' }); setShowAddModal('student'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'student', id: s.id, title: 'Delete Record', message: `Permantly erase ${s.first_name} ${s.surname}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}

                     {activeTab === 'permits' && filteredStudents.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                           <td className="px-10 py-5">
                              <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs uppercase shadow-sm">
                                    {s.first_name[0]}{s.surname[0]}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="font-bold uppercase dark:text-white leading-tight truncate">{s.surname}, {s.first_name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase truncate">{s.admission_number}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-10 py-5">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{classes.find(c => c.id === s.class_id)?.name || 'Unassigned'}</p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{s.gender} • Official Entry</p>
                           </td>
                           <td className="px-10 py-5 text-right">
                              <button onClick={() => setViewingPermitStudent(s)} className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg active:scale-[0.98]">
                                 <Eye size={16} /> Generate Permit
                              </button>
                           </td>
                        </tr>
                     ))}

                     {activeTab === 'teachers' && teachers.filter(t => t.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                       <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5">
                            <p className="font-bold uppercase dark:text-white truncate">{t.full_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">ID: {t.username}</p>
                         </td>
                         <td className="px-10 py-5">
                            <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.role.replace('_', ' ')}</span>
                         </td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(t); setNewTeacher({ fullName: t.full_name, username: t.username, password: '', role: t.role }); setShowAddModal('teacher'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'teacher', id: t.id, title: 'Revoke Access', message: `Remove portal access for ${t.full_name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}

                     {activeTab === 'classes' && classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                       <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                         <td className="px-10 py-5">
                            <p className="font-bold uppercase dark:text-white">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Lvl: {c.level} | Arm: {c.arm}</p>
                         </td>
                         <td className="px-10 py-5">
                            <div className="flex flex-col">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                 {teachers.find(t => t.id === c.form_teacher_id)?.full_name || 'Vacant'}
                              </p>
                              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Designated Form Teacher</p>
                            </div>
                         </td>
                         <td className="px-10 py-5 text-right space-x-2">
                            <button onClick={() => { setEditingEntity(c); setNewClass({ name: c.name, level: c.level, arm: c.arm, form_teacher_id: c.form_teacher_id || '' }); setShowAddModal('class'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                            <button onClick={() => setDeleteConfirmation({ show: true, type: 'class', id: c.id, title: 'Decommission Class', message: `Permantly remove ${c.name} from registry?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                         </td>
                       </tr>
                     ))}

                     {activeTab === 'subjects' && subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-10 py-5">
                             <p className="font-bold uppercase dark:text-white truncate">{s.name}</p>
                             <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">ID: {s.id.split('-')[0]}</p>
                          </td>
                          <td className="px-10 py-5">
                             <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${s.category === ClassLevel.JSS ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                {s.category === ClassLevel.JSS ? 'Junior Secondary' : 'Senior Secondary'}
                             </span>
                          </td>
                          <td className="px-10 py-5 text-right space-x-2">
                             <button onClick={() => { setEditingEntity(s); setNewSubject({ name: s.name, category: s.category }); setShowAddModal('subject'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></button>
                             <button onClick={() => setDeleteConfirmation({ show: true, type: 'subject', id: s.id, title: 'Delete Subject', message: `Remove ${s.name} from the curriculum?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                     ))}

                     {activeTab === 'results' && filteredStudents.map(s => {
                        const res = computeStudentResults(s.id);
                        const isHighPerf = res.average >= 70;
                        const isMidPerf = res.average >= 50;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-all group">
                            <td className="px-8 py-6">
                                <div className="flex items-center gap-4 overflow-hidden">
                                  <div className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-black uppercase ${isHighPerf ? 'bg-emerald-100 text-emerald-600' : isMidPerf ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                    {s.first_name[0]}{s.surname[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-black uppercase dark:text-white leading-tight truncate">{s.surname}, {s.first_name}</p>
                                    <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase mt-1 truncate">{s.admission_number}</p>
                                  </div>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest truncate">{classes.find(c => c.id === s.class_id)?.name || 'Unassigned'}</p>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{res.count} Recorded</p>
                                  </div>
                                  <div className="flex flex-col items-center shrink-0">
                                     <span className={`px-4 py-1.5 rounded-xl font-black text-[11px] tracking-widest uppercase ${isHighPerf ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : isMidPerf ? 'bg-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-rose-500 text-white shadow-lg shadow-rose-100 dark:shadow-none'}`}>
                                       {res.average.toFixed(1)}%
                                     </span>
                                  </div>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-right space-x-1">
                                <button onClick={() => setViewingResultStudent(s)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-2xl transition-all" title="View Transcript"><Eye size={20} /></button>
                                <button onClick={() => handlePrintStudent(s)} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-2xl transition-all" title="Print Academic Report"><Printer size={20} /></button>
                            </td>
                          </tr>
                        );
                     })}

                     {activeTab === 'assignments' && teacherSubjects.map(ts => {
                        const teacher = teachers.find(t => t.id === ts.teacher_id);
                        const subject = subjects.find(s => s.id === ts.subject_id);
                        const schoolClass = classes.find(c => c.id === ts.class_id);
                        return (
                          <tr key={ts.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-10 py-5">
                              <p className="font-bold uppercase dark:text-white truncate">{teacher?.full_name || 'Legacy ID: ' + ts.teacher_id}</p>
                              <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{teacher?.username || '---'}</p>
                            </td>
                            <td className="px-10 py-5">
                              <div className="flex flex-col">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{schoolClass?.name || 'Unassigned'}</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase mt-1 truncate">{subject?.name || 'Unknown'}</p>
                              </div>
                            </td>
                            <td className="px-10 py-5 text-right">
                              <button onClick={() => setDeleteConfirmation({ show: true, type: 'mapping', id: ts.id, title: 'Revoke Assignment', message: `Remove assignment for ${teacher?.full_name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                     })}

                     {/* Empty States */}
                     {activeTab === 'students' && students.length === 0 && (
                        <tr><td colSpan={3} className="py-20 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">No students found in registry</td></tr>
                     )}
                     {activeTab === 'permits' && filteredStudents.length === 0 && (
                        <tr><td colSpan={3} className="py-20 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">No student records found for permit generation</td></tr>
                     )}
                     {activeTab === 'assignments' && teacherSubjects.length === 0 && (
                        <tr><td colSpan={3} className="py-20 text-center text-slate-400 font-black uppercase tracking-widest text-[10px]">No teaching assignments recorded</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
          )}

          {activeTab === 'settings' && settingsData && (
             <div className="p-10 max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3">
                   <SettingsIcon size={24} className="text-blue-600" />
                   <h2 className="text-2xl font-black uppercase tracking-tighter dark:text-white">Institution Configuration</h2>
                </div>
                
                <form onSubmit={handleUpdateSettings} className="space-y-12">
                   {/* School Identity */}
                   <div className="space-y-8 p-10 bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border dark:border-slate-700 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-blue-500" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Identity & Branding</h3>
                      </div>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">School Official Name</label>
                          <input required className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={settingsData.name} onChange={e => setSettingsData({...settingsData, name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Institutional Motto</label>
                          <input required className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={settingsData.motto} onChange={e => setSettingsData({...settingsData, motto: e.target.value})} />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><ImageIcon size={12} /> Institutional Logo</label>
                          <div className="relative group">
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-all group-hover:border-blue-500 shadow-sm">
                              <div className="w-14 h-14 rounded-xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 flex items-center justify-center overflow-hidden">
                                {settingsData.logo ? <img src={settingsData.logo} alt="Logo Preview" className="w-full h-full object-contain p-1" /> : <ImageIcon className="text-slate-300" size={24} />}
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upload Logo</p>
                                <p className="text-[9px] text-slate-400 font-medium">Click to select (under 2MB)</p>
                              </div>
                              <Upload size={18} className="text-blue-500" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-2"><Palette size={12} /> Interface Theme Color</label>
                          <div className="flex gap-3">
                            <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-2xl border-4 border-white dark:border-slate-800 shadow-md">
                              <input type="color" className="absolute inset-[-50%] w-[200%] h-[200%] cursor-pointer p-0 border-none outline-none" value={settingsData.primary_color} onChange={e => setSettingsData({...settingsData, primary_color: e.target.value})} />
                            </div>
                            <input className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none uppercase font-mono tracking-widest" value={settingsData.primary_color} onChange={e => setSettingsData({...settingsData, primary_color: e.target.value})} />
                          </div>
                        </div>
                      </div>
                   </div>

                   {/* Academic Period */}
                   <div className="space-y-8 p-10 bg-slate-50 dark:bg-slate-900/50 rounded-[3rem] border dark:border-slate-700 shadow-inner">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-amber-500" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Academic Period</h3>
                      </div>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Active Session (YYYY/YYYY)</label>
                          <input required placeholder="e.g. 2025/2026" className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={settingsData.current_session} onChange={e => setSettingsData({...settingsData, current_session: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Current Term</label>
                          <select className="w-full p-4 rounded-2xl bg-white dark:bg-slate-800 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={settingsData.current_term} onChange={e => setSettingsData({...settingsData, current_term: Number(e.target.value) as 1|2|3})}>
                             <option value={1}>1st Academic Term</option>
                             <option value={2}>2nd Academic Term</option>
                             <option value={3}>3rd Academic Term</option>
                          </select>
                        </div>
                      </div>
                   </div>

                   <button disabled={isUpdatingSettings} type="submit" className="w-full py-6 bg-blue-600 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl flex items-center justify-center gap-4 transition-all hover:scale-[1.01] hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50">
                      {isUpdatingSettings ? (
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save size={20} />
                          Commit System Synchronization
                        </>
                      )}
                   </button>
                </form>
             </div>
          )}
        </div>
      )}

      {/* Transcript Preview Modal - ALIGNED WITH STUDENT DASHBOARD */}
      {viewingResultStudent && settingsData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4 md:p-10 no-print">
           <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-5xl h-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-slate-100 dark:border-slate-700">
              {/* Header Strip */}
              <div className="px-10 py-8 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-[#1e1b4b] rounded-2xl flex items-center justify-center shadow-lg">
                     {settingsData.logo ? <img src={settingsData.logo} alt="Logo" className="w-8 h-8 object-contain" /> : <Building2 className="text-white" size={28} />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none mb-1">{settingsData.name}</h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Institutional Registry • Verified Academic Record</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => { setViewingResultStudent(null); handlePrintStudent(viewingResultStudent); }} className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
                    <Printer size={18} /> Print Record
                  </button>
                  <button onClick={() => setViewingResultStudent(null)} className="p-3 hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={24}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white">
                <div className="scale-90 md:scale-100 origin-top">
                   <ModernReportCard student={viewingResultStudent} />
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Exam Permit Preview Modal */}
      {viewingPermitStudent && settingsData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4 md:p-10 no-print">
           <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-3xl h-fit max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-slate-100 dark:border-slate-700">
              {/* Header Strip */}
              <div className="px-10 py-8 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-[#1e1b4b] rounded-xl flex items-center justify-center shadow-lg">
                     <Ticket className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none mb-1">Permit Preview</h2>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Institutional Registry • Verified Identity</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => { setViewingPermitStudent(null); handlePrintPermit(viewingPermitStudent); }} className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl">
                    <Printer size={18} /> Print Permit
                  </button>
                  <button onClick={() => setViewingPermitStudent(null)} className="p-3 hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={24}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 bg-white flex items-center justify-center">
                <ModernExamPermit student={viewingPermitStudent} />
              </div>
           </div>
        </div>
      )}

      {/* Report Spooling View (Print Only) */}
      {selectedReportStudent && settingsData && (
         <div className="print-only fixed inset-0 bg-white z-[999] p-0 overflow-y-auto">
            <ModernReportCard student={selectedReportStudent} />
         </div>
      )}

      {/* Exam Permit Spooling View (Print Only) */}
      {selectedPermitStudent && settingsData && (
         <div className="print-only fixed inset-0 bg-white z-[999] p-10 flex items-center justify-center">
            <ModernExamPermit student={selectedPermitStudent} />
         </div>
      )}

      {/* Modal Overlays (Enrollment, Staff, etc) */}
      {showAddModal === 'student' && (
         <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Update Registry' : 'Enroll Student'}</h2>
                  <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
               </div>
               <form onSubmit={(e) => { e.preventDefault(); handleAddStudent(e); }} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                     <input required placeholder="Surname" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newStudent.surname} onChange={e => setNewStudent({...newStudent, surname: e.target.value})} />
                     <input required placeholder="First Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                     <input placeholder="Middle Name (Optional)" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newStudent.middle_name} onChange={e => setNewStudent({...newStudent, middle_name: e.target.value})} />
                     <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value as Gender})}>
                        <option value={Gender.MALE}>Male</option>
                        <option value={Gender.FEMALE}>Female</option>
                     </select>
                  </div>
                  <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold" value={newStudent.class_id} onChange={e => setNewStudent({...newStudent, class_id: e.target.value})}>
                     <option value="">Assign to Class...</option>
                     {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  
                  <div className="border-t dark:border-slate-700 pt-6 space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Parent / Guardian Information</p>
                    <div className="grid md:grid-cols-2 gap-4">
                       <input placeholder="Parent's Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newStudent.parent_name} onChange={e => setNewStudent({...newStudent, parent_name: e.target.value})} />
                       <input placeholder="Parent's Phone" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none" value={newStudent.parent_phone} onChange={e => setNewStudent({...newStudent, parent_phone: e.target.value})} />
                    </div>
                    <textarea placeholder="Parent's Residential Address" rows={2} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none resize-none" value={newStudent.parent_address} onChange={e => setNewStudent({...newStudent, parent_address: e.target.value})} />
                  </div>
                  
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Confirm Enrollment</button>
               </form>
            </div>
         </div>
      )}

      {showAddModal === 'teacher' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Update Staff' : 'Add Faculty Member'}</h2>
              <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleSaveTeacher} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Full Legal Name</label>
                <input required placeholder="e.g. John Doe" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newTeacher.fullName} onChange={e => setNewTeacher({...newTeacher, fullName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Portal Username / ID</label>
                <input required placeholder="e.g. jdoe_staff" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} />
              </div>
              {!editingEntity && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Initial Password</label>
                  <input required type="password" placeholder="••••••••" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Institutional Role</label>
                <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newTeacher.role} onChange={e => setNewTeacher({...newTeacher, role: e.target.value as UserRole})}>
                   <option value={UserRole.FORM_TEACHER}>Form Master / Teacher</option>
                   <option value={UserRole.ADMIN}>Administrative Staff</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                {loading ? 'Processing...' : (editingEntity ? 'Confirm Updates' : 'Add to Faculty')}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddModal === 'class' && (
         <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Update Class' : 'Create Class'}</h2>
                  <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
               </div>
               <form onSubmit={handleSaveClass} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Classroom Name</label>
                    <input required placeholder="e.g. JSS 1A" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Level</label>
                      <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newClass.level} onChange={e => setNewClass({...newClass, level: e.target.value as ClassLevel})}>
                         <option value={ClassLevel.JSS}>Junior Secondary</option>
                         <option value={ClassLevel.SS}>Senior Secondary</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Arm / Section</label>
                      <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newClass.arm} onChange={e => setNewClass({...newClass, arm: e.target.value as 'A' | 'B'})}>
                         <option value="A">Arm A</option>
                         <option value="B">Arm B</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Form Master Designation</label>
                    <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newClass.form_teacher_id} onChange={e => setNewClass({...newClass, form_teacher_id: e.target.value})}>
                       <option value="">Select Staff...</option>
                       {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                    {loading ? 'Processing...' : (editingEntity ? 'Confirm Updates' : 'Establish Class')}
                  </button>
               </form>
            </div>
         </div>
      )}

      {showAddModal === 'subject' && (
         <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
               <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter">{editingEntity ? 'Update Subject' : 'Add Subject'}</h2>
                  <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
               </div>
               <form onSubmit={handleSaveSubject} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject Name</label>
                    <input required placeholder="e.g. Further Mathematics" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Curriculum Category</label>
                    <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all shadow-sm" value={newSubject.category} onChange={e => setNewSubject({...newSubject, category: e.target.value as ClassLevel})}>
                       <option value={ClassLevel.JSS}>Junior Secondary (JSS)</option>
                       <option value={ClassLevel.SS}>Senior Secondary (SS)</option>
                    </select>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                    {loading ? 'Processing...' : (editingEntity ? 'Confirm Updates' : 'Add Subject to Curriculum')}
                  </button>
               </form>
            </div>
         </div>
      )}

      {/* Mapping Modal (Teaching Assignments) */}
      {showAddModal === 'mapping' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-3xl font-black uppercase tracking-tighter">Teaching Assignments</h2>
               <button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={24}/></button>
            </div>
            <form onSubmit={handleBulkMapping} className="space-y-6">
               <div className="grid md:grid-cols-2 gap-4">
                  <select required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold outline-none" value={mapping.teacherId} onChange={e => setMapping({...mapping, teacherId: e.target.value})}>
                     <option value="">Choose Staff...</option>
                     {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                  <select required className="w-full p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border font-bold outline-none" value={mapping.classId} onChange={e => setMapping({...mapping, classId: e.target.value})}>
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

      {/* Confirmation Modals */}
      {studentEditConfirm.show && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-10 flex flex-col items-center text-center gap-4">
              <div className="p-5 bg-blue-600 text-white rounded-[2rem] shadow-xl mb-2"><Edit2 size={48} /></div>
              <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400 uppercase tracking-tighter">Commit Registry Update</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">Overwrite existing records for <span className="text-blue-600 font-black">{studentEditConfirm.name}</span>?</p>
            </div>
            <div className="p-10 flex gap-4">
               <button onClick={() => setStudentEditConfirm({show: false, name: '', isSaving: false})} className="flex-1 py-4.5 bg-slate-100 dark:bg-slate-700 dark:text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">Go Back</button>
               <button disabled={studentEditConfirm.isSaving} onClick={executeStudentSave} className="flex-1 py-4.5 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-blue-200">
                  {studentEditConfirm.isSaving ? 'Syncing...' : 'Commit Changes'}
               </button>
            </div>
          </div>
        </div>
      )}

      {promotionConfirmData.show && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-10 flex flex-col items-center text-center gap-4">
              <div className="p-5 bg-blue-600 text-white rounded-[2rem] shadow-xl mb-2"><TrendingUp size={48} /></div>
              <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400 uppercase tracking-tighter">Confirm Academic Promotion</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">Are you sure you want to promote <span className="text-blue-600 font-black">{promotionConfirmData.count}</span> students to <span className="text-blue-600 font-black">{promotionConfirmData.targetClassName}</span>?</p>
            </div>
            <div className="p-10 flex gap-4">
               <button disabled={isPromoting} onClick={() => setPromotionConfirmData({...promotionConfirmData, show: false})} className="flex-1 py-4.5 bg-slate-100 dark:bg-slate-700 dark:text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">Review Again</button>
               <button disabled={isPromoting} onClick={executePromotion} className="flex-1 py-4.5 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">
                  {isPromoting ? 'Promoting...' : 'Confirm & Execute'}
               </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 dark:bg-rose-900/20 p-10 flex flex-col items-center text-center gap-4">
              <div className="p-5 bg-rose-500 text-white rounded-[2rem] shadow-xl mb-2"><AlertTriangle size={48} /></div>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 uppercase tracking-tighter">Registry Caution</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 leading-relaxed">{deleteConfirmation.message}</p>
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