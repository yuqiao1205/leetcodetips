import "server-only";

import fs from "node:fs";
import path from "node:path";
import { read, utils, write } from "xlsx";

import type { WorkbookBlock, WorkbookSheet } from "@/lib/workbook-types";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "tips.xlsx");
const targetDirectory = path.join(projectRoot, "data");
const targetWorkbookPath = path.join(targetDirectory, "tips.xlsx");
const jsonTargetPath = path.join(targetDirectory, "workbook.json");

function syncRootWorkbookCopy() {
  try {
    fs.copyFileSync(targetWorkbookPath, sourcePath);
    return;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error.code === "EBUSY" || error.code === "EPERM")
    ) {
      return;
    }

    throw error;
  }
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\r\n/g, "\n").trim();
}

function trimTrailingEmptyCells(row: string[]) {
  const nextRow = [...row];

  while (nextRow.length > 0 && nextRow[nextRow.length - 1] === "") {
    nextRow.pop();
  }

  return nextRow;
}

function isLikelyHeaderCells(cells: string[]) {
  return cells.every(
    (cell) => cell.length > 0 && cell.length <= 40 && !cell.includes("\n"),
  );
}

function isLikelyHeaderRow(rows: string[][]) {
  if (rows.length < 2) {
    return false;
  }

  const [firstRow, secondRow] = rows;

  if (firstRow.length < 2 || secondRow.length !== firstRow.length) {
    return false;
  }

  return isLikelyHeaderCells(firstRow);
}

function buildBlocks(rows: string[][]): WorkbookBlock[] {
  const blocks: WorkbookBlock[] = [];
  let currentMode: "notes" | "table" | null = null;
  let noteBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  const isIntroNoteRow = (row: string[], rowIndex: number) => {
    const nonEmptyCells = row.filter(Boolean);

    if (rowIndex !== 0 || nonEmptyCells.length === 0) {
      return false;
    }

    const nextRow = rows[rowIndex + 1] ?? [];
    const nextNextRow = rows[rowIndex + 2] ?? [];
    const nextNonEmpty = nextRow.filter(Boolean);
    const nextNextNonEmpty = nextNextRow.filter(Boolean);

    const currentLooksLikeHeader =
      nonEmptyCells.length >= 2 && isLikelyHeaderCells(nonEmptyCells);
    const currentLooksLikeIntro = nonEmptyCells.some(
      (cell) => cell.length > 40 || cell.includes("\n"),
    );

    return (
      !currentLooksLikeHeader &&
      currentLooksLikeIntro &&
      nextNonEmpty.length >= 2 &&
      nextNextNonEmpty.length >= 2 &&
      isLikelyHeaderRow([nextRow, nextNextRow])
    );
  };

  const flushNotes = () => {
    if (noteBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "notes",
      rows: noteBuffer,
    });

    noteBuffer = [];
  };

  const flushTable = () => {
    if (tableBuffer.length === 0) {
      return;
    }

    const columnCount = Math.max(...tableBuffer.map((row) => row.length));

    blocks.push({
      type: "table",
      rows: tableBuffer,
      columnCount,
      hasHeader: isLikelyHeaderRow(tableBuffer),
    });

    tableBuffer = [];
  };

  for (const [rowIndex, row] of rows.entries()) {
    const nonEmptyCells = row.filter(Boolean);
    const introNoteRow = isIntroNoteRow(row, rowIndex);
    const nextMode = nonEmptyCells.length <= 1 || introNoteRow ? "notes" : "table";

    if (currentMode && nextMode !== currentMode) {
      flushNotes();
      flushTable();
    }

    currentMode = nextMode;

    if (nextMode === "notes") {
      noteBuffer.push(introNoteRow ? nonEmptyCells.join("\n\n") : (nonEmptyCells[0] ?? ""));
      continue;
    }

    tableBuffer.push(row);
  }

  flushNotes();
  flushTable();

  return blocks;
}

function flattenBlocks(blocks: WorkbookBlock[]) {
  return blocks.flatMap((block) => {
    if (block.type === "notes") {
      return block.rows.map((row) => [normalizeCell(row)]);
    }

    return block.rows.map((row) => row.map(normalizeCell));
  });
}

function normalizeRows(rows: string[][]) {
  return rows
    .map((row) => trimTrailingEmptyCells(row.map(normalizeCell)))
    .filter((row) => row.some(Boolean));
}

function normalizeSheet(sheet: WorkbookSheet, index: number): WorkbookSheet {
  const rows = normalizeRows(flattenBlocks(sheet.blocks));
  const title = normalizeCell(sheet.title) || `Sheet${index + 1}`;

  return {
    id: normalizeCell(sheet.id) || `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    title,
    rowCount: rows.length,
    preview: rows.flat().find(Boolean) ?? title,
    blocks: buildBlocks(rows),
  };
}

function sheetNameForWorkbook(title: string, index: number) {
  const fallback = `Sheet${index + 1}`;
  const cleaned = normalizeCell(title).replace(/[\\/?*\[\]:]/g, " ").trim();

  return (cleaned || fallback).slice(0, 31);
}

export function coerceWorkbookSheets(input: unknown): WorkbookSheet[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  return input.map((item, index) => {
    const sheet = typeof item === "object" && item !== null ? item : {};
    const rawBlocks = Array.isArray((sheet as { blocks?: unknown }).blocks)
      ? ((sheet as { blocks: unknown[] }).blocks ?? [])
      : [];

    const blocks: WorkbookBlock[] = rawBlocks
      .map((block) => {
        if (typeof block !== "object" || block === null || !("type" in block)) {
          return null;
        }

        const rawBlock = block as Record<string, unknown>;

        if (rawBlock.type === "notes") {
          const rows = Array.isArray(rawBlock.rows)
            ? rawBlock.rows.map(normalizeCell)
            : [];

          return {
            type: "notes" as const,
            rows,
          };
        }

        if (rawBlock.type === "table") {
          const rows = Array.isArray(rawBlock.rows)
            ? rawBlock.rows.map((row) => {
                if (!Array.isArray(row)) {
                  return [];
                }

                return row.map(normalizeCell);
              })
            : [];

          return {
            type: "table" as const,
            rows,
            columnCount: Math.max(
              Number(rawBlock.columnCount) || 0,
              ...rows.map((row) => row.length),
            ),
            hasHeader: Boolean(rawBlock.hasHeader),
          };
        }

        return null;
      })
      .filter((block): block is WorkbookBlock => block !== null);

    return normalizeSheet(
      {
        id: normalizeCell((sheet as { id?: unknown }).id),
        title: normalizeCell((sheet as { title?: unknown }).title),
        rowCount: 0,
        preview: "",
        blocks,
      },
      index,
    );
  });
}

export function persistWorkbook(sheets: WorkbookSheet[]) {
  const normalizedSheets = sheets.map((sheet, index) => normalizeSheet(sheet, index));
  const workbook = utils.book_new();

  normalizedSheets.forEach((sheet, index) => {
    const rows = normalizeRows(flattenBlocks(sheet.blocks));
    const worksheet = utils.aoa_to_sheet(rows.length > 0 ? rows : [[""]]);
    utils.book_append_sheet(workbook, worksheet, sheetNameForWorkbook(sheet.title, index));
  });

  fs.mkdirSync(targetDirectory, { recursive: true });
  const workbookBuffer = write(workbook, { bookType: "xlsx", type: "buffer" });
  fs.writeFileSync(targetWorkbookPath, workbookBuffer);
  syncRootWorkbookCopy();
  fs.writeFileSync(jsonTargetPath, JSON.stringify(normalizedSheets, null, 2));

  return normalizedSheets;
}
