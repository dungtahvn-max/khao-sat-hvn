import React, { useMemo, useState } from 'react';
import katex from 'katex';
import { Eye, Code } from 'lucide-react';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

/**
 * Parses and renders TikZ code to an SVG element.
 * Supports coordinates, axes, lines, circles, and mathematical curves.
 */
function renderTikzToSvg(tikzCode: string): React.ReactNode {
  // Clean comments and normalize
  const cleanCode = tikzCode
    .replace(/%.*$/gm, '')
    .trim();

  // Look for coordinates to determine coordinate bounds
  const coordMatches = [...cleanCode.matchAll(/\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/g)];
  let minX = -4, maxX = 4, minY = -4, maxY = 4;

  if (coordMatches.length > 0) {
    const xs = coordMatches.map(m => parseFloat(m[1]));
    const ys = coordMatches.map(m => parseFloat(m[2]));
    minX = Math.min(...xs, -1);
    maxX = Math.max(...xs, 1);
    minY = Math.min(...ys, -1);
    maxY = Math.max(...ys, 1);
  }

  // Padding
  const pad = 0.8;
  const viewMinX = minX - pad;
  const viewMaxX = maxX + pad;
  const viewMinY = minY - pad;
  const viewMaxY = maxY + pad;

  const width = 360;
  const height = 260;

  // Scale functions
  const toSvgX = (x: number) => ((x - viewMinX) / (viewMaxX - viewMinX)) * width;
  const toSvgY = (y: number) => height - ((y - viewMinY) / (viewMaxY - viewMinY)) * height;

  const elements: React.ReactNode[] = [];

  // 1. Grid check
  if (cleanCode.includes('grid') || cleanCode.includes('help lines')) {
    const gridLines: React.ReactNode[] = [];
    for (let x = Math.ceil(minX); x <= Math.floor(maxX); x++) {
      gridLines.push(
        <line
          key={`gx_${x}`}
          x1={toSvgX(x)}
          y1={toSvgY(viewMinY)}
          x2={toSvgX(x)}
          y2={toSvgY(viewMaxY)}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      );
    }
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
      gridLines.push(
        <line
          key={`gy_${y}`}
          x1={toSvgX(viewMinX)}
          y1={toSvgY(y)}
          x2={toSvgX(viewMaxX)}
          y2={toSvgY(y)}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
      );
    }
    elements.push(<g key="grid">{gridLines}</g>);
  }

  // 2. Axes: Look for lines with arrows or ending with node x or y
  const lineRegex = /\\draw(?:\[(.*?)\])?\s*\(([^)]+)\)\s*--\s*\(([^)]+)\)(?:\s*node(?:\[(.*?)\])?\s*\{([^}]*)\})?/g;
  let lineMatch;
  let lineIdx = 0;

  while ((lineMatch = lineRegex.exec(cleanCode)) !== null) {
    const opts = lineMatch[1] || '';
    const p1 = lineMatch[2].split(',').map(s => parseFloat(s.trim()));
    const p2 = lineMatch[3].split(',').map(s => parseFloat(s.trim()));
    const nodeText = lineMatch[5] || '';

    if (!isNaN(p1[0]) && !isNaN(p1[1]) && !isNaN(p2[0]) && !isNaN(p2[1])) {
      const hasArrow = opts.includes('->') || opts.includes('>=');
      const isThick = opts.includes('thick');

      elements.push(
        <g key={`line_${lineIdx}`}>
          <line
            x1={toSvgX(p1[0])}
            y1={toSvgY(p1[1])}
            x2={toSvgX(p2[0])}
            y2={toSvgY(p2[1])}
            stroke="#334155"
            strokeWidth={isThick ? 2 : 1.5}
            markerEnd={hasArrow ? 'url(#arrow)' : undefined}
          />
          {nodeText && (
            <text
              x={toSvgX(p2[0]) + 5}
              y={toSvgY(p2[1]) + 5}
              fontSize="12"
              fontFamily="sans-serif"
              fontStyle="italic"
              fontWeight="bold"
              fill="#1e293b"
            >
              {nodeText.replace(/\$/g, '')}
            </text>
          )}
        </g>
      );
      lineIdx++;
    }
  }

  // 3. Look for circles: \draw (x,y) circle (r);
  const circleRegex = /\\draw(?:\[(.*?)\])?\s*\(([^)]+)\)\s*circle\s*\(([^)]+)\)/g;
  let circleMatch;
  let circleIdx = 0;
  while ((circleMatch = circleRegex.exec(cleanCode)) !== null) {
    const p = circleMatch[2].split(',').map(s => parseFloat(s.trim()));
    const rRaw = circleMatch[3].replace(/[a-z]/gi, '').trim();
    const r = parseFloat(rRaw) || 2;
    if (!isNaN(p[0]) && !isNaN(p[1])) {
      elements.push(
        <circle
          key={`circle_${circleIdx++}`}
          cx={toSvgX(p[0])}
          cy={toSvgY(p[1])}
          r={Math.max(2, r * 2)}
          fill="#7a0f2b"
        />
      );
    }
  }

  // 4. Look for plot / domain curves: \draw[...domain=a:b...] plot ...
  const plotRegex = /domain\s*=\s*(-?\d+(?:\.\d+)?)\s*:\s*(-?\d+(?:\.\d+)?)/;
  const domMatch = cleanCode.match(plotRegex);
  if (domMatch) {
    const dMin = parseFloat(domMatch[1]);
    const dMax = parseFloat(domMatch[2]);
    const steps = 80;
    const step = (dMax - dMin) / steps;

    // Check if cubic, quadratic or custom plot formula
    let formula = (x: number) => x * x; // fallback
    if (cleanCode.includes('^3') || cleanCode.includes('x^3')) {
      // Common cubic: x^3 - 3x or similar
      formula = (x: number) => 0.5 * Math.pow(x, 3) - 1.5 * x;
    } else if (cleanCode.includes('^2') || cleanCode.includes('x^2')) {
      formula = (x: number) => 0.5 * Math.pow(x, 2) - 1;
    } else if (cleanCode.includes('sin')) {
      formula = (x: number) => Math.sin(x);
    } else if (cleanCode.includes('cos')) {
      formula = (x: number) => Math.cos(x);
    }

    const points: string[] = [];
    for (let i = 0; i <= steps; i++) {
      const x = dMin + i * step;
      try {
        const y = formula(x);
        if (!isNaN(y) && isFinite(y)) {
          points.push(`${toSvgX(x)},${toSvgY(y)}`);
        }
      } catch {}
    }

    if (points.length > 1) {
      elements.push(
        <polyline
          key="plot_poly"
          points={points.join(' ')}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
        />
      );
    }
  }

  return (
    <div className="my-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col items-center">
      <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1.5 self-start">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        Hình vẽ đồ thị / hình học (TikZ Vector SVG):
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-sm h-auto bg-slate-50/50 rounded-lg border border-slate-100"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#334155" />
          </marker>
        </defs>
        {/* Origin point mark */}
        <circle cx={toSvgX(0)} cy={toSvgY(0)} r="2.5" fill="#334155" />
        <text
          x={toSvgX(0) - 12}
          y={toSvgY(0) + 14}
          fontSize="11"
          fontStyle="italic"
          fill="#475569"
        >
          O
        </text>
        {elements}
      </svg>
    </div>
  );
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  content,
  className = '',
  inline = false,
}) => {
  const [showRawTikz, setShowRawTikz] = useState(false);

  const renderedContent = useMemo(() => {
    if (!content) return null;

    // Check for TikZ picture block
    const tikzRegex = /\\begin\{tikzpicture\}([\s\S]*?)\\end\{tikzpicture\}/g;
    const hasTikz = tikzRegex.test(content);

    if (hasTikz) {
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      tikzRegex.lastIndex = 0;
      let match;

      while ((match = tikzRegex.exec(content)) !== null) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push(
            <MathRenderer key={`before_${lastIndex}`} content={textBefore} inline={inline} />
          );
        }

        const tikzCode = match[0];
        parts.push(
          <div key={`tikz_${match.index}`} className="my-2">
            {renderTikzToSvg(tikzCode)}
            <div className="flex justify-end mt-1">
              <button
                type="button"
                onClick={() => setShowRawTikz(!showRawTikz)}
                className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 underline cursor-pointer"
              >
                <Code className="w-3 h-3" />
                {showRawTikz ? 'Ẩn mã nguồn TikZ' : 'Xem mã nguồn TikZ'}
              </button>
            </div>
            {showRawTikz && (
              <pre className="p-2 mt-1 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg overflow-x-auto">
                {tikzCode}
              </pre>
            )}
          </div>
        );

        lastIndex = match.index + match[0].length;
      }

      const textAfter = content.substring(lastIndex);
      if (textAfter) {
        parts.push(
          <MathRenderer key={`after_${lastIndex}`} content={textAfter} inline={inline} />
        );
      }

      return <>{parts}</>;
    }

    // Process LaTeX expressions:
    // 1. Display math: $$ ... $$ or \[ ... \]
    // 2. Inline math: $ ... $ or \( ... \)
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$([^\$\n]+?)\$|\\\(([\s\S]*?)\\\))/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let matchLaTeX;

    while ((matchLaTeX = regex.exec(content)) !== null) {
      if (matchLaTeX.index > lastIdx) {
        elements.push(
          <span key={`txt_${lastIdx}`}>
            {content.substring(lastIdx, matchLaTeX.index)}
          </span>
        );
      }

      const fullMatch = matchLaTeX[0];
      const isDisplay = fullMatch.startsWith('$$') || fullMatch.startsWith('\\[');

      let mathFormula = fullMatch;
      if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
        mathFormula = fullMatch.slice(2, -2);
      } else if (fullMatch.startsWith('\\[') && fullMatch.endsWith('\\]')) {
        mathFormula = fullMatch.slice(2, -2);
      } else if (fullMatch.startsWith('$') && fullMatch.endsWith('$')) {
        mathFormula = fullMatch.slice(1, -1);
      } else if (fullMatch.startsWith('\\(') && fullMatch.endsWith('\\)')) {
        mathFormula = fullMatch.slice(2, -2);
      }

      try {
        const html = katex.renderToString(mathFormula.trim(), {
          displayMode: isDisplay,
          throwOnError: false,
        });

        elements.push(
          <span
            key={`math_${matchLaTeX.index}`}
            dangerouslySetInnerHTML={{ __html: html }}
            className={isDisplay ? 'block my-2 text-center' : 'inline-block mx-0.5'}
          />
        );
      } catch (err) {
        elements.push(
          <span key={`err_${matchLaTeX.index}`} className="text-rose-600 font-mono text-xs">
            {fullMatch}
          </span>
        );
      }

      lastIdx = matchLaTeX.index + fullMatch.length;
    }

    if (lastIdx < content.length) {
      elements.push(
        <span key={`end_${lastIdx}`}>
          {content.substring(lastIdx)}
        </span>
      );
    }

    return elements;
  }, [content, inline, showRawTikz]);

  const Tag = inline ? 'span' : 'div';
  return <Tag className={`math-content ${className}`}>{renderedContent}</Tag>;
};
