
export enum UserRole {
  ADMIN = 'admin',
  FORM_TEACHER = 'form_teacher',
  STUDENT = 'student'
}

export enum ClassLevel {
  JSS = 'JSS',
  SS = 'SS'
}

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  full_name: string;
  created_at: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  level: ClassLevel;
  arm: 'A' | 'B';
  form_teacher_id?: string;
}

export interface Subject {
  id: string;
  name: string;
  category: ClassLevel;
}

export interface TeacherSubject {
  id: string;
  teacher_id: string;
  subject_id: string;
  class_id: string;
}

export interface Student {
  id: string;
  first_name: string;
  surname: string;
  middle_name?: string;
  gender: Gender;
  class_id: string;
  admission_number: string;
  password?: string;
  photo?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_address?: string;
  profile_id?: string;
}

export interface Score {
  id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  first_ca: number;
  second_ca: number;
  exam: number;
  term: 1 | 2 | 3;
  session: string;
  is_published: boolean;
  is_approved_by_form_teacher: boolean;
  comment?: string;
}

export interface FormTeacherRemark {
  id: string;
  student_id: string;
  class_id: string;
  remark: string;
  term: 1 | 2 | 3;
  session: string;
  position?: number;
}

export interface SchoolSettings {
  name: string;
  logo: string;
  motto: string;
  primary_color: string;
  current_term: 1 | 2 | 3;
  current_session: string;
}

export const AI_REMARK_PROMPT = (name: string, avg: number, total: number, subjects: number, position: string) => `
You are a professional school form teacher. Write a concise, encouraging, and specific academic remark for a student.
Student Name: ${name}
Average Score: ${avg}%
Total Subjects: ${subjects}
Class Position: ${position}
The remark should be professional, between 15-25 words, and provide actionable insight based on the performance level. 
If the average is >70, be very complimentary. 
If <40, be concerned but encouraging.
Respond ONLY with the remark text.
`;
