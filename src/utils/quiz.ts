import { Question } from '../types';

/**
 * Robustly checks if a student's answer matches the correct answer for a question.
 * Supports:
 * - 0-indexed numeric values (0, 1, 2, 3)
 * - String numeric values ("0", "1", "2", "3")
 * - Letter representations ("A", "B", "C", "D" -> 0, 1, 2, 3)
 * - Full option text matching
 */
export function isAnswerCorrect(studentAns: any, question: Question): boolean {
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
  if (typeof ca === 'string' && /^[A-Za-z]$/.test(ca.trim())) {
    const letterIndex = ca.trim().toUpperCase().charCodeAt(0) - 65; // 'A'->0, 'B'->1, ...
    if (!isNaN(numAns) && numAns === letterIndex) return true;
  }
  // Or studentAns is 'B', ca is 1
  if (typeof studentAns === 'string' && /^[A-Za-z]$/.test(studentAns.trim())) {
    const letterIndex = studentAns.trim().toUpperCase().charCodeAt(0) - 65;
    if (!isNaN(numCa) && numCa === letterIndex) return true;
  }

  // 5. Option text comparison: e.g. ca is full option text string
  if (question.options && Array.isArray(question.options)) {
    // If studentAns is numeric index, compare question.options[numAns] with ca
    if (!isNaN(numAns) && question.options[numAns] !== undefined) {
      if (question.options[numAns].trim().toLowerCase() === String(ca).trim().toLowerCase()) {
        return true;
      }
    }
    // If ca is string matching an option, find index of ca
    const optIdx = question.options.findIndex(opt => opt.trim().toLowerCase() === String(ca).trim().toLowerCase());
    if (optIdx >= 0 && optIdx === numAns) {
      return true;
    }
  }

  return false;
}
