import { ClassLevel } from './types';

export const JSS_SUBJECTS = [
  "English Language", "Mathematics", "Basic Science", "Social Studies", 
  "Business Studies", "Computer Studies", "Civic Education", "Religious Studies", 
  "Cultural and Creative Arts"
];

export const SS_SUBJECTS = [
  "English Language", "Mathematics", "Biology", "Chemistry", "Physics", 
  "Economics", "Government", "Literature in English", "Computer Studies"
];

export const CLASSES_LIST = [
  { level: ClassLevel.JSS, arms: ['A', 'B'], years: [1, 2, 3] },
  { level: ClassLevel.SS, arms: ['A', 'B'], years: [1, 2, 3] }
];

export const DEFAULT_SETTINGS = {
  name: "Prince and Princess International School",
  motto: "Character, Skill and Career",
  logo: "https://api.dicebear.com/7.x/initials/svg?seed=PP&backgroundColor=002366",
  primaryColor: "#002366",
  currentTerm: 1 as const,
  currentSession: "2023/2024"
};

export const GRADING_SYSTEM = [
  { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
  { min: 60, max: 69, grade: 'B', remark: 'Very Good' },
  { min: 50, max: 59, grade: 'C', remark: 'Credit' },
  { min: 45, max: 49, grade: 'D', remark: 'Pass' },
  { min: 40, max: 44, grade: 'E', remark: 'Fair' },
  { min: 0, max: 39, grade: 'F', remark: 'Fail' },
];

export const getGrade = (score: number) => {
  const g = GRADING_SYSTEM.find(item => score >= item.min && score <= item.max);
  return g ? g.grade : 'F';
};

export const getRemark = (score: number) => {
  const g = GRADING_SYSTEM.find(item => score >= item.min && score <= item.max);
  return g ? g.remark : 'Fail';
};

export const getAutoRemark = (average: number) => {
  if (average >= 70) return "An excellent performance. Keep it up!";
  if (average >= 60) return "A very good performance. Maintain the effort.";
  if (average >= 50) return "A good performance, but there is still room for improvement.";
  if (average >= 45) return "A fair performance. You need to work harder in your weak subjects.";
  return "Poor performance. You must dedicate more time to your studies.";
};

export const getOrdinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const PRINCIPAL_SIGNATURE_STYLE = "font-family: 'Brush Script MT', cursive; font-size: 2.5rem; color: #002366;";