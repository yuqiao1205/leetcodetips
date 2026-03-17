import fs from "node:fs";
import path from "node:path";

import type { WorkbookSheet } from "@/lib/workbook-types";

const workbookJsonPath = path.join(process.cwd(), "data", "workbook.json");

export function loadWorkbook(): WorkbookSheet[] {
  const workbookJson = fs.readFileSync(workbookJsonPath, "utf8");

  return JSON.parse(workbookJson) as WorkbookSheet[];
}
