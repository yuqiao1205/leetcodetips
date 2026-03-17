export type WorkbookBlock =
  | {
      type: "notes";
      rows: string[];
    }
  | {
      type: "table";
      rows: string[][];
      columnCount: number;
      hasHeader: boolean;
    };

export type WorkbookSheet = {
  id: string;
  title: string;
  rowCount: number;
  preview: string;
  blocks: WorkbookBlock[];
};
