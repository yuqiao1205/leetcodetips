import fs from "node:fs";
import path from "node:path";
import { read, utils, writeFile } from "xlsx";

const projectRoot = process.cwd();
const targetDirectory = path.join(projectRoot, "data");
const rootWorkbookPath = path.join(projectRoot, "tips.xlsx");
const targetPath = path.join(targetDirectory, "tips.xlsx");
const jsonTargetPath = path.join(targetDirectory, "workbook.json");

function getPreferredSourcePath() {
  const candidates = [rootWorkbookPath, targetPath].filter((candidatePath) =>
    fs.existsSync(candidatePath),
  );

  if (candidates.length === 0) {
    return rootWorkbookPath;
  }

  return candidates.sort((leftPath, rightPath) => {
    const leftModifiedTime = fs.statSync(leftPath).mtimeMs;
    const rightModifiedTime = fs.statSync(rightPath).mtimeMs;

    return rightModifiedTime - leftModifiedTime;
  })[0];
}

const sourcePath = getPreferredSourcePath();

function normalizeCell(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\r\n/g, "\n").trim();
}

function trimTrailingEmptyCells(row) {
  const nextRow = [...row];

  while (nextRow.length > 0 && nextRow[nextRow.length - 1] === "") {
    nextRow.pop();
  }

  return nextRow;
}

function isLikelyHeaderCells(cells) {
  return cells.every(
    (cell) => cell.length > 0 && cell.length <= 40 && !cell.includes("\n"),
  );
}

function isLikelyHeaderRow(rows) {
  if (rows.length < 2) {
    return false;
  }

  const [firstRow, secondRow] = rows;

  if (firstRow.length < 2 || secondRow.length !== firstRow.length) {
    return false;
  }

  return isLikelyHeaderCells(firstRow);
}

function buildBlocks(rows) {
  const blocks = [];
  let currentMode = null;
  let noteBuffer = [];
  let tableBuffer = [];

  const isIntroNoteRow = (row, rowIndex) => {
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

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Workbook not found at ${sourcePath}`);
}

fs.mkdirSync(targetDirectory, { recursive: true });
fs.copyFileSync(sourcePath, targetPath);

const workbook = read(fs.readFileSync(sourcePath), {
  type: "buffer",
  cellText: true,
  dense: false,
});

const sheets = workbook.SheetNames.map((sheetName, index) => {
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const rows = rawRows
    .map((row) => trimTrailingEmptyCells(row.map(normalizeCell)))
    .filter((row) => row.some(Boolean));

  return {
    id: `${sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    title: sheetName,
    rowCount: rows.length,
    preview: rows.flat().find(Boolean) ?? sheetName,
    blocks: buildBlocks(rows),
  };
}).filter((sheet) => sheet.rowCount > 0);

fs.writeFileSync(jsonTargetPath, JSON.stringify(sheets, null, 2));
writeFile(workbook, targetPath);

console.log(`Synced workbook to ${targetPath}`);
console.log(`Generated workbook JSON at ${jsonTargetPath}`);
