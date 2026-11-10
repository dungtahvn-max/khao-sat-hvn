import { Question, SurveyType, ExamPartsConfig } from '../types';

/**
 * Chuẩn hóa chuỗi văn bản cho câu trả lời ngắn (điền từ):
 * - Mặc định không viết hoa (lowercase)
 * - Bỏ qua dấu chấm, phẩy và tất cả khoảng trắng
 */
export function cleanShortText(str: any): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[.,\s]/g, '');
}

/**
 * Chuẩn hóa và so sánh số cho câu trả lời ngắn (điền số):
 * - Hỗ trợ cả dấu chấm '.' và dấu phẩy ',' cho số thập phân
 * - Bỏ qua khoảng trắng
 */
export function compareShortNumber(studentAns: any, correctAns: any): boolean {
  if (studentAns === undefined || studentAns === null || studentAns === '') return false;
  if (correctAns === undefined || correctAns === null || correctAns === '') return false;

  const cleanS = String(studentAns).trim().replace(',', '.');
  const cleanC = String(correctAns).trim().replace(',', '.');

  if (cleanS === cleanC) return true;

  const numS = parseFloat(cleanS);
  const numC = parseFloat(cleanC);

  if (!isNaN(numS) && !isNaN(numC)) {
    return Math.abs(numS - numC) < 0.00001;
  }

  return false;
}

/**
 * Kiểm tra xem câu trả lời của học sinh có khớp đáp án đúng hay không.
 * Hỗ trợ 4 dạng:
 * 1. single_choice (Trắc nghiệm 1 đáp án đúng)
 * 2. true_false (Đúng-Sai 4 ý) -> trả về true nếu đúng cả 4 ý
 * 3. short_number (Điền số)
 * 4. short_text (Điền từ)
 */
export function isAnswerCorrect(studentAns: any, question: Question): boolean {
  const qType = question.type || (question.options && question.options.length > 0 ? 'single_choice' : 'text');

  if (qType === 'short_number') {
    return compareShortNumber(studentAns, question.correct_answer);
  }

  if (qType === 'short_text') {
    if (studentAns === undefined || studentAns === null || studentAns === '') return false;
    if (question.correct_answer === undefined || question.correct_answer === null) return false;
    return cleanShortText(studentAns) === cleanShortText(question.correct_answer);
  }

  if (qType === 'true_false') {
    if (!studentAns || typeof studentAns !== 'object') return false;
    const correctBooleans: boolean[] = question.correct_answers || [false, false, false, false];
    let matchCount = 0;
    for (let i = 0; i < 4; i++) {
      const sVal = studentAns[i] !== undefined ? Boolean(studentAns[i]) : false;
      const cVal = Boolean(correctBooleans[i]);
      if (sVal === cVal) matchCount++;
    }
    return matchCount === 4;
  }

  // Mặc định cho single_choice
  if (question.correct_answer === undefined || question.correct_answer === null) return false;
  if (studentAns === undefined || studentAns === null || studentAns === '') return false;

  const ca: any = question.correct_answer;

  // 1. Direct strict equality
  if (studentAns === ca) return true;

  // 2. String comparison: "1" === "1"
  if (String(studentAns).trim() === String(ca).trim()) return true;

  // 3. Numeric comparison: 1 === 1
  const numAns = Number(studentAns);
  const numCa = Number(ca);
  if (!isNaN(numAns) && !isNaN(numCa) && numAns === numCa) return true;

  // 4. Letter comparison: e.g. studentAns is 1 (index), ca is 'B'
  if (typeof ca === 'string' && /^[A-Da-d]$/.test(ca.trim())) {
    const letterIndex = ca.trim().toUpperCase().charCodeAt(0) - 65; // 'A'->0, 'B'->1, ...
    if (!isNaN(numAns) && numAns === letterIndex) return true;
  }
  if (typeof studentAns === 'string' && /^[A-Da-d]$/.test(studentAns.trim())) {
    const letterIndex = studentAns.trim().toUpperCase().charCodeAt(0) - 65;
    if (!isNaN(numCa) && numCa === letterIndex) return true;
  }

  // 5. Option text comparison: e.g. ca is full option text string
  if (question.options && Array.isArray(question.options)) {
    if (!isNaN(numAns) && question.options[numAns] !== undefined) {
      if (question.options[numAns].trim().toLowerCase() === String(ca).trim().toLowerCase()) {
        return true;
      }
    }
    const optIdx = question.options.findIndex(opt => opt.trim().toLowerCase() === String(ca).trim().toLowerCase());
    if (optIdx >= 0 && optIdx === numAns) {
      return true;
    }
  }

  return false;
}

/**
 * Tính số ý trùng khớp cho dạng câu hỏi Đúng-Sai (0 đến 4 ý)
 */
export function getTrueFalseMatchCount(studentAns: any, question: Question): { matches: number; details: boolean[] } {
  if (!studentAns || typeof studentAns !== 'object') {
    return { matches: 0, details: [false, false, false, false] };
  }
  const correctBooleans: boolean[] = question.correct_answers || [false, false, false, false];
  const details: boolean[] = [];
  let matches = 0;

  for (let i = 0; i < 4; i++) {
    const sVal = studentAns[i] !== undefined ? Boolean(studentAns[i]) : false;
    const cVal = Boolean(correctBooleans[i]);
    const isMatch = sVal === cVal;
    details.push(isMatch);
    if (isMatch) matches++;
  }

  return { matches, details };
}

/**
 * Tính điểm cho 1 câu hỏi cụ thể theo quy chế:
 * - Trắc nghiệm (single_choice): Đúng = 100% điểm câu, Sai = 0
 * - Đúng - Sai (true_false):
 *   + 1 ý trùng khớp = 10% điểm câu
 *   + 2 ý trùng khớp = 25% điểm câu
 *   + 3 ý trùng khớp = 50% điểm câu
 *   + 4 ý trùng khớp = 100% điểm câu
 *   + 0 ý = 0
 * - Điền số / Điền từ: Đúng = 100% điểm câu, Sai = 0
 */
export function calculateQuestionScore(
  studentAns: any,
  question: Question,
  assignedPoints?: number
): { score: number; maxPoints: number; isFullMatch: boolean; details?: any } {
  const maxPoints = typeof assignedPoints === 'number'
    ? assignedPoints
    : (typeof question.points === 'number' ? question.points : 1);

  const qType = question.type || (question.options && question.options.length > 0 ? 'single_choice' : 'text');

  if (qType === 'true_false') {
    const { matches, details } = getTrueFalseMatchCount(studentAns, question);
    let ratio = 0;
    if (matches === 1) ratio = 0.10;
    else if (matches === 2) ratio = 0.25;
    else if (matches === 3) ratio = 0.50;
    else if (matches === 4) ratio = 1.00;

    const score = Number((maxPoints * ratio).toFixed(3));
    return {
      score,
      maxPoints,
      isFullMatch: matches === 4,
      details: { matches, itemMatches: details, ratio },
    };
  }

  const correct = isAnswerCorrect(studentAns, question);
  return {
    score: correct ? maxPoints : 0,
    maxPoints,
    isFullMatch: correct,
  };
}

/**
 * Phân chia câu hỏi của bài kiểm tra thành 3 phần:
 * Phần 1: Trắc nghiệm (single_choice)
 * Phần 2: Đúng - Sai (true_false)
 * Phần 3: Trả lời ngắn (short_number + short_text)
 * Đôn phần lên nếu phần trước không có!
 */
export interface ExamPartGroup {
  partIndex: 1 | 2 | 3;
  typeCategory: 'single_choice' | 'true_false' | 'short_answer';
  title: string;
  questions: Question[];
  count: number;
}

export function groupExamQuestions(questions: Question[]): ExamPartGroup[] {
  const singleChoiceList: Question[] = [];
  const trueFalseList: Question[] = [];
  const shortAnswerList: Question[] = [];

  questions.forEach(q => {
    const t = q.type || (q.options && q.options.length > 0 ? 'single_choice' : 'text');
    if (t === 'true_false') {
      trueFalseList.push(q);
    } else if (t === 'short_number' || t === 'short_text') {
      shortAnswerList.push(q);
    } else {
      singleChoiceList.push(q);
    }
  });

  const availableGroups: { typeCategory: 'single_choice' | 'true_false' | 'short_answer'; title: string; questions: Question[] }[] = [];

  if (singleChoiceList.length > 0) {
    availableGroups.push({
      typeCategory: 'single_choice',
      title: 'Trắc nghiệm nhiều lựa chọn',
      questions: singleChoiceList,
    });
  }
  if (trueFalseList.length > 0) {
    availableGroups.push({
      typeCategory: 'true_false',
      title: 'Trắc nghiệm Đúng - Sai',
      questions: trueFalseList,
    });
  }
  if (shortAnswerList.length > 0) {
    availableGroups.push({
      typeCategory: 'short_answer',
      title: 'Trả lời ngắn (Điền số & Điền từ)',
      questions: shortAnswerList,
    });
  }

  // Đôn lên làm Phần 1, Phần 2, Phần 3
  return availableGroups.map((g, idx) => ({
    partIndex: (idx + 1) as 1 | 2 | 3,
    typeCategory: g.typeCategory,
    title: `Phần ${idx + 1}: ${g.title}`,
    questions: g.questions,
    count: g.questions.length,
  }));
}

/**
 * Tính toàn bộ điểm số của một bài làm (dành cho quiz hoặc bài kiểm tra exam):
 */
export function calculateTotalScore(
  answers: Record<string, any>,
  questions: Question[],
  surveyType: SurveyType,
  examConfig?: ExamPartsConfig
): {
  totalScore: number;
  maxScore: number;
  questionScores: Record<string, number>;
  correctCount: number;
} {
  let totalScore = 0;
  let maxScore = 0;
  let correctCount = 0;
  const questionScores: Record<string, number> = {};

  if (surveyType === 'exam') {
    const parts = groupExamQuestions(questions);

    // Tính điểm của từng phần và điểm mỗi câu trong từng phần
    parts.forEach((p, pIdx) => {
      let partTotalPts = 0;
      if (pIdx === 0 && examConfig?.part1_points !== undefined) {
        partTotalPts = examConfig.part1_points;
      } else if (pIdx === 1 && examConfig?.part2_points !== undefined) {
        partTotalPts = examConfig.part2_points;
      } else if (pIdx === 2 && examConfig?.part3_points !== undefined) {
        partTotalPts = examConfig.part3_points;
      } else {
        // Fallback: tổng điểm từ question.points hoặc 1pt/câu
        partTotalPts = p.questions.reduce((sum, q) => sum + (typeof q.points === 'number' ? q.points : 1), 0);
      }

      const pointsPerQuestion = p.count > 0 ? partTotalPts / p.count : 0;

      p.questions.forEach(q => {
        const studentAns = answers[q.id];
        const res = calculateQuestionScore(studentAns, q, pointsPerQuestion);
        questionScores[q.id] = res.score;
        totalScore += res.score;
        maxScore += res.maxPoints;
        if (res.isFullMatch) {
          correctCount++;
        }
      });
    });
  } else {
    // Quiz thông thường
    questions.forEach(q => {
      const studentAns = answers[q.id];
      const assignedPoints = typeof q.points === 'number' ? q.points : 1;
      const res = calculateQuestionScore(studentAns, q, assignedPoints);
      questionScores[q.id] = res.score;
      totalScore += res.score;
      maxScore += res.maxPoints;
      if (res.isFullMatch) {
        correctCount++;
      }
    });
  }

  // Làm tròn điểm hiển thị đến 2 chữ số thập phân
  return {
    totalScore: Number(totalScore.toFixed(2)),
    maxScore: Number(maxScore.toFixed(2)),
    questionScores,
    correctCount,
  };
}
