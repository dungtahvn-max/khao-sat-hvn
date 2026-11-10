import React, { useState, useEffect, useMemo } from 'react';
import { Student, Teacher, Survey, SurveyResponse, AppSettings, Question, AuthSession, AppTheme } from '../types';
import {
  getStudents, upsertStudents, deleteStudent, deleteAllStudents,
  getTeachers, upsertTeachers, deleteTeacher,
  getSurveys, saveSurvey, deleteSurvey, isValidUUID, generateUUID,
  getResponses, getAppSettings, saveAppSettings,
  checkSupabaseConnection, ConnectionStatus
} from '../services/supabase';
import {
  downloadStudentTemplate, downloadTeacherTemplate,
  parseStudentExcel, parseTeacherExcel,
  exportSchoolSummaryToExcel, exportFilteredSurveyResponsesToExcel,
  ParsedStudentRow, ParsedTeacherRow
} from '../utils/excel';
import { sortClassNames, compareClassNames, getGradeFromClassName, formatClassDisplay } from '../utils/classOrder';
import { useTheme } from '../context/ThemeContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { SurveyEditorModal } from './SurveyEditorModal';
import { CodeSurveyModal } from './CodeSurveyModal';
import { MathRenderer } from './MathRenderer';
import * as XLSX from 'xlsx';
import {
  Shield, Users, BookOpen, FileText, Download, Upload,
  Plus, Trash2, Edit2, CheckCircle2, Clock,
  Search, RefreshCw, KeyRound, Database,
  FileSpreadsheet, ToggleLeft, ToggleRight, Sparkles, AlertTriangle, X,
  Code, Filter, ExternalLink, Calendar, HardDrive,
  Menu, Palette, Check, Lock, ChevronRight, CheckSquare, Square, User, Eye,
  BarChart3, Copy, Shuffle
} from 'lucide-react';
import { isAnswerCorrect, getTrueFalseMatchCount } from '../utils/quiz';

interface AdminPortalProps {
  session?: AuthSession | null;
  onOpenSqlModal?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ session, onOpenSqlModal }) => {
  const { theme, setTheme, config } = useTheme();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'teachers' | 'surveys' | 'reports' | 'settings'>('overview');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<{ student: Student; response?: SurveyResponse } | null>(null);
  
  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Student Filter / Search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('ALL');

  // Progress Tab Filter States (Toàn trường, Khối, Lớp, Đã làm / Chưa làm)
  const [progressSurveyId, setProgressSurveyId] = useState<string>('');
  const [progressScope, setProgressScope] = useState<string>('ALL'); // 'ALL' | 'GRADE_10' | 'GRADE_11' | 'GRADE_12' | 'CLASS_...'
  const [progressStatus, setProgressStatus] = useState<'ALL' | 'COMPLETED' | 'PENDING'>('ALL');
  const [progressSearch, setProgressSearch] = useState('');

  // Modals & Forms
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentFormData, setStudentFormData] = useState({
    full_name: '',
    dob_display: '',
    cccd: '',
    class_name: '',
    stt: 1,
  });

  // Import Student Modal
  const [showImportStudentModal, setShowImportStudentModal] = useState(false);
  const [parsedStudentRows, setParsedStudentRows] = useState<ParsedStudentRow[]>([]);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importStatusText, setImportStatusText] = useState<string>('');
  const [showAllImportPreview, setShowAllImportPreview] = useState(false);

  // Student Table Pagination
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState<number>(100);

  // Teacher Modals (Supports creating Teacher or Admin)
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherFormData, setTeacherFormData] = useState<{
    username: string;
    password: string;
    full_name: string;
    homeroom_class: string;
    role: 'teacher' | 'admin';
  }>({
    username: '',
    password: '',
    full_name: '',
    homeroom_class: '',
    role: 'teacher',
  });

  // Import Teacher Modal
  const [showImportTeacherModal, setShowImportTeacherModal] = useState(false);
  const [parsedTeacherRows, setParsedTeacherRows] = useState<ParsedTeacherRow[]>([]);

  // Survey Builder Modal
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);

  // Survey Delete Confirmation Modal
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [deletingSurvey, setDeletingSurvey] = useState(false);

  // Code Survey Modal
  const [showCodeSurveyModal, setShowCodeSurveyModal] = useState(false);

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [adminPasswordText, setAdminPasswordText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [stList, tcList, svList, rpList, stData, conn] = await Promise.all([
        getStudents(),
        getTeachers(),
        getSurveys(),
        getResponses(),
        getAppSettings(),
        checkSupabaseConnection(true),
      ]);
      setStudents(stList);
      setTeachers(tcList);
      setSurveys(svList);
      setResponses(rpList);
      setSettings(stData);
      setAnnouncementText(stData.announcement || '');
      setAdminPasswordText(stData.admin_password || '1235');
      setConnectionStatus(conn);

      if (svList.length > 0 && !progressSurveyId) {
        setProgressSurveyId(svList[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Master Admin & Permissions
  const currentAdminUsername = (session?.admin?.username || 'admin').trim().toLowerCase();
  const isMasterAdmin = currentAdminUsername === (settings?.admin_username || 'admin').trim().toLowerCase() || currentAdminUsername === 'admin';
  const displayedTeachers = isMasterAdmin ? teachers : teachers.filter(t => t.role !== 'admin');

  const handleChangeTheme = async (newTheme: AppTheme) => {
    if (!isMasterAdmin) {
      showToast('Chỉ Quản trị viên tối cao mới có quyền thay đổi Theme toàn trường!', 'error');
      return;
    }
    if (newTheme === theme) return;
    setSavingTheme(true);
    try {
      await setTheme(newTheme);
      const themeNames: Record<AppTheme, string> = {
        burgundy: 'Đỏ Burgundy THPT Huỳnh Văn Nghệ',
        blue: 'Xanh Dương Giáo Dục (Nguyên bản)',
        green: 'Xanh Lá Tươi Mới (Emerald Green)',
        glass: 'Glassmorphism & Mesh Gradient Hiện Đại',
      };
      showToast(`Đã lưu và áp dụng theme "${themeNames[newTheme]}" cho toàn hệ thống!`);
    } catch (e) {
      showToast('Lỗi khi đổi theme giao diện', 'error');
    } finally {
      setSavingTheme(false);
    }
  };

  // Distinct classes & grades sorted with standard Huỳnh Văn Nghệ sequence
  // Khối 10: 10.1 -> 10.9, 10_10, 10.11 -> 10.15; Khối 11: 11.1 -> 11.9, 11_10, 11.11; Khối 12: 12.1 -> 12.9, 12_10, 12.11, 12.12
  const allClasses = sortClassNames(Array.from(new Set(students.map(s => s.class_name.trim().toUpperCase()))));
  const allGrades = Array.from(new Set(students.map(s => getGradeFromClassName(s.class_name)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Modal State for Class-by-Class Progress
  const [showClassProgressModal, setShowClassProgressModal] = useState(false);
  const [classProgressSort, setClassProgressSort] = useState<'class_order' | 'rate_desc' | 'rate_asc'>('class_order');
  const [copiedZaloAdmin, setCopiedZaloAdmin] = useState(false);

  // ----------------- STUDENT ACTIONS -----------------
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStudentFormData({
      full_name: '',
      dob_display: '',
      cccd: '',
      class_name: allClasses[0] || '10A1',
      stt: students.length + 1,
    });
    setShowStudentModal(true);
  };

  const handleOpenEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentFormData({
      full_name: s.full_name,
      dob_display: s.dob_display,
      cccd: s.cccd,
      class_name: s.class_name,
      stt: s.stt || 1,
    });
    setShowStudentModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCccd = studentFormData.cccd.trim();
    if (cleanCccd.length !== 12) {
      showToast('Số CCCD phải gồm đúng 12 chữ số!', 'error');
      return;
    }

    const dobMatch = studentFormData.dob_display.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (!dobMatch) {
      showToast('Ngày sinh phải có định dạng dd/mm/yyyy (ví dụ: 05/08/2009)!', 'error');
      return;
    }
    const d = dobMatch[1].padStart(2, '0');
    const m = dobMatch[2].padStart(2, '0');
    const y = dobMatch[3];
    const dobDisplay = `${d}/${m}/${y}`;
    const dobPassword = `${d}${m}${y}`;

    const studentToSave: Partial<Student> = {
      id: editingStudent ? editingStudent.id : `s_${Date.now()}`,
      full_name: studentFormData.full_name.trim(),
      dob_display: dobDisplay,
      dob_password: dobPassword,
      cccd: cleanCccd,
      class_name: studentFormData.class_name.trim().toUpperCase(),
      stt: Number(studentFormData.stt) || 1,
    };

    const res = await upsertStudents([studentToSave]);
    if (res.success) {
      showToast('Đã lưu thông tin học sinh thành công!');
      setShowStudentModal(false);
      loadAllData();
    } else {
      showToast(res.error || 'Lỗi khi lưu học sinh', 'error');
    }
  };

  const handleDeleteStudent = async (s: Student) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${s.full_name}" (CCCD: ${s.cccd})?`)) {
      await deleteStudent(s.id, s.cccd);
      showToast('Đã xóa học sinh.');
      loadAllData();
    }
  };

  const handleDeleteAllStudents = async () => {
    if (!isMasterAdmin) {
      showToast('Chỉ Quản trị viên tối cao mới có quyền xóa toàn bộ học sinh!', 'error');
      return;
    }
    if (students.length === 0) {
      showToast('Danh sách học sinh hiện đang trống!', 'error');
      return;
    }
    const confirmed = window.confirm(
      `⚠️ CẢNH BÁO QUAN TRỌNG:\nBạn có chắc chắn muốn xóa TOÀN BỘ ${students.length} tài khoản học sinh trong trường?\n\nHành động này sẽ xóa danh sách học sinh và không thể hoàn tác!`
    );
    if (confirmed) {
      const res = await deleteAllStudents();
      if (res.success) {
        showToast(`Đã xóa thành công toàn bộ ${res.count} tài khoản học sinh!`);
        loadAllData();
      } else {
        showToast(res.error || 'Lỗi khi xóa học sinh', 'error');
      }
    }
  };

  const handleStudentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseStudentExcel(file);
      setParsedStudentRows(result.rows);
      setShowImportStudentModal(true);
    } catch {
      showToast('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file!', 'error');
    }
  };

  const handleConfirmImportStudents = async () => {
    const validRows = parsedStudentRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showToast('Không có dòng hợp lệ nào để import!', 'error');
      return;
    }

    setImportProgress(5);
    setImportStatusText(`Bắt đầu xử lý ${validRows.length} học sinh...`);
    const studentsToSave: Partial<Student>[] = validRows.map(r => ({
      stt: r.stt,
      full_name: r.full_name,
      dob_display: r.dob_display,
      dob_password: r.dob_password,
      cccd: r.cccd,
      class_name: r.class_name,
    }));

    const res = await upsertStudents(studentsToSave, (percent, currentBatch, totalBatches, processedCount) => {
      setImportProgress(percent);
      setImportStatusText(`Đang lưu lô ${currentBatch}/${totalBatches} (${processedCount}/${studentsToSave.length} học sinh)...`);
    });

    if (res.success) {
      showToast(`Đã import thành công toàn bộ ${res.count} học sinh vào hệ thống!`);
      setShowImportStudentModal(false);
      setParsedStudentRows([]);
      setImportProgress(null);
      setImportStatusText('');
      await loadAllData();
    } else {
      showToast(res.error || 'Lỗi khi import học sinh', 'error');
      setImportProgress(null);
      setImportStatusText('');
    }
  };

  // ----------------- TEACHER & ADMIN ACCOUNTS ACTIONS -----------------
  const handleOpenAddTeacher = () => {
    setEditingTeacher(null);
    setTeacherFormData({
      username: '',
      password: '',
      full_name: '',
      homeroom_class: allClasses[0] || '10A1',
      role: 'teacher',
    });
    setShowTeacherModal(true);
  };

  const handleOpenEditTeacher = (t: Teacher) => {
    setEditingTeacher(t);
    setTeacherFormData({
      username: t.username,
      password: t.password,
      full_name: t.full_name,
      homeroom_class: t.homeroom_class || '',
      role: t.role || 'teacher',
    });
    setShowTeacherModal(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.username.trim() || !teacherFormData.password.trim()) {
      showToast('Vui lòng điền đủ Tên đăng nhập và Mật khẩu!', 'error');
      return;
    }

    const teacherToSave: Partial<Teacher> = {
      id: editingTeacher ? editingTeacher.id : `t_${Date.now()}`,
      username: teacherFormData.username.trim().toLowerCase(),
      password: teacherFormData.password.trim(),
      full_name: teacherFormData.full_name.trim(),
      homeroom_class: teacherFormData.role === 'admin' ? 'BGH' : teacherFormData.homeroom_class.trim().toUpperCase(),
      role: teacherFormData.role,
    };

    const ok = await upsertTeachers([teacherToSave]);
    if (ok) {
      showToast(`Đã lưu tài khoản ${teacherFormData.role === 'admin' ? 'Quản trị viên (Admin)' : 'Giáo viên'}!`);
      setShowTeacherModal(false);
      loadAllData();
    } else {
      showToast('Lỗi khi lưu tài khoản', 'error');
    }
  };

  const handleDeleteTeacher = async (t: Teacher) => {
    const roleLabel = t.role === 'admin' ? 'Quản trị viên' : 'GVCN';
    if (window.confirm(`Bạn có chắc muốn xóa tài khoản ${roleLabel} "${t.full_name}" (${t.username})?`)) {
      await deleteTeacher(t.id, t.username);
      showToast(`Đã xóa tài khoản ${roleLabel}.`);
      loadAllData();
    }
  };

  const handleTeacherFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseTeacherExcel(file);
      if (result.rows.length === 0) {
        showToast('Không tìm thấy dữ liệu giáo viên trong file Excel!', 'error');
        return;
      }
      setParsedTeacherRows(result.rows);
      setShowImportTeacherModal(true);
    } catch (err: any) {
      console.error('Lỗi đọc file Excel GV:', err);
      showToast(err.message || 'Không thể đọc file Excel Giáo viên!', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImportTeachers = async () => {
    const validRows = parsedTeacherRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      showToast('Không có dòng hợp lệ nào để import!', 'error');
      return;
    }

    const teachersToSave = validRows.map(r => ({
      username: r.username,
      password: r.password,
      full_name: r.full_name,
      homeroom_class: r.homeroom_class,
      role: 'teacher' as const,
    }));

    const ok = await upsertTeachers(teachersToSave);
    if (ok) {
      showToast(`Đã import thành công ${teachersToSave.length} Giáo viên vào hệ thống!`);
      setShowImportTeacherModal(false);
      setParsedTeacherRows([]);
      await loadAllData();
    } else {
      showToast('Lỗi khi lưu danh sách Giáo viên vào cơ sở dữ liệu!', 'error');
    }
  };

  // ----------------- SURVEY ACTIONS -----------------
  const handleToggleSurveyField = async (survey: Survey, field: 'is_active' | 'show_answers' | 'allow_multiple_attempts') => {
    const updated = {
      ...survey,
      [field]: !survey[field],
      updated_at: new Date().toISOString(),
    };
    await saveSurvey(updated);
    setSurveys(prev => prev.map(s => s.id === survey.id ? updated : s));
    showToast(`Đã cập nhật cấu hình bài khảo sát!`);
  };

  const handleOpenAddSurvey = () => {
    setEditingSurvey(null);
    setShowSurveyModal(true);
  };

  const handleOpenEditSurvey = (s: Survey) => {
    setEditingSurvey(s);
    setShowSurveyModal(true);
  };

  const handleSaveSurveyFromModal = async (surveyToSave: Survey) => {
    const ok = await saveSurvey(surveyToSave);
    if (ok) {
      showToast('Đã lưu bài khảo sát / kiểm tra thành công!');
      setShowSurveyModal(false);
      setSurveys(prev => {
        const exists = prev.some(s => s.id === surveyToSave.id);
        return exists ? prev.map(s => s.id === surveyToSave.id ? surveyToSave : s) : [surveyToSave, ...prev];
      });
      if (!progressSurveyId) {
        setProgressSurveyId(surveyToSave.id);
      }
      await loadAllData();
      return true;
    } else {
      showToast('Lỗi khi lưu bài khảo sát', 'error');
      return false;
    }
  };

  const handleSaveSurveyFromCode = async (surveyToSave: Survey) => {
    const ok = await saveSurvey(surveyToSave);
    if (ok) {
      showToast(`Tạo thành công khảo sát "${surveyToSave.title}" từ mã code!`);
      setShowCodeSurveyModal(false);
      setSurveys(prev => {
        const exists = prev.some(s => s.id === surveyToSave.id);
        return exists ? prev.map(s => s.id === surveyToSave.id ? surveyToSave : s) : [surveyToSave, ...prev];
      });
      if (!progressSurveyId) {
        setProgressSurveyId(surveyToSave.id);
      }
      await loadAllData();
      return true;
    } else {
      showToast('Lỗi khi lưu khảo sát từ code', 'error');
      return false;
    }
  };

  const handleDeleteSurvey = (s: Survey) => {
    setSurveyToDelete(s);
  };

  const confirmDeleteSurvey = async () => {
    if (!surveyToDelete) return;
    setDeletingSurvey(true);
    try {
      const id = surveyToDelete.id;
      const title = surveyToDelete.title;

      // Optimistically update UI immediately
      setSurveys(prev => prev.filter(s => s.id !== id));
      setResponses(prev => prev.filter(r => r.survey_id !== id));
      if (progressSurveyId === id) {
        const remaining = surveys.filter(s => s.id !== id);
        setProgressSurveyId(remaining[0]?.id || '');
      }

      const ok = await deleteSurvey(id);
      if (ok) {
        showToast(`Đã xóa bài khảo sát "${title}" thành công!`);
      } else {
        showToast('Không thể xóa trên máy chủ, nhưng đã xóa khỏi bộ nhớ đệm.', 'error');
      }
      setSurveyToDelete(null);
      await loadAllData();
    } catch (err: any) {
      showToast('Lỗi khi xóa bài khảo sát: ' + (err?.message || 'Lỗi không xác định'), 'error');
    } finally {
      setDeletingSurvey(false);
    }
  };

  // ----------------- SETTINGS & ANNOUNCEMENT -----------------
  const handleSaveAnnouncement = async () => {
    await saveAppSettings({ announcement: announcementText });
    showToast('Đã cập nhật thông báo từ Ban quản trị!');
  };

  const handleSaveAdminPassword = async () => {
    if (adminPasswordText.trim().length < 4) {
      showToast('Mật khẩu Admin phải có ít nhất 4 ký tự!', 'error');
      return;
    }
    await saveAppSettings({ admin_password: adminPasswordText.trim() });
    showToast('Đã đổi mật khẩu Quản trị viên!');
  };

  // ----------------- FILTERED PROGRESS CALCULATION -----------------
  const selectedProgressSurvey = surveys.find(s => s.id === progressSurveyId) || surveys[0];
  const currentSurveyResponses = responses.filter(r => r.survey_id === selectedProgressSurvey?.id);
  const currentRespMap = new Map<string, SurveyResponse>();
  currentSurveyResponses.forEach(r => currentRespMap.set(r.student_cccd, r));

  // Filter students based on Scope (Toàn trường / Khối / Lớp) and Status (Tất cả / Đã làm / Chưa làm)
  const matchedStudents = students.filter(s => {
    // 1. Filter by Scope
    if (progressScope.startsWith('GRADE_')) {
      const gradeTarget = progressScope.replace('GRADE_', 'Khối ');
      if (getGradeFromClassName(s.class_name) !== gradeTarget) return false;
    } else if (progressScope.startsWith('CLASS_')) {
      const classTarget = progressScope.replace('CLASS_', '');
      if (s.class_name.trim().toUpperCase() !== classTarget) return false;
    }

    // 2. Filter by Status
    const isCompleted = currentRespMap.has(s.cccd);
    if (progressStatus === 'COMPLETED' && !isCompleted) return false;
    if (progressStatus === 'PENDING' && isCompleted) return false;

    // 3. Search query
    if (progressSearch.trim()) {
      const term = progressSearch.toLowerCase();
      if (!s.full_name.toLowerCase().includes(term) && !s.cccd.includes(term)) return false;
    }

    return true;
  });

  // Calculate scope stats
  const scopeTotalStudents = students.filter(s => {
    if (progressScope.startsWith('GRADE_')) {
      const gradeTarget = progressScope.replace('GRADE_', 'Khối ');
      return getGradeFromClassName(s.class_name) === gradeTarget;
    } else if (progressScope.startsWith('CLASS_')) {
      const classTarget = progressScope.replace('CLASS_', '');
      return s.class_name.trim().toUpperCase() === classTarget;
    }
    return true;
  });
  const scopeCompletedCount = scopeTotalStudents.filter(s => currentRespMap.has(s.cccd)).length;
  const scopePendingCount = scopeTotalStudents.length - scopeCompletedCount;
  const scopeRate = scopeTotalStudents.length > 0
    ? Math.round((scopeCompletedCount / scopeTotalStudents.length) * 100)
    : 0;

  // Export filtered responses to Excel
  const handleExportFilteredExcel = () => {
    if (!selectedProgressSurvey) return;
    const scopeLabel = progressScope === 'ALL'
      ? 'Toàn trường'
      : progressScope.startsWith('GRADE_')
      ? progressScope.replace('GRADE_', 'Khối ')
      : `Lớp ${progressScope.replace('CLASS_', '')}`;

    const statusLabel = progressStatus === 'ALL'
      ? 'Tất cả'
      : progressStatus === 'COMPLETED'
      ? 'Đã thực hiện'
      : 'Chưa thực hiện';

    exportFilteredSurveyResponsesToExcel(
      selectedProgressSurvey,
      matchedStudents,
      responses,
      scopeLabel,
      statusLabel
    );
  };

  // Detailed Class-by-Class Progress for selectedProgressSurvey
  const classProgressData = useMemo(() => {
    if (!selectedProgressSurvey) return [];
    
    return allClasses.map((cls) => {
      const classStudents = students.filter(s => s.class_name.trim().toUpperCase() === cls);
      const totalInClass = classStudents.length;
      const classResponses = classStudents
        .map(s => currentRespMap.get(s.cccd))
        .filter((r): r is SurveyResponse => !!r);
      const completedInClass = classResponses.length;
      const rate = totalInClass > 0 ? Math.round((completedInClass / totalInClass) * 100) : 0;
      
      // Average score if quiz
      let avgScore = 0;
      if (selectedProgressSurvey.survey_type === 'quiz' && completedInClass > 0) {
        const totalScore = classResponses.reduce((acc, r) => acc + (r.score || 0), 0);
        avgScore = Math.round((totalScore / completedInClass) * 10) / 10;
      }

      // Completion timestamp if 100% & latest submission time for tie-breaking
      let completedAt100: string | null = null;
      let latestSubmissionTime = 0;
      if (completedInClass > 0) {
        const timestamps = classResponses
          .map(r => r.submitted_at)
          .filter(Boolean)
          .sort();
        if (timestamps.length > 0) {
          const latest = timestamps[timestamps.length - 1];
          latestSubmissionTime = new Date(latest).getTime();
          if (rate === 100) {
            completedAt100 = new Date(latest).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
        }
      }

      return {
        className: cls,
        grade: getGradeFromClassName(cls),
        totalInClass,
        completedInClass,
        rate,
        avgScore,
        completedAt100,
        latestSubmissionTime,
      };
    });
  }, [allClasses, students, currentRespMap, selectedProgressSurvey]);

  const sortedClassProgress = useMemo(() => {
    const list = [...classProgressData];
    if (classProgressSort === 'rate_desc') {
      return list.sort((a, b) => {
        if (b.rate !== a.rate) {
          return b.rate - a.rate;
        }
        // Các lớp cùng tỉ lệ: xếp lớp đạt được tỉ lệ đó sớm nhất (latestSubmissionTime nhỏ hơn / sớm hơn)
        if (a.latestSubmissionTime && b.latestSubmissionTime) {
          if (a.latestSubmissionTime !== b.latestSubmissionTime) {
            return a.latestSubmissionTime - b.latestSubmissionTime;
          }
        } else if (a.latestSubmissionTime && !b.latestSubmissionTime) {
          return -1;
        } else if (!a.latestSubmissionTime && b.latestSubmissionTime) {
          return 1;
        }
        return compareClassNames(a.className, b.className);
      });
    }
    if (classProgressSort === 'rate_asc') {
      return list.sort((a, b) => a.rate - b.rate || compareClassNames(a.className, b.className));
    }
    // Default: 'class_order'
    return list.sort((a, b) => compareClassNames(a.className, b.className));
  }, [classProgressData, classProgressSort]);

  const gradeSummaries = useMemo(() => {
    const grades = ['Khối 10', 'Khối 11', 'Khối 12'];
    return grades.map(g => {
      const items = classProgressData.filter(c => c.grade === g);
      const total = items.reduce((acc, i) => acc + i.totalInClass, 0);
      const done = items.reduce((acc, i) => acc + i.completedInClass, 0);
      const rate = total > 0 ? Math.round((done / total) * 100) : 0;
      
      let avgScore = 0;
      if (selectedProgressSurvey?.survey_type === 'quiz' && done > 0) {
        const weightedScoreSum = items.reduce((acc, i) => acc + (i.avgScore * i.completedInClass), 0);
        avgScore = Math.round((weightedScoreSum / done) * 10) / 10;
      }

      return { grade: g, total, done, rate, avgScore };
    });
  }, [classProgressData, selectedProgressSurvey]);

  const handleCopyZaloAdminMessage = () => {
    if (!selectedProgressSurvey) return;

    const totalAll = classProgressData.reduce((acc, c) => acc + c.totalInClass, 0);
    const completedAll = classProgressData.reduce((acc, c) => acc + c.completedInClass, 0);
    const overallRate = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;

    const byRateDesc = [...classProgressData].sort((a, b) => b.rate - a.rate);
    const cutoffIndex = Math.floor(byRateDesc.length * 0.7);
    const lowerClasses = byRateDesc.slice(cutoffIndex).sort((a, b) => compareClassNames(a.className, b.className));

    let msg = `📢 KÍNH GỬI QUÝ THẦY/CÔ GIÁO VIÊN CHỦ NHIỆM\n`;
    msg += `(V/v: Cập nhật tiến độ đợt khảo sát: "${selectedProgressSurvey.title}")\n`;
    msg += `--------------------------------------------------\n\n`;
    msg += `Kính gửi Quý Thầy/Cô,\n`;
    msg += `Ban Quản trị xin gửi thông tin cập nhật tiến độ khảo sát toàn trường tính đến hiện tại:\n`;
    msg += `• Toàn trường: ${completedAll}/${totalAll} học sinh hoàn thành (Tỉ lệ: ${overallRate}%).\n`;
    msg += `• Đa số các lớp (hơn 70% tổng số lớp) đã đạt tiến độ rất tốt và tích cực.\n\n`;

    if (lowerClasses.length > 0) {
      msg += `Để đảm bảo hoàn thành chỉ tiêu khảo sát đúng tiến độ, Ban Quản trị kính nhờ Quý Thầy/Cô chủ nhiệm các lớp dưới đây tiếp tục đôn đốc, nhắc nhở các em học sinh khẩn trương nộp bài:\n\n`;
      lowerClasses.forEach((c, idx) => {
        msg += `${idx + 1}. Lớp ${formatClassDisplay(c.className)}: ${c.completedInClass}/${c.totalInClass} HS (${c.rate}%)\n`;
      });
      msg += `\n`;
    }

    msg += `🔗 Đường link tham gia khảo sát: https://khao-sat-hvn.netlify.app\n\n`;
    msg += `Kính chúc Quý Thầy/Cô luôn nhiều sức khỏe và công tác tốt.\n`;
    msg += `Ban Quản trị xin trân trọng cảm ơn sự phối hợp nhiệt tình của Quý Thầy/Cô! 🙏`;

    navigator.clipboard.writeText(msg);
    setCopiedZaloAdmin(true);
    showToast('Đã sao chép tin nhắn Zalo gửi nhóm GVCN thành công!');
    setTimeout(() => setCopiedZaloAdmin(false), 3000);
  };

  // Filter students for Student Tab
  const filteredStudents = students.filter(s => {
    if (studentClassFilter !== 'ALL' && s.class_name.trim().toUpperCase() !== studentClassFilter) {
      return false;
    }
    if (studentSearch.trim()) {
      const term = studentSearch.toLowerCase();
      return s.full_name.toLowerCase().includes(term) || s.cccd.includes(term);
    }
    return true;
  });

  const totalStudentPages = studentPageSize === -1
    ? 1
    : Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const safeStudentPage = Math.min(Math.max(1, studentPage), totalStudentPages);
  const paginatedStudents = studentPageSize === -1
    ? filteredStudents
    : filteredStudents.slice((safeStudentPage - 1) * studentPageSize, safeStudentPage * studentPageSize);

  const navTabs = [
    { id: 'overview' as const, label: 'Tổng quan', icon: Sparkles },
    { id: 'students' as const, label: 'Học sinh', icon: Users },
    { id: 'teachers' as const, label: 'Giáo viên', icon: BookOpen },
    { id: 'surveys' as const, label: 'Quản lý khảo sát', icon: FileText },
    { id: 'reports' as const, label: 'Báo cáo', icon: FileSpreadsheet },
    { id: 'settings' as const, label: 'Cài đặt', icon: KeyRound },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center space-x-2 text-sm font-semibold animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation Layout: Left Sidebar for Glass theme, Top Horizontal Bar for Classic themes */}
      <div className={theme === 'glass' ? "flex flex-col md:flex-row gap-6 items-start" : "space-y-6"}>
        {theme === 'glass' ? (
          <aside className="w-full md:w-64 shrink-0">
            <div className="bg-white/75 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-lg md:sticky md:top-20 space-y-4">
              <div className="px-2 py-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50/80 px-2.5 py-1 rounded-full border border-indigo-200/50">
                  Admin Portal
                </span>
                <h2 className="text-sm font-black text-slate-900 mt-2">Hệ thống Khảo sát</h2>
                <p className="text-[11px] text-slate-500">THPT Huỳnh Văn Nghệ</p>
              </div>

              <nav className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-1 gap-1.5">
                {navTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                          : 'text-slate-700 hover:bg-white/60 hover:text-indigo-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>
        ) : (
          /* Top Navigation Bar for classic themes */
          <div className="bg-white p-2 sm:p-2.5 rounded-2xl border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-600">
              {navTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#7a0f2b] text-white shadow-xs'
                        : 'hover:text-[#7a0f2b] hover:bg-rose-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Panels */}
        <div className={theme === 'glass' ? "flex-1 min-w-0 space-y-6 w-full" : "space-y-6"}>



      {/* ----------------- TAB 1: OVERVIEW ----------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* PROGRESS TRACKING & FILTERED STUDENT LIST */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5 shrink-0">
                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-[#7a0f2b]" />
                <span>Tiến độ khảo sát</span>
              </h3>

              <div className="flex items-center gap-2 shrink-0">
                {/* Nút xem tiến độ từng lớp */}
                <button
                  type="button"
                  onClick={() => setShowClassProgressModal(true)}
                  className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  title="Xem chi tiết tiến độ thực hiện bài khảo sát của từng lớp"
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-1" />
                  <span>Tiến độ từng lớp</span>
                </button>

                {/* Export Button for filtered list - cùng dòng */}
                <button
                  type="button"
                  onClick={handleExportFilteredExcel}
                  className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  <span>Xuất danh sách</span>
                </button>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#faf2f4] p-3.5 rounded-xl border border-rose-100 text-xs">
              {/* Select Survey */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn đợt khảo sát:</label>
                <select
                  value={progressSurveyId}
                  onChange={e => setProgressSurveyId(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  {surveys.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.is_active ? 'Đang mở' : 'Đã khóa'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Scope: Toàn trường / Khối / Lớp */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Phạm vi:</label>
                <select
                  value={progressScope}
                  onChange={e => setProgressScope(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold text-[#7a0f2b]"
                >
                  <option value="ALL">🏫 Toàn trường (Tất cả các lớp)</option>
                  <optgroup label="Theo Khối">
                    {allGrades.map(g => (
                      <option key={g} value={`GRADE_${g.replace('Khối ', '')}`}>
                        {g}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Theo Lớp cụ thể">
                    {allClasses.map(c => (
                      <option key={c} value={`CLASS_${c}`}>
                        Lớp {formatClassDisplay(c)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Select Status */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Trạng thái:</label>
                <select
                  value={progressStatus}
                  onChange={e => setProgressStatus(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="ALL">Tất cả ({scopeTotalStudents.length})</option>
                  <option value="COMPLETED">✅ Đã thực hiện ({scopeCompletedCount})</option>
                  <option value="PENDING">⏳ Chưa thực hiện ({scopePendingCount})</option>
                </select>
              </div>

              {/* Search in matched */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tìm kiếm học sinh:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    autoCapitalize="none"
                    placeholder="Tìm tên hoặc CCCD..."
                    value={progressSearch}
                    onChange={e => setProgressSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-2 bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Scope Summary Combined Single Box */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 rounded-xl border border-emerald-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-700">Đã thực hiện:</span>
                <span className="text-base sm:text-lg font-black text-emerald-800">
                  {scopeCompletedCount}/{scopeTotalStudents.length}
                </span>
                <span className="text-slate-400 font-bold mx-1">;</span>
                <span className="font-semibold text-slate-700">Tỉ lệ:</span>
                <span className="text-base sm:text-lg font-black text-[#7a0f2b]">
                  {scopeRate}%
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                (Chưa thực hiện: <b className="text-rose-700">{scopePendingCount}</b> học sinh)
              </div>
            </div>

            {/* Matching Students List Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>
                  Danh sách học sinh thỏa điều kiện lọc: <b>{matchedStudents.length}</b> học sinh
                </span>
                <span className="text-slate-500">
                  Khảo sát: {selectedProgressSurvey?.title}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2.5">STT</th>
                      <th className="px-4 py-2.5">Họ và tên</th>
                      <th className="px-4 py-2.5">Lớp</th>
                      <th className="px-4 py-2.5">Số CCCD</th>
                      <th className="px-4 py-2.5">Ngày sinh</th>
                      <th className="px-4 py-2.5 text-center">ĐÃ THỰC HIỆN</th>
                      {selectedProgressSurvey?.survey_type === 'quiz' && (
                        <th className="px-4 py-2.5 text-center">Kết quả / Điểm</th>
                      )}
                      <th className="px-4 py-2.5">Thời gian nộp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matchedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={selectedProgressSurvey?.survey_type === 'quiz' ? 8 : 7} className="px-4 py-8 text-center text-slate-500">
                          Không có học sinh nào phù hợp với điều kiện lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      matchedStudents.map((s, idx) => {
                        const resp = currentRespMap.get(s.cccd);
                        const isDone = !!resp;

                        return (
                          <tr
                            key={s.id}
                            className="hover:bg-rose-50/50 transition-colors"
                          >
                            <td className="px-4 py-2.5 text-slate-500 font-semibold">{s.stt || idx + 1}</td>
                            <td className="px-4 py-2.5 font-bold">
                              <button
                                type="button"
                                onClick={() => setSelectedStudentDetail({ student: s, response: resp })}
                                className="font-bold text-slate-900 hover:text-[#7a0f2b] hover:underline cursor-pointer text-left focus:outline-none"
                                title="Nhấp vào tên để xem chi tiết bài làm khảo sát"
                              >
                                {s.full_name}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-[#7a0f2b]">{formatClassDisplay(s.class_name)}</td>
                            <td className="px-4 py-2.5 font-mono text-slate-700">{s.cccd}</td>
                            <td className="px-4 py-2.5 text-slate-600">{s.dob_display}</td>
                            <td className="px-4 py-2.5 text-center">
                              <div className="flex items-center justify-center" title={isDone ? 'Đã thực hiện' : 'Chưa thực hiện'}>
                                {isDone ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                                    <span className="text-[11px]">Đã thực hiện</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-slate-400 font-semibold bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                                    <Square className="w-4 h-4 text-slate-300" />
                                    <span className="text-[11px] text-slate-500">Chưa thực hiện</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            {selectedProgressSurvey?.survey_type === 'quiz' && (
                              <td className="px-4 py-2.5 text-center font-bold">
                                {isDone ? (
                                  <span className="text-[#7a0f2b] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    {resp?.score} / {resp?.total_questions || selectedProgressSurvey.questions.length}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                              {isDone && resp?.submitted_at
                                ? new Date(resp.submitted_at).toLocaleString('vi-VN')
                                : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* ----------------- TAB 3: STUDENTS & IMPORT ----------------- */}
      {activeTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadStudentTemplate}
                className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Tải file Excel mẫu Học sinh
              </button>

              <label className="inline-flex items-center px-3.5 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import Excel Học sinh
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleStudentFileSelect}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleOpenAddStudent}
                className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Thêm học sinh thủ công
              </button>
            </div>

            {/* Filter and Search */}
            <div className="flex items-center gap-2">
              <select
                value={studentClassFilter}
                onChange={e => {
                  setStudentClassFilter(e.target.value);
                  setStudentPage(1);
                }}
                className="bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-[#7a0f2b]"
              >
                <option value="ALL">Tất cả các lớp</option>
                {allClasses.map(cls => (
                  <option key={cls} value={cls}>Lớp {formatClassDisplay(cls)}</option>
                ))}
              </select>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  autoCapitalize="none"
                  placeholder="Tìm tên hoặc CCCD..."
                  value={studentSearch}
                  onChange={e => {
                    setStudentSearch(e.target.value);
                    setStudentPage(1);
                  }}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7a0f2b]"
                />
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>
                  Hiển thị <strong>{filteredStudents.length === 0 ? 0 : (safeStudentPage - 1) * (studentPageSize === -1 ? filteredStudents.length : studentPageSize) + 1}</strong> - <strong>{studentPageSize === -1 ? filteredStudents.length : Math.min(safeStudentPage * studentPageSize, filteredStudents.length)}</strong> trên <strong>{filteredStudents.length}</strong> học sinh
                  {studentClassFilter !== 'ALL' || studentSearch ? ` (Tổng trường: ${students.length})` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span>Số lượng/trang:</span>
                  <select
                    value={studentPageSize}
                    onChange={e => {
                      setStudentPageSize(Number(e.target.value));
                      setStudentPage(1);
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={-1}>Tất cả</option>
                  </select>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:inline">Mật khẩu: Ngày sinh ddmmyyyy</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px] sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5">STT</th>
                    <th className="px-4 py-2.5">Họ và tên</th>
                    <th className="px-4 py-2.5">Lớp</th>
                    <th className="px-4 py-2.5">Số CCCD</th>
                    <th className="px-4 py-2.5">Ngày sinh</th>
                    <th className="px-4 py-2.5">Mật khẩu</th>
                    <th className="px-4 py-2.5 text-center">ĐÃ THỰC HIỆN</th>
                    <th className="px-4 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Không tìm thấy học sinh nào phù hợp
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s, index) => {
                      const displayStt = s.stt || (studentPageSize === -1 ? index + 1 : (safeStudentPage - 1) * studentPageSize + index + 1);
                      const isDone = currentRespMap.has(s.cccd);
                      return (
                        <tr key={s.id || s.cccd} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500 font-semibold">{displayStt}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900">{s.full_name}</td>
                          <td className="px-4 py-2.5 font-bold text-[#7a0f2b]">{formatClassDisplay(s.class_name)}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{s.cccd}</td>
                          <td className="px-4 py-2.5 text-slate-600">{s.dob_display}</td>
                          <td className="px-4 py-2.5 font-mono text-emerald-700 font-semibold">{s.dob_password}</td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center" title={isDone ? 'Đã thực hiện' : 'Chưa thực hiện'}>
                              {isDone ? (
                                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                  <span className="text-[11px]">Đã thực hiện</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-slate-400 font-semibold bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200">
                                  <Square className="w-4 h-4 text-slate-300" />
                                  <span className="text-[11px] text-slate-500">Chưa thực hiện</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right space-x-1">
                            <button
                              onClick={() => handleOpenEditStudent(s)}
                              className="p-1 text-slate-500 hover:text-[#7a0f2b] hover:bg-rose-50 rounded-md"
                              title="Sửa"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(s)}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                              title="Xóa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalStudentPages > 1 && (
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-600 font-medium">
                  Trang <strong className="text-slate-900">{safeStudentPage}</strong> / <strong className="text-slate-900">{totalStudentPages}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStudentPage(1)}
                    disabled={safeStudentPage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang đầu"
                  >
                    « Đầu
                  </button>
                  <button
                    onClick={() => setStudentPage(prev => Math.max(1, prev - 1))}
                    disabled={safeStudentPage <= 1}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ‹ Trước
                  </button>

                  <span className="px-2.5 py-1 font-bold text-[#7a0f2b] bg-rose-50 border border-rose-200 rounded-lg">
                    {safeStudentPage}
                  </span>

                  <button
                    onClick={() => setStudentPage(prev => Math.min(totalStudentPages, prev + 1))}
                    disabled={safeStudentPage >= totalStudentPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Sau ›
                  </button>
                  <button
                    onClick={() => setStudentPage(totalStudentPages)}
                    disabled={safeStudentPage >= totalStudentPages}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang cuối"
                  >
                    Cuối »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------- TAB 4: TEACHERS & ADMIN ACCOUNTS ----------------- */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={downloadTeacherTemplate}
                className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Tải file Excel mẫu Giáo viên
              </button>

              <label className="inline-flex items-center px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs">
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import Excel Giáo viên
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleTeacherFileSelect}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleOpenAddTeacher}
                className="inline-flex items-center px-3.5 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                {isMasterAdmin ? 'Thêm tài khoản GVCN / Admin' : 'Thêm tài khoản Giáo viên'}
              </button>
            </div>
          </div>

          {/* Accounts Table */}
          <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase text-[11px]">
                  <tr>
                    <th className="px-4 py-3">STT</th>
                    <th className="px-4 py-3">Họ và tên</th>
                    {isMasterAdmin && <th className="px-4 py-3">Vai trò</th>}
                    <th className="px-4 py-3">Lớp chủ nhiệm</th>
                    <th className="px-4 py-3">Tên đăng nhập</th>
                    <th className="px-4 py-3">Mật khẩu</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedTeachers.map((t, idx) => (
                    <tr key={t.id || t.username} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{t.full_name}</td>
                      {isMasterAdmin && (
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              t.role === 'admin'
                                ? 'bg-rose-100 text-[#7a0f2b] border border-rose-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {t.role === 'admin' ? '🛡️ Quản trị viên (Admin)' : '👨‍🏫 GVCN'}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 font-extrabold text-[#7a0f2b]">
                        {t.role === 'admin' ? 'Ban quản trị' : formatClassDisplay(t.homeroom_class)}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{t.username}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{t.password}</td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <button
                          onClick={() => handleOpenEditTeacher(t)}
                          className="p-1 text-slate-500 hover:text-[#7a0f2b] hover:bg-rose-50 rounded-md"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeacher(t)}
                          className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 5: SURVEYS & FORMS ----------------- */}
      {activeTab === 'surveys' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quản lý Đợt Khảo sát & Biểu mẫu thu thập</h3>
              <p className="text-xs text-slate-500">
                Hỗ trợ trắc nghiệm, điền thông tin, ngày tháng và tệp đính kèm tải lên Google Drive
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCodeSurveyModal(true)}
                className="inline-flex items-center px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Code className="w-4 h-4 mr-1.5" />
                Tạo khảo sát bằng Code
              </button>
              <button
                onClick={handleOpenAddSurvey}
                className="inline-flex items-center px-4 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tạo khảo sát mới
              </button>
            </div>
          </div>

          {/* Survey Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surveys.map(sv => {
              const isForm = sv.survey_type === 'form';
              const hasSpecificClasses = Boolean(sv.target_classes && sv.target_classes.length > 0 && !sv.target_classes.includes('ALL'));

              return (
                <div
                  key={sv.id}
                  className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between transition-all ${
                    isForm
                      ? 'bg-emerald-50/20 border-emerald-200 hover:border-emerald-300'
                      : 'bg-white border-rose-100 hover:border-rose-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                          isForm
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-[#7a0f2b] text-white border border-[#7a0f2b] shadow-2xs'
                        }`}>
                          {sv.survey_type === 'quiz' ? 'Trắc nghiệm có chấm điểm' : 'Thu thập thông tin'}
                        </span>
                        {hasSpecificClasses ? (
                          <span
                            className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200"
                            title={`Giao cho các lớp: ${sv.target_classes?.map(formatClassDisplay).join(', ')}`}
                          >
                            Lớp: {sv.target_classes?.map(formatClassDisplay).slice(0, 3).join(', ')}{sv.target_classes && sv.target_classes.length > 3 ? ` +${sv.target_classes.length - 3}` : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            Toàn trường
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {sv.questions?.length || 0} câu hỏi
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">{sv.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                      {sv.description}
                    </p>
                    {sv.google_drive_folder_id && sv.survey_type !== 'quiz' && (
                      <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono mb-3 bg-white p-1.5 rounded-lg border border-slate-200">
                        <HardDrive className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Drive ID: {sv.google_drive_folder_id}</span>
                      </div>
                    )}
                  </div>

                {/* Toggle Controls */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-medium">Trạng thái Mở / Khóa:</span>
                    <button
                      onClick={() => handleToggleSurveyField(sv, 'is_active')}
                      className={`flex items-center gap-1 font-bold ${
                        sv.is_active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {sv.is_active ? (
                        <>
                          <span>Đang Mở</span>
                          <ToggleRight className="w-6 h-6 text-emerald-600" />
                        </>
                      ) : (
                        <>
                          <span>Đã Khóa</span>
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-medium">Hiển thị Đáp án & Lời giải:</span>
                    <button
                      onClick={() => handleToggleSurveyField(sv, 'show_answers')}
                      className={`flex items-center gap-1 font-bold ${
                        sv.show_answers ? 'text-[#7a0f2b]' : 'text-slate-400'
                      }`}
                    >
                      {sv.show_answers ? (
                        <>
                          <span>Cho phép xem</span>
                          <ToggleRight className="w-6 h-6 text-[#7a0f2b]" />
                        </>
                      ) : (
                        <>
                          <span>Ẩn đáp án</span>
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-700 font-medium">Cho phép làm lại nhiều lần:</span>
                    <button
                      onClick={() => handleToggleSurveyField(sv, 'allow_multiple_attempts')}
                      className={`flex items-center gap-1 font-bold ${
                        sv.allow_multiple_attempts ? 'text-purple-700' : 'text-slate-400'
                      }`}
                    >
                      {sv.allow_multiple_attempts ? (
                        <>
                          <span>Cho phép</span>
                          <ToggleRight className="w-6 h-6 text-purple-600" />
                        </>
                      ) : (
                        <>
                          <span>Chỉ 1 lần</span>
                          <ToggleLeft className="w-6 h-6 text-slate-400" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditSurvey(sv)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Chỉnh sửa câu hỏi
                    </button>
                    <button
                      onClick={() => handleDeleteSurvey(sv)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* ----------------- TAB 6: REPORTS & EXCEL EXPORT ----------------- */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Báo cáo & Xuất dữ liệu Toàn trường ra Excel</h3>
              <p className="text-xs text-slate-500">Tải các báo cáo tổng hợp hoặc danh sách chi tiết của từng đợt khảo sát</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {surveys.map(sv => {
                const svResponses = responses.filter(r => r.survey_id === sv.id);
                return (
                  <div key={sv.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{sv.title}</h4>
                      <p className="text-xs text-slate-500">
                        Đã có <b>{svResponses.length}</b> học sinh nộp bài
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          exportFilteredSurveyResponsesToExcel(
                            sv,
                            students,
                            responses,
                            'Toan_Truong',
                            'Tat_Ca'
                          );
                        }}
                        className="px-3 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Xuất danh sách chi tiết toàn trường (.xlsx)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 7: SETTINGS ----------------- */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          {/* ANNOUNCEMENT CARD */}
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#7a0f2b]" />
                  Thông báo từ Ban quản trị
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nội dung thông báo sẽ xuất hiện trên màn hình đăng nhập và trang cá nhân của toàn bộ học sinh khi mở ứng dụng.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveAnnouncement}
                className="px-4 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                Cập nhật thông báo
              </button>
            </div>
            <textarea
              rows={3}
              value={announcementText}
              onChange={e => setAnnouncementText(e.target.value)}
              placeholder="Nhập thông báo gửi tới toàn thể học sinh và giáo viên..."
              className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#7a0f2b] focus:bg-white"
            ></textarea>
          </div>

          {/* THEME SELECTION CARD (Only Admin can change, applies to all accounts) */}
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#7a0f2b]" />
                  Theme Màu Giao diện Toàn trường (Chỉ Quản trị viên tối cao cấu hình)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lựa chọn theme màu sắc sẽ được lưu vào cơ sở dữ liệu Supabase và áp dụng đồng bộ cho tất cả tài khoản Học sinh, Giáo viên và Toàn trường.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-[#7a0f2b] border border-rose-200 self-start sm:self-auto">
                Hiện tại: {theme === 'burgundy' ? 'Đỏ Burgundy THPT Huỳnh Văn Nghệ' : theme === 'green' ? 'Xanh Lá Tươi Mới (Emerald)' : theme === 'glass' ? 'Glassmorphism & Mesh Gradient Hiện Đại' : 'Xanh Dương Giáo Dục'}
              </span>
            </div>

            {!isMasterAdmin && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Chỉ Quản trị viên tối cao (Master Admin) mới có quyền thay đổi Theme giao diện toàn trường. Tài khoản hiện tại chỉ có quyền xem.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {/* Option 1: Burgundy Red */}
              <div
                onClick={() => isMasterAdmin && handleChangeTheme('burgundy')}
                className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  !isMasterAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                } ${
                  theme === 'burgundy'
                    ? 'border-[#7a0f2b] bg-rose-50/50 shadow-xs ring-2 ring-[#7a0f2b]/20'
                    : 'border-slate-200 hover:border-rose-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#7a0f2b] inline-block shadow-xs border border-white"></span>
                      <span className="font-bold text-sm text-slate-900">Đỏ Burgundy</span>
                    </div>
                    {theme === 'burgundy' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#7a0f2b] text-white flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đang dùng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Gam màu đỏ rượu vang truyền thống mang nhận diện Trường THPT Huỳnh Văn Nghệ (1959), trang trọng, uy tín.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <div className="h-4 flex-1 rounded bg-[#7a0f2b]"></div>
                    <div className="h-4 flex-1 rounded bg-[#5a0a1f]"></div>
                    <div className="h-4 flex-1 rounded bg-[#a81a3d]"></div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isMasterAdmin || savingTheme || theme === 'burgundy'}
                  className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    !isMasterAdmin
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : theme === 'burgundy'
                      ? 'bg-[#7a0f2b] text-white cursor-default'
                      : 'bg-slate-100 hover:bg-[#7a0f2b] hover:text-white text-slate-700 cursor-pointer'
                  }`}
                >
                  {!isMasterAdmin
                    ? '🔒 Cần quyền Master Admin'
                    : savingTheme && theme !== 'burgundy'
                    ? 'Đang lưu...'
                    : theme === 'burgundy'
                    ? '✓ Đang áp dụng'
                    : 'Chọn Theme Đỏ'}
                </button>
              </div>

              {/* Option 2: Classic Blue */}
              <div
                onClick={() => isMasterAdmin && handleChangeTheme('blue')}
                className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  !isMasterAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                } ${
                  theme === 'blue'
                    ? 'border-blue-700 bg-blue-50/50 shadow-xs ring-2 ring-blue-700/20'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1e40af] inline-block shadow-xs border border-white"></span>
                      <span className="font-bold text-sm text-slate-900">Xanh Dương Giáo Dục</span>
                    </div>
                    {theme === 'blue' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-700 text-white flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đang dùng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Banner xanh đen đậm gradient, nút bấm xanh đậm và nền các khung màu xanh nhạt thanh lịch.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <div className="h-4 flex-1 rounded bg-[#1e40af]"></div>
                    <div className="h-4 flex-1 rounded bg-[#09152b]"></div>
                    <div className="h-4 flex-1 rounded bg-[#2563eb]"></div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isMasterAdmin || savingTheme || theme === 'blue'}
                  className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    !isMasterAdmin
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : theme === 'blue'
                      ? 'bg-blue-700 text-white cursor-default'
                      : 'bg-slate-100 hover:bg-blue-700 hover:text-white text-slate-700 cursor-pointer'
                  }`}
                >
                  {!isMasterAdmin
                    ? '🔒 Cần quyền Master Admin'
                    : savingTheme && theme !== 'blue'
                    ? 'Đang lưu...'
                    : theme === 'blue'
                    ? '✓ Đang áp dụng'
                    : 'Chọn Theme Xanh Dương'}
                </button>
              </div>

              {/* Option 3: Emerald Green */}
              <div
                onClick={() => isMasterAdmin && handleChangeTheme('green')}
                className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  !isMasterAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                } ${
                  theme === 'green'
                    ? 'border-emerald-700 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-700/20'
                    : 'border-slate-200 hover:border-emerald-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#047857] inline-block shadow-xs border border-white"></span>
                      <span className="font-bold text-sm text-slate-900">Xanh Lá Tươi Mới (Emerald)</span>
                    </div>
                    {theme === 'green' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-700 text-white flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đang dùng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Banner xanh lá đen đậm gradient, nút bấm xanh lá đậm, nền các khung màu xanh lá nhạt pastel tươi mới và dịu mắt.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <div className="h-4 flex-1 rounded bg-[#047857]"></div>
                    <div className="h-4 flex-1 rounded bg-[#022419]"></div>
                    <div className="h-4 flex-1 rounded bg-[#10b981]"></div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isMasterAdmin || savingTheme || theme === 'green'}
                  className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    !isMasterAdmin
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : theme === 'green'
                      ? 'bg-emerald-700 text-white cursor-default'
                      : 'bg-slate-100 hover:bg-emerald-700 hover:text-white text-slate-700 cursor-pointer'
                  }`}
                >
                  {!isMasterAdmin
                    ? '🔒 Cần quyền Master Admin'
                    : savingTheme && theme !== 'green'
                    ? 'Đang lưu...'
                    : theme === 'green'
                    ? '✓ Đang áp dụng'
                    : 'Chọn Theme Xanh Lá'}
                </button>
              </div>

              {/* Option 4: Glassmorphism & Mesh Gradient */}
              <div
                onClick={() => isMasterAdmin && handleChangeTheme('glass')}
                className={`p-4 rounded-2xl border-2 transition-all relative flex flex-col justify-between ${
                  !isMasterAdmin ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                } ${
                  theme === 'glass'
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50/90 via-purple-50/90 to-pink-50/90 shadow-md ring-2 ring-indigo-500/30'
                    : 'border-slate-200 hover:border-indigo-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 via-purple-500 to-pink-500 inline-block shadow-xs border border-white"></span>
                      <span className="font-bold text-sm text-slate-900">Glass & Mesh Gradient</span>
                    </div>
                    {theme === 'glass' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                        <Check className="w-3 h-3" /> Đang dùng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Menu Left Sidebar hiện đại, nền mesh gradient đa sắc, thẻ hiệu ứng kính mờ (glassmorphism) cùng các khối cầu trôi nổi ấn tượng.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <div className="h-4 flex-1 rounded bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                    <div className="h-4 flex-1 rounded bg-gradient-to-r from-purple-600 to-pink-600"></div>
                    <div className="h-4 flex-1 rounded bg-gradient-to-r from-teal-500 to-emerald-500"></div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isMasterAdmin || savingTheme || theme === 'glass'}
                  className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    !isMasterAdmin
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : theme === 'glass'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs cursor-default'
                      : 'bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 cursor-pointer'
                  }`}
                >
                  {!isMasterAdmin
                    ? '🔒 Cần quyền Master Admin'
                    : savingTheme && theme !== 'glass'
                    ? 'Đang lưu...'
                    : theme === 'glass'
                    ? '✓ Đang áp dụng'
                    : 'Chọn Theme Glassmorphism'}
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-2xl space-y-5">
            {/* Account & Password Management */}
            <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#7a0f2b]" />
                Bảo mật & Tài khoản Quản trị
              </h3>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Tên đăng nhập:</span>
                  <span className="font-mono font-bold text-slate-900">{currentAdminUsername}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Cấp độ phân quyền:</span>
                  <span className="font-bold text-[#7a0f2b]">
                    {isMasterAdmin ? 'Quản trị viên tối cao (Master Admin)' : 'Quản trị viên phụ trách'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Để bảo vệ an toàn hệ thống, khi đổi mật khẩu Quản trị bạn cần nhập chính xác mật khẩu hiện tại trước khi thiết lập mật khẩu mới.
              </p>

              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-rose-300" />
                Đổi mật khẩu tài khoản của tôi
              </button>
            </div>

            {/* Danger Zone: Only Master Admin can delete all students */}
            {isMasterAdmin && (
              <div className="bg-rose-50/60 p-5 rounded-2xl border-2 border-rose-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Quản lý Dữ liệu Học sinh Toàn trường (Vùng nguy hiểm)
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Chức năng đặc biệt dành riêng cho <b>Quản trị viên tối cao (Master Admin)</b>. Cho phép xóa toàn bộ danh sách học sinh và toàn bộ kết quả khảo sát của học sinh trong cơ sở dữ liệu khi bắt đầu năm học mới. Thao tác này <b>không thể hoàn tác</b>.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleDeleteAllStudents}
                    disabled={students.length === 0}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa tất cả học sinh trong trường ({students.length} HS)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </div>
      </div>

      {/* ----------------- MODAL: ADD / EDIT STUDENT ----------------- */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#7a0f2b] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingStudent ? 'Chỉnh sửa học sinh' : 'Thêm học sinh mới'}
              </h3>
              <button
                onClick={() => setShowStudentModal(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Họ và tên học sinh:</label>
                <input
                  type="text"
                  required
                  value={studentFormData.full_name}
                  onChange={e => setStudentFormData({ ...studentFormData, full_name: e.target.value })}
                  placeholder="Nhập họ và tên"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Số CCCD (12 chữ số):
                </label>
                <input
                  type="text"
                  required
                  maxLength={12}
                  autoCapitalize="none"
                  value={studentFormData.cccd}
                  onChange={e => setStudentFormData({ ...studentFormData, cccd: e.target.value })}
                  placeholder="Nhập 12 số CCCD"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Ngày sinh (dd/mm/yyyy):
                  </label>
                  <input
                    type="text"
                    required
                    value={studentFormData.dob_display}
                    onChange={e => setStudentFormData({ ...studentFormData, dob_display: e.target.value })}
                    placeholder="VD: 05/08/2009"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lớp:</label>
                  <input
                    type="text"
                    required
                    value={studentFormData.class_name}
                    onChange={e => setStudentFormData({ ...studentFormData, class_name: e.target.value })}
                    placeholder="VD: 10A1"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl uppercase font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStudentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white font-bold rounded-xl cursor-pointer"
                >
                  Lưu học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: IMPORT STUDENTS PREVIEW ----------------- */}
      {showImportStudentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#7a0f2b] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Xem trước kết quả Import Excel Học sinh</h3>
                <p className="text-xs text-rose-200">
                  Tự động chuẩn hóa 12 số CCCD và ngày sinh làm mật khẩu
                </p>
              </div>
              <button
                onClick={() => setShowImportStudentModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">
                  Tổng dòng: {parsedStudentRows.length}
                </span>
                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  Hợp lệ: {parsedStudentRows.filter(r => r.isValid).length}
                </span>
                {parsedStudentRows.some(r => !r.isValid) && (
                  <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">
                    Lỗi: {parsedStudentRows.filter(r => !r.isValid).length}
                  </span>
                )}
              </div>

              {importProgress !== null && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-bold text-[#7a0f2b] block">{importStatusText || `Đang lưu: ${importProgress}%`}</span>
                    <span className="text-[11px] text-slate-500">Vui lòng chờ hệ thống hoàn tất lưu vào cơ sở dữ liệu...</span>
                  </div>
                  <div className="w-28 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#7a0f2b] h-full transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Preview Header */}
            {parsedStudentRows.length > 100 && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <span>
                  {showAllImportPreview
                    ? `Đang hiển thị toàn bộ ${parsedStudentRows.length} dòng học sinh.`
                    : `Đang hiển thị 100 dòng xem trước đầu tiên (trong tổng số ${parsedStudentRows.length} dòng).`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllImportPreview(!showAllImportPreview)}
                  className="font-bold underline text-[#7a0f2b] hover:text-[#901335] cursor-pointer"
                >
                  {showAllImportPreview ? 'Thu gọn (chỉ xem 100 dòng)' : `Xem toàn bộ (${parsedStudentRows.length} dòng)`}
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Dòng</th>
                    <th className="px-3 py-2">Họ và tên</th>
                    <th className="px-3 py-2">Số CCCD</th>
                    <th className="px-3 py-2">Ngày sinh</th>
                    <th className="px-3 py-2">Mật khẩu</th>
                    <th className="px-3 py-2">Lớp</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(showAllImportPreview ? parsedStudentRows : parsedStudentRows.slice(0, 100)).map((r, i) => (
                    <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                      <td className="px-3 py-2 text-slate-500">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{r.full_name}</td>
                      <td className="px-3 py-2 font-mono">{r.cccd}</td>
                      <td className="px-3 py-2">{r.dob_display}</td>
                      <td className="px-3 py-2 font-mono text-emerald-700 font-semibold">{r.dob_password}</td>
                      <td className="px-3 py-2 font-bold">{r.class_name}</td>
                      <td className="px-3 py-2">
                        {r.isValid ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Hợp lệ
                          </span>
                        ) : (
                          <span className="text-rose-700 text-[11px] font-semibold">
                            {r.errors.join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setShowImportStudentModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmImportStudents}
                disabled={importProgress !== null || parsedStudentRows.filter(r => r.isValid).length === 0}
                className="px-6 py-2.5 bg-[#7a0f2b] hover:bg-[#8f1334] text-white font-bold rounded-xl text-xs shadow-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                Xác nhận Lưu ({parsedStudentRows.filter(r => r.isValid).length} học sinh)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: ADD / EDIT TEACHER & ADMIN ----------------- */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-[#7a0f2b] text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingTeacher ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản GVCN / Admin mới'}
              </h3>
              <button
                onClick={() => setShowTeacherModal(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Vai trò tài khoản:</label>
                <select
                  value={teacherFormData.role}
                  onChange={e => setTeacherFormData({ ...teacherFormData, role: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-[#7a0f2b]"
                >
                  <option value="teacher">👨‍🏫 Giáo viên chủ nhiệm (GVCN)</option>
                  <option value="admin">🛡️ Quản trị viên (Admin)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Họ và tên:</label>
                <input
                  type="text"
                  required
                  value={teacherFormData.full_name}
                  onChange={e => setTeacherFormData({ ...teacherFormData, full_name: e.target.value })}
                  placeholder="Nhập họ và tên"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              {teacherFormData.role === 'teacher' && (
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Lớp chủ nhiệm:</label>
                  <input
                    type="text"
                    required
                    value={teacherFormData.homeroom_class}
                    onChange={e => setTeacherFormData({ ...teacherFormData, homeroom_class: e.target.value })}
                    placeholder="VD: 10A1"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl uppercase font-bold"
                  />
                </div>
              )}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tên đăng nhập:</label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  value={teacherFormData.username}
                  onChange={e => setTeacherFormData({ ...teacherFormData, username: e.target.value })}
                  placeholder="Nhập tên đăng nhập"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mật khẩu:</label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  value={teacherFormData.password}
                  onChange={e => setTeacherFormData({ ...teacherFormData, password: e.target.value })}
                  placeholder="Nhập mật khẩu"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTeacherModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white font-bold rounded-xl cursor-pointer"
                >
                  Lưu tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: IMPORT TEACHERS PREVIEW ----------------- */}
      {showImportTeacherModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Xem trước Import Excel Giáo viên</h3>
              <button
                onClick={() => setShowImportTeacherModal(false)}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700">
                  Tổng dòng: {parsedTeacherRows.length}
                </span>
                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  Hợp lệ: {parsedTeacherRows.filter(r => r.isValid).length}
                </span>
                {parsedTeacherRows.some(r => !r.isValid) && (
                  <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">
                    Lỗi: {parsedTeacherRows.filter(r => !r.isValid).length}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">Mật khẩu được lưu dạng văn bản/chuỗi</span>
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Dòng</th>
                    <th className="px-3 py-2">Họ và tên</th>
                    <th className="px-3 py-2">Lớp CN</th>
                    <th className="px-3 py-2">Tên đăng nhập</th>
                    <th className="px-3 py-2">Mật khẩu</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedTeacherRows.map((r, i) => (
                    <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                      <td className="px-3 py-2 text-slate-500 font-semibold">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{r.full_name}</td>
                      <td className="px-3 py-2 font-bold text-[#7a0f2b]">{r.homeroom_class}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{r.username}</td>
                      <td className="px-3 py-2 font-mono text-slate-600">{r.password}</td>
                      <td className="px-3 py-2">
                        {r.isValid ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Hợp lệ
                          </span>
                        ) : (
                          <span className="text-rose-700 text-[11px] font-semibold">
                            {r.errors.join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setShowImportTeacherModal(false)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmImportTeachers}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Lưu vào hệ thống ({parsedTeacherRows.filter(r => r.isValid).length} GV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: SURVEY / FORM / EXAM BUILDER ----------------- */}
      <SurveyEditorModal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        onSave={handleSaveSurveyFromModal}
        editingSurvey={editingSurvey}
        allClasses={allClasses}
        isAdmin={true}
      />

      {/* ----------------- MODAL: CREATE SURVEY FROM CODE (JSON) ----------------- */}
      <CodeSurveyModal
        isOpen={showCodeSurveyModal}
        onClose={() => setShowCodeSurveyModal(false)}
        onSaveSurveyFromCode={handleSaveSurveyFromCode}
      />

      {/* Delete Survey Confirmation Modal */}
      {surveyToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100 text-center animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-rose-100 text-[#7a0f2b] rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Xác nhận xóa đợt khảo sát
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Bạn có chắc chắn muốn xóa bài khảo sát <b className="text-slate-900">"{surveyToDelete.title}"</b>? Toàn bộ kết quả phản hồi của học sinh liên quan đến bài này sẽ bị xóa vĩnh viễn và không thể khôi phục.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={deletingSurvey}
                onClick={() => setSurveyToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deletingSurvey}
                onClick={confirmDeleteSurvey}
                className="px-5 py-2.5 rounded-xl bg-[#7a0f2b] hover:bg-[#8f1334] text-white text-xs font-bold shadow-md cursor-pointer transition-colors flex items-center gap-2"
              >
                {deletingSurvey && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{deletingSurvey ? 'Đang xóa...' : 'Đồng ý xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userRole="admin"
        username={currentAdminUsername}
        onPasswordChanged={() => {
          showToast('Mật khẩu Quản trị viên đã được cập nhật thành công!');
          loadAllData();
        }}
      />

      {/* Student Survey Detail Modal */}
      {selectedStudentDetail && (() => {
        const activeSurvey = surveys.find(s => s.id === (selectedStudentDetail.response?.survey_id || progressSurveyId)) || selectedProgressSurvey;
        const resp = selectedStudentDetail.response;
        const student = selectedStudentDetail.student;
        const isQuiz = activeSurvey?.survey_type === 'quiz' || activeSurvey?.survey_type === 'exam';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-[#7a0f2b] to-[#a11b3e] text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white font-bold shrink-0 shadow-inner">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      {student.full_name}
                    </h3>
                    <p className="text-xs text-rose-100/90 mt-0.5">
                      Lớp: <span className="font-bold text-white">{formatClassDisplay(student.class_name)}</span> • CCCD: <span className="font-mono text-white">{student.cccd}</span> • Ngày sinh: {student.dob_display}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudentDetail(null)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Survey Summary Header */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Đợt khảo sát: </span>
                  <span className="font-bold text-slate-800">{activeSurvey?.title || 'Chưa chọn khảo sát'}</span>
                </div>
                <div>
                  {resp ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Đã nộp bài
                      </span>
                      {isQuiz && (
                        <span className="bg-rose-100 text-[#7a0f2b] px-2.5 py-0.5 rounded-full font-bold border border-rose-200">
                          Điểm: {resp.score} / {resp.total_questions || activeSurvey?.questions.length} ({Math.round(((resp.score || 0) / (resp.total_questions || activeSurvey?.questions.length || 1)) * 100)}%)
                        </span>
                      )}
                      {resp.submitted_at && (
                        <span className="text-slate-500">
                          {new Date(resp.submitted_at).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full font-medium">
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                      Chưa thực hiện
                    </span>
                  )}
                </div>
              </div>

              {/* Questions & Answers Content */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {!resp ? (
                  <div className="py-12 text-center text-slate-500">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                      <FileText className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">Học sinh chưa thực hiện bài khảo sát này</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Khi học sinh hoàn thành và gửi bài, chi tiết toàn bộ các câu trả lời và tệp đính kèm sẽ hiển thị tại đây.
                    </p>
                  </div>
                ) : !activeSurvey?.questions?.length ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Không có danh sách câu hỏi trong bài khảo sát này.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {activeSurvey.questions.map((q, qIdx) => {
                      const ans = resp.answers ? (resp.answers[q.id] !== undefined ? resp.answers[q.id] : resp.answers[String(qIdx)]) : undefined;
                      const qType = q.type || (q.options && q.options.length > 0 ? 'single_choice' : 'text');
                      const correct = (activeSurvey.survey_type === 'quiz' || activeSurvey.survey_type === 'exam')
                        ? isAnswerCorrect(ans, q)
                        : null;

                      return (
                        <div
                          key={q.id || qIdx}
                          className={`p-4 rounded-xl border transition-all ${
                            (activeSurvey.survey_type === 'quiz' || activeSurvey.survey_type === 'exam')
                              ? correct
                                ? 'bg-emerald-50/50 border-emerald-200'
                                : 'bg-rose-50/50 border-rose-200'
                              : 'bg-slate-50/70 border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-md bg-white text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                                {qIdx + 1}
                              </span>
                              <div>
                                <div className="text-sm font-bold text-slate-900 leading-snug">
                                  <MathRenderer content={q.question} inline />
                                </div>
                                {q.file_code_prefix && (
                                  <span className="text-[10px] text-slate-500 font-mono mt-0.5 inline-block">Mã tệp: [{q.file_code_prefix}]</span>
                                )}
                              </div>
                            </div>
                            {(activeSurvey.survey_type === 'quiz' || activeSurvey.survey_type === 'exam') && (
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                                  correct
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-[#7a0f2b]'
                                }`}
                              >
                                {correct ? '✓ Đúng' : '✗ Sai'}
                              </span>
                            )}
                          </div>

                          {/* Image if present */}
                          {q.image_url && (
                            <div className="my-2">
                              <img
                                src={q.image_url}
                                alt="Hình ảnh đính kèm"
                                className="max-h-48 rounded-lg border border-slate-200 object-contain bg-white p-1"
                              />
                            </div>
                          )}

                          {/* Detail of response */}
                          <div className="mt-2 text-xs">
                            {qType === 'file' ? (
                              <div className="mt-1 bg-white p-3 rounded-lg border border-slate-200">
                                <span className="text-slate-500 font-semibold block mb-1">Tệp đính kèm đã tải lên:</span>
                                {ans ? (
                                  typeof ans === 'object' && ans.url ? (
                                    <a
                                      href={ans.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7a0f2b] text-white font-bold rounded-lg text-xs hover:bg-[#8f1334] transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>{ans.name || 'Xem tệp trên Google Drive'}</span>
                                    </a>
                                  ) : typeof ans === 'string' && (ans.startsWith('http') || ans.includes('drive.google.com')) ? (
                                    <a
                                      href={ans}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#7a0f2b] text-white font-bold rounded-lg text-xs hover:bg-[#8f1334] transition-colors"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      <span>Xem tệp trên Google Drive</span>
                                    </a>
                                  ) : (
                                    <span className="font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded">
                                      {typeof ans === 'object' ? JSON.stringify(ans) : String(ans)}
                                    </span>
                                  )
                                ) : (
                                  <span className="text-slate-400 italic">Không có tệp đính kèm</span>
                                )}
                              </div>
                            ) : qType === 'true_false' ? (
                              <div className="space-y-1.5">
                                {['a', 'b', 'c', 'd'].map((letter, optIdx) => {
                                  const sVal = ans && typeof ans === 'object' ? ans[optIdx] : undefined;
                                  const cVal = q.correct_answers ? q.correct_answers[optIdx] : false;
                                  const isItemMatch = sVal === cVal;

                                  return (
                                    <div key={optIdx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
                                      <div className="flex-1 mr-2">
                                        <b>{letter})</b> <MathRenderer content={q.options?.[optIdx] || ''} inline />
                                      </div>
                                      <span className={isItemMatch ? 'text-emerald-700 font-bold shrink-0' : 'text-rose-700 font-bold shrink-0'}>
                                        HS: {sVal === true ? 'ĐÚNG' : sVal === false ? 'SAI' : 'Trống'} | Chuẩn: {cVal ? 'ĐÚNG' : 'SAI'} {isItemMatch ? '✓' : '✗'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (qType === 'short_number' || qType === 'short_text') ? (
                              <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                                <div>
                                  <span className="text-slate-500 font-semibold">Học sinh điền: </span>
                                  <span className="font-mono font-bold text-slate-900">{ans !== undefined && ans !== null && ans !== '' ? String(ans) : '(Bỏ trống)'}</span>
                                </div>
                                <div className="text-emerald-700 font-semibold">
                                  Đáp án chuẩn: <span className="font-mono font-bold">{String(q.correct_answer ?? '')}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-start gap-1.5">
                                  <span className="text-slate-500 font-semibold shrink-0">Câu trả lời: </span>
                                  <span className="font-bold text-slate-900 break-words">
                                    {ans !== undefined && ans !== null && ans !== '' ? (
                                      typeof ans === 'number' && q.options && q.options[ans] !== undefined ? (
                                        <span>{String.fromCharCode(65 + ans)}. <MathRenderer content={q.options[ans]} inline /></span>
                                      ) : (
                                        String(ans)
                                      )
                                    ) : (
                                      <span className="text-slate-400 italic font-normal">(Chưa trả lời)</span>
                                    )}
                                  </span>
                                </div>
                                {(activeSurvey.survey_type === 'quiz' || activeSurvey.survey_type === 'exam') && q.correct_answer !== undefined && (
                                  <div className="flex items-start gap-1.5 text-slate-600">
                                    <span className="text-emerald-700 font-semibold shrink-0">Đáp án đúng: </span>
                                    <span className="font-semibold text-emerald-800 break-words">
                                      {q.options && q.options[q.correct_answer] !== undefined ? (
                                        <span>{String.fromCharCode(65 + q.correct_answer)}. <MathRenderer content={q.options[q.correct_answer]} inline /></span>
                                      ) : (
                                        String(q.correct_answer)
                                      )}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedStudentDetail(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Đóng lại
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ----------------- MODAL: CLASS-BY-CLASS PROGRESS ----------------- */}
      {showClassProgressModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-300" />
                  Tiến độ khảo sát theo từng lớp
                </h3>
                <p className="text-xs text-indigo-200 mt-0.5">
                  Đợt khảo sát: <b className="text-white">{selectedProgressSurvey?.title || 'Chưa chọn'}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClassProgressModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-700">Sắp xếp:</span>
                <button
                  type="button"
                  onClick={() => setClassProgressSort('class_order')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    classProgressSort === 'class_order'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Thứ tự lớp chuẩn (10.1 → 12.12)
                </button>
                <button
                  type="button"
                  onClick={() => setClassProgressSort('rate_desc')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    classProgressSort === 'rate_desc'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tỉ lệ: Cao → Thấp
                </button>
                <button
                  type="button"
                  onClick={() => setClassProgressSort('rate_asc')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    classProgressSort === 'rate_asc'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tỉ lệ: Thấp → Cao
                </button>
              </div>

              {/* Zalo Copy Button for Admin */}
              <button
                type="button"
                onClick={handleCopyZaloAdminMessage}
                className="inline-flex items-center px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer text-xs"
                title="Sao chép tin nhắn lịch sự gửi vào nhóm Zalo GVCN để nhắc nhở các lớp tiến độ thấp"
              >
                {copiedZaloAdmin ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-300" />
                    Đã sao chép tin nhắn Zalo!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy tin nhắn Zalo gửi GVCN
                  </>
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Grade Summaries */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {gradeSummaries.map(g => (
                  <div
                    key={g.grade}
                    className="p-3.5 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 shadow-2xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-indigo-950">{g.grade}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-700 text-white">
                        {g.rate}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <div>
                        Đã thực hiện: <b className="text-emerald-800">{g.done}</b> / {g.total} HS
                      </div>
                      {selectedProgressSurvey?.survey_type === 'quiz' && (
                        <div>
                          Điểm trung bình khối: <b className="text-indigo-800">{g.avgScore} đ</b>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Color legend guide */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 font-bold mr-1">Quy ước màu:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  100% (Hoàn thành)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ≥ 80%
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  ≥ 50%
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                  ≥ 30%
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                  &lt; 30%
                </span>
              </div>

              {/* Classes Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[460px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="px-3.5 py-2.5">STT</th>
                        <th className="px-3.5 py-2.5">Lớp</th>
                        <th className="px-3.5 py-2.5 text-center">Sĩ số</th>
                        <th className="px-3.5 py-2.5 text-center">Đã thực hiện</th>
                        <th className="px-3.5 py-2.5 text-center">Tỉ lệ (%)</th>
                        {selectedProgressSurvey?.survey_type === 'quiz' && (
                          <th className="px-3.5 py-2.5 text-center">Điểm TB</th>
                        )}
                        <th className="px-3.5 py-2.5">Thời điểm hoàn thành 100%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedClassProgress.map((c, idx) => {
                        let rowBg = 'bg-rose-50/70 hover:bg-rose-100/70 text-rose-950';
                        let badgeBg = 'bg-rose-600 text-white';
                        if (c.rate === 100) {
                          rowBg = 'bg-blue-50/80 hover:bg-blue-100/80 text-blue-950 font-medium';
                          badgeBg = 'bg-blue-600 text-white';
                        } else if (c.rate >= 80) {
                          rowBg = 'bg-emerald-50/80 hover:bg-emerald-100/80 text-emerald-950';
                          badgeBg = 'bg-emerald-600 text-white';
                        } else if (c.rate >= 50) {
                          rowBg = 'bg-amber-50/80 hover:bg-amber-100/80 text-amber-950';
                          badgeBg = 'bg-amber-600 text-white';
                        } else if (c.rate >= 30) {
                          rowBg = 'bg-orange-50/80 hover:bg-orange-100/80 text-orange-950';
                          badgeBg = 'bg-orange-600 text-white';
                        }

                        return (
                          <tr key={c.className} className={`transition-colors ${rowBg}`}>
                            <td className="px-3.5 py-2.5 font-semibold text-slate-500">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-black text-sm">
                              Lớp {formatClassDisplay(c.className)}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-semibold text-slate-700">
                              {c.totalInClass}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-bold">
                              {c.completedInClass} / {c.totalInClass}
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs ${badgeBg}`}>
                                {c.rate}%
                              </span>
                            </td>
                            {selectedProgressSurvey?.survey_type === 'quiz' && (
                              <td className="px-3.5 py-2.5 text-center font-bold">
                                {c.completedInClass > 0 ? `${c.avgScore} đ` : '-'}
                              </td>
                            )}
                            <td className="px-3.5 py-2.5 text-xs font-mono">
                              {c.completedAt100 ? (
                                <span className="inline-flex items-center gap-1 font-bold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-300">
                                  <Check className="w-3.5 h-3.5 text-blue-700" />
                                  {c.completedAt100}
                                </span>
                              ) : c.rate === 100 ? (
                                <span className="text-blue-800 font-semibold">Đã hoàn thành</span>
                              ) : (
                                <span className="text-slate-400 italic">Chưa hoàn thành</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Tổng cộng: <b>{sortedClassProgress.length}</b> lớp học
              </span>
              <button
                type="button"
                onClick={() => setShowClassProgressModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
