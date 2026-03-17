import { NextResponse } from "next/server";

import { coerceWorkbookSheets, persistWorkbook } from "@/lib/workbook-persistence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sheets = coerceWorkbookSheets(body?.sheets);

    if (!sheets) {
      return NextResponse.json(
        { error: "Invalid workbook payload." },
        { status: 400 },
      );
    }

    const savedSheets = persistWorkbook(sheets);

    return NextResponse.json({ sheets: savedSheets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save workbook.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
