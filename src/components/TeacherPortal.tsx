import React, { useState, useEffect } from 'react';
import { Teacher, Student, Survey, SurveyResponse } from '../types';
import { getStudents, getSurveys, getResponses, saveSurvey } from '../services/supabase';
import { exportClassResultsToExcel } from '../utils/excel';
import { isAnswerCorrect, getTrueFalseMatchCount } from '../utils/quiz';
import { useTheme } from '../context/ThemeContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { formatClassDisplay, sortClassNames } from '../utils/classOrder';
import { SurveyEditorModal } from './SurveyEditorModal';
import { CodeSurveyModal } from './CodeSurveyModal';
import { MathRenderer } from './MathRenderer';
import {
  Users, CheckCircle2, Clock, Award, FileSpreadsheet,
  Copy, Check, Search, Eye, X, BookOpen, AlertCircle, ExternalLink,
  KeyRound, Plus, Code, Edit2, Sparkles, FileText
} from 'lucide-react';

interface TeacherPortalProps {
  teacher: Teacher;
}

export const TeacherPortal: React.FC<TeacherPortalProps> = ({ teacher }) => {
  const { config } = useTheme();
  const [students, setStudents] = useState<Student[]>([]);
  const [allClasses, setAllClasses] = useState<string[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Survey Creation & Editing for Teacher
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [showCodeSurveyModal, setShowCodeSurveyModal] = useState(false);

  // Change Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Copy Zalo state
  const [copiedZalo, setCopiedZalo] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Student detail modal
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailResponse, setDetailResponse] = useState<SurveyResponse | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadData();
  }, [teacher.homeroom_class]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allStudents, allSurveys, allResponses] = await Promise.all([
        getStudents(),
        getSurveys(),
        getResponses(),
      ]);

      const classList = sortClassNames(Array.from(new Set(allStudents.map(s => s.class_name.trim().toUpperCase()))));
      setAllClasses(classList);

      const classStudents = allStudents.filter(
        s => s.class_name.trim().toUpperCase() === teacher.homeroom_class.trim().toUpperCase()
      );
      setStudents(classStudents);

      const normalizedClass = teacher.homeroom_class.trim().toUpperCase();
      const applicableSurveys = allSurveys.filter(
        s => !s.target_classes || s.target_classes.length === 0 || s.target_classes.includes('ALL') || s.target_classes.map(c => c.trim().toUpperCase()).includes(normalizedClass)
      );
      setSurveys(applicableSurveys.length > 0 ? applicableSurveys : allSurveys);
      setResponses(allResponses);

      const targetList = applicableSurveys.length > 0 ? applicableSurveys : allSurveys;
      if (targetList.length > 0 && (!selectedSurveyId || !targetList.some(s => s.id === selectedSurveyId))) {
        setSelectedSurveyId(targetList[0].id);
      }
    } catch (e) {
      console.error('Error loading teacher data', e);
    } finally {
      setLoading(false);
    }
  };

  const currentSurvey = surveys.find(s => s.id === selectedSurveyId) || surveys[0];

  const currentSurveyResponses = responses.filter(
    r => r.survey_id === currentSurvey?.id &&
         r.class_name.trim().toUpperCase() === teacher.homeroom_class.trim().toUpperCase()
  );

  const responseMap = new Map<string, SurveyResponse>();
  currentSurveyResponses.forEach(r => responseMap.set(r.student_cccd, r));

  const totalStudents = students.length;
  const completedStudents = students.filter(s => responseMap.has(s.cccd));
  const pendingStudents = students.filter(s => !responseMap.has(s.cccd));
  const completedCount = completedStudents.length;
  const pendingCount = pendingStudents.length;
  const completionRate = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;

  let averageScore: number | null = null;
  if ((currentSurvey?.survey_type === 'quiz' || currentSurvey?.survey_type === 'exam') && completedCount > 0) {
    const totalScore = completedStudents.reduce((sum, s) => {
      const r = responseMap.get(s.cccd);
      return sum + (r?.score || 0);
    }, 0);
    averageScore = Number((totalScore / completedCount).toFixed(2));
  }

  const filteredStudents = students.filter(s => {
    const isCompleted = responseMap.has(s.cccd);
    if (filterStatus === 'completed' && !isCompleted) return false;
    if (filterStatus === 'pending' && isCompleted) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = s.full_name.toLowerCase().includes(term);
      const matchCccd = s.cccd.includes(term);
      if (!matchName && !matchCccd) return false;
    }
    return true;
  });

  const handleCopyZaloMessage = () => {
    if (!currentSurvey) return;

    let text = `📢 [THÔNG BÁO NHẮC NHỞ LÀM KHẢO SÁT - LỚP ${formatClassDisplay(teacher.homeroom_class)}]\n`;
    text += `Đợt khảo sát: "${currentSurvey.title}"\n`;
    text += `------------------------------------\n`;
    text += `Sĩ số lớp: ${totalStudents} | Đã hoàn thành: ${completedCount}/${totalStudents} (${completionRate}%)\n\n`;

    if (pendingStudents.length === 0) {
      text += `🎉 Chúc mừng lớp ${formatClassDisplay(teacher.homeroom_class)}! 100% các bạn đã hoàn thành khảo sát.\n`;
    } else {
      text += `Danh sách ${pendingStudents.length} bạn chưa hoàn thành khảo sát:\n`;
      pendingStudents.forEach((s, idx) => {
        text += `${idx + 1}. ${s.full_name}\n`;
      });
      text += `\n🔗 Link làm khảo sát: https://khao-sat-hvn.netlify.app\n`;
      text += `Đề nghị các bạn khẩn trương đăng nhập vào link trên và nộp bài trước thời hạn quy định!\n`;
    }

    navigator.clipboard.writeText(text);
    setCopiedZalo(true);
    setTimeout(() => setCopiedZalo(false), 2500);
  };

  const handleExportExcel = () => {
    if (!currentSurvey) return;
    exportClassResultsToExcel(
      teacher.homeroom_class,
      currentSurvey.title,
      students,
      currentSurveyResponses,
      currentSurvey
    );
  };

  const handleOpenStudentDetail = (student: Student) => {
    const resp = responseMap.get(student.cccd) || null;
    setDetailStudent(student);
    setDetailResponse(resp);
  };

  // Survey Creation / Editing for Teacher
  const handleOpenCreateSurvey = () => {
    setEditingSurvey(null);
    setShowSurveyModal(true);
  };

  const handleOpenEditCurrentSurvey = () => {
    if (!currentSurvey) return;
    setEditingSurvey(currentSurvey);
    setShowSurveyModal(true);
  };

  const handleSaveSurveyFromModal = async (surveyToSave: Survey): Promise<boolean> => {
    const ok = await saveSurvey(surveyToSave);
    if (ok) {
      showToast(`Đã lưu bài "${surveyToSave.title}" thành công!`);
      setShowSurveyModal(false);
      await loadData();
      setSelectedSurveyId(surveyToSave.id);
      return true;
    } else {
      showToast('Lỗi khi lưu bài khảo sát!', 'error');
      return false;
    }
  };

  const handleSaveSurveyFromCode = async (surveyToSave: Survey) => {
    const ok = await saveSurvey(surveyToSave);
    if (ok) {
      showToast(`Đã tạo thành công bài "${surveyToSave.title}" từ mã code!`);
      setShowCodeSurveyModal(false);
      await loadData();
      setSelectedSurveyId(surveyToSave.id);
    } else {
      showToast('Lỗi khi lưu khảo sát từ code', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center space-x-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Teacher Action Bar: Create Survey, Import Code, Survey Selector */}
      <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Survey Dropdown & Edit button */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Chọn đợt khảo sát:
          </label>
          <select
            value={selectedSurveyId}
            onChange={e => setSelectedSurveyId(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs sm:text-sm rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#7a0f2b] focus:bg-white font-bold"
          >
            {surveys.map(s => (
              <option key={s.id} value={s.id}>
                {s.survey_type === 'exam' ? '📝 [Kiểm tra] ' : s.survey_type === 'quiz' ? '🎯 [Trắc nghiệm] ' : '📋 [Thu thập] '}
                {s.title} ({s.is_active ? 'Đang mở' : 'Đã đóng'})
              </option>
            ))}
          </select>

          {currentSurvey && (
            <button
              type="button"
              onClick={handleOpenEditCurrentSurvey}
              className="p-2 text-slate-600 hover:text-[#7a0f2b] hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Chỉnh sửa bài khảo sát / kiểm tra này"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right: Teacher Actions (Create Survey, Code Import, Export Excel, Zalo Copy) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Create Survey Button for Teacher */}
          <button
            type="button"
            onClick={handleOpenCreateSurvey}
            className="inline-flex items-center px-3.5 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Giáo viên tạo khảo sát hoặc đề kiểm tra mới"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tạo đề / Khảo sát mới
          </button>

          {/* Import Code Button for Teacher */}
          <button
            type="button"
            onClick={() => setShowCodeSurveyModal(true)}
            className="inline-flex items-center px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Tạo nhanh khảo sát bằng mã JSON (Hỗ trợ LaTeX & TikZ)"
          >
            <Code className="w-4 h-4 mr-1.5 text-rose-300" />
            Nhập đề từ Code
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-all cursor-pointer"
            title="Xuất kết quả khảo sát của lớp ra tệp Excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-700" />
            Xuất Excel lớp
          </button>

          <button
            onClick={handleCopyZaloMessage}
            className={`inline-flex items-center px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs ${
              copiedZalo
                ? 'bg-[#7a0f2b] text-white'
                : 'bg-rose-50 text-[#7a0f2b] hover:bg-rose-100 border border-rose-200'
            }`}
          >
            {copiedZalo ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Đã sao chép Zalo!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5" />
                Dán Zalo nhắc nhở
              </>
            )}
          </button>
        </div>
      </div>

      {/* Class Statistics 4-Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Sĩ số lớp</span>
            <span className="text-2xl font-black text-slate-900">{totalStudents}</span>
            <span className="text-[11px] text-slate-400 block mt-0.5">Học sinh lớp {formatClassDisplay(teacher.homeroom_class)}</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-[#7a0f2b] block font-semibold">Đã tham gia</span>
            <span className="text-2xl font-black text-[#7a0f2b]">{completedCount}</span>
            <span className="text-[11px] text-rose-700 block mt-0.5">Tỷ lệ {completionRate}%</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-100 flex items-center justify-center text-[#7a0f2b]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-700 block font-semibold">Chưa tham gia</span>
            <span className="text-2xl font-black text-amber-800">{pendingCount}</span>
            <span className="text-[11px] text-amber-600 block mt-0.5">Cần nhắc nhở</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block font-semibold">Điểm TB của lớp</span>
            <span className="text-2xl font-black text-slate-800">
              {averageScore !== null ? `${averageScore} đ` : 'N/A'}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              {currentSurvey?.survey_type === 'exam'
                ? 'Thang 10 điểm'
                : currentSurvey?.survey_type === 'quiz'
                ? `Thang ${currentSurvey.questions.length} điểm`
                : 'Phiếu ý kiến'}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-xs">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-700">Tiến độ hoàn thành của lớp {formatClassDisplay(teacher.homeroom_class)}</span>
          <span className="text-[#7a0f2b] font-bold">{completedCount} / {totalStudents} học sinh ({completionRate}%)</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#7a0f2b] to-[#991b3d] h-full rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          ></div>
        </div>
      </div>

      {/* Student List & Filters */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
        {/* Table Controls Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({totalStudents})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterStatus === 'completed'
                  ? 'bg-[#7a0f2b] text-white shadow-xs font-bold'
                  : 'text-[#7a0f2b] hover:bg-rose-50'
              }`}
            >
              Đã hoàn thành ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterStatus === 'pending'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Chưa hoàn thành ({pendingCount})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              autoCapitalize="none"
              placeholder="Tìm theo tên hoặc CCCD..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#7a0f2b] focus:bg-white"
            />
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <div className="w-6 h-6 border-2 border-[#7a0f2b] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Đang tải dữ liệu học sinh lớp {formatClassDisplay(teacher.homeroom_class)}...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Không tìm thấy học sinh nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">STT</th>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-4 py-3">Số CCCD</th>
                  <th className="px-4 py-3">Ngày sinh</th>
                  <th className="px-4 py-3 text-center">Trạng thái</th>
                  {(currentSurvey?.survey_type === 'quiz' || currentSurvey?.survey_type === 'exam') && (
                    <th className="px-4 py-3 text-center">Điểm số</th>
                  )}
                  <th className="px-4 py-3">Thời gian nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, index) => {
                  const resp = responseMap.get(s.cccd);
                  const isDone = !!resp;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-500">
                        {s.stt || index + 1}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {isDone ? (
                          <button
                            type="button"
                            onClick={() => handleOpenStudentDetail(s)}
                            className="font-bold text-slate-900 hover:text-[#7a0f2b] hover:underline cursor-pointer text-left focus:outline-none"
                            title="Nhấp vào tên để xem bài làm của học sinh"
                          >
                            {s.full_name}
                          </button>
                        ) : (
                          <span className="text-slate-900">{s.full_name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {s.cccd}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.dob_display}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isDone
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-[#7a0f2b]'
                          }`}
                        >
                          {isDone ? 'Đã hoàn thành' : 'Chưa làm'}
                        </span>
                      </td>
                      {(currentSurvey?.survey_type === 'quiz' || currentSurvey?.survey_type === 'exam') && (
                        <td className="px-4 py-3 text-center font-bold">
                          {isDone && resp?.score !== undefined ? (
                            <span className="text-[#7a0f2b] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                              {currentSurvey.survey_type === 'exam'
                                ? `${resp.score} / 10 đ`
                                : `${resp.score} / ${resp.total_questions || currentSurvey?.questions.length}`}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {isDone && resp?.submitted_at
                          ? new Date(resp.submitted_at).toLocaleString('vi-VN')
                          : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Submission Detail Modal */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-[#7a0f2b] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Bài làm của: {detailStudent.full_name}</h3>
                <p className="text-xs text-rose-200">
                  Lớp {formatClassDisplay(detailStudent.class_name)} • Số CCCD: {detailStudent.cccd}
                </p>
              </div>
              <button
                onClick={() => setDetailStudent(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {detailResponse ? (
                <>
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center justify-between">
                    <div>
                      <span className="text-[#7a0f2b] font-bold block">
                        {currentSurvey?.survey_type === 'exam'
                          ? `Kết quả kiểm tra: ${detailResponse.score} / 10 điểm`
                          : currentSurvey?.survey_type === 'quiz'
                          ? `Kết quả: ${detailResponse.score} / ${detailResponse.total_questions || currentSurvey?.questions.length} câu đúng`
                          : 'Đã hoàn thành khảo sát thu thập thông tin'}
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Nộp lúc: {new Date(detailResponse.submitted_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm">Chi tiết từng câu hỏi:</h4>
                    {currentSurvey?.questions.map((q, idx) => {
                      const studentAns = detailResponse.answers?.[q.id];
                      const qType = q.type || (q.options && q.options.length > 0 ? 'single_choice' : 'text');
                      const isCorrect = isAnswerCorrect(studentAns, q);

                      return (
                        <div key={q.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-slate-900">
                              <span>Câu {idx + 1}: </span>
                              <MathRenderer content={q.question} inline />
                            </div>
                            {(currentSurvey.survey_type === 'quiz' || currentSurvey.survey_type === 'exam') && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-[#7a0f2b]'
                                }`}
                              >
                                {isCorrect ? 'Đúng' : 'Chưa đúng'}
                              </span>
                            )}
                          </div>

                          {/* Image if present */}
                          {q.image_url && (
                            <img
                              src={q.image_url}
                              alt="Hình ảnh câu hỏi"
                              className="max-h-40 rounded-lg border border-slate-200 object-contain"
                            />
                          )}

                          <div className="text-slate-700 space-y-1.5 pl-2 border-l-2 border-slate-300">
                            {/* Single choice */}
                            {qType === 'single_choice' && (
                              <div>
                                <span className="text-slate-500">Học sinh chọn: </span>
                                <span className="font-bold">
                                  {typeof studentAns === 'number' && q.options?.[studentAns]
                                    ? `${String.fromCharCode(65 + studentAns)}. ${q.options[studentAns]}`
                                    : studentAns !== undefined && studentAns !== null ? String(studentAns) : 'Bỏ trống'}
                                </span>
                                {q.correct_answer !== undefined && q.options && (
                                  <div className="text-emerald-700 font-semibold mt-1">
                                    Đáp án chuẩn: {String.fromCharCode(65 + q.correct_answer)}. {q.options[q.correct_answer]}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* True / False */}
                            {qType === 'true_false' && (
                              <div className="space-y-1">
                                {['a', 'b', 'c', 'd'].map((letter, optIdx) => {
                                  const sVal = studentAns && typeof studentAns === 'object' ? studentAns[optIdx] : undefined;
                                  const cVal = q.correct_answers ? q.correct_answers[optIdx] : false;
                                  const isItemMatch = sVal === cVal;

                                  return (
                                    <div key={optIdx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded-lg border border-slate-200">
                                      <span><b>{letter})</b> {q.options?.[optIdx]}</span>
                                      <span className={isItemMatch ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                        HS: {sVal === true ? 'ĐÚNG' : sVal === false ? 'SAI' : 'Trống'} | Chuẩn: {cVal ? 'ĐÚNG' : 'SAI'} {isItemMatch ? '✓' : '✗'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Short Answers */}
                            {(qType === 'short_number' || qType === 'short_text') && (
                              <div>
                                <div>
                                  <span className="text-slate-500">Học sinh điền: </span>
                                  <span className="font-mono font-bold text-slate-900">{String(studentAns || '(Bỏ trống)')}</span>
                                </div>
                                <div className="text-emerald-700 font-semibold mt-0.5">
                                  Đáp án chuẩn: <span className="font-mono">{String(q.correct_answer)}</span>
                                </div>
                              </div>
                            )}

                            {/* File Upload */}
                            {qType === 'file' && studentAns && typeof studentAns === 'object' && studentAns.fileUrl && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono font-bold text-[#7a0f2b]">{studentAns.fileName}</span>
                                <a
                                  href={studentAns.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-0.5 rounded bg-rose-50 text-[#7a0f2b] border border-rose-200 text-xs font-semibold hover:bg-rose-100 inline-flex items-center gap-1"
                                >
                                  Xem trên Google Drive
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-slate-500">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  Học sinh chưa nộp bài khảo sát này.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 text-right">
              <button
                onClick={() => setDetailStudent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Survey Editor Modal for Teacher */}
      <SurveyEditorModal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        onSave={handleSaveSurveyFromModal}
        editingSurvey={editingSurvey}
        allClasses={allClasses}
        currentTeacher={teacher}
        isAdmin={false}
      />

      {/* Code Survey Modal for Teacher */}
      <CodeSurveyModal
        isOpen={showCodeSurveyModal}
        onClose={() => setShowCodeSurveyModal(false)}
        onSaveSurveyFromCode={handleSaveSurveyFromCode}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        userRole="teacher"
        username={teacher.username}
      />
    </div>
  );
};
