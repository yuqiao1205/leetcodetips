"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { WorkbookBlock, WorkbookSheet } from "@/lib/workbook-types";

type WorkbookTabsProps = {
  sheets: WorkbookSheet[];
};

const TIP_COLUMNS = ["方法", "功能", "备注", "例子"];

function formatCell(cell: string) {
  return cell.length === 0 ? "—" : cell;
}

function getFallbackColumnLabel(cellIndex: number) {
  return TIP_COLUMNS[cellIndex] ?? `Column ${cellIndex + 1}`;
}

function isStandardTipHeader(row: string[]) {
  return TIP_COLUMNS.every((label, index) => (row[index] ?? "") === label);
}

function getSheetRows(blocks: WorkbookBlock[]) {
  return blocks.flatMap((block) => {
    if (block.type === "notes") {
      return block.rows.map((row) => [row]);
    }

    return block.rows;
  });
}

function updateSheetMeta(sheet: WorkbookSheet): WorkbookSheet {
  const rows = getSheetRows(sheet.blocks).filter((row) => row.some((cell) => cell.trim().length > 0));

  return {
    ...sheet,
    rowCount: rows.length,
    preview: rows.flat().find((cell) => cell.trim().length > 0) ?? sheet.title,
  };
}

function createEmptyRow(columnCount: number) {
  return Array.from({ length: Math.max(columnCount, TIP_COLUMNS.length) }, () => "");
}

export function WorkbookTabs({ sheets }: WorkbookTabsProps) {
  const router = useRouter();
  const [editableSheets, setEditableSheets] = useState(sheets);
  const [activeSheetId, setActiveSheetId] = useState(sheets[0]?.id ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const activeSheet = useMemo(
    () => editableSheets.find((sheet) => sheet.id === activeSheetId) ?? editableSheets[0],
    [activeSheetId, editableSheets],
  );

  useEffect(() => {
    setEditableSheets(sheets);
  }, [sheets]);

  useEffect(() => {
    if (editableSheets.some((sheet) => sheet.id === activeSheetId)) {
      return;
    }

    setActiveSheetId(editableSheets[0]?.id ?? "");
  }, [activeSheetId, editableSheets]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveState("idle");
      setSaveMessage("");
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [saveState]);

  const updateActiveSheet = (updater: (sheet: WorkbookSheet) => WorkbookSheet) => {
    setEditableSheets((current) =>
      current.map((sheet) => {
        if (sheet.id !== activeSheetId) {
          return sheet;
        }

        return updateSheetMeta(updater(sheet));
      }),
    );
    setSaveState("idle");
    setSaveMessage("");
  };

  const handleCellChange = (
    blockIndex: number,
    rowIndex: number,
    cellIndex: number,
    value: string,
  ) => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      blocks: sheet.blocks.map((block, currentBlockIndex) => {
        if (block.type !== "table" || currentBlockIndex !== blockIndex) {
          return block;
        }

        return {
          ...block,
          rows: block.rows.map((row, currentRowIndex) => {
            if (currentRowIndex !== rowIndex) {
              return row;
            }

            return row.map((cell, currentCellIndex) => {
              if (currentCellIndex !== cellIndex) {
                return cell;
              }

              return value;
            });
          }),
        };
      }),
    }));
  };

  const handleAddRow = (blockIndex: number, columnCount: number) => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      blocks: sheet.blocks.map((block, currentBlockIndex) => {
        if (block.type !== "table" || currentBlockIndex !== blockIndex) {
          return block;
        }

        return {
          ...block,
          columnCount: Math.max(block.columnCount, TIP_COLUMNS.length),
          rows: [...block.rows, createEmptyRow(columnCount)],
        };
      }),
    }));
  };

  const handleDeleteRow = (blockIndex: number, rowIndex: number) => {
    updateActiveSheet((sheet) => ({
      ...sheet,
      blocks: sheet.blocks.map((block, currentBlockIndex) => {
        if (block.type !== "table" || currentBlockIndex !== blockIndex) {
          return block;
        }

        return {
          ...block,
          rows: block.rows.filter((_, currentRowIndex) => currentRowIndex !== rowIndex),
        };
      }),
    }));
  };

  const handleSave = async () => {
    setSaveState("saving");
    setSaveMessage("Saving workbook to Excel...");

    try {
      const response = await fetch("/api/workbook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sheets: editableSheets }),
      });

      const payload = (await response.json()) as {
        error?: string;
        sheets?: WorkbookSheet[];
      };

      if (!response.ok || !payload.sheets) {
        throw new Error(payload.error ?? "Failed to save workbook.");
      }

      setEditableSheets(payload.sheets);
      setSaveState("saved");
      setSaveMessage("Workbook saved to tips.xlsx and synced to workbook.json.");
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Failed to save workbook.");
    }
  };

  if (!activeSheet) {
    return (
      <section className="rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <p className="text-sm text-slate-500">No workbook data was found.</p>
      </section>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3 overflow-x-auto pb-2 lg:pb-0">
              {editableSheets.map((sheet) => {
                const isActive = sheet.id === activeSheet.id;

                return (
                  <button
                    key={sheet.id}
                    type="button"
                    onClick={() => setActiveSheetId(sheet.id)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition sm:px-4 ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-200"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                    }`}
                  >
                    {sheet.title}
                  </button>
                );
              })}
            </div>

            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:items-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === "saving"}
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
              >
                {saveState === "saving" ? "Saving..." : "Save to Excel"}
              </button>
              <p className="max-w-xs text-sm text-slate-500 sm:text-right">
                Edit the table inline, then save changes back to Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {saveMessage ? (
            <div
              className={`mb-6 rounded-2xl px-4 py-3 text-sm ${
                saveState === "error"
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : saveState === "saved"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              {saveMessage}
            </div>
          ) : null}

          <div className="space-y-6">
            {activeSheet.blocks.map((block, blockIndex) => {
              if (block.type === "notes") {
                return (
                  <article
                    key={`${activeSheet.id}-notes-${blockIndex}`}
                    className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5"
                  >
                    <div className="space-y-3">
                      {block.rows.map((row, rowIndex) => (
                        <p
                          key={`${activeSheet.id}-note-${blockIndex}-${rowIndex}`}
                          className="whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base"
                        >
                          {row}
                        </p>
                      ))}
                    </div>
                  </article>
                );
              }

              return (
                <article
                  key={`${activeSheet.id}-table-${blockIndex}`}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Tips table</p>
                      <p className="text-xs text-slate-500">
                        新增 tips 请直接增加一行，然后填写 方法、功能、备注、例子。
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddRow(blockIndex, block.columnCount)}
                      className="w-full rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 sm:w-auto"
                    >
                      Add row
                    </button>
                  </div>

                  <div className="space-y-4 p-4 lg:hidden">
                    {block.rows.map((row, rowIndex) => {
                      const cells = Array.from({ length: block.columnCount }, (_, columnIndex) => {
                        return row[columnIndex] ?? "";
                      });
                      const isHeaderRow = rowIndex === 0 && (block.hasHeader || isStandardTipHeader(cells));
                      const columnLabels = Array.from({ length: block.columnCount }, (_, columnIndex) => {
                        const headerValue = (block.hasHeader || isStandardTipHeader(block.rows[0] ?? []))
                          ? (block.rows[0]?.[columnIndex] ?? "").trim()
                          : "";

                        return headerValue || getFallbackColumnLabel(columnIndex);
                      });

                      return (
                        <div
                          key={`${activeSheet.id}-mobile-row-${blockIndex}-${rowIndex}`}
                          className={`rounded-2xl border p-4 shadow-sm ${
                            isHeaderRow
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-slate-50/70"
                          }`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className={`text-sm font-semibold ${isHeaderRow ? "text-white" : "text-slate-900"}`}>
                              {isHeaderRow ? "Header row" : `Row ${rowIndex + 1}`}
                            </p>
                            {!isHeaderRow ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(blockIndex, rowIndex)}
                                className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            {cells.map((cell, cellIndex) => (
                              <label
                                key={`${activeSheet.id}-mobile-cell-${blockIndex}-${rowIndex}-${cellIndex}`}
                                className="flex flex-col gap-2"
                              >
                                <span
                                  className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                                    isHeaderRow ? "text-slate-200" : "text-slate-500"
                                  }`}
                                >
                                  {isHeaderRow
                                    ? `Header ${cellIndex + 1}`
                                    : columnLabels[cellIndex]}
                                </span>
                                <textarea
                                  value={cell}
                                  onChange={(event) =>
                                    handleCellChange(blockIndex, rowIndex, cellIndex, event.target.value)
                                  }
                                  rows={Math.min(8, Math.max(2, cell.split("\n").length))}
                                  className={`w-full resize-y rounded-2xl border px-3 py-2 text-sm leading-6 outline-none transition focus:border-blue-400 ${
                                    isHeaderRow
                                      ? "border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:bg-slate-800"
                                      : cellIndex === 0
                                        ? "border-slate-200 bg-slate-100 font-medium text-slate-900 focus:bg-white"
                                        : "border-slate-200 bg-white text-slate-700 focus:bg-white"
                                  }`}
                                  placeholder={getFallbackColumnLabel(cellIndex)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto lg:block">
                    <table className="min-w-full border-separate border-spacing-0">
                      <tbody>
                        {block.rows.map((row, rowIndex) => {
                          const cells = Array.from({ length: block.columnCount }, (_, columnIndex) => {
                            return row[columnIndex] ?? "";
                          });

                          const isHeaderRow = rowIndex === 0 && (block.hasHeader || isStandardTipHeader(cells));

                          return (
                            <tr
                              key={`${activeSheet.id}-row-${blockIndex}-${rowIndex}`}
                              className="align-top"
                            >
                              {cells.map((cell, cellIndex) => {
                                const sharedClassName =
                                  "border-b border-r border-slate-200 p-3 text-left whitespace-pre-wrap leading-6 last:border-r-0 xl:p-4";

                                if (isHeaderRow) {
                                  return (
                                    <th
                                      key={`${activeSheet.id}-cell-${blockIndex}-${rowIndex}-${cellIndex}`}
                                      className={`${sharedClassName} bg-slate-900 text-sm font-semibold text-white`}
                                    >
                                      {formatCell(cell)}
                                    </th>
                                  );
                                }

                                return (
                                  <td
                                    key={`${activeSheet.id}-cell-${blockIndex}-${rowIndex}-${cellIndex}`}
                                    className={`${sharedClassName} align-top text-sm text-slate-700 ${
                                      cellIndex === 0 ? "bg-slate-50 text-slate-900" : "bg-white"
                                    }`}
                                  >
                                    <textarea
                                      value={cell}
                                      onChange={(event) =>
                                        handleCellChange(blockIndex, rowIndex, cellIndex, event.target.value)
                                      }
                                      rows={Math.min(8, Math.max(2, cell.split("\n").length))}
                                      className={`w-full resize-y rounded-2xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-blue-400 focus:bg-white ${
                                        cellIndex === 0
                                          ? "bg-slate-50 font-medium text-slate-900"
                                          : "bg-white text-slate-700"
                                      }`}
                                      placeholder={TIP_COLUMNS[cellIndex] ?? `Column ${cellIndex + 1}`}
                                    />
                                  </td>
                                );
                              })}

                              {isHeaderRow ? (
                                <th className="border-b border-slate-200 bg-slate-900 p-3 text-left text-sm font-semibold text-white xl:p-4">
                                  操作
                                </th>
                              ) : (
                                <td className="border-b border-slate-200 bg-white p-3 align-top xl:p-4">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRow(blockIndex, rowIndex)}
                                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                                  >
                                    Delete
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
