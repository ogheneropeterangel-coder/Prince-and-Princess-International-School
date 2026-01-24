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
  Download, FileSpreadsheet, Upload, FileType, FileText, Printer, Eye, Award, BarChart3, Fingerprint, Crown, TrendingUp, CheckCircle2, Clock, Send, ShieldCheck, ShieldAlert, Activity, PieChart, Ticket, Contact, ChevronRight, FileDown, FileUp
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
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<any | null>(null);
  const [selectedReportStudent, setSelectedReportStudent] = useState<Student | null>(null);
  const [selectedPermitStudent, setSelectedPermitStudent] = useState<Student | null>(null);
  const [isBulkPrintingPermits, setIsBulkPrintingPermits] = useState(false);
  const [viewingResultStudent, setViewingResultStudent] = useState<Student | null>(null);
  const [viewingPermitStudent, setViewingPermitStudent] = useState<Student | null>(null);
  const [viewingStudentProfile, setViewingStudentProfile] = useState<Student | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  
  // Selection States
  const [selectedPermitStudentIds, setSelectedPermitStudentIds] = useState<string[]>([]);
  
  // Assignment Filtering State
  const [filterTeacherId, setFilterTeacherId] = useState<string>('');
  const [filterAssignmentClassId, setFilterAssignmentClassId] = useState<string>('');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  
  // Promotion State
  const [sourceClassId, setSourceClassId] = useState<string>('');
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [selectedPromotionStudentIds, setSelectedPromotionStudentIds] = useState<string[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    show: boolean;
    type: string;
    id: string;
    title: string;
    message: string;
  }>({ show: false, type: '', id: '', title: '', message: '' });

  const [settingsData, setSettingsData] = useState<SchoolSettings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const published = scoresArray.filter(s => s.is_published).length;
      const approved = scoresArray.filter(s => s.is_approved_by_form_teacher).length;

      setStats({ 
        students: (stu as Student[]).length, 
        teachers: (profs as User[]).filter(u => u.role !== UserRole.STUDENT).length, 
        classes: (cls as SchoolClass[]).length, 
        subjects: (subs as Subject[]).length,
        totalScores: scoresArray.length,
        publishedScores: published,
        approvedScores: approved
      });
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
      const fullName = `${s.first_name} ${s.surname} ${s.middle_name || ''}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || s.admission_number.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = !selectedClassId || s.class_id === selectedClassId;
      return matchesSearch && matchesClass;
    });
  }, [students, searchTerm, selectedClassId]);

  const filteredMappings = useMemo(() => {
    return teacherSubjects.filter(ts => {
      const teacher = teachers.find(t => t.id === ts.teacher_id);
      const subject = subjects.find(s => s.id === ts.subject_id);
      const cls = classes.find(c => c.id === ts.class_id);
      
      const matchesTeacher = !filterTeacherId || ts.teacher_id === filterTeacherId;
      const matchesClass = !filterAssignmentClassId || ts.class_id === filterAssignmentClassId;
      const matchesSubject = !filterSubjectId || ts.subject_id === filterSubjectId;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        (teacher?.full_name || '').toLowerCase().includes(searchLower) ||
        (subject?.name || '').toLowerCase().includes(searchLower) ||
        (cls?.name || '').toLowerCase().includes(searchLower);

      return matchesTeacher && matchesClass && matchesSubject && matchesSearch;
    });
  }, [teacherSubjects, filterTeacherId, filterAssignmentClassId, filterSubjectId, searchTerm, teachers, subjects, classes]);

  const studentsInSourceClass = useMemo(() => {
    if (!sourceClassId) return [];
    return students.filter(s => s.class_id === sourceClassId);
  }, [students, sourceClassId]);

  const selectedPermitStudents = useMemo(() => {
    return students.filter(s => selectedPermitStudentIds.includes(s.id));
  }, [students, selectedPermitStudentIds]);

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

  useEffect(() => {
    if (selectedReportStudent || selectedPermitStudent || isBulkPrintingPermits) {
      const timer = setTimeout(() => {
        window.print();
        setSelectedReportStudent(null);
        setSelectedPermitStudent(null);
        setIsBulkPrintingPermits(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedReportStudent, selectedPermitStudent, isBulkPrintingPermits]);

  const handlePrintStudent = (student: Student) => setSelectedReportStudent(student);

  const handleBulkPrintPermits = () => {
    if (selectedPermitStudentIds.length === 0) {
      alert("Please select at least one student to download permits.");
      return;
    }
    setIsBulkPrintingPermits(true);
  };
  
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();
      const admNo = (editingEntity?.admission_number || `PPIS/${currentYear}/${Math.floor(1000 + Math.random() * 9000)}`).toLowerCase();
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
        ...newStudent, 
        admission_number: admNo, 
        profile_id: profileId 
      });

      setShowAddModal(null);
      await refreshData();
      alert("Student record synchronized successfully.");
    } catch (err: any) { 
      alert("Registry Error: " + err.message); 
    } finally {
      setLoading(false);
    }
  };

  const handleBulkExport = () => {
    if (students.length === 0) return;
    const headers = ['Admission Number', 'First Name', 'Surname', 'Middle Name', 'Gender', 'Class', 'Parent Name', 'Parent Phone', 'Parent Address'];
    const rows = students.map(s => {
      const clsName = classes.find(c => c.id === s.class_id)?.name || 'N/A';
      return [
        s.admission_number,
        s.first_name,
        s.surname,
        s.middle_name || '',
        s.gender,
        clsName,
        s.parent_name || '',
        s.parent_phone || '',
        s.parent_address || ''
      ].map(val => `"${val}"`).join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ppisms_students_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleDownloadTemplate = () => {
    const headers = ['first_name', 'surname', 'middle_name', 'gender', 'class_name', 'parent_name', 'parent_phone', 'parent_address'];
    const example = ['John', 'Doe', 'Quincy', 'Male', 'JSS 1A', 'Jane Doe', '08012345678', 'No. 1 School Road'];
    const csv = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ppisms_student_import_template.csv`;
    link.click();
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error("File is empty or missing data rows.");

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dataRows = lines.slice(1);
      
      const currentYear = new Date().getFullYear();
      let importedCount = 0;

      for (const row of dataRows) {
        const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const rowData: any = {};
        headers.forEach((h, i) => rowData[h] = values[i]);

        if (!rowData.first_name || !rowData.surname || !rowData.class_name) continue;

        const targetClass = classes.find(c => c.name.toLowerCase() === rowData.class_name.toLowerCase());
        if (!targetClass) {
          console.warn(`Class not found: ${rowData.class_name}. Skipping student ${rowData.first_name}.`);
          continue;
        }

        const profileId = crypto.randomUUID();
        const studentId = crypto.randomUUID();
        const admNo = `PPIS/${currentYear}/${Math.floor(1000 + Math.random() * 9000)}`.toLowerCase();

        await db.users.save({ 
          id: profileId, 
          full_name: `${rowData.first_name} ${rowData.surname}`, 
          username: admNo, 
          password: rowData.surname.toLowerCase().trim(),
          role: UserRole.STUDENT, 
          created_at: new Date().toISOString() 
        });

        await db.students.save({ 
          id: studentId, 
          first_name: rowData.first_name,
          surname: rowData.surname,
          middle_name: rowData.middle_name || '',
          gender: (rowData.gender?.toLowerCase() === 'female' ? Gender.FEMALE : Gender.MALE),
          class_id: targetClass.id,
          admission_number: admNo, 
          profile_id: profileId,
          parent_name: rowData.parent_name || '',
          parent_phone: rowData.parent_phone || '',
          parent_address: rowData.parent_address || ''
        });

        importedCount++;
      }

      alert(`Successfully imported ${importedCount} students.`);
      await refreshData();
    } catch (err: any) {
      alert("Import Error: " + err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
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
      alert("Staff record synchronized successfully.");
    } catch (err: any) { 
      alert("Staff Registry Error: " + err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await db.classes.save({ id: editingEntity?.id || crypto.randomUUID(), ...newClass });
      setShowAddModal(null);
      await refreshData();
    } catch (err: any) { alert("Registry Sync Error: " + err.message); } finally { setLoading(false); }
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await db.subjects.save({ id: editingEntity?.id || crypto.randomUUID(), ...newSubject });
      setShowAddModal(null);
      await refreshData();
    } catch (err: any) { alert("Registry Sync Error: " + err.message); } finally { setLoading(false); }
  };

  const handleBulkMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapping.teacherId || !mapping.classId || mapping.selectedSubjectIds.length === 0) {
      alert("Please select teacher, class, and at least one subject.");
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
      alert("Subjects assigned successfully.");
    } catch (err: any) { 
      alert("Assignment Error: " + err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleBulkPromotion = async () => {
    if (!targetClassId || selectedPromotionStudentIds.length === 0) {
      alert("Please select a destination class and at least one student.");
      return;
    }

    if (!confirm(`Are you sure you want to promote ${selectedPromotionStudentIds.length} students to ${classes.find(c => c.id === targetClassId)?.name}?`)) {
      return;
    }

    setIsPromoting(true);
    try {
      const promises = selectedPromotionStudentIds.map(id => {
        const student = students.find(s => s.id === id);
        if (!student) return Promise.resolve();
        return db.students.save({ ...student, class_id: targetClassId });
      });
      await Promise.all(promises);
      alert("Selected students promoted successfully.");
      setSelectedPromotionStudentIds([]);
      await refreshData();
    } catch (err: any) {
      alert("Promotion Error: " + err.message);
    } finally {
      setIsPromoting(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 512000) {
      alert("Image is too large. Please select a logo under 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (settingsData) {
        setSettingsData({ ...settingsData, logo: reader.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsData) return;
    setIsSavingSettings(true);
    try {
      await db.settings.update(settingsData);
      alert("Institutional settings synchronized successfully.");
    } catch (err: any) {
      alert("Settings Registry Error: " + err.message);
    } finally {
      setIsSavingSettings(false);
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

  const ModernExamPermit = ({ student }: { student: Student }) => {
    if (!settingsData) return null;
    const cls = classes.find(c => c.id === student.class_id);
    return (
      <div className="bg-white p-8 border-4 border-slate-900 rounded-[2rem] w-[400px] h-[600px] flex flex-col items-center justify-between text-slate-900 font-sans mx-auto shadow-2xl relative overflow-hidden text-black">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-bl-full opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-50 rounded-tr-full opacity-50" />
        
        <div className="text-center z-10 w-full space-y-2">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl mx-auto flex items-center justify-center mb-2">
            {settingsData.logo ? <img src={settingsData.logo} className="w-10 h-10 object-contain" /> : <Building2 className="text-white" size={24} />}
          </div>
          <h2 className="text-lg font-black uppercase leading-tight tracking-tighter text-slate-900">{settingsData.name}</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{settingsData.current_session} Session • Term {settingsData.current_term}</p>
        </div>

        <div className="w-full bg-slate-900 text-white py-2 text-center text-xs font-black uppercase tracking-[0.2em] rounded-lg">
          Official Exam Permit
        </div>

        <div className="w-full space-y-4 z-10 flex-1 flex flex-col justify-center">
          <div className="w-24 h-24 bg-slate-100 rounded-2xl mx-auto flex items-center justify-center border-2 border-slate-200 shadow-inner">
            <UserIcon size={40} className="text-slate-300" />
          </div>
          
          <div className="space-y-4 pt-2">
            <div className="text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Student Full Name</p>
              <p className="text-sm font-black uppercase text-slate-800">{student.surname}, {student.first_name} {student.middle_name || ''}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4">
              <div className="text-center border-r border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Admission ID</p>
                <p className="text-xs font-bold text-slate-800 font-mono">{student.admission_number}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Class Level</p>
                <p className="text-xs font-bold text-slate-800">{cls?.name || '---'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full space-y-6 z-10">
          <div className="flex justify-between items-end px-4">
            <div className="text-center space-y-1">
              <div className="w-24 h-[1px] bg-slate-400" />
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Registry Seal</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs italic" style={{ fontFamily: 'Brush Script MT', fontSize: '1.2rem' }}>Principal</p>
              <div className="w-24 h-[1px] bg-slate-400" />
              <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">Authorized Sign</p>
            </div>
          </div>
          <p className="text-[7px] text-center text-slate-400 font-bold uppercase tracking-widest">Valid for Final Assessment Cycle</p>
        </div>
      </div>
    );
  };

  const ModernReportCard = ({ student }: { student: Student }) => {
    const res = computeStudentResults(student.id);
    const cls = classes.find(c => c.id === student.class_id);
    const remark = allRemarks.find(rem => rem.student_id === student.id && rem.term === settingsData?.current_term && rem.session === settingsData?.current_session);
    if (!settingsData) return null;
    return (
      <div className="bg-white p-10 md:p-14 font-sans text-black w-full max-w-4xl min-h-[1100px] flex flex-col relative overflow-hidden rounded-[1.5rem] border border-slate-100 print:shadow-none print:border-none print:m-0 print:p-8 text-black">
        <div className="flex flex-col items-center text-center mb-10 relative z-10 text-black">
            <div className="w-20 h-20 rounded-2xl bg-[#1e1b4b] flex items-center justify-center shadow-xl mb-4">
               {settingsData.logo ? <img src={settingsData.logo} alt="Logo" className="w-12 h-12 object-contain" /> : <Building2 className="text-white" size={32} />}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight text-black mb-1 leading-none">{settingsData.name}</h1>
            <p className="text-[8px] font-semibold text-slate-500 uppercase tracking-[0.4em] pt-1">Official Academic Terminal Record</p>
            <p className="text-[8px] font-bold text-[#1e1b4b] uppercase tracking-widest mt-2">{settingsData.current_session} Session • Term {settingsData.current_term}</p>
        </div>
        <div className="grid grid-cols-4 gap-0 mb-8 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden relative z-10 text-black">
            <div className="p-4 border-r border-slate-200"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Full Name</p><p className="text-xs font-semibold text-black uppercase truncate">{student.first_name} {student.surname} {student.middle_name || ''}</p></div>
            <div className="p-4 border-r border-slate-200"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Adm Number</p><p className="text-xs font-semibold text-black uppercase font-mono">{student.admission_number}</p></div>
            <div className="p-4 border-r border-slate-200"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Class Level</p><p className="text-xs font-semibold text-black uppercase">{cls?.name || '---'}</p></div>
            <div className="p-4 text-right"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gender</p><p className="text-xs font-semibold text-black uppercase">{student.gender}</p></div>
        </div>
        <div className="flex-1 relative z-10 mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white text-black">
          <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1e1b4b] text-white">
                  <th className="py-3.5 px-6 text-[9px] font-black uppercase tracking-widest">Subject Discipline</th>
                  <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16">CA 1</th>
                  <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16">CA 2</th>
                  <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16">Exam</th>
                  <th className="py-3.5 px-3 text-[9px] font-black uppercase tracking-widest text-center w-16 bg-[#312e81]">Total</th>
                  <th className="py-3.5 px-4 text-[9px] font-black uppercase tracking-widest text-center w-20">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-black">
                {subjects.filter(sub => sub.category === cls?.level).map((sub) => {
                  const s = allScores.find(score => score.student_id === student.id && score.subject_id === sub.id && score.term === settingsData.current_term && score.session === settingsData.current_session);
                  const total = (s?.first_ca || 0) + (s?.second_ca || 0) + (s?.exam || 0);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-6 font-semibold text-[11px] uppercase tracking-tight text-black">{sub.name}</td>
                      <td className="py-3 px-3 text-center text-[10px] font-medium text-slate-600">{s?.first_ca ?? '0'}</td>
                      <td className="py-3 px-3 text-center text-[10px] font-medium text-slate-600">{s?.second_ca ?? '0'}</td>
                      <td className="py-3 px-3 text-center text-[10px] font-medium text-slate-600">{s?.exam ?? '0'}</td>
                      <td className="py-3 px-3 text-center font-bold text-[#1e1b4b] bg-slate-50/30 text-[12px]">{total || '0'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-bold text-[9px] uppercase border ${total >= 70 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : total >= 60 ? 'bg-blue-50 border-blue-200 text-blue-700' : total >= 50 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>{getGrade(total)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-6 mb-8 relative z-10 text-black">
            <div className="bg-[#1e1b4b] p-6 rounded-2xl text-white shadow-lg flex flex-col justify-center"><p className="text-[7px] font-bold text-white/40 uppercase tracking-[0.3em] mb-1">Aggregate</p><p className="text-xl font-bold tracking-tighter">{res.total.toFixed(0)}</p></div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-1">Average Score</p><p className="text-xl font-bold text-[#1e1b4b] tracking-tighter">{res.average.toFixed(1)}%</p></div>
            <div className="bg-[#eff6ff] p-6 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between"><div><p className="text-[7px] font-bold text-blue-500 uppercase tracking-[0.3em] mb-1">Class Position</p><p className="text-xl font-bold text-blue-900 tracking-tighter">{getOrdinal(res.position)}</p></div><div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-amber-500 shadow-inner"><Crown size={18} fill="currentColor" /></div></div>
        </div>
        <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 relative z-10 text-black"><p className="text-[7px] font-bold text-slate-400 uppercase tracking-[0.5em] mb-2 flex items-center gap-2"><Sparkles size={10} className="text-[#1e1b4b]" /> Faculty Remark</p><p className="text-sm font-medium italic text-black leading-relaxed">"{remark?.remark || getAutoRemark(res.average)}"</p></div>
      </div>
    );
  };

  const ModernStudentProfile = ({ student }: { student: Student }) => {
    const res = computeStudentResults(student.id);
    const cls = classes.find(c => c.id === student.class_id);
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-[3rem] border dark:border-slate-700 flex flex-col md:flex-row items-center gap-10">
          <div className="w-32 h-32 bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-white text-5xl font-black shadow-2xl">{student.first_name[0]}</div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">{student.surname}, {student.first_name} {student.middle_name || ''}</h3>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
               <span className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">{student.admission_number}</span>
               <span className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-black uppercase tracking-widest">{cls?.name || 'Unassigned'}</span>
               <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">{student.gender}</span>
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-800/50 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-700 space-y-8">
            <div className="flex items-center gap-3"><Contact size={20} className="text-blue-600" /><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Guardian Info</h4></div>
            <div className="space-y-6">
              <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Parent Name</p><p className="font-bold text-slate-900 dark:text-white uppercase">{student.parent_name || 'Not Recorded'}</p></div>
              <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Guardian Phone</p><p className="font-bold text-slate-900 dark:text-white">{student.parent_phone || 'Not Recorded'}</p></div>
              <div className="space-y-1"><p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em]">Address</p><p className="font-bold text-slate-900 dark:text-white leading-relaxed">{student.parent_address || 'Not Recorded'}</p></div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800/50 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-700 space-y-8">
            <div className="flex items-center gap-3"><Award size={20} className="text-amber-500" /><h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance Snapshot</h4></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center space-y-1"><p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Average</p><p className="text-2xl font-black text-blue-600">{res.average.toFixed(1)}%</p></div>
              <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center space-y-1"><p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Rank</p><p className="text-2xl font-black text-slate-900 dark:text-white">{getOrdinal(res.position)}</p></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 text-black dark:text-white">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Admin <span className="text-blue-600">Dashboard</span></h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Registry Management • {activeTab}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === 'students' && (
            <div className="flex flex-wrap gap-3">
              <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleBulkImport} />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 shadow-xl shadow-amber-100 transition-all"><FileUp size={18} /> Bulk Import</button>
              <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-6 py-3.5 bg-slate-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-100 transition-all"><FileDown size={18} /> Template</button>
              <button onClick={handleBulkExport} className="flex items-center gap-2 px-6 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all"><FileSpreadsheet size={18} /> Export CSV</button>
              <button onClick={() => { setEditingEntity(null); setNewStudent({ first_name: '', surname: '', middle_name: '', gender: Gender.MALE, class_id: '', parent_phone: '', parent_address: '', parent_name: '' }); setShowAddModal('student'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Enroll Student</button>
            </div>
          )}
          {activeTab === 'teachers' && <button onClick={() => { setEditingEntity(null); setNewTeacher({ fullName: '', username: '', password: '', role: UserRole.FORM_TEACHER }); setShowAddModal('teacher'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Add Staff</button>}
          {activeTab === 'classes' && <button onClick={() => { setEditingEntity(null); setNewClass({ name: '', level: ClassLevel.JSS, arm: 'A', form_teacher_id: '' }); setShowAddModal('class'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Create Class</button>}
          {activeTab === 'subjects' && <button onClick={() => { setEditingEntity(null); setNewSubject({ name: '', category: ClassLevel.JSS }); setShowAddModal('subject'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><Plus size={18} /> Add Subject</button>}
          {activeTab === 'assignments' && <button onClick={() => { setMapping({ teacherId: '', classId: '', selectedSubjectIds: [] }); setShowAddModal('mapping'); }} className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"><LinkIcon size={18} /> Assign Subjects</button>}
        </div>
      </header>

      {loading && activeTab !== 'settings' && activeTab !== 'overview' ? <TableSkeleton /> : (
        <div className="space-y-10">
             {activeTab === 'overview' && (
                <div className="space-y-10 animate-in fade-in duration-700">
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                      <StatsCard title="Total Students" value={stats.students} icon={Users} color="blue" trend="Learners" />
                      <StatsCard title="Active Staff" value={stats.teachers} icon={GraduationCap} color="green" trend="Faculty" />
                      <StatsCard title="Class Units" value={stats.classes} icon={School} color="purple" trend="Capacity" />
                      <StatsCard title="Active Subjects" value={stats.subjects} icon={Book} color="amber" trend="Curriculum" />
                   </div>

                   <div className="grid lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-2xl">
                                  <Activity size={24} />
                               </div>
                               <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Academic Pulse</h2>
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl space-y-4">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Records Published</p>
                               <div className="flex items-end gap-3">
                                  <h3 className="text-4xl font-black text-blue-600">{stats.publishedScores}</h3>
                                  <span className="text-slate-400 font-bold mb-1.5 text-xs">/ {stats.totalScores} items</span>
                               </div>
                               <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(stats.publishedScores / (stats.totalScores || 1)) * 100}%` }} />
                               </div>
                            </div>
                            <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl space-y-4">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Faculty Approvals</p>
                               <div className="flex items-end gap-3">
                                  <h3 className="text-4xl font-black text-emerald-500">{stats.approvedScores}</h3>
                                  <span className="text-slate-400 font-bold mb-1.5 text-xs">/ {stats.totalScores} items</span>
                               </div>
                               <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(stats.approvedScores / (stats.totalScores || 1)) * 100}%` }} />
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm space-y-8">
                         <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-2xl">
                               <PieChart size={24} />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Population Hub</h2>
                         </div>
                         <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {classes.map(c => {
                               const count = students.filter(s => s.class_id === c.id).length;
                               return (
                                  <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl">
                                     <span className="text-sm font-bold uppercase tracking-tight">{c.name}</span>
                                     <span className="px-3 py-1 bg-white dark:bg-slate-800 rounded-lg text-[10px] font-black text-blue-600 shadow-sm">{count} Students</span>
                                  </div>
                               );
                            })}
                         </div>
                      </div>
                   </div>
                </div>
             )}

             {activeTab !== 'overview' && (
                <div className="bg-white dark:bg-slate-800 rounded-[3rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden min-h-[500px]">
                <div className="overflow-x-auto">
                    {(activeTab !== 'settings' && activeTab !== 'promotion') && (
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30 dark:bg-slate-900/20">
                            <div className="relative w-full md:w-80"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" placeholder={`Search in ${activeTab}...`} className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm outline-none font-bold text-slate-900 dark:text-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                            {(activeTab === 'students' || activeTab === 'results' || activeTab === 'permits') && (
                            <div className="flex items-center gap-3">
                                {activeTab === 'permits' && selectedClassId && (
                                  <button onClick={handleBulkPrintPermits} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center gap-2">
                                    <FileDown size={16} /> Bulk Download Permits (PDF)
                                  </button>
                                )}
                                <select className="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-black uppercase outline-none text-slate-900 dark:text-white" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}><option value="">All Classes...</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                            </div>
                            )}
                            
                            {activeTab === 'assignments' && (
                              <div className="flex flex-wrap items-center gap-3">
                                <select 
                                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase outline-none text-slate-900 dark:text-white" 
                                  value={filterTeacherId} 
                                  onChange={e => setFilterTeacherId(e.target.value)}
                                >
                                  <option value="">All Staff</option>
                                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                </select>
                                <select 
                                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase outline-none text-slate-900 dark:text-white" 
                                  value={filterAssignmentClassId} 
                                  onChange={e => setFilterAssignmentClassId(e.target.value)}
                                >
                                  <option value="">All Classes</option>
                                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select 
                                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase outline-none text-slate-900 dark:text-white" 
                                  value={filterSubjectId} 
                                  onChange={e => setFilterSubjectId(e.target.value)}
                                >
                                  <option value="">All Subjects</option>
                                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && settingsData && (
                        <div className="p-12 max-w-3xl mx-auto space-y-12">
                        <div className="flex items-center gap-5">
                            <div className="p-5 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-100">
                                <SettingsIcon size={32} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Institutional Settings</h2>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Global Portal Configuration</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveSettings} className="space-y-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">School Official Name</label>
                                    <input required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={settingsData.name} onChange={e => setSettingsData({...settingsData, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Motto / Identity Slogan</label>
                                    <input className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={settingsData.motto} onChange={e => setSettingsData({...settingsData, motto: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Academic Session</label>
                                    <input placeholder="e.g. 2023/2024" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={settingsData.current_session} onChange={e => setSettingsData({...settingsData, current_session: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Current Term</label>
                                    <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={settingsData.current_term} onChange={e => setSettingsData({...settingsData, current_term: Number(e.target.value) as any})}>
                                    <option value={1}>Term 1 (First Term)</option>
                                    <option value={2}>Term 2 (Second Term)</option>
                                    <option value={3}>Term 3 (Third Term)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Institutional Brand Logo</label>
                                <div className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 transition-colors cursor-pointer relative group">
                                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleLogoUpload} />
                                    <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                                    {settingsData.logo ? (
                                        <img src={settingsData.logo} className="w-full h-full object-contain p-2" alt="Logo Preview" />
                                    ) : (
                                        <ImageIcon className="text-slate-300" size={32} />
                                    )}
                                    </div>
                                    <div className="flex-1">
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Upload School Logo</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Select image file (PNG, JPG, SVG)</p>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <Upload size={20} />
                                    </div>
                                </div>
                            </div>

                            <button disabled={isSavingSettings} type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3">
                                {isSavingSettings ? <Clock className="animate-spin" size={18} /> : <Save size={18} />}
                                Commit Global Settings Sync
                            </button>
                        </form>
                        </div>
                    )}

                    {activeTab === 'promotion' ? (
                        <div className="p-10 space-y-10">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Source Classification (From)</label>
                                <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none" value={sourceClassId} onChange={e => { setSourceClassId(e.target.value); setSelectedPromotionStudentIds([]); }}>
                                <option value="">Choose Class...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Target Classification (To)</label>
                                <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none" value={targetClassId} onChange={e => setTargetClassId(e.target.value)}>
                                    <option value="">Choose Class...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={handleBulkPromotion} disabled={isPromoting || !targetClassId || selectedPromotionStudentIds.length === 0} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 disabled:opacity-30 transition-all flex items-center gap-2">
                                    {isPromoting ? <Clock className="animate-spin" size={16} /> : <TrendingUp size={16} />} Promote Selected
                                </button>
                                </div>
                            </div>
                        </div>

                        {sourceClassId ? (
                            <div className="border border-slate-100 dark:border-slate-700 rounded-[2rem] overflow-hidden">
                                <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                                    <th className="px-10 py-6 w-16">
                                        <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-200" checked={studentsInSourceClass.length > 0 && selectedPromotionStudentIds.length === studentsInSourceClass.length} onChange={(e) => {
                                            if (e.target.checked) setSelectedPromotionStudentIds(studentsInSourceClass.map(s => s.id));
                                            else setSelectedPromotionStudentIds([]);
                                        }} />
                                    </th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Student Registry</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Current Status</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Academic Preview</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y border-t border-slate-100 dark:border-slate-700">
                                    {studentsInSourceClass.map(s => {
                                        const res = computeStudentResults(s.id);
                                        return (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-10 py-6">
                                            <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-200" checked={selectedPromotionStudentIds.includes(s.id)} onChange={() => {
                                                if (selectedPromotionStudentIds.includes(s.id)) setSelectedPromotionStudentIds(selectedPromotionStudentIds.filter(id => id !== s.id));
                                                else setSelectedPromotionStudentIds([...selectedPromotionStudentIds, s.id]);
                                            }} />
                                            </td>
                                            <td className="px-10 py-6">
                                            <p className="font-bold text-slate-900 dark:text-white uppercase">{s.surname}, {s.first_name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{s.admission_number}</p>
                                            </td>
                                            <td className="px-10 py-6 text-center">
                                            <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${res.average >= 50 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                {res.average >= 50 ? 'Recommended' : 'Caution'}
                                            </span>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                            <p className="text-sm font-black text-blue-600">{res.average.toFixed(1)}%</p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Average</p>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="py-24 text-center space-y-4 opacity-30">
                                <TrendingUp size={64} className="mx-auto text-slate-400" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Select source class to begin promotion cycle</p>
                            </div>
                        )}
                        </div>
                    ) : (activeTab !== 'settings' && activeTab !== 'overview' && (
                        <table className="w-full text-left table-fixed">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50">
                            {activeTab === 'permits' && (
                                <th className="px-8 py-6 w-16">
                                    <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-200" checked={filteredStudents.length > 0 && selectedPermitStudentIds.length === filteredStudents.length} onChange={(e) => {
                                        if (e.target.checked) setSelectedPermitStudentIds(filteredStudents.map(s => s.id));
                                        else setSelectedPermitStudentIds([]);
                                    }} />
                                </th>
                            )}
                            <th className={`py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 px-8 ${activeTab === 'results' || activeTab === 'assignments' ? 'w-[50%]' : 'w-[40%]'}`}>Identity & Details</th>
                            <th className={`py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 px-8 ${activeTab === 'results' || activeTab === 'assignments' ? 'w-[30%]' : 'w-[40%]'}`}>Information</th>
                            <th className={`py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right px-8 w-[20%]`}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y border-t border-slate-100 dark:divide-slate-700">
                            {activeTab === 'results' && filteredStudents.map(s => {
                                const res = computeStudentResults(s.id);
                                return (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-black text-xs text-blue-600 uppercase">{s.first_name[0]}{s.surname[0]}</div>
                                        <div className="min-w-0"><p className="font-black uppercase text-slate-900 dark:text-white leading-tight">{s.surname}, {s.first_name}</p><p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">{s.admission_number}</p></div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{classes.find(c => c.id === s.class_id)?.name || 'N/A'}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{res.count} Records</p></div><span className="px-4 py-1.5 rounded-xl bg-blue-500 text-white font-black text-[11px] uppercase">{res.average.toFixed(1)}%</span></div></td>
                                    <td className="px-8 py-6 text-right space-x-1"><button onClick={() => setViewingResultStudent(s)} className="p-3 text-slate-400 hover:text-blue-600 rounded-2xl transition-all" title="View Result"><Eye size={20} /></button><button onClick={() => setViewingResultStudent(s)} className="p-3 text-slate-400 hover:text-emerald-600 rounded-2xl transition-all" title="View & Print"><Printer size={20} /></button></td>
                                </tr>
                                );
                            })}

                            {activeTab === 'students' && filteredStudents.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-8 py-6 cursor-pointer" onClick={() => setViewingStudentProfile(s)}>
                                    <p className="font-bold text-slate-900 dark:text-white uppercase truncate group-hover:text-blue-600 transition-colors">{s.surname}, {s.first_name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{s.admission_number}</p>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{classes.find(c => c.id === s.class_id)?.name || 'N/A'}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{s.gender} • Parent: {s.parent_name || 'N/A'}</p>
                                </td>
                                <td className="px-8 py-6 text-right space-x-2">
                                    <button onClick={() => { setEditingEntity(s); setNewStudent({ first_name: s.first_name, surname: s.surname, middle_name: s.middle_name || '', gender: s.gender, class_id: s.class_id, parent_phone: s.parent_phone || '', parent_address: s.parent_address || '', parent_name: s.parent_name || '' }); setShowAddModal('student'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={18} /></button>
                                    <button onClick={() => setDeleteConfirmation({ show: true, type: 'student', id: s.id, title: 'Delete', message: `Remove ${s.first_name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                </td>
                                </tr>
                            ))}

                            {activeTab === 'permits' && filteredStudents.map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                    <input type="checkbox" className="w-5 h-5 rounded-lg border-slate-200" checked={selectedPermitStudentIds.includes(s.id)} onChange={() => {
                                        if (selectedPermitStudentIds.includes(s.id)) setSelectedPermitStudentIds(selectedPermitStudentIds.filter(id => id !== s.id));
                                        else setSelectedPermitStudentIds([...selectedPermitStudentIds, s.id]);
                                    }} />
                                </td>
                                <td className="px-8 py-6">
                                    <p className="font-bold text-slate-900 dark:text-white uppercase truncate">{s.surname}, {s.first_name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{s.admission_number}</p>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{classes.find(c => c.id === s.class_id)?.name || 'N/A'}</p>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button onClick={() => setViewingPermitStudent(s)} className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg hover:bg-black"><Printer size={16} /> View Permit</button>
                                </td>
                                </tr>
                            ))}

                            {activeTab === 'classes' && classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(c => (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6"><p className="font-bold text-slate-900 dark:text-white uppercase truncate">{c.name}</p><p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Level: {c.level}</p></td>
                                <td className="px-8 py-6"><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{teachers.find(t => t.id === c.form_teacher_id)?.full_name || 'Vacant'}</p></td>
                                <td className="px-8 py-6 text-right space-x-2"><button onClick={() => { setEditingEntity(c); setNewClass({ name: c.name, level: c.level, arm: c.arm, form_teacher_id: c.form_teacher_id || '' }); setShowAddModal('class'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={18} /></button><button onClick={() => setDeleteConfirmation({ show: true, type: 'class', id: c.id, title: 'Delete', message: `Remove ${c.name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button></td>
                                </tr>
                            ))}

                            {activeTab === 'subjects' && subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())).map(s => (
                                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6"><p className="font-bold text-slate-900 dark:text-white uppercase truncate">{s.name}</p><p className="text-[10px] text-slate-400 uppercase tracking-widest">ID: {s.id.split('-')[0]}</p></td>
                                <td className="px-8 py-6"><span className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{s.category}</span></td>
                                <td className="px-8 py-6 text-right space-x-2"><button onClick={() => { setEditingEntity(s); setNewSubject({ name: s.name, category: s.category }); setShowAddModal('subject'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={18} /></button><button onClick={() => setDeleteConfirmation({ show: true, type: 'subject', id: s.id, title: 'Delete', message: `Remove ${s.name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button></td>
                                </tr>
                            ))}

                            {activeTab === 'teachers' && teachers.filter(t => t.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map(t => (
                                <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6"><p className="font-bold text-slate-900 dark:text-white uppercase truncate">{t.full_name}</p><p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">ID: {t.username}</p></td>
                                <td className="px-8 py-6"><span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{t.role.replace('_', ' ')}</span></td>
                                <td className="px-8 py-6 text-right space-x-2"><button onClick={() => { setEditingEntity(t); setNewTeacher({ fullName: t.full_name, username: t.username, password: '', role: t.role }); setShowAddModal('teacher'); }} className="p-3 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={18} /></button><button onClick={() => setDeleteConfirmation({ show: true, type: 'teacher', id: t.id, title: 'Revoke', message: `Revoke ${t.full_name}?` })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button></td>
                                </tr>
                            ))}

                            {activeTab === 'assignments' && filteredMappings.map(ts => (
                                <tr key={ts.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                    <p className="font-bold text-slate-900 dark:text-white uppercase truncate">{teachers.find(t => t.id === ts.teacher_id)?.full_name || 'Staff Missing'}</p>
                                </td>
                                <td className="px-8 py-6">
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                        {classes.find(c => c.id === ts.class_id)?.name || 'N/A'} — {subjects.find(s => s.id === ts.subject_id)?.name || 'N/A'}
                                    </p>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button onClick={() => setDeleteConfirmation({ show: true, type: 'mapping', id: ts.id, title: 'Revoke', message: 'Remove assignment?' })} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                </td>
                                </tr>
                            ))}
                        </tbody>
                        </table>
                    ))}
                </div>
                </div>
             )}
        </div>
      )}

      {/* Modals */}
      {showAddModal === 'mapping' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3.5rem] w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Assign Subjects</h2>
              <button onClick={() => setShowAddModal(null)} className="text-slate-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"><X size={24}/></button>
            </div>
            <form onSubmit={handleBulkMapping} className="space-y-6">
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Choose Staff</label>
                    <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={mapping.teacherId} onChange={e => setMapping({...mapping, teacherId: e.target.value})}>
                      <option value="">Choose Staff...</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Choose Class</label>
                    <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={mapping.classId} onChange={e => setMapping({...mapping, classId: e.target.value})}>
                      <option value="">Choose Class...</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
               </div>
               
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Course Material</label>
                  <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {subjects.map(sub => (
                      <label key={sub.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${mapping.selectedSubjectIds.includes(sub.id) ? 'bg-blue-600 text-white border-blue-700 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={mapping.selectedSubjectIds.includes(sub.id)} 
                          onChange={() => { 
                            const cur = mapping.selectedSubjectIds; 
                            if(cur.includes(sub.id)) setMapping({...mapping, selectedSubjectIds: cur.filter(id => id !== sub.id)}); 
                            else setMapping({...mapping, selectedSubjectIds: [...cur, sub.id]}); 
                          }} 
                        />
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${mapping.selectedSubjectIds.includes(sub.id) ? 'bg-white border-white' : 'bg-slate-100 dark:bg-slate-700 border-slate-300'}`}>
                          {mapping.selectedSubjectIds.includes(sub.id) && <Check size={14} className="text-blue-600" />}
                        </div>
                        <span className="text-[11px] font-black uppercase truncate">{sub.name}</span>
                      </label>
                    ))}
                  </div>
               </div>
               
               <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all">Assign Selected Subjects</button>
            </form>
          </div>
        </div>
      )}

      {viewingResultStudent && settingsData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[60] flex items-center justify-center p-4 md:p-10 no-print">
           <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-5xl h-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-slate-100 dark:border-slate-700">
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
                  <button onClick={() => { handlePrintStudent(viewingResultStudent); }} className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
                    <Printer size={18} /> Print Record
                  </button>
                  <button onClick={() => setViewingResultStudent(null)} className="p-3 hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 rounded-2xl transition-all">
                    <X size={24}/>
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-white shadow-inner">
                <div className="scale-90 md:scale-100 origin-top flex justify-center">
                  <ModernReportCard student={viewingResultStudent} />
                </div>
              </div>
           </div>
        </div>
      )}

      {viewingStudentProfile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[70] flex items-center justify-center p-4 md:p-10 no-print">
           <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-slate-100 dark:border-slate-700">
              <div className="px-10 py-8 border-b dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none mb-1">Student Profile Details</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Institutional Registry • Comprehensive Record</p>
                </div>
                <button onClick={() => setViewingStudentProfile(null)} className="p-3 hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 rounded-2xl transition-all">
                  <X size={24}/>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-10">
                <ModernStudentProfile student={viewingStudentProfile} />
              </div>
           </div>
        </div>
      )}

      {showAddModal === 'student' && (
         <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingEntity ? 'Update' : 'Enroll'} Student</h2><button onClick={() => setShowAddModal(null)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"><X size={24}/></button></div>
               <form onSubmit={handleSaveStudent} className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Surname</label>
                      <input required placeholder="Surname" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.surname} onChange={e => setNewStudent({...newStudent, surname: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">First Name</label>
                      <input required placeholder="First Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.first_name} onChange={e => setNewStudent({...newStudent, first_name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Middle Name</label>
                      <input placeholder="Middle Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.middle_name} onChange={e => setNewStudent({...newStudent, middle_name: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Classification</label>
                      <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.class_id} onChange={e => setNewStudent({...newStudent, class_id: e.target.value})}><option value="">Select Class...</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Gender</label>
                      <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value as Gender})}><option value={Gender.MALE}>Male</option><option value={Gender.FEMALE}>Female</option></select>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Parent Name</label>
                      <input placeholder="Guardian Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" value={newStudent.parent_name} onChange={e => setNewStudent({...newStudent, parent_name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact Line</label>
                      <input placeholder="Guardian Phone" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" value={newStudent.parent_phone} onChange={e => setNewStudent({...newStudent, parent_phone: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Residential Address</label>
                      <input placeholder="Guardian Address" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" value={newStudent.parent_address} onChange={e => setNewStudent({...newStudent, parent_address: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all">Confirm Registry Enrollment</button>
               </form>
            </div>
         </div>
      )}

      {showAddModal === 'teacher' && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingEntity ? 'Edit' : 'Enroll'} Staff</h2><button onClick={() => setShowAddModal(null)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"><X size={24} className="text-slate-400"/></button></div>
            <form onSubmit={handleSaveTeacher} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Full Legal Name</label>
                <input required placeholder="Staff Full Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newTeacher.fullName} onChange={e => setNewTeacher({...newTeacher, fullName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Registry ID/User</label>
                  <input required placeholder="Registry Username" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newTeacher.username} onChange={e => setNewTeacher({...newTeacher, username: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Portal Access Pass</label>
                  <input placeholder={editingEntity ? "Leave blank to keep" : "Initial Password"} className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newTeacher.password} onChange={e => setNewTeacher({...newTeacher, password: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Organizational Role</label>
                <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={newTeacher.role} onChange={e => setNewTeacher({...newTeacher, role: e.target.value as UserRole})}><option value={UserRole.FORM_TEACHER}>Form/Subject Teacher</option><option value={UserRole.ADMIN}>Portal Administrator</option></select>
              </div>
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">{editingEntity ? 'Update' : 'Commit'} Registry Record</button>
            </form>
          </div>
        </div>
      )}

      {showAddModal === 'class' && (
         <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingEntity ? 'Update' : 'Create'} Class</h2><button onClick={() => setShowAddModal(null)} className="text-slate-400"><X size={24}/></button></div>
               <form onSubmit={handleSaveClass} className="space-y-6">
                  <input required placeholder="Class Name (e.g. JSS 1A)" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} />
                  <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" value={newClass.level} onChange={e => setNewClass({...newClass, level: e.target.value as ClassLevel})}><option value={ClassLevel.JSS}>JSS</option><option value={ClassLevel.SS}>SS</option></select>
                  <select className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" value={newClass.form_teacher_id} onChange={e => setNewClass({...newClass, form_teacher_id: e.target.value})}><option value="">Assign Form Teacher...</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select>
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Commit Class Record</button>
               </form>
            </div>
         </div>
      )}

      {showAddModal === 'subject' && (
         <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-8"><h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingEntity ? 'Update' : 'Add'} Subject</h2><button onClick={() => setShowAddModal(null)} className="text-slate-400"><X size={24}/></button></div>
               <form onSubmit={handleSaveSubject} className="space-y-6">
                  <input required placeholder="Subject Name" className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-600" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} />
                  <select required className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold" value={newSubject.category} onChange={e => setNewSubject({...newSubject, category: e.target.value as ClassLevel})}><option value={ClassLevel.JSS}>JSS Level</option><option value={ClassLevel.SS}>SS Level</option></select>
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl">Commit Subject</button>
               </form>
            </div>
         </div>
      )}

      {viewingPermitStudent && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[60] flex items-center justify-center p-4 no-print">
           <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-2xl h-full max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-slate-700">
              <div className="px-10 py-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-1">Exam Permit Preview</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Registry Verification Protocol</p>
                </div>
                <button onClick={() => setViewingPermitStudent(null)} className="p-3 hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 rounded-2xl transition-all"><X size={24}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                <div className="scale-75 md:scale-100"><ModernExamPermit student={viewingPermitStudent} /></div>
              </div>
              <div className="px-10 py-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end gap-4 shrink-0">
                <button onClick={() => { setSelectedPermitStudent(viewingPermitStudent); setViewingPermitStudent(null); }} className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex items-center gap-2">
                   <Printer size={16} /> Print Official Permit
                </button>
              </div>
           </div>
        </div>
      )}

      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6 no-print">
          <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-rose-50 p-10 flex flex-col items-center text-center gap-4"><div className="p-5 bg-rose-500 text-white rounded-[2rem] shadow-xl mb-2"><AlertTriangle size={48} /></div><h3 className="text-2xl font-black text-rose-600 uppercase tracking-tighter">Caution</h3><p className="text-sm font-bold text-slate-500 leading-relaxed">{deleteConfirmation.message}</p></div>
            <div className="p-10 flex gap-4"><button onClick={() => setDeleteConfirmation({...deleteConfirmation, show: false})} className="flex-1 py-4.5 bg-slate-100 font-black rounded-2xl uppercase tracking-widest text-[10px]">Abort</button><button onClick={executeDelete} className="flex-1 py-4.5 bg-rose-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px]">Confirm Delete</button></div>
          </div>
        </div>
      )}

      {selectedReportStudent && settingsData && (
         <div className="print-only fixed inset-0 bg-white z-[999] p-0 overflow-y-auto flex justify-center items-start"><ModernReportCard student={selectedReportStudent} /></div>
      )}

      {selectedPermitStudent && <div className="print-only fixed inset-0 bg-white z-[999] flex items-center justify-center p-10"><ModernExamPermit student={selectedPermitStudent} /></div>}
      
      {isBulkPrintingPermits && (
        <div className="print-only fixed inset-0 bg-white z-[999] overflow-y-auto">
          {selectedPermitStudents.map((s, idx) => (
            <div key={s.id} className={`flex items-center justify-center p-10 h-screen`} style={{ breakAfter: 'page' }}>
              <ModernExamPermit student={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;