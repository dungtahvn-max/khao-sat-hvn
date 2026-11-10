export type SurveyType = 'quiz' | 'form' | 'exam';
export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'date' | 'file' | 'true_false' | 'short_number' | 'short_text';

export interface Question {
  id: string;
  question: string;
  type?: QuestionType;
  options: string[];
  correct_answer?: any; // 0-indexed option, or string/number for short answer
  correct_answers?: boolean[]; // For true_false: array of 4 booleans for ý a, b, c, d
  points?: number; // Điểm của từng câu
  image_url?: string; // Link ảnh đính kèm câu hỏi
  explanation?: string;
  required?: boolean;
  file_code_prefix?: string; // Mã tệp / Tiền tố đặt tên tệp, vd: CCCD, ANH_THE, GIAY_KHAI_SINH
}

export interface ExamPartsConfig {
  part1_points?: number;
  part2_points?: number;
  part3_points?: number;
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
  exam_config?: ExamPartsConfig; // Thiết lập điểm cho từng phần trong bài kiểm tra
  default_points?: number; // Điểm mặc định mỗi câu trong quiz
  created_by?: string; // Tên đăng nhập của người tạo (admin hoặc giáo viên)
  created_by_name?: string; // Họ tên người tạo
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
