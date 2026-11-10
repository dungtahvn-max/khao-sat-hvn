/**
 * Chuẩn hóa và so sánh thứ tự các lớp học:
 * Khối 10: 10.1 đến 10.9, 10_10 (hoặc 10.10), 10.11 đến 10.15
 * Khối 11: 11.1 đến 11.9, 11_10 (hoặc 11.10), 11.11
 * Khối 12: 12.1 đến 12.9, 12_10 (hoặc 12.10), 12.11, 12.12
 */

export function parseClassComponents(className: string) {
  const raw = (className || '').trim().toUpperCase();
  // Match grade: leading digits (10, 11, 12, ...)
  const gradeMatch = raw.match(/^(\d+)/);
  const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : 999;

  // Remainder after grade
  const remainder = gradeMatch ? raw.slice(gradeMatch[1].length) : raw;

  // Extract section / index number.
  // Examples: ".1" -> 1, ".9" -> 9, "_10" -> 10, ".10" -> 10, ".11" -> 11, "A1" -> letter "A", num 1
  const subMatch = remainder.match(/^[._\s/-]?([A-Z]*)(\d+)?(.*)$/);
  const letter = subMatch && subMatch[1] ? subMatch[1] : '';
  const num = subMatch && subMatch[2] ? parseInt(subMatch[2], 10) : 0;
  const extra = subMatch && subMatch[3] ? subMatch[3] : '';

  return { grade, letter, num, extra, raw };
}

export function compareClassNames(a: string, b: string): number {
  const pA = parseClassComponents(a);
  const pB = parseClassComponents(b);

  if (pA.grade !== pB.grade) {
    return pA.grade - pB.grade;
  }
  if (pA.letter !== pB.letter) {
    return pA.letter.localeCompare(pB.letter);
  }
  if (pA.num !== pB.num) {
    return pA.num - pB.num;
  }
  return pA.raw.localeCompare(pB.raw);
}

export function sortClassNames(classes: string[]): string[] {
  return [...classes].sort(compareClassNames);
}

export function getGradeFromClassName(className: string): string {
  const p = parseClassComponents(className);
  if (p.grade === 10) return 'Khối 10';
  if (p.grade === 11) return 'Khối 11';
  if (p.grade === 12) return 'Khối 12';
  return p.grade !== 999 ? `Khối ${p.grade}` : 'Khác';
}

/**
 * Hiển thị tên lớp trên giao diện:
 * 10_10 xem như 10.10, 11_10 xem như 11.10, 12_10 xem như 12.10
 * Trong khi giá trị gốc trong database và khi xuất Excel vẫn giữ nguyên 10_10, 11_10, 12_10
 */
export function formatClassDisplay(className: string): string {
  if (!className) return '';
  const raw = className.trim();
  return raw.replace(/(\b\d+)_10\b/g, '$1.10');
}
