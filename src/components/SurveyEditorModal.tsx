import React, { useState, useEffect, useMemo } from 'react';
import { Survey, Question, SurveyType, QuestionType, ExamPartsConfig, Teacher } from '../types';
import { isValidUUID, generateUUID } from '../services/supabase';
import { DEFAULT_GOOGLE_DRIVE_FOLDER_ID } from '../utils/googleDrive';
import { groupExamQuestions } from '../utils/quiz';
import { ClassScopeSelector } from './ClassScopeSelector';
import { ImageUploadModal } from './ImageUploadModal';
import { MathRenderer } from './MathRenderer';
import {
  X, Plus, Trash2, HardDrive, Shuffle, Image as ImageIcon,
  CheckCircle2, AlertTriangle, Sparkles, HelpCircle,
  Calculator, Check, ArrowRight, Eye, FileText, CheckSquare, Square
} from 'lucide-react';

interface SurveyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (survey: Survey) => Promise<boolean>;
  editingSurvey?: Survey | null;
  allClasses: string[];
  currentTeacher?: Teacher | null;
  isAdmin?: boolean;
}

export const SurveyEditorModal: React.FC<SurveyEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingSurvey,
  allClasses,
  currentTeacher,
  isAdmin = false,
}) => {
  const isTeacher = !!currentTeacher && !isAdmin;
  const teacherHomeroom = currentTeacher?.homeroom_class?.trim().toUpperCase();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [surveyType, setSurveyType] = useState<SurveyType>('form');
  const [isActive, setIsActive] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [allowMultipleAttempts, setAllowMultipleAttempts] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState(DEFAULT_GOOGLE_DRIVE_FOLDER_ID);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // Scope State: If teacher creating new, default to 'classes' and their homeroom; if admin, default to 'all'
  const [scopeMode, setScopeMode] = useState<'all' | 'classes'>('all');
  const [targetClasses, setTargetClasses] = useState<string[]>([]);

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);

  // Exam Score Configuration (Phần 1, Phần 2, Phần 3)
  const [examPart1Points, setExamPart1Points] = useState<number>(3.0);
  const [examPart2Points, setExamPart2Points] = useState<number>(4.0);
  const [examPart3Points, setExamPart3Points] = useState<number>(3.0);

  // Image Upload Modal state for question
  const [imageModalQuestionIndex, setImageModalQuestionIndex] = useState<number | null>(null);

  // Live KaTeX preview toggle per question
  const [previewMap, setPreviewMap] = useState<Record<number, boolean>>({});

  // Submitting state & validation error
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingSurvey) {
      setTitle(editingSurvey.title || '');
      setDescription(editingSurvey.description || '');
      setSurveyType(editingSurvey.survey_type || 'form');
      setIsActive(editingSurvey.is_active ?? true);
      setShowAnswers(editingSurvey.show_answers ?? false);
      setAllowMultipleAttempts(editingSurvey.allow_multiple_attempts ?? false);
      setDriveFolderId(editingSurvey.google_drive_folder_id || DEFAULT_GOOGLE_DRIVE_FOLDER_ID);
      setShuffleQuestions(!!editingSurvey.shuffle_questions);
      setShuffleOptions(!!editingSurvey.shuffle_options);

      const hasClasses = !!(editingSurvey.target_classes && editingSurvey.target_classes.length > 0 && !editingSurvey.target_classes.includes('ALL'));
      setScopeMode(hasClasses ? 'classes' : 'all');
      setTargetClasses(editingSurvey.target_classes || []);

      setQuestions(editingSurvey.questions && editingSurvey.questions.length > 0 ? [...editingSurvey.questions] : [createDefaultQuestion('single_choice')]);

      if (editingSurvey.exam_config) {
        setExamPart1Points(editingSurvey.exam_config.part1_points ?? 3.0);
        setExamPart2Points(editingSurvey.exam_config.part2_points ?? 4.0);
        setExamPart3Points(editingSurvey.exam_config.part3_points ?? 3.0);
      }
    } else {
      // Create new
      setTitle('');
      setDescription('');
      setIsActive(true);
      setShowAnswers(false);
      setAllowMultipleAttempts(false);
      setDriveFolderId(DEFAULT_GOOGLE_DRIVE_FOLDER_ID);
      setShuffleQuestions(false);
      setShuffleOptions(false);

      if (isTeacher && teacherHomeroom) {
        setSurveyType('exam'); // Teacher defaults to creating Exam/Quiz
        setScopeMode('classes');
        setTargetClasses([teacherHomeroom]);
      } else {
        setSurveyType('form');
        setScopeMode('all');
        setTargetClasses([]);
      }

      setQuestions([createDefaultQuestion(isTeacher ? 'single_choice' : 'text')]);
      setExamPart1Points(3.0);
      setExamPart2Points(4.0);
      setExamPart3Points(3.0);
    }

    setFormError('');
    setPreviewMap({});
  }, [isOpen, editingSurvey]);

  function createDefaultQuestion(type: QuestionType = 'single_choice'): Question {
    return {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      question: '',
      type,
      options: type === 'true_false'
        ? ['Ý a: ', 'Ý b: ', 'Ý c: ', 'Ý d: ']
        : type === 'single_choice'
        ? ['', '', '', '']
        : [],
      correct_answer: type === 'single_choice' ? 0 : '',
      correct_answers: [false, false, false, false],
      points: 1,
      image_url: '',
      explanation: '',
      file_code_prefix: '',
      required: true,
    };
  }

  // Handle survey type change
  const handleSurveyTypeChange = (newType: SurveyType) => {
    setSurveyType(newType);

    if (newType === 'exam') {
      // Ensure all questions conform to exam question types
      setQuestions(prev => prev.map(q => {
        if (!q.type || q.type === 'text' || q.type === 'date' || q.type === 'file') {
          return {
            ...q,
            type: 'single_choice' as const,
            options: (!q.options || q.options.length < 4) ? ['', '', '', ''] : q.options,
            correct_answer: 0,
          };
        }
        return q;
      }));
    } else if (newType === 'quiz') {
      // Regular quiz: single_choice
      setQuestions(prev => prev.map(q => ({
        ...q,
        type: 'single_choice' as const,
        options: (!q.options || q.options.length < 2) ? ['', '', '', ''] : q.options,
        correct_answer: typeof q.correct_answer === 'number' ? q.correct_answer : 0,
      })));
    }
  };

  // Add question
  const handleAddQuestion = () => {
    const defaultType: QuestionType = surveyType === 'exam'
      ? 'single_choice'
      : surveyType === 'quiz'
      ? 'single_choice'
      : 'text';
    setQuestions(prev => [...prev, createDefaultQuestion(defaultType)]);
  };

  // Remove question
  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      alert('Bài khảo sát/kiểm tra phải có ít nhất 1 câu hỏi!');
      return;
    }
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Quiz Scale 10 Option: divides 10 / totalQuestions
  const handleApplyQuizScale10 = () => {
    if (questions.length === 0) return;
    const ptsPerQ = Number((10 / questions.length).toFixed(3));
    setQuestions(prev => prev.map(q => ({ ...q, points: ptsPerQ })));
  };

  // Calculate total points for quiz
  const quizTotalPoints = useMemo(() => {
    const sum = questions.reduce((acc, q) => acc + (typeof q.points === 'number' ? q.points : 1), 0);
    return Number(sum.toFixed(2));
  }, [questions]);

  // Group exam questions into Part 1, Part 2, Part 3
  const examGroups = useMemo(() => {
    if (surveyType !== 'exam') return [];
    return groupExamQuestions(questions);
  }, [questions, surveyType]);

  // Points per question for each exam group
  const examGroup1 = examGroups[0];
  const examGroup2 = examGroups[1];
  const examGroup3 = examGroups[2];

  const part1PtsPerQ = examGroup1 && examGroup1.count > 0 ? Number((examPart1Points / examGroup1.count).toFixed(3)) : 0;
  const part2PtsPerQ = examGroup2 && examGroup2.count > 0 ? Number((examPart2Points / examGroup2.count).toFixed(3)) : 0;
  const part3PtsPerQ = examGroup3 && examGroup3.count > 0 ? Number((examPart3Points / examGroup3.count).toFixed(3)) : 0;

  // Total points for exam parts
  const examTotalPoints = useMemo(() => {
    let sum = 0;
    if (examGroup1) sum += examPart1Points;
    if (examGroup2) sum += examPart2Points;
    if (examGroup3) sum += examPart3Points;
    return Number(sum.toFixed(2));
  }, [examGroup1, examGroup2, examGroup3, examPart1Points, examPart2Points, examPart3Points]);

  const isExamTotalValid10 = Math.abs(examTotalPoints - 10) < 0.001;

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!title.trim()) {
      setFormError('Vui lòng nhập Tiêu đề cho bài khảo sát / kiểm tra!');
      return;
    }

    if (questions.length === 0) {
      setFormError('Bài khảo sát / kiểm tra cần ít nhất 1 câu hỏi!');
      return;
    }

    // Check if any question has empty title
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].question?.trim()) {
        setFormError(`Câu hỏi số ${i + 1} chưa có nội dung yêu cầu!`);
        return;
      }
    }

    // Prepare processed questions
    const processedQuestions: Question[] = questions.map((q, idx) => {
      let qPoints = typeof q.points === 'number' ? q.points : 1;

      if (surveyType === 'exam') {
        const t = q.type || 'single_choice';
        if (examGroup1 && ((t === 'single_choice' && examGroup1.typeCategory === 'single_choice') ||
            (t === 'true_false' && examGroup1.typeCategory === 'true_false') ||
            ((t === 'short_number' || t === 'short_text') && examGroup1.typeCategory === 'short_answer'))) {
          qPoints = part1PtsPerQ;
        } else if (examGroup2 && ((t === 'single_choice' && examGroup2.typeCategory === 'single_choice') ||
            (t === 'true_false' && examGroup2.typeCategory === 'true_false') ||
            ((t === 'short_number' || t === 'short_text') && examGroup2.typeCategory === 'short_answer'))) {
          qPoints = part2PtsPerQ;
        } else if (examGroup3 && ((t === 'single_choice' && examGroup3.typeCategory === 'single_choice') ||
            (t === 'true_false' && examGroup3.typeCategory === 'true_false') ||
            ((t === 'short_number' || t === 'short_text') && examGroup3.typeCategory === 'short_answer'))) {
          qPoints = part3PtsPerQ;
        }
      }

      return {
        ...q,
        points: qPoints,
        options: q.type === 'single_choice' || q.type === 'true_false'
          ? (q.options || ['', '', '', ''])
          : (q.options || []),
      };
    });

    const surveyId = (editingSurvey?.id && isValidUUID(editingSurvey.id))
      ? editingSurvey.id
      : generateUUID();

    const finalTargetClasses = scopeMode === 'classes' ? targetClasses : [];

    const examConfig: ExamPartsConfig | undefined = surveyType === 'exam'
      ? {
          part1_points: examGroup1 ? examPart1Points : 0,
          part2_points: examGroup2 ? examPart2Points : 0,
          part3_points: examGroup3 ? examPart3Points : 0,
        }
      : undefined;

    const surveyToSave: Survey = {
      id: surveyId,
      title: title.trim(),
      description: description.trim(),
      survey_type: surveyType,
      is_active: isActive,
      show_answers: showAnswers,
      allow_multiple_attempts: allowMultipleAttempts,
      google_drive_folder_id: surveyType === 'form' ? (driveFolderId.trim() || DEFAULT_GOOGLE_DRIVE_FOLDER_ID) : '',
      target_classes: finalTargetClasses,
      shuffle_questions: shuffleQuestions,
      shuffle_options: shuffleOptions,
      exam_config: examConfig,
      created_by: editingSurvey?.created_by || (currentTeacher ? currentTeacher.username : 'admin'),
      created_by_name: editingSurvey?.created_by_name || (currentTeacher ? currentTeacher.full_name : 'Quản trị viên'),
      questions: processedQuestions,
      created_at: editingSurvey ? editingSurvey.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const ok = await onSave(surveyToSave);
      if (ok) {
        onClose();
      } else {
        setFormError('Không thể lưu khảo sát vào hệ thống. Vui lòng thử lại!');
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu bài khảo sát!');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 bg-[#7a0f2b] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-200" />
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                {editingSurvey
                  ? `Chỉnh sửa: ${editingSurvey.title}`
                  : isTeacher
                  ? 'Giáo viên tạo Đề kiểm tra / Khảo sát mới'
                  : 'Tạo mới Khảo sát / Bài kiểm tra toàn trường'}
              </h3>
              <p className="text-[11px] text-rose-200">
                {surveyType === 'exam'
                  ? 'Cấu trúc bài kiểm tra chuẩn 3 phần (Trắc nghiệm, Đúng-Sai 4 ý, Điền số & Điền từ)'
                  : surveyType === 'quiz'
                  ? 'Trắc nghiệm khảo sát kiến thức có chấm điểm tự động'
                  : 'Phiếu khảo sát ý kiến & thu thập thông tin học sinh'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 font-bold rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Row 1: Title & Type Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label className="font-bold text-slate-800 block text-xs">
                Tiêu đề khảo sát / bài kiểm tra:
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Kiểm tra kiến thức Toán học 12 / Khảo sát ý kiến đầu năm..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#7a0f2b]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-800 block text-xs">
                Loại khảo sát:
              </label>
              <select
                value={surveyType}
                onChange={e => handleSurveyTypeChange(e.target.value as SurveyType)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-[#7a0f2b] focus:bg-white focus:ring-2 focus:ring-[#7a0f2b]"
              >
                <option value="exam">📝 Bài kiểm tra (Định dạng đề mới 2025)</option>
                <option value="quiz">🎯 Trắc nghiệm có chấm điểm</option>
                <option value="form">📋 Thu thập thông tin / lấy ý kiến</option>
              </select>
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="space-y-1">
            <label className="font-bold text-slate-800 block text-xs">
              Mô tả / Hướng dẫn học sinh làm bài:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Nhập ghi chú, thời gian làm bài, quy định hoặc lưu ý cho học sinh..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#7a0f2b]"
            ></textarea>
          </div>

          {/* Row 3: Class Scope Selection (Grouped by Grade with Accordion & Select All Grade) */}
          <ClassScopeSelector
            scopeMode={scopeMode}
            onScopeModeChange={setScopeMode}
            selectedClasses={targetClasses}
            onChange={setTargetClasses}
            allClasses={allClasses}
            homeroomClass={teacherHomeroom}
            isTeacher={isTeacher}
          />

          {/* Row 4: Google Drive Folder ID setting (Only for Form) */}
          {surveyType === 'form' && (
            <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
              <label className="font-bold text-[#7a0f2b] flex items-center gap-1.5">
                <HardDrive className="w-4 h-4" />
                Mã ID Thư mục Google Drive (để lưu tệp đính kèm khi học sinh tải lên):
              </label>
              <input
                type="text"
                autoCapitalize="none"
                value={driveFolderId}
                onChange={e => setDriveFolderId(e.target.value)}
                placeholder="Mặc định: 1pS2VfhHEUbc2fWs0K_K6bSjivy0n8OMT"
                className="w-full p-2 bg-white border border-rose-300 rounded-lg font-mono text-xs font-semibold"
              />
              <span className="text-[11px] text-slate-500 block">
                Mặc định lưu vào thư mục Google Drive: <code className="font-mono font-bold text-rose-800">1pS2VfhHEUbc2fWs0K_K6bSjivy0n8OMT</code>
              </span>
            </div>
          )}

          {/* Row 5: Options Bar (Shuffle, Show Answers, Multiple Attempts) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-6 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
              />
              <span>Mở bài khảo sát cho học sinh làm</span>
            </label>

            {(surveyType === 'quiz' || surveyType === 'exam') && (
              <>
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={e => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
                  />
                  <span>Xáo trộn thứ tự câu hỏi</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={e => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
                  />
                  <span>Xáo trộn thứ tự các đáp án</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showAnswers}
                    onChange={e => setShowAnswers(e.target.checked)}
                    className="w-4 h-4 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
                  />
                  <span>Cho xem đáp án sau khi nộp</span>
                </label>
              </>
            )}

            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={allowMultipleAttempts}
                onChange={e => setAllowMultipleAttempts(e.target.checked)}
                className="w-4 h-4 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
              />
              <span>Cho phép làm lại bài</span>
            </label>
          </div>

          {/* =========================================================================
              SCORING PANEL 1: REGULAR QUIZ SCORE & SCALE 10 BUTTON
              ========================================================================= */}
          {surveyType === 'quiz' && (
            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#7a0f2b]" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Thiết lập điểm bài trắc nghiệm
                    </h4>
                    <span className="text-[11px] text-slate-600">
                      Mặc định mỗi câu 1 điểm, bạn có thể chỉnh điểm từng câu hoặc bấm chia đều theo thang điểm 10.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-500 block">Tổng điểm hiện tại:</span>
                    <span className="text-base font-black text-[#7a0f2b]">
                      {quizTotalPoints} điểm
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyQuizScale10}
                    className="px-3.5 py-2 bg-[#7a0f2b] hover:bg-[#8f1334] text-white rounded-xl font-bold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Tùy chọn thang điểm 10 (Chia đều)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              SCORING PANEL 2: EXAM (BÀI KIỂM TRA) PARTS 1, 2, 3 CONFIGURATION
              ========================================================================= */}
          {surveyType === 'exam' && (
            <div className="p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#7a0f2b]" />
                    Thiết lập điểm từng phần của Bài kiểm tra (Thang điểm 10 chuẩn)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Hệ thống tự động gom các câu hỏi trong đề thành các phần tương ứng và chia đều số điểm mỗi câu.
                  </p>
                </div>

                {/* Total Points Status Banner: RED IF NOT 10! */}
                <div
                  className={`px-3.5 py-2 rounded-xl border flex items-center gap-2 font-bold transition-all ${
                    isExamTotalValid10
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs'
                      : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  }`}
                >
                  {isExamTotalValid10 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>Tổng điểm: 10.0 / 10 điểm (Chuẩn)</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>Tổng điểm: {examTotalPoints} / 10 điểm (Chưa đúng 10!)</span>
                    </>
                  )}
                </div>
              </div>

              {/* 3 Parts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Part 1 */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      {examGroup1 ? examGroup1.title : 'Phần 1: Trắc nghiệm'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {examGroup1 ? `${examGroup1.count} câu` : '0 câu'}
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tổng số điểm phần này:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={examPart1Points}
                      onChange={e => setExamPart1Points(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Điểm mỗi câu:</span>
                    <span className="font-bold text-[#7a0f2b]">{part1PtsPerQ} đ/câu</span>
                  </div>
                </div>

                {/* Part 2 */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      {examGroup2 ? examGroup2.title : 'Phần 2: Đúng - Sai'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {examGroup2 ? `${examGroup2.count} câu` : '0 câu'}
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tổng số điểm phần này:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={examPart2Points}
                      onChange={e => setExamPart2Points(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Điểm mỗi câu:</span>
                    <span className="font-bold text-[#7a0f2b]">{part2PtsPerQ} đ/câu</span>
                  </div>
                </div>

                {/* Part 3 */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      {examGroup3 ? examGroup3.title : 'Phần 3: Trả lời ngắn'}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {examGroup3 ? `${examGroup3.count} câu` : '0 câu'}
                    </span>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Tổng số điểm phần này:
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={examPart3Points}
                      onChange={e => setExamPart3Points(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 text-xs"
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                    <span>Điểm mỗi câu:</span>
                    <span className="font-bold text-[#7a0f2b]">{part3PtsPerQ} đ/câu</span>
                  </div>
                </div>
              </div>

              {/* Note on True/False Grading Rules */}
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>
                  <b>Quy chế chấm điểm Đúng - Sai:</b> Trùng khớp 1 ý = <b>10%</b> điểm câu; 2 ý = <b>25%</b> điểm câu; 3 ý = <b>50%</b> điểm câu; đúng cả 4 ý = <b>100%</b> điểm câu!
                </span>
              </div>
            </div>
          )}

          {/* =========================================================================
              QUESTIONS LIST & BUILDER
              ========================================================================= */}
          <div className="space-y-4 pt-3 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span>Danh sách câu hỏi ({questions.length})</span>
              </h4>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center px-3.5 py-1.5 bg-rose-50 text-[#7a0f2b] hover:bg-rose-100 border border-rose-200 rounded-xl font-bold text-xs cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Thêm câu hỏi mới
              </button>
            </div>

            {questions.map((q, qIndex) => {
              const qType = q.type || 'single_choice';
              const showLivePreview = !!previewMap[qIndex];

              return (
                <div
                  key={q.id || qIndex}
                  className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3.5 shadow-2xs"
                >
                  {/* Question Header Line */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#7a0f2b] text-sm">
                        Câu {qIndex + 1}:
                      </span>

                      {/* Question Type Selector */}
                      {surveyType === 'exam' ? (
                        <select
                          value={qType}
                          onChange={e => {
                            const newT = e.target.value as QuestionType;
                            setQuestions(prev => {
                              const next = [...prev];
                              const cur = next[qIndex];
                              cur.type = newT;
                              if (newT === 'true_false') {
                                cur.options = cur.options && cur.options.length === 4 ? cur.options : ['Ý a: ', 'Ý b: ', 'Ý c: ', 'Ý d: '];
                                cur.correct_answers = cur.correct_answers || [false, false, false, false];
                              } else if (newT === 'single_choice') {
                                cur.options = cur.options && cur.options.length === 4 ? cur.options : ['', '', '', ''];
                                cur.correct_answer = typeof cur.correct_answer === 'number' ? cur.correct_answer : 0;
                              } else if (newT === 'short_number') {
                                cur.correct_answer = cur.correct_answer ? String(cur.correct_answer) : '0';
                              } else if (newT === 'short_text') {
                                cur.correct_answer = cur.correct_answer ? String(cur.correct_answer) : '';
                              }
                              return next;
                            });
                          }}
                          className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                        >
                          <option value="single_choice">🎯 Trắc nghiệm 4 lựa chọn (1 đáp án đúng)</option>
                          <option value="true_false">⚖️ Đúng - Sai (4 ý a, b, c, d)</option>
                          <option value="short_number">🔢 Trả lời ngắn: Điền số</option>
                          <option value="short_text">🔤 Trả lời ngắn: Điền từ (Cụm từ)</option>
                        </select>
                      ) : surveyType === 'quiz' ? (
                        <span className="px-2.5 py-0.5 rounded-md bg-rose-50 text-[#7a0f2b] font-bold text-xs border border-rose-200">
                          Trắc nghiệm lựa chọn
                        </span>
                      ) : (
                        <select
                          value={qType}
                          onChange={e => {
                            const newT = e.target.value as QuestionType;
                            setQuestions(prev => {
                              const next = [...prev];
                              next[qIndex].type = newT;
                              if (newT === 'single_choice' && (!next[qIndex].options || next[qIndex].options.length === 0)) {
                                next[qIndex].options = ['', '', '', ''];
                              }
                              return next;
                            });
                          }}
                          className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                        >
                          <option value="text">Điền thông tin văn bản</option>
                          <option value="date">Điền ngày tháng</option>
                          <option value="single_choice">Trắc nghiệm lựa chọn</option>
                          <option value="file">Tải lên tệp đính kèm (Ảnh/CCCD)</option>
                        </select>
                      )}
                    </div>

                    {/* Question Actions */}
                    <div className="flex items-center gap-2">
                      {/* Individual question score input for quiz */}
                      {surveyType === 'quiz' && (
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-500 font-semibold">Điểm:</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={q.points ?? 1}
                            onChange={e => {
                              const pts = parseFloat(e.target.value) || 0;
                              setQuestions(prev => {
                                const next = [...prev];
                                next[qIndex].points = pts;
                                return next;
                              });
                            }}
                            className="w-16 p-1 bg-white border border-slate-300 rounded text-xs font-bold text-center"
                          />
                        </div>
                      )}

                      {/* Image insert button with Google Drive folder ID requirement */}
                      <button
                        type="button"
                        onClick={() => setImageModalQuestionIndex(qIndex)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all ${
                          q.image_url
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                        title="Chèn ảnh minh họa cho câu hỏi (Lưu vào Google Drive)"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-[#7a0f2b]" />
                        <span>{q.image_url ? 'Đã chèn ảnh (Đổi ảnh)' : 'Chèn ảnh'}</span>
                      </button>

                      {/* Toggle KaTeX Preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewMap(prev => ({ ...prev, [qIndex]: !prev[qIndex] }))}
                        className="px-2 py-1 bg-white border border-slate-300 text-slate-600 hover:text-slate-900 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer"
                        title="Xem trước công thức toán học & đồ thị TikZ"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{showLivePreview ? 'Ẩn KaTeX' : 'Xem KaTeX'}</span>
                      </button>

                      {/* Delete Question */}
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(qIndex)}
                        className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Textarea (Supports LaTeX & TikZ) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Nội dung câu hỏi (hỗ trợ công thức LaTeX ví dụ <code className="text-rose-800">$x^2 + y^2 = 1$</code> hoặc TikZ <code className="text-rose-800">\begin&#123;tikzpicture&#125;...</code>):
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={q.question}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestions(prev => {
                          const next = [...prev];
                          next[qIndex].question = val;
                          return next;
                        });
                      }}
                      placeholder="Nhập nội dung câu hỏi..."
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:ring-2 focus:ring-[#7a0f2b]"
                    ></textarea>
                  </div>

                  {/* KaTeX Live Preview Box if enabled */}
                  {showLivePreview && q.question && (
                    <div className="p-3 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1 animate-in fade-in duration-100">
                      <span className="text-[10px] font-bold uppercase text-blue-700 block">
                        Xem trước công thức hiển thị thực tế:
                      </span>
                      <MathRenderer content={q.question} className="text-xs text-slate-800" />
                    </div>
                  )}

                  {/* Image Attachment Preview if present */}
                  {q.image_url && (
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <img
                          src={q.image_url}
                          alt="Ảnh câu hỏi"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] font-bold text-slate-800 block">
                            Ảnh minh họa câu hỏi
                          </span>
                          <span className="text-[10px] text-slate-400 truncate block font-mono">
                            {q.image_url}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions(prev => {
                            const next = [...prev];
                            next[qIndex].image_url = '';
                            return next;
                          });
                        }}
                        className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer flex-shrink-0"
                      >
                        Gỡ ảnh
                      </button>
                    </div>
                  )}

                  {/* File Code Prefix if type is file */}
                  {qType === 'file' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                      <label className="text-[11px] font-bold text-[#7a0f2b] block">
                        Mã tệp / Tiền tố đặt tên tệp khi học sinh nộp:
                      </label>
                      <input
                        type="text"
                        autoCapitalize="none"
                        value={q.file_code_prefix || ''}
                        onChange={e => {
                          const val = e.target.value.trim().toUpperCase();
                          setQuestions(prev => {
                            const next = [...prev];
                            next[qIndex].file_code_prefix = val;
                            return next;
                          });
                        }}
                        placeholder="VD: CCCD_MAT_TRUOC, ANH_THE_3X4..."
                        className="w-full p-2 bg-white border border-rose-300 rounded-lg font-mono text-xs font-bold text-[#7a0f2b]"
                      />
                    </div>
                  )}

                  {/* =========================================================
                      TYPE A: SINGLE CHOICE (4 options, 1 correct)
                      ========================================================= */}
                  {qType === 'single_choice' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        Các phương án trả lời (Bấm vào nút tròn để chọn đáp án đúng):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options?.map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const isCorrect = q.correct_answer === optIdx;

                          return (
                            <div
                              key={optIdx}
                              onClick={() => {
                                setQuestions(prev => {
                                  const next = [...prev];
                                  next[qIndex].correct_answer = optIdx;
                                  return next;
                                });
                              }}
                              className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-500 shadow-2xs ring-1 ring-emerald-500'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct_ans_${q.id || qIndex}`}
                                checked={isCorrect}
                                onChange={() => {}} // Handled by container onClick
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`w-5 font-bold ${isCorrect ? 'text-emerald-800' : 'text-slate-600'}`}>
                                {letter}.
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  const val = e.target.value;
                                  setQuestions(prev => {
                                    const next = [...prev];
                                    next[qIndex].options[optIdx] = val;
                                    return next;
                                  });
                                }}
                                placeholder={`Nội dung lựa chọn ${letter}...`}
                                className="flex-1 p-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#7a0f2b] focus:outline-none text-xs font-medium"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      TYPE B: TRUE / FALSE (4 statements, checkbox correct answers)
                      ========================================================= */}
                  {qType === 'true_false' && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          4 Ý mệnh đề (Đánh dấu tích vào các ý ĐÚNG; ý không tích là SAI):
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          Tích chọn: Đúng ✓ | Không tích: Sai ✗
                        </span>
                      </div>
                      <div className="space-y-2">
                        {['a', 'b', 'c', 'd'].map((letter, optIdx) => {
                          const isChecked = !!(q.correct_answers && q.correct_answers[optIdx]);
                          const optText = q.options?.[optIdx] || '';

                          return (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                                isChecked
                                  ? 'bg-emerald-50/80 border-emerald-400'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <label
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                                  isChecked
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                    : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setQuestions(prev => {
                                      const next = [...prev];
                                      const cur = next[qIndex];
                                      cur.correct_answers = cur.correct_answers || [false, false, false, false];
                                      cur.correct_answers[optIdx] = checked;
                                      return next;
                                    });
                                  }}
                                  className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>{isChecked ? 'ĐÚNG' : 'SAI'}</span>
                              </label>

                              <span className="font-bold text-slate-700 w-6">
                                {letter})
                              </span>

                              <input
                                type="text"
                                value={optText}
                                onChange={e => {
                                  const val = e.target.value;
                                  setQuestions(prev => {
                                    const next = [...prev];
                                    next[qIndex].options = next[qIndex].options || ['', '', '', ''];
                                    next[qIndex].options[optIdx] = val;
                                    return next;
                                  });
                                }}
                                placeholder={`Nội dung mệnh đề ý ${letter}...`}
                                className="flex-1 p-1 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#7a0f2b] focus:outline-none text-xs font-medium"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* =========================================================
                      TYPE C: SHORT ANSWER (NUMBER)
                      ========================================================= */}
                  {qType === 'short_number' && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Đáp án chuẩn bằng số (Dấu thập phân có thể dùng '.' hoặc ','):
                      </label>
                      <input
                        type="text"
                        value={q.correct_answer ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setQuestions(prev => {
                            const next = [...prev];
                            next[qIndex].correct_answer = val;
                            return next;
                          });
                        }}
                        placeholder="VD: 3.14 hoặc 3,14 hoặc -5 hoặc 25..."
                        className="w-full sm:w-64 p-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500 block">
                        Khi học sinh làm bài, hệ thống sẽ hiển thị bàn phím số ảo chuyên dụng để học sinh nhập đáp án dễ dàng trên điện thoại & máy tính.
                      </span>
                    </div>
                  )}

                  {/* =========================================================
                      TYPE D: SHORT ANSWER (TEXT)
                      ========================================================= */}
                  {qType === 'short_text' && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Đáp án chuẩn là cụm từ (Mặc định không viết hoa):
                      </label>
                      <input
                        type="text"
                        autoCapitalize="none"
                        value={q.correct_answer ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          setQuestions(prev => {
                            const next = [...prev];
                            next[qIndex].correct_answer = val;
                            return next;
                          });
                        }}
                        placeholder="VD: mat cau / dong bien / huynh van nghe..."
                        className="w-full sm:w-80 p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      />
                      <span className="text-[11px] text-slate-500 block">
                        Khi đối chiếu chấm bài, hệ thống tự động bỏ qua viết hoa, bỏ qua các dấu chấm, phẩy và tất cả khoảng trắng.
                      </span>
                    </div>
                  )}

                  {/* Explanation Field */}
                  {(surveyType === 'quiz' || surveyType === 'exam') && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                        Lời giải chi tiết / Giải thích đáp án (hiển thị khi học sinh xem lại bài):
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setQuestions(prev => {
                            const next = [...prev];
                            next[qIndex].explanation = val;
                            return next;
                          });
                        }}
                        placeholder="Giải thích cách giải bài toán..."
                        className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[11px]"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Add Question Button */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
            >
              <Plus className="w-4 h-4 text-[#7a0f2b]" />
              Thêm câu hỏi tiếp theo
            </button>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#7a0f2b] hover:bg-[#8f1334] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang lưu dữ liệu...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {editingSurvey ? 'Lưu thay đổi' : 'Hoàn tất & Tạo bài'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Image Upload Popup with mandatory Google Drive Folder ID prompt */}
      {imageModalQuestionIndex !== null && (
        <ImageUploadModal
          isOpen={true}
          initialFolderId={driveFolderId || DEFAULT_GOOGLE_DRIVE_FOLDER_ID}
          onClose={() => setImageModalQuestionIndex(null)}
          onImageSelected={url => {
            if (imageModalQuestionIndex !== null) {
              setQuestions(prev => {
                const next = [...prev];
                next[imageModalQuestionIndex].image_url = url;
                return next;
              });
            }
          }}
        />
      )}
    </div>
  );
};
