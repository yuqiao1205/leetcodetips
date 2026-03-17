import { WorkbookTabs } from "@/components/workbook-tabs";
import { loadWorkbook } from "@/lib/workbook";

export const dynamic = "force-dynamic";

export default function Home() {
  const sheets = loadWorkbook();
  const totalTips = sheets.reduce((count, sheet) => count + sheet.rowCount, 0);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur xl:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                LeetCode Tips Workbook
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                A curated collection of Java LeetCode tips site
              </h1>
              <p className="text-base leading-7 text-slate-600 sm:text-lg">
                A structured reference of Java Collections for LeetCode, featuring notes, examples, code snippets, and quick tips to help you quickly master data structures and common problem-solving patterns.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:min-w-[340px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Workbook tabs</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{sheets.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Rows imported</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">{totalTips}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 col-span-2 sm:col-span-1">
                <p className="text-sm text-slate-500">Stack</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">Next.js · React · Tailwind</p>
              </div>
            </div>
          </div>
        </section>

        <WorkbookTabs sheets={sheets} />
      </div>
    </main>
  );
}
