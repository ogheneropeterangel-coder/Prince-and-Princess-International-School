
import { 
  User, UserRole, SchoolClass, Subject, TeacherSubject, 
  Student, Score, FormTeacherRemark, SchoolSettings, ClassLevel, Gender 
} from './types';
import { supabase } from './lib/supabase';
import { DEFAULT_SETTINGS } from './constants';

// Simple in-memory cache for static data
const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

const getCached = (key: string) => {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  return null;
};

const setCache = (key: string, data: any) => {
  cache[key] = { data, timestamp: Date.now() };
};

export const db = {
  users: {
    getAll: async (role?: UserRole) => {
      let query = supabase.from('profiles').select('id, username, full_name, role, created_at');
      if (role) query = query.eq('role', role);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as User[];
    },
    save: async (user: User) => {
      // Standard upsert using primary key 'id'
      const { error } = await supabase.from('profiles').upsert(user);
      if (error) throw error;
      delete cache['users'];
    },
    remove: async (id: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      delete cache['users'];
    }
  },
  classes: {
    getAll: async () => {
      const cached = getCached('classes');
      if (cached) return cached;
      const { data, error } = await supabase.from('classes').select('*').order('name');
      if (error) throw error;
      setCache('classes', data);
      return (data || []) as SchoolClass[];
    },
    save: async (cls: SchoolClass) => {
      const { error } = await supabase.from('classes').upsert(cls);
      if (error) throw error;
      delete cache['classes'];
    },
    remove: async (id: string) => {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      delete cache['classes'];
    }
  },
  subjects: {
    getAll: async () => {
      const cached = getCached('subjects');
      if (cached) return cached;
      const { data, error } = await supabase.from('subjects').select('*').order('name');
      if (error) throw error;
      setCache('subjects', data);
      return (data || []) as Subject[];
    },
    save: async (sub: Subject) => {
      const { error } = await supabase.from('subjects').upsert(sub);
      if (error) throw error;
      delete cache['subjects'];
    },
    remove: async (id: string) => {
      const { error } = await supabase.from('subjects').delete().eq('id', id);
      if (error) throw error;
      delete cache['subjects'];
    }
  },
  teacherSubjects: {
    getAll: async () => {
      const { data, error } = await supabase.from('teacher_subjects').select('*');
      if (error) throw error;
      return (data || []) as TeacherSubject[];
    },
    save: async (ts: TeacherSubject) => {
      const { error } = await supabase.from('teacher_subjects').insert(ts);
      if (error) throw error;
    },
    remove: async (id: string) => {
      const { error } = await supabase.from('teacher_subjects').delete().eq('id', id);
      if (error) throw error;
    }
  },
  students: {
    getAll: async () => {
      const { data, error } = await supabase.from('students').select('*').order('surname');
      if (error) throw error;
      return (data || []) as Student[];
    },
    getByClass: async (classId: string) => {
      const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('surname');
      if (error) throw error;
      return (data || []) as Student[];
    },
    save: async (stu: Student) => {
      const { password, ...studentData } = stu;
      const { error } = await supabase.from('students').upsert(studentData);
      if (error) throw error;
    },
    remove: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    }
  },
  scores: {
    getAll: async () => {
      const { data, error } = await supabase.from('scores').select('*');
      if (error) throw error;
      return (data || []) as Score[];
    },
    getByClass: async (classId: string, term: number, session: string) => {
      const { data, error } = await supabase.from('scores')
        .select('*')
        .eq('class_id', classId)
        .eq('term', term)
        .eq('session', session);
      if (error) throw error;
      return (data || []) as Score[];
    },
    save: async (score: Score) => {
      const { error } = await supabase.from('scores').upsert(score);
      if (error) throw error;
    },
    updateByClass: async (classId: string, updates: Partial<Score>) => {
      const { error } = await supabase.from('scores').update(updates).eq('class_id', classId);
      if (error) throw error;
    },
    removeBySubject: async (subjectId: string) => {
      const { error } = await supabase.from('scores').delete().eq('subject_id', subjectId);
      if (error) throw error;
    }
  },
  remarks: {
    getAll: async () => {
      const { data, error } = await supabase.from('remarks').select('*');
      if (error) throw error;
      return (data || []) as FormTeacherRemark[];
    },
    save: async (remark: FormTeacherRemark) => {
      const { error } = await supabase.from('remarks').upsert(remark);
      if (error) throw error;
    }
  },
  settings: {
    get: async (): Promise<SchoolSettings> => {
      const cached = getCached('settings');
      if (cached) return cached;
      const { data, error } = await supabase.from('settings').select('*').single();
      if (error) return {
        name: DEFAULT_SETTINGS.name,
        logo: DEFAULT_SETTINGS.logo,
        motto: DEFAULT_SETTINGS.motto,
        primary_color: DEFAULT_SETTINGS.primaryColor,
        current_term: DEFAULT_SETTINGS.currentTerm,
        current_session: DEFAULT_SETTINGS.currentSession
      };
      setCache('settings', data);
      return data as SchoolSettings;
    },
    update: async (updates: Partial<SchoolSettings>) => {
      const { error } = await supabase.from('settings').upsert({ id: 1, ...updates });
      if (error) throw error;
      delete cache['settings'];
    }
  }
};

export const calculatePositions = (students: Student[], scores: Score[], term: number, session: string) => {
  const rankings: Record<string, { total: number, studentId: string }> = {};
  students.forEach(student => {
    const studentScores = scores.filter(s => s.student_id === student.id && s.term === term && s.session === session);
    const total = studentScores.reduce((acc, s) => acc + (Number(s.first_ca) + Number(s.second_ca) + Number(s.exam)), 0);
    rankings[student.id] = { total, studentId: student.id };
  });
  const sorted = Object.values(rankings).sort((a, b) => b.total - a.total);
  return sorted.reduce((acc, item, index) => {
    acc[item.studentId] = index + 1;
    return acc;
  }, {} as Record<string, number>);
};
