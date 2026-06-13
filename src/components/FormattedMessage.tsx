import React, { useState } from "react";
import { Clipboard, Check, Table, FileSpreadsheet, FileText } from "lucide-react";

interface FormattedMessageProps {
  text: string;
}

export default function FormattedMessage({ text }: FormattedMessageProps) {
  const [copiedTableIndex, setCopiedTableIndex] = useState<number | null>(null);
  const [copiedFull, setCopiedFull] = useState(false);

  if (!text) return null;

  // 1. Inline parsing for font weights, italics, and inline code ticks
  const renderInnerInline = (lineText: string) => {
    const parts = lineText.split(/\*([^*]+)\*/g);
    return parts.map((part, index) => {
      const isItalic = index % 2 === 1;
      if (isItalic) {
        return (
          <span key={index} className="italic text-slate-650 dark:text-slate-300 bg-slate-100/50 dark:bg-slate-800/30 px-1 rounded-sm text-[11px] sm:text-xs">
            {part}
          </span>
        );
      } else {
        // Handle inline code block ticks
        const codeParts = part.split(/`([^`]+)`/g);
        return codeParts.map((subPart, isCodeIdx) => {
          const isCode = isCodeIdx % 2 === 1;
          if (isCode) {
            return (
              <code key={isCodeIdx} className="font-mono text-[11px] sm:text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/25 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-950/40 font-bold">
                {subPart}
              </code>
            );
          }
          return subPart;
        });
      }
    });
  };

  const renderInlineStyles = (lineText: string) => {
    if (!lineText) return "";
    
    // Clean to avoid double-triple asterisk artifacts e.g. "***"
    let cleanText = lineText.replace(/\*\*\*/g, "**").replace(/^⚠️\s*/, "");
    
    // Split by bold double asterisks **
    const parts = cleanText.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, index) => {
      const isBold = index % 2 === 1;
      if (isBold) {
        return (
          <strong key={index} className="font-extrabold text-blue-900/95 dark:text-blue-100">
            {renderInnerInline(part)}
          </strong>
        );
      } else {
        return renderInnerInline(part);
      }
    });
  };

  // 2. Parse lines into logical blocks
  const parseBlocks = (sourceText: string) => {
    const lines = sourceText.split("\n");
    const blocks: any[] = [];
    let currentTableLines: string[] = [];
    let currentListItems: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Is it a table line?
      if (line.includes("|") && line.trim().startsWith("|") && line.trim().endsWith("|")) {
        if (currentListItems.length > 0) {
          blocks.push({ type: "list", items: currentListItems });
          currentListItems = [];
        }
        currentTableLines.push(line);
        continue;
      } else {
        if (currentTableLines.length > 0) {
          blocks.push({ type: "table", lines: currentTableLines });
          currentTableLines = [];
        }
      }

      // Is it a list line?
      const listMatch = line.trim().match(/^([*-]|\d+\.)\s+(.*)$/);
      if (listMatch) {
        const content = listMatch[2];
        currentListItems.push(content);
        continue;
      } else {
        if (currentListItems.length > 0) {
          blocks.push({ type: "list", items: currentListItems });
          currentListItems = [];
        }
      }

      // Is it horizontal divider?
      if (line.trim() === "---") {
        blocks.push({ type: "divider" });
        continue;
      }

      // Is it helper note block?
      const trimmed = line.trim();
      const isNote = trimmed.startsWith("⚠️") || 
                     (trimmed.startsWith("*(") && trimmed.endsWith(")*")) ||
                     (trimmed.startsWith("(") && trimmed.endsWith(").")) ||
                     trimmed.startsWith("👉");

      if (isNote) {
        blocks.push({ type: "note", text: line });
        continue;
      }

      // Is it a heading?
      const heading3Match = line.match(/^###\s+(.*)$/);
      if (heading3Match) {
        blocks.push({ type: "heading", level: 3, text: heading3Match[1] });
        continue;
      }
      const heading2Match = line.match(/^##\s+(.*)$/);
      if (heading2Match) {
        blocks.push({ type: "heading", level: 2, text: heading2Match[1] });
        continue;
      }
      const heading1Match = line.match(/^#\s+(.*)$/);
      if (heading1Match) {
        blocks.push({ type: "heading", level: 1, text: heading1Match[1] });
        continue;
      }

      // Default to plain paragraph or spacing
      if (trimmed === "") {
        blocks.push({ type: "empty" });
      } else {
        blocks.push({ type: "paragraph", text: line });
      }
    }

    // Flush any pending lists list/tables
    if (currentTableLines.length > 0) {
      blocks.push({ type: "table", lines: currentTableLines });
    }
    if (currentListItems.length > 0) {
      blocks.push({ type: "list", items: currentListItems });
    }

    return blocks;
  };

  const blocks = parseBlocks(text);

  // Parse markdown tables to JSON arrays
  const parseTableJson = (tableLines: string[]) => {
    const parsedRows: string[][] = [];
    tableLines.forEach((line) => {
      const cells = line.split("|").map((c) => c.trim());
      // Remove trailing and leading blanks
      if (cells[0] === "") cells.shift();
      if (cells[cells.length - 1] === "") cells.pop();
      
      const isAlignmentDivider = cells.every((c) => /^:?-+:?$/.test(c));
      if (!isAlignmentDivider && cells.length > 0) {
        parsedRows.push(cells);
      }
    });
    if (parsedRows.length === 0) return null;
    const headers = parsedRows[0];
    const bodyRows = parsedRows.slice(1);
    return { headers, bodyRows };
  };

  // Clipboard copies
  const copyTableToClipboard = (tableLines: string[], index: number) => {
    const tableData = parseTableJson(tableLines);
    if (!tableData) return;

    // Build standard high-compat TSV format so that pasting into Excel creates native rows
    const tsvContent = [
      tableData.headers.join("\t"),
      ...tableData.bodyRows.map((row) => row.join("\t"))
    ].join("\n");

    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedTableIndex(index);
      setTimeout(() => setCopiedTableIndex(null), 2500);
    });
  };

  const copyFullMessage = () => {
    // Strip header and bold markers easily for clean copy pasting
    const cleanFullText = text
      .replace(/\*\*\*/g, "")
      .replace(/\*\*/g, "")
      .replace(/^###\s+/gm, "")
      .replace(/^##\s+/gm, "")
      .replace(/^#\s+/gm, "");

    navigator.clipboard.writeText(text).then(() => {
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    });
  };

  return (
    <div className="flex flex-col gap-2.5 w-full text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
      {/* Optional Top Action bar for the message to Copy Full text cleanly */}
      <div className="flex justify-end select-none">
        <button
          onClick={copyFullMessage}
          title="Copiar cotización / texto completo"
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors border border-slate-200/40 dark:border-slate-800/40"
        >
          {copiedFull ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Contenido Copiado</span>
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              <span>Copiar Texto Completo</span>
            </>
          )}
        </button>
      </div>

      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case "heading": {
            return (
              <h4
                key={bIdx}
                className="font-sans font-bold text-slate-900 dark:text-slate-100 mt-3 first:mt-0 pb-1 border-b border-slate-150/50 dark:border-slate-800/50 tracking-tight text-xs sm:text-sm md:text-base flex items-center gap-1.5"
              >
                <span>{block.text}</span>
              </h4>
            );
          }
          case "divider": {
            return <hr key={bIdx} className="my-2 border-slate-150 dark:border-slate-800" />;
          }
          case "list": {
            return (
              <ul key={bIdx} className="pl-4 pr-1 sm:pl-5 list-disc space-y-1 my-1.5 text-slate-700 dark:text-slate-300">
                {block.items.map((item: string, iIdx: number) => (
                  <li key={iIdx} className="marker:text-blue-500 pl-1">
                    {renderInlineStyles(item)}
                  </li>
                ))}
              </ul>
            );
          }
          case "note": {
            const isAlert = block.text.includes("⚠️") || block.text.toLowerCase().includes("requerida");
            const boxStyle = isAlert
              ? "bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-300 dark:bg-amber-500/10"
              : "bg-blue-50/50 border-blue-100 text-blue-900 dark:text-blue-300 dark:bg-blue-950/15 dark:border-blue-950/50";
            return (
              <div
                key={bIdx}
                className={`p-3 rounded-xl border leading-relaxed my-2 font-medium italic text-[11px] sm:text-xs ${boxStyle}`}
              >
                {renderInlineStyles(block.text)}
              </div>
            );
          }
          case "table": {
            const tableData = parseTableJson(block.lines);
            if (!tableData) return null;
            const isCopied = copiedTableIndex === bIdx;

            return (
              <div
                key={bIdx}
                className="my-3 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#070b13] shadow-xs flex flex-col"
              >
                {/* Table Controller Header bar */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-850 select-none">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      <Table className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Cotización Ajustada de Proyecto
                    </span>
                  </div>
                  
                  {/* Clipboard copy action */}
                  <button
                    onClick={() => copyTableToClipboard(block.lines, bIdx)}
                    title="Copiar tabla para pegar perfectamente en Excel o Word"
                    className="flex items-center gap-1 px-2 py-1 rounded bg-white hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-450 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500 animate-bounce" />
                        <span className="text-emerald-500">¡Copiado a Excel!</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                        <span>Copiar Tabla</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Actual responsive HTML table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] sm:text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/10 border-b border-slate-150 dark:border-slate-850 select-none text-left">
                        {tableData.headers.map((h, hIdx) => {
                          const alignClass = hIdx === 0 || hIdx === 3 ? "text-center" : "text-left";
                          return (
                            <th
                              key={hIdx}
                              className={`px-3 py-2 font-bold text-slate-550 dark:text-slate-400 ${alignClass}`}
                            >
                              {h}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-slate-850/50">
                      {tableData.bodyRows.map((row, rIdx) => {
                        const isEven = rIdx % 2 === 0;
                        const rowBg = isEven ? "bg-white dark:bg-[#070b13]" : "bg-slate-50/20 dark:bg-slate-900/5";
                        return (
                          <tr key={rIdx} className={`${rowBg} hover:bg-blue-50/20 dark:hover:bg-blue-950/10 transition-colors`}>
                            {row.map((cell, cIdx) => {
                              const alignClass = cIdx === 0 || cIdx === 3 ? "text-center font-mono" : "text-left";
                              const textHighlightClass = cIdx === 4 ? "font-bold font-mono text-blue-600 dark:text-blue-400" : "";
                              return (
                                <td
                                  key={cIdx}
                                  className={`px-3 py-2.5 text-slate-700 dark:text-slate-300 font-medium ${alignClass} ${textHighlightClass}`}
                                >
                                  {renderInlineStyles(cell)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          case "paragraph": {
            return (
              <p key={bIdx} className="my-1 text-slate-700 dark:text-slate-300">
                {renderInlineStyles(block.text)}
              </p>
            );
          }
          case "empty": {
            return <div key={bIdx} className="h-1.5" />;
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
