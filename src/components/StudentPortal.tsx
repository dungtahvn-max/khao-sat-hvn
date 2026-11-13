import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Student, Survey, SurveyResponse } from '../types';
import { getSurveys, getResponses, saveResponse, generateUUID } from '../services/supabase';
import { generateStudentFileName, getStudentFileBaseName, extractGoogleDriveFileId, uploadFileToGoogleDrive, DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../utils/googleDrive';
import { isAnswerCorrect } from '../utils/quiz';
import { formatClassDisplay } from '../utils/classOrder';
import confetti from 'canvas-confetti';
import {
  CheckCircle2, Clock, AlertTriangle, FileText, Award,
  Sparkles, ArrowLeft, Send, Check, X,
  HelpCircle, ChevronRight, RotateCcw, Calendar, UserCheck, User,
  Upload, ExternalLink, Loader2
} from 'lucide-react';

interface StudentPortalProps {
  student: Student;
  announcement?: string;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ student, announcement }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Active taking/viewing state
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [mode, setMode] = useState<'list' | 'taking' | 'view_result'>('list');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [unansweredErrors, setUnansweredErrors] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  // File upload state per question
  const [uploadingQuestions, setUploadingQuestions] = useState<Record<string, number>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  // Ref map for smooth scrolling to unanswered questions
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    loadData();
  }, [student.cccd]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [surveysData, responsesData] = await Promise.all([
        getSurveys(),
        getResponses(),
      ]);

      // Filter surveys assigned to this student (either all school or specific class)
      const studentClassNorm = student.class_name.trim().toUpperCase();
      const studentSurveys = surveysData.filter(s => {
        if (!s.target_classes || s.target_classes.length === 0 || s.target_classes.includes('ALL')) {
          return true;
        }
        return s.target_classes.map(c => c.trim().toUpperCase()).includes(studentClassNorm);
      });

      setSurveys(studentSurveys);
      const studentResp = responsesData.filter(r => r.student_cccd === student.cccd);
      setResponses(studentResp);
    } catch (e) {
      console.error('Error loading student surveys', e);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getStudentResponse = (surveyId: string): SurveyResponse | undefined => {
    return responses.find(r => r.survey_id === surveyId);
  };

  const handleStartSurvey = (survey: Survey) => {
    setActiveSurvey(survey);
    const existingResp = getStudentResponse(survey.id);
    if (existingResp && !survey.allow_multiple_attempts) {
      setMode('view_result');
    } else {
      setAnswers(existingResp ? { ...existingResp.answers } : {});
      setUnansweredErrors({});
      setUploadingQuestions({});
      setUploadErrors({});
      setMode('taking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleViewResult = (survey: Survey) => {
    setActiveSurvey(survey);
    setMode('view_result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    if (unansweredErrors[questionId]) {
      setUnansweredErrors(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleToggleMultiChoice = (questionId: string, optIndex: number) => {
    setAnswers(prev => {
      const current = Array.isArray(prev[questionId]) ? [...prev[questionId]] : [];
      const existsIdx = current.indexOf(optIndex);
      if (existsIdx >= 0) {
        current.splice(existsIdx, 1);
      } else {
        current.push(optIndex);
      }
      current.sort((a, b) => a - b);
      return { ...prev, [questionId]: current };
    });
    if (unansweredErrors[questionId]) {
      setUnansweredErrors(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Handle file selection and auto-upload to Google Drive (inside class subfolder, overwriting old file if exists)
  const handleFileUpload = async (questionId: string, fileCodePrefix: string, file: File) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(file.name);
    let localPreviewUrl = '';
    if (isImage) {
      try {
        localPreviewUrl = URL.createObjectURL(file);
      } catch (e) {
        console.error('Error creating object URL for image', e);
      }
    }

    const previousAnswer = answers[questionId];
    const oldFileId =
      (previousAnswer && typeof previousAnswer === 'object'
        ? previousAnswer.fileId || extractGoogleDriveFileId(previousAnswer.fileUrl)
        : '') || '';

    const formattedName = generateStudentFileName(fileCodePrefix, student, file.name);
    const fileBaseName = getStudentFileBaseName(fileCodePrefix, student);
    const classFolderName = formatClassDisplay(student.class_name);
    const folderId = activeSurvey?.google_drive_folder_id?.trim() || DEFAULT_GOOGLE_DRIVE_FOLDER_ID;

    // Show immediate preview with upload in progress
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        fileName: formattedName,
        isImage,
        previewUrl: localPreviewUrl,
        uploading: true,
      },
    }));

    setUploadingQuestions(prev => ({ ...prev, [questionId]: 15 }));
    setUploadErrors(prev => ({ ...prev, [questionId]: '' }));

    const res = await uploadFileToGoogleDrive(
      file,
      folderId,
      formattedName,
      (percent) => {
        setUploadingQuestions(prev => ({ ...prev, [questionId]: percent }));
      },
      {
        className: classFolderName,
        fileBaseName,
        oldFileId,
      }
    );

    if (res.success && res.fileUrl) {
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          fileId: res.fileId || extractGoogleDriveFileId(res.fileUrl),
          fileName: formattedName,
          fileUrl: res.fileUrl,
          folderName: res.folderName || classFolderName,
          isImage,
          previewUrl: localPreviewUrl || res.fileUrl,
          uploadedAt: new Date().toISOString(),
        },
      }));
      setUploadingQuestions(prev => ({ ...prev, [questionId]: 100 }));
      showToast(`Đã tải lên thư mục lớp ${classFolderName}: ${formattedName}`, 'success');
    } else {
      setUploadErrors(prev => ({ ...prev, [questionId]: res.error || 'Lỗi khi tải tệp lên' }));
      showToast(res.error || 'Lỗi tải tệp lên Google Drive', 'error');
    }
  };

  const handleSubmitSurvey = async () => {
    if (!activeSurvey || submitting) return;

    // Check if any file is still actively uploading
    const activeUploads = Object.values(uploadingQuestions).some(p => p > 0 && p < 100);
    if (activeUploads) {
      showToast('Đang có tệp đang tải lên Google Drive, vui lòng chờ trong giây lát!', 'error');
      return;
    }

    // Validate all questions
    const errors: Record<string, boolean> = {};
    let firstUnansweredId: string | null = null;

    activeSurvey.questions.forEach((q) => {
      const ans = answers[q.id];
      const isBlank =
        ans === undefined ||
        ans === null ||
        ans === '' ||
        (Array.isArray(ans) && ans.length === 0) ||
        (typeof ans === 'object' && !Array.isArray(ans) && !ans.fileUrl && !ans.fileName);
      if (isBlank) {
        errors[q.id] = true;
        if (!firstUnansweredId) {
          firstUnansweredId = q.id;
        }
      }
    });

    if (firstUnansweredId) {
      setUnansweredErrors(errors);
      showToast('Vui lòng trả lời đầy đủ tất cả các câu hỏi trước khi nộp bài!', 'error');
      const targetEl = questionRefs.current[firstUnansweredId];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);
    try {
      let score = 0;
      if (activeSurvey.survey_type === 'quiz') {
        activeSurvey.questions.forEach(q => {
          if (isAnswerCorrect(answers[q.id], q)) {
            score++;
          }
        });
      }

      const responseRecord: SurveyResponse = {
        id: generateUUID(),
        survey_id: activeSurvey.id,
        student_cccd: student.cccd,
        student_name: student.full_name,
        class_name: student.class_name,
        answers: { ...answers },
        score,
        total_questions: activeSurvey.questions.length,
        submitted_at: new Date().toISOString(),
      };

      // Optimistically update responses in local state immediately so view_result has it right away
      setResponses(prev => {
        const idx = prev.findIndex(r => r.survey_id === responseRecord.survey_id && r.student_cccd === responseRecord.student_cccd);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = responseRecord;
          return next;
        }
        return [responseRecord, ...prev];
      });

      const ok = await saveResponse(responseRecord);
      if (ok) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
          });
        } catch {}

        showToast('Nộp bài khảo sát thành công! Cảm ơn em đã tham gia.', 'success');
        setMode('view_result');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await loadData();
      } else {
        showToast('Có lỗi xảy ra khi lưu bài khảo sát. Vui lòng thử lại!', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi gửi bài: ' + (err.message || 'Thử lại sau ít phút'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalSurveys = surveys.filter(s => s.is_active).length;
  const completedCount = surveys.filter(s => s.is_active && getStudentResponse(s.id)).length;
  const pendingCount = Math.max(0, totalSurveys - completedCount);

  // Prepared questions taking shuffle_questions and shuffle_options into account
  const displayQuestions = useMemo(() => {
    if (!activeSurvey) return [];
    let list = activeSurvey.questions.map(q => {
      let optionsList = (q.options || []).map((text, originalIndex) => ({
        text,
        originalIndex,
      }));
      if (activeSurvey.survey_type === 'quiz' && activeSurvey.shuffle_options && optionsList.length > 1) {
        optionsList = [...optionsList].sort(() => Math.random() - 0.5);
      }
      return {
        ...q,
        displayOptions: optionsList,
      };
    });

    if (activeSurvey.survey_type === 'quiz' && activeSurvey.shuffle_questions && list.length > 1) {
      list = [...list].sort(() => Math.random() - 0.5);
    }
    return list;
  }, [activeSurvey?.id, mode === 'taking']);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center space-x-2 text-sm font-semibold animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ----------------- VIEW 1: DASHBOARD & SURVEY LIST ----------------- */}
      {mode === 'list' && (
        <>
          {/* Announcement Banner */}
          {announcement && (
            <div className="p-4 bg-gradient-to-r from-rose-50 via-[#fcf2f4] to-rose-50 border border-rose-200 rounded-2xl flex items-start space-x-3 shadow-xs">
              <div className="p-2 bg-[#7a0f2b] text-white rounded-xl flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-sm text-[#5a0a1f]">
                <span className="font-bold block text-[#7a0f2b] text-base mb-0.5">
                  Thông báo từ Ban quản trị
                </span>
                <p className="leading-relaxed text-slate-700">{announcement}</p>
              </div>
            </div>
          )}



          {/* Student Profile & Progress Modal */}
          {showProfileModal && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                <div className="p-4 bg-gradient-to-r from-[#6b0f24] to-[#881337] text-white flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-rose-200" />
                    <h3 className="font-bold text-base">Thông tin học sinh & Tiến độ cá nhân</h3>
                  </div>
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Student Profile Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                    <div className="flex items-center space-x-3 pb-3 border-b border-slate-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7a0f2b] to-[#991b3d] flex items-center justify-center text-white text-lg font-bold shadow-md shadow-rose-950/10">
                        {student.full_name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">{student.full_name}</h2>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-[#7a0f2b]" />
                          Học sinh lớp <span className="font-bold text-[#7a0f2b] bg-rose-100 px-1.5 py-0.2 rounded">{formatClassDisplay(student.class_name)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 block mb-0.5">Số CCCD</span>
                        <span className="font-mono font-bold text-slate-800 tracking-wide">{student.cccd}</span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-slate-400 block mb-0.5">Ngày sinh</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#7a0f2b]" />
                          {student.dob_display}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
                        <span className="text-slate-400 block mb-0.5">Lớp</span>
                        <span className="font-bold text-[#7a0f2b]">{formatClassDisplay(student.class_name)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Stats Card */}
                  <div className="bg-gradient-to-br from-[#6b0f24] via-[#851633] to-[#4f0919] rounded-2xl p-5 text-white shadow-md">
                    <h3 className="text-xs uppercase tracking-wider text-rose-200 font-bold mb-3 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-300" />
                      Tiến độ làm bài khảo sát
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 text-center">
                        <span className="text-[11px] text-rose-200 block">Tổng bài:</span>
                        <span className="text-lg font-black">{totalSurveys}</span>
                      </div>
                      <div className="bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-400/30 text-center">
                        <span className="text-[11px] text-emerald-200 block">Đã xong:</span>
                        <span className="text-lg font-black text-emerald-300">{completedCount}</span>
                      </div>
                      <div className="bg-rose-500/20 p-2.5 rounded-xl border border-rose-400/30 text-center">
                        <span className="text-[11px] text-rose-200 block">Chưa làm:</span>
                        <span className="text-lg font-black text-rose-300">{pendingCount}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 text-[11px] text-rose-200 text-center border-t border-white/10">
                      {pendingCount === 0 && totalSurveys > 0
                        ? '🎉 Em đã hoàn thành tất cả khảo sát!'
                        : `Em còn ${pendingCount} khảo sát cần hoàn thành.`}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-100 border-t border-slate-200 text-right">
                  <button
                    onClick={() => setShowProfileModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Đóng lại
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Survey Cards Container */}
          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                <div className="w-6 h-6 border-2 border-[#7a0f2b] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Đang tải danh sách khảo sát...
              </div>
            ) : surveys.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm">
                Hiện tại trường chưa mở đợt khảo sát nào mới.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {surveys.map(survey => {
                  const resp = getStudentResponse(survey.id);
                  const isCompleted = !!resp;
                  const isLocked = !survey.is_active;

                  return (
                    <div
                      key={survey.id}
                      className={`bg-white rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                        isCompleted
                          ? 'border-emerald-200 bg-gradient-to-br from-white to-emerald-50/20 shadow-xs'
                          : isLocked
                          ? 'border-slate-200 opacity-70 bg-slate-50'
                          : survey.survey_type === 'form'
                          ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 hover:shadow-md'
                          : 'border-slate-200 hover:border-rose-300 hover:shadow-md'
                      }`}
                    >
                      <div>
                        {/* Status Badges */}
                        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isLocked
                                ? 'bg-slate-200 text-slate-700'
                                : survey.survey_type === 'form'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-[#7a0f2b] border border-rose-300'
                            }`}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Đã hoàn thành
                              </>
                            ) : isLocked ? (
                              'Đã đóng'
                            ) : (
                              <>
                                <Clock className={`w-3.5 h-3.5 ${survey.survey_type === 'form' ? 'text-emerald-700' : 'text-[#7a0f2b]'}`} />
                                Chưa thực hiện
                              </>
                            )}
                          </span>

                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                            survey.survey_type === 'form'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-[#7a0f2b] text-white border border-[#7a0f2b] shadow-2xs'
                          }`}>
                            {survey.survey_type === 'quiz' ? 'Trắc nghiệm có chấm điểm' : 'Thu thập thông tin'}
                          </span>
                        </div>

                        {/* Survey Title & Description */}
                        <h4 className="text-base font-bold text-slate-900 leading-snug mb-1.5">
                          {survey.title}
                        </h4>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                          {survey.description || 'Không có mô tả thêm.'}
                        </p>
                      </div>

                      {/* Footer Info & Action */}
                      <div className="pt-3 border-t border-slate-100">
                        {isCompleted && resp ? (
                          <div className="flex items-center justify-between text-xs mb-3">
                            <div>
                              <span className="text-slate-500 block text-[11px]">Kết quả đạt được:</span>
                              <span className="font-extrabold text-emerald-700 text-sm">
                                {survey.survey_type === 'quiz'
                                  ? `${resp.score}/${resp.total_questions || survey.questions.length} câu đúng (${Math.round(((resp.score || 0) / (resp.total_questions || survey.questions.length)) * 100)}%)`
                                  : 'Đã nộp phản hồi'}
                              </span>
                            </div>
                            <div className="text-right text-[11px] text-slate-400">
                              Nộp lúc: {new Date(resp.submitted_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                              {new Date(resp.submitted_at).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-slate-500 mb-3 gap-1">
                            <FileText className={`w-3.5 h-3.5 ${survey.survey_type === 'form' ? 'text-emerald-700' : 'text-[#7a0f2b]'}`} />
                            <span>Gồm <b>{survey.questions.length}</b> câu hỏi</span>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <>
                              <button
                                onClick={() => handleViewResult(survey)}
                                className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                Xem kết quả & bài làm
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                              {survey.allow_multiple_attempts && !isLocked && (
                                <button
                                  onClick={() => handleStartSurvey(survey)}
                                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Làm lại bài"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Làm lại
                                </button>
                              )}
                            </>
                          ) : isLocked ? (
                            <button
                              disabled
                              className="w-full py-2 px-3 bg-slate-100 text-slate-400 text-xs font-semibold rounded-xl cursor-not-allowed"
                            >
                              Khảo sát đã đóng
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartSurvey(survey)}
                              className={`w-full py-2.5 px-4 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                survey.survey_type === 'form'
                                  ? 'bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 shadow-emerald-950/20'
                                  : 'bg-gradient-to-r from-[#7a0f2b] to-[#991b3d] hover:from-[#8b112c] hover:to-[#a81c43] shadow-rose-950/20'
                              }`}
                            >
                              {survey.survey_type === 'form' ? 'Bắt đầu điền thông tin' : 'Bắt đầu làm bài'}
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ----------------- VIEW 2: TAKING SURVEY ----------------- */}
      {mode === 'taking' && activeSurvey && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm sticky top-20 z-30 flex items-center justify-between gap-4">
            <button
              onClick={() => setMode('list')}
              className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Thoát ra danh sách
            </button>
            <div className="text-right flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">{activeSurvey.title}</h3>
              <p className={`text-xs font-semibold ${activeSurvey.survey_type === 'form' ? 'text-emerald-700' : 'text-[#7a0f2b]'}`}>
                Đã điền: {
                  activeSurvey.questions.filter(q => {
                    const a = answers[q.id];
                    if (a === undefined || a === null || a === '') return false;
                    if (Array.isArray(a)) return a.length > 0;
                    if (typeof a === 'object') return Boolean(a.fileUrl || a.fileName);
                    return true;
                  }).length
                } / {activeSurvey.questions.length} câu
              </p>
            </div>
          </div>

          {/* Survey Info Card */}
          <div className={`rounded-2xl p-6 text-white shadow-md ${
            activeSurvey.survey_type === 'form'
              ? 'bg-gradient-to-r from-[#022c22] via-[#064e3b] to-[#022019] border border-emerald-800'
              : 'bg-gradient-to-r from-[#6b0f24] via-[#851633] to-[#4f0919]'
          }`}>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2 inline-block ${
              activeSurvey.survey_type === 'form'
                ? 'bg-emerald-800/80 text-emerald-100 border border-emerald-600'
                : 'bg-white/20 text-white'
            }`}>
              {activeSurvey.survey_type === 'quiz' ? 'Trắc nghiệm khảo sát' : 'Phiếu thu thập thông tin'}
            </span>
            <h2 className="text-xl sm:text-2xl font-black mb-2">{activeSurvey.title}</h2>
            <p className={`text-xs sm:text-sm leading-relaxed max-w-3xl ${
              activeSurvey.survey_type === 'form' ? 'text-emerald-100' : 'text-rose-100'
            }`}>
              {activeSurvey.description}
            </p>
            <div className={`mt-4 pt-3 border-t text-xs flex items-center gap-2 ${
              activeSurvey.survey_type === 'form' ? 'border-emerald-700/60 text-emerald-200' : 'border-white/10 text-rose-200'
            }`}>
              <HelpCircle className={`w-4 h-4 ${activeSurvey.survey_type === 'form' ? 'text-emerald-300' : 'text-amber-300'}`} />
              <span>
                {activeSurvey.survey_type === 'form'
                  ? 'Em hãy đọc kỹ từng yêu cầu và chọn/điền thông tin chính xác trước khi nhấn Gửi thông tin'
                  : 'Em hãy đọc kỹ từng câu hỏi và chọn/điền đáp án chính xác nhất trước khi nhấn "Nộp bài".'}
              </span>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {displayQuestions.map((q, index) => {
              const isUnanswered = unansweredErrors[q.id];
              const selectedValue = answers[q.id];
              const qType = q.type || (q.options && q.options.length > 0 ? 'single_choice' : 'text');
              const isForm = activeSurvey.survey_type === 'form';
              const optionsToRender = q.displayOptions || (q.options || []).map((text, originalIndex) => ({ text, originalIndex }));

              return (
                <div
                  key={q.id}
                  ref={el => {
                    questionRefs.current[q.id] = el;
                  }}
                  className={`rounded-2xl p-5 border transition-all ${
                    isUnanswered
                      ? 'border-rose-500 ring-2 ring-rose-200 shadow-md bg-rose-50/20'
                      : isForm
                      ? 'bg-emerald-50/25 border-emerald-200 hover:border-emerald-300 shadow-xs'
                      : 'bg-white border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isForm
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-[#7a0f2b]'
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                        {q.question}
                      </p>
                      {isUnanswered && (
                        <p className="text-xs text-rose-600 font-semibold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Mục này chưa được điền thông tin/tải tệp!
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Input Rendering based on Question Type */}
                  <div className="mt-3 pl-0 sm:pl-10">
                    {/* TYPE 1: Single Choice Options */}
                    {qType === 'single_choice' && optionsToRender.length > 0 && (
                      <div className="space-y-2">
                        {optionsToRender.map((optItem, optIndex) => {
                          const isSelected = selectedValue === optItem.originalIndex;
                          const letter = String.fromCharCode(65 + optIndex);

                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() => handleSelectAnswer(q.id, optItem.originalIndex)}
                              className={`w-full text-left p-3.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-between border cursor-pointer ${
                                isSelected
                                  ? isForm
                                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold shadow-xs ring-1 ring-emerald-600'
                                    : 'bg-rose-50 border-[#7a0f2b] text-[#5a0a1f] font-bold shadow-xs ring-1 ring-[#7a0f2b]'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center flex-shrink-0 border ${
                                    isSelected
                                      ? isForm
                                        ? 'bg-emerald-700 text-white border-emerald-700'
                                        : 'bg-[#7a0f2b] text-white border-[#7a0f2b]'
                                      : 'bg-white text-slate-600 border-slate-300'
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="leading-relaxed">{optItem.text}</span>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center ml-2 flex-shrink-0 ${
                                  isSelected
                                    ? isForm
                                      ? 'border-emerald-700 bg-emerald-700 text-white'
                                      : 'border-[#7a0f2b] bg-[#7a0f2b] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 1B: Multi Choice Options (Checkbox - chọn nhiều mục) */}
                    {qType === 'multi_choice' && optionsToRender.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-emerald-700 block mb-1">
                          ✓ Có thể tích chọn nhiều mục cùng lúc:
                        </span>
                        {optionsToRender.map((optItem, optIndex) => {
                          const selectedList: number[] = Array.isArray(selectedValue) ? selectedValue : [];
                          const isSelected = selectedList.includes(optItem.originalIndex);
                          const letter = String.fromCharCode(65 + optIndex);

                          return (
                            <button
                              key={optIndex}
                              type="button"
                              onClick={() => handleToggleMultiChoice(q.id, optItem.originalIndex)}
                              className={`w-full text-left p-3.5 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-between border cursor-pointer ${
                                isSelected
                                  ? isForm
                                    ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold shadow-xs ring-1 ring-emerald-600'
                                    : 'bg-rose-50 border-[#7a0f2b] text-[#5a0a1f] font-bold shadow-xs ring-1 ring-[#7a0f2b]'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center flex-shrink-0 border ${
                                    isSelected
                                      ? isForm
                                        ? 'bg-emerald-700 text-white border-emerald-700'
                                        : 'bg-[#7a0f2b] text-white border-[#7a0f2b]'
                                      : 'bg-white text-slate-600 border-slate-300'
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="leading-relaxed">{optItem.text}</span>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-md border flex items-center justify-center ml-2 flex-shrink-0 ${
                                  isSelected
                                    ? isForm
                                      ? 'border-emerald-700 bg-emerald-700 text-white'
                                      : 'border-[#7a0f2b] bg-[#7a0f2b] text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 2: Date Input */}
                    {qType === 'date' && (
                      <div className="max-w-xs">
                        <label className="text-[11px] text-slate-500 font-semibold block mb-1">
                          Chọn ngày/tháng/năm:
                        </label>
                        <input
                          type="date"
                          value={selectedValue || ''}
                          onChange={e => handleSelectAnswer(q.id, e.target.value)}
                          className={`w-full text-xs sm:text-sm p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 ${
                            isForm ? 'focus:ring-emerald-600' : 'focus:ring-[#7a0f2b]'
                          }`}
                        />
                      </div>
                    )}

                    {/* TYPE 3: File Upload with instant image preview & overwrite */}
                    {qType === 'file' && (
                      <div className={`p-4 rounded-2xl space-y-3 ${
                        isForm
                          ? 'bg-emerald-50/70 border border-dashed border-emerald-300'
                          : 'bg-rose-50/50 border border-dashed border-rose-200'
                      }`}>
                        {/* File Selector */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <label className={`inline-flex items-center justify-center px-4 py-2.5 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors ${
                            isForm
                              ? 'bg-emerald-700 hover:bg-emerald-800'
                              : 'bg-[#7a0f2b] hover:bg-[#8f1334]'
                          }`}>
                            <Upload className="w-4 h-4 mr-1.5" />
                            {selectedValue && typeof selectedValue === 'object' && selectedValue.fileName
                              ? 'Chọn tệp khác để thay thế (ghi đè)'
                              : 'Chọn tệp đính kèm để tải lên'}
                            <input
                              type="file"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(q.id, q.file_code_prefix || 'TEP', file);
                                }
                              }}
                              className="hidden"
                            />
                          </label>

                          {uploadingQuestions[q.id] !== undefined && uploadingQuestions[q.id] < 100 && (
                            <div className={`flex items-center gap-2 text-xs font-semibold ${
                              isForm ? 'text-emerald-700' : 'text-[#7a0f2b]'
                            }`}>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Đang tải lên Google Drive: {uploadingQuestions[q.id]}%</span>
                            </div>
                          )}
                        </div>

                        {/* Image Preview & Upload Status */}
                        {selectedValue && typeof selectedValue === 'object' && selectedValue.fileName && (
                          <div className="space-y-2 pt-1">
                            {/* Render image preview directly if it's an image */}
                            {(selectedValue.isImage || /\.(jpg|jpeg|png|webp|gif|bmp|heic)$/i.test(selectedValue.fileName) || selectedValue.previewUrl) && (
                              <div className="p-3 bg-white border border-emerald-300 rounded-xl flex flex-col items-center shadow-xs">
                                <div className="w-full max-h-64 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mb-2">
                                  <img
                                    src={selectedValue.previewUrl || selectedValue.fileUrl}
                                    alt={selectedValue.fileName}
                                    className="max-h-64 max-w-full object-contain rounded-md"
                                    onError={(e) => {
                                      // Hide image container on broken load
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="w-full flex items-center justify-between text-xs text-slate-600">
                                  <span className="font-semibold text-emerald-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Hình ảnh đính kèm đã tải lên thành công
                                  </span>
                                  {selectedValue.fileUrl && (
                                    <a
                                      href={selectedValue.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-700 hover:underline font-bold inline-flex items-center gap-1"
                                    >
                                      Mở ảnh gốc
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* File info card */}
                            <div className="p-3 bg-white border border-emerald-300 rounded-xl flex items-center justify-between text-xs shadow-2xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-800 block truncate">{selectedValue.fileName}</span>
                                  {selectedValue.fileUrl ? (
                                    <a
                                      href={selectedValue.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                                    >
                                      Xem tệp trên Google Drive
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">{selectedValue.notice || 'Đã lưu tệp'}</span>
                                  )}
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                                Đã sẵn sàng
                              </span>
                            </div>
                          </div>
                        )}

                        {uploadErrors[q.id] && (
                          <div className="text-xs text-red-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {uploadErrors[q.id]}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TYPE 4: Regular Text Input */}
                    {qType === 'text' && (
                      <textarea
                        rows={3}
                        value={selectedValue || ''}
                        onChange={e => handleSelectAnswer(q.id, e.target.value)}
                        placeholder="Nhập câu trả lời hoặc ý kiến của em vào đây..."
                        className={`w-full text-xs sm:text-sm p-3 bg-white border border-slate-300 rounded-xl focus:ring-2 ${
                          isForm ? 'focus:ring-emerald-600' : 'focus:ring-[#7a0f2b]'
                        }`}
                      ></textarea>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submit Footer */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              {activeSurvey.survey_type === 'form'
                ? 'Đảm bảo em đã điền đầy đủ thông tin và kiểm tra kỹ trước khi gửi.'
                : 'Đảm bảo em đã kiểm tra kỹ trước khi nộp. Nút "Nộp bài" sẽ tự động kiểm tra xem còn câu nào bỏ trống.'}
            </div>
            <button
              onClick={handleSubmitSurvey}
              disabled={submitting}
              className={`w-full sm:w-auto px-8 py-3 text-white text-sm font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                activeSurvey.survey_type === 'form'
                  ? 'bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 shadow-emerald-950/20'
                  : 'bg-gradient-to-r from-[#7a0f2b] to-[#991b3d] hover:from-[#8b112c] hover:to-[#a81c43] shadow-rose-950/20'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{activeSurvey.survey_type === 'form' ? 'Đang gửi thông tin...' : 'Đang gửi bài lên hệ thống...'}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{activeSurvey.survey_type === 'form' ? 'Gửi thông tin' : 'Hoàn thành & Nộp bài'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ----------------- VIEW 3: VIEW RESULT ----------------- */}
      {mode === 'view_result' && activeSurvey && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Bar */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <button
              onClick={() => setMode('list')}
              className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Quay lại danh sách
            </button>
            <span className="text-xs font-semibold text-slate-500">Kết quả khảo sát</span>
          </div>

          {/* Result Banner */}
          {(() => {
            const resp = getStudentResponse(activeSurvey.id);
            const totalQ = resp?.total_questions || activeSurvey.questions.length;
            const score = resp?.score ?? 0;
            const percent = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;

            return (
              <div className="bg-gradient-to-br from-[#6b0f24] via-[#851633] to-[#4f0919] rounded-2xl p-6 sm:p-8 text-white shadow-lg text-center relative overflow-hidden">
                <div className="inline-flex p-3 rounded-2xl bg-white/10 backdrop-blur-md mb-3 border border-white/20">
                  <CheckCircle2 className="w-10 h-10 text-rose-200" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black mb-1">
                  Bạn đã hoàn thành bài khảo sát! Cảm ơn bạn đã tham gia.
                </h2>
                <p className="text-xs sm:text-sm text-rose-100 max-w-xl mx-auto">
                  {activeSurvey.title}
                </p>

                {activeSurvey.survey_type === 'quiz' && (
                  <div className="mt-6 inline-flex flex-col sm:flex-row items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/20">
                    <div className="text-center sm:text-left">
                      <span className="text-xs text-rose-200 block">Tổng điểm đạt được:</span>
                      <span className="text-3xl font-black text-white">{score} / {totalQ} câu đúng</span>
                    </div>
                    <div className="h-8 w-px bg-white/20 hidden sm:block"></div>
                    <div className="text-center sm:text-right">
                      <span className="text-xs text-rose-200 block">Tỷ lệ chính xác:</span>
                      <span className="text-2xl font-extrabold text-amber-300">{percent}%</span>
                    </div>
                  </div>
                )}

                {!activeSurvey.show_answers && (
                  <div className="mt-4 text-xs text-rose-100/90 italic">
                    (Đáp án chi tiết đang được Quản trị viên cài đặt bảo mật cho đến khi kết thúc đợt khảo sát)
                  </div>
                )}
              </div>
            );
          })()}

          {/* Breakdown if show_answers is enabled */}
          {activeSurvey.show_answers ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Chi tiết câu trả lời & Giải thích đáp án</h3>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                  Chế độ hiển thị đáp án: BẬT
                </span>
              </div>

              {activeSurvey.questions.map((q, index) => {
                const resp = getStudentResponse(activeSurvey.id);
                const studentAns = resp?.answers?.[q.id];
                const isCorrect = isAnswerCorrect(studentAns, q);

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl p-5 border shadow-xs ${
                      isCorrect ? 'border-emerald-200' : 'border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-[#7a0f2b]'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <p className="text-sm font-bold text-slate-900 leading-snug">{q.question}</p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0 ${
                          isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-[#7a0f2b]'
                        }`}
                      >
                        {isCorrect ? (
                          <>
                            <Check className="w-3 h-3 stroke-[3]" />
                            Đúng
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 stroke-[3]" />
                            Chưa đúng
                          </>
                        )}
                      </span>
                    </div>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-2 mt-3 pl-0 sm:pl-10">
                        {q.options.map((opt, optIndex) => {
                          const isStudentSelected = Array.isArray(studentAns)
                            ? studentAns.includes(optIndex)
                            : studentAns === optIndex || String(studentAns).trim() === String(optIndex);
                          const isCorrectOption = activeSurvey.survey_type === 'quiz' ? isAnswerCorrect(optIndex, q) : false;
                          const letter = String.fromCharCode(65 + optIndex);

                          let style = 'bg-slate-50 border-slate-200 text-slate-700';
                          if (isCorrectOption) {
                            style = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-300';
                          } else if (isStudentSelected && activeSurvey.survey_type === 'form') {
                            style = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-300';
                          } else if (isStudentSelected && !isCorrect) {
                            style = 'bg-rose-50 border-rose-400 text-rose-950 font-semibold ring-1 ring-rose-300';
                          }

                          return (
                            <div
                              key={optIndex}
                              className={`p-3 rounded-xl text-xs sm:text-sm flex items-center justify-between border ${style}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center bg-white border border-slate-200 text-slate-800">
                                  {letter}
                                </span>
                                <span>{opt}</span>
                              </div>
                              <div className="text-xs font-semibold flex items-center gap-1">
                                {isCorrectOption && (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    Đáp án đúng
                                  </span>
                                )}
                                {isStudentSelected && !isCorrectOption && (
                                  <span className="text-[#7a0f2b] font-bold flex items-center gap-1">
                                    <X className="w-3.5 h-3.5" />
                                    Em đã chọn
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.explanation && (
                      <div className="mt-3.5 pl-0 sm:pl-10">
                        <div className="p-3 bg-rose-50/70 border border-rose-200/60 rounded-xl text-xs text-[#5a0a1f] leading-relaxed">
                          <span className="font-bold text-[#7a0f2b] block mb-0.5">💡 Giải thích chi tiết:</span>
                          {q.explanation}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-600 text-xs sm:text-sm">
              <p className="font-semibold text-slate-800 mb-1">
                Bài làm của bạn đã được ghi nhận trên hệ thống trường.
              </p>
              <p className="text-slate-500">
                Khi Ban quản trị mở tính năng xem đáp án, bạn sẽ có thể vào xem chi tiết bài giải tại đây.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => setMode('list')}
              className="px-6 py-2.5 bg-[#7a0f2b] hover:bg-[#8f1334] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Về trang chủ khảo sát
            </button>
            {activeSurvey.allow_multiple_attempts && activeSurvey.is_active && (
              <button
                onClick={() => handleStartSurvey(activeSurvey)}
                className="px-6 py-2.5 bg-rose-50 hover:bg-rose-100 text-[#7a0f2b] border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Làm lại bài này
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
