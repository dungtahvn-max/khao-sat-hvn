export type SurveyType = 'quiz' | 'form';
export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'date' | 'file';

export interface Question {
  id: string;
  question: string;
  type?: QuestionType;
  options: string[];
  correct_answer?: number; // 0-indexed option
  explanation?: string;
  required?: boolean;
  file_code_prefix?: string; // Mã tệp / Tiền tố đặt tên tệp, vd: CCCD, ANH_THE, GIAY_KHAI_SINH
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  survey_type: SurveyType;
  is_active: boolean;
  show_answers: boolean;
  allow_multiple_attempts: boolean;
  google_drive_folder_id?: string; // Mã ID thư mục Google Drive để lưu tệp học sinh tải lên
  target_classes?: string[]; // Danh sách lớp được giao (rỗng hoặc undefined = toàn trường)
  shuffle_questions?: boolean; // Xáo trộn thứ tự các câu hỏi khi học sinh làm bài
  shuffle_options?: boolean; // Xáo trộn các lựa chọn đáp án trong từng câu hỏi
  questions: Question[];
  created_at?: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  stt?: number;
  full_name: string;
  dob_display: string; // "dd/mm/yyyy"
  dob_password: string; // "ddmmyyyy"
  cccd: string; // 12 digits
  class_name: string;
  created_at?: string;
}

export interface Teacher {
  id: string;
  username: string;
  password: string;
  full_name: string;
  homeroom_class: string;
  role?: 'teacher' | 'admin'; // 'teacher' (GVCN) hoặc 'admin' (Quản trị viên)
  created_at?: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  student_cccd: string;
  student_name: string;
  class_name: string;
  answers: Record<string, any>; // question id -> selected option index or string or file upload metadata
  score?: number;
  total_questions?: number;
  submitted_at: string;
}

export type AppTheme = 'burgundy' | 'blue' | 'green' | 'glass';

export interface AppSettings {
  id: number;
  admin_username: string;
  admin_password: string;
  announcement: string;
  theme?: AppTheme;
  created_at?: string;
}

export type UserRole = 'student' | 'teacher' | 'admin';

export interface AuthSession {
  role: UserRole;
  student?: Student;
  teacher?: Teacher;
  admin?: {
    username: string;
    fullName?: string;
  };
}
