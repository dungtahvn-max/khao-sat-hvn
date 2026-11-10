import React, { useState, useMemo } from 'react';
import { getGradeFromClassName, formatClassDisplay, sortClassNames } from '../utils/classOrder';
import { ChevronDown, ChevronRight, CheckSquare, Square, Users, Layers, Check } from 'lucide-react';

interface ClassScopeSelectorProps {
  scopeMode: 'all' | 'classes';
  onScopeModeChange: (mode: 'all' | 'classes') => void;
  selectedClasses: string[];
  onChange: (classes: string[]) => void;
  allClasses: string[];
  homeroomClass?: string;
  isTeacher?: boolean;
}

export const ClassScopeSelector: React.FC<ClassScopeSelectorProps> = ({
  scopeMode,
  onScopeModeChange,
  selectedClasses,
  onChange,
  allClasses,
  homeroomClass,
  isTeacher = false,
}) => {
  // Group classes by grade
  const gradeGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    allClasses.forEach(c => {
      const g = getGradeFromClassName(c);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    });

    // Ensure sorted order
    const list: { grade: string; classes: string[] }[] = [];
    const gradeOrder = ['Khối 10', 'Khối 11', 'Khối 12'];
    gradeOrder.forEach(g => {
      if (map.has(g)) {
        list.push({ grade: g, classes: sortClassNames(map.get(g)!) });
        map.delete(g);
      }
    });

    // Remaining (e.g. Khối khác)
    map.forEach((cls, g) => {
      list.push({ grade: g, classes: sortClassNames(cls) });
    });

    return list;
  }, [allClasses]);

  // Expanded state for each grade accordion. Default expand all or expand grade containing homeroomClass
  const [expandedGrades, setExpandedGrades] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    gradeGroups.forEach(g => {
      // By default open all or open the one with homeroom
      init[g.grade] = true;
    });
    return init;
  });

  const toggleGradeExpand = (grade: string) => {
    setExpandedGrades(prev => ({
      ...prev,
      [grade]: !prev[grade],
    }));
  };

  const handleSelectEntireGrade = (gradeClasses: string[]) => {
    const allGradeSelected = gradeClasses.every(c => selectedClasses.includes(c));
    let next: string[];
    if (allGradeSelected) {
      // Bỏ chọn tất cả lớp của khối này
      next = selectedClasses.filter(c => !gradeClasses.includes(c));
    } else {
      // Thêm tất cả lớp của khối này
      const set = new Set([...selectedClasses, ...gradeClasses]);
      next = Array.from(set);
    }
    onChange(next);
  };

  const handleToggleClass = (className: string) => {
    if (selectedClasses.includes(className)) {
      onChange(selectedClasses.filter(c => c !== className));
    } else {
      onChange([...selectedClasses, className]);
    }
  };

  const handleSelectAllSchool = () => {
    onChange([...allClasses]);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const handleSelectOnlyHomeroom = () => {
    if (homeroomClass) {
      onChange([homeroomClass.trim().toUpperCase()]);
    }
  };

  return (
    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      {/* Scope Mode Radio Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <label className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#7a0f2b]" />
            Phạm vi áp dụng bài khảo sát / kiểm tra:
          </label>
          <span className="text-[11px] text-slate-500">
            {isTeacher
              ? 'Mặc định giao cho lớp chủ nhiệm của thầy cô, có thể chọn mở rộng ra khối hoặc toàn trường'
              : 'Giao cho toàn bộ học sinh toàn trường hoặc phân bổ cho từng khối, từng lớp cụ thể'}
          </span>
        </div>

        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
          <label
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              scopeMode === 'all'
                ? 'bg-[#7a0f2b] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <input
              type="radio"
              name="scopeOption"
              className="sr-only"
              checked={scopeMode === 'all'}
              onChange={() => {
                onScopeModeChange('all');
                onChange([]);
              }}
            />
            <span>Toàn trường</span>
          </label>

          <label
            className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              scopeMode === 'classes'
                ? 'bg-[#7a0f2b] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <input
              type="radio"
              name="scopeOption"
              className="sr-only"
              checked={scopeMode === 'classes'}
              onChange={() => onScopeModeChange('classes')}
            />
            <span>Chọn lớp / Khối</span>
          </label>
        </div>
      </div>

      {/* Class Group by Grade Area when 'classes' is active */}
      {scopeMode === 'classes' && (
        <div className="pt-2 border-t border-slate-200 space-y-3 animate-in fade-in duration-150">
          {/* Quick actions bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">
                Tổng đã chọn: <b className="text-[#7a0f2b]">{selectedClasses.length}</b> / {allClasses.length} lớp
              </span>
              {isTeacher && homeroomClass && (
                <button
                  type="button"
                  onClick={handleSelectOnlyHomeroom}
                  className="px-2 py-0.5 rounded-md bg-rose-50 text-[#7a0f2b] border border-rose-200 text-[11px] font-bold hover:bg-rose-100 cursor-pointer"
                  title="Chỉ chọn lớp của giáo viên chủ nhiệm"
                >
                  🎯 Lớp chủ nhiệm ({formatClassDisplay(homeroomClass)})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleSelectAllSchool}
                className="text-[#7a0f2b] hover:underline font-bold cursor-pointer"
              >
                Chọn tất cả các lớp
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
              >
                Bỏ chọn tất cả
              </button>
            </div>
          </div>

          {/* List of Grade Accordions */}
          <div className="space-y-2.5">
            {gradeGroups.map(group => {
              const gradeClasses = group.classes;
              const selectedInGrade = gradeClasses.filter(c => selectedClasses.includes(c));
              const allInGradeSelected = gradeClasses.length > 0 && selectedInGrade.length === gradeClasses.length;
              const isExpanded = !!expandedGrades[group.grade];

              return (
                <div
                  key={group.grade}
                  className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  {/* Grade Header */}
                  <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    {/* Click title to expand/collapse */}
                    <div
                      onClick={() => toggleGradeExpand(group.grade)}
                      className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                      <button
                        type="button"
                        className="p-1 rounded-md text-slate-500 group-hover:text-slate-800 transition-transform"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-[#7a0f2b]" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-[#7a0f2b] transition-colors">
                          {group.grade}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          ({selectedInGrade.length}/{gradeClasses.length} lớp đã chọn)
                        </span>
                      </div>
                    </div>

                    {/* "Chọn cả khối x" checkbox right next to Grade Name */}
                    <div className="flex items-center gap-3">
                      <label
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer select-none ${
                          allInGradeSelected
                            ? 'bg-[#7a0f2b] text-white border-[#7a0f2b] shadow-2xs'
                            : selectedInGrade.length > 0
                            ? 'bg-rose-50 text-[#7a0f2b] border-rose-300'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                        title={`Chọn nhanh toàn bộ các lớp của ${group.grade}`}
                      >
                        <input
                          type="checkbox"
                          checked={allInGradeSelected}
                          onChange={() => handleSelectEntireGrade(gradeClasses)}
                          className="w-3.5 h-3.5 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
                        />
                        <span>Chọn cả {group.grade}</span>
                      </label>
                    </div>
                  </div>

                  {/* Grade Classes Grid (Accordion Content) */}
                  {isExpanded && (
                    <div className="p-3 bg-white grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 animate-in fade-in duration-100">
                      {gradeClasses.map(className => {
                        const isChecked = selectedClasses.includes(className);
                        const isHomeroom = homeroomClass && homeroomClass.trim().toUpperCase() === className.trim().toUpperCase();

                        return (
                          <label
                            key={className}
                            className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-all select-none ${
                              isChecked
                                ? 'bg-rose-50 border-[#7a0f2b] text-[#7a0f2b] shadow-2xs font-bold'
                                : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleClass(className)}
                              className="w-4 h-4 rounded text-[#7a0f2b] focus:ring-[#7a0f2b]"
                            />
                            <span className="truncate">
                              {formatClassDisplay(className)}
                            </span>
                            {isHomeroom && (
                              <span
                                className="ml-auto text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300"
                                title="Lớp của bạn chủ nhiệm"
                              >
                                CN
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
