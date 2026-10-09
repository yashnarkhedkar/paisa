"use client";

import { useState, useTransition } from "react";
import { inr } from "@/lib/format";
import { importRows, previewCsv, type Preview } from "./actions";

export function UploadForm({ accounts }: { accounts: { code: string; name: string; format: string | null }[] }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [pending, start] = useTransition();

  const onPreview = (fd: FormData) =>
    start(async () => {
      setSummary(null);
      setPreview(await previewCsv(fd));
    });

  const onImport = () =>
    start(async () => {
      if (!preview) return;
      const fresh = preview.rows.filter((r) => !r.dup);
      const res = await importRows(JSON.stringify(fresh));
      const dups = res.duplicates + (preview.rows.length - fresh.length);
      setSummary(`${res.imported} imported, ${dups} duplicates skipped, ${preview.bad.length} rejected`);
      setPreview(null);
      setFileName("");
    });

  const freshCount = preview ? preview.rows.filter((r) => !r.dup).length : 0;

  return (
    <div className="space-y-4">
      <form action={onPreview} className="space-y-3">
        <label className="card block cursor-pointer border-2 border-dashed p-8 text-center text-sm transition hover:border-ink">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv,.pdf,application/pdf"
            required
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
          />
          <svg
            className="mx-auto mb-2 h-6 w-6 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
          </svg>
          {fileName ? (
            <>
              <span className="block truncate font-medium">{fileName}</span>
              <span className="hint mt-1 block underline">change</span>
            </>
          ) : (
            <>
              <span className="block font-medium">Tap to choose a PDF statement or CSV</span>
              <span className="hint mt-1 block">PDF: pick its account below · CSV: date, account, description, amount, type, ref</span>
            </>
          )}
        </label>

        <label className="block">
          <span className="hint">Account (required for PDF; for CSV, fills a blank account column)</span>
          <select name="account" className="select mt-1">
            <option value="">— use the CSV column —</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
                {a.format ? ` · ${a.format} PDF` : ""}
              </option>
            ))}
          </select>
        </label>

        <button disabled={pending || !fileName} className="btn-primary w-full sm:w-auto">
          {pending ? "Reading…" : "Preview"}
        </button>
      </form>

      {summary && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-green-200 bg-green-50">
          <p className="text-sm font-medium text-green-800">{summary}</p>
          <a href="/" className="btn btn-sm">
            See dashboard
          </a>
        </div>
      )}
      {preview?.error && <p className="card border-red-200 bg-red-50 text-sm text-neg">{preview.error}</p>}

      {preview && !preview.error && (
        <>
          <p className="muted">
            {preview.rows.length} rows read · {freshCount} new · {preview.rows.length - freshCount} already imported
            {preview.bad.length > 0 && <> · <span className="text-neg">{preview.bad.length} rejected</span></>}
          </p>

          <div className="card-tight divide-rows text-sm">
            {preview.rows.map((r) => (
              <div key={r.line} className={`px-4 py-3 ${r.dup ? "opacity-50" : ""}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{r.description}</span>
                  <span className={`shrink-0 ${r.amount < 0 ? "amount-neg" : "amount-pos"}`}>{inr(r.amount)}</span>
                </div>
                <div className="hint mt-0.5">
                  {r.date} · {r.categoryName ?? <span className="text-amber-700">no category yet</span>}
                  {r.dup && " · already imported"}
                </div>
              </div>
            ))}
          </div>

          {preview.bad.length > 0 && (
            <ul className="card space-y-0.5 border-red-200 bg-red-50 text-xs text-neg">
              {preview.bad.map((b) => (
                <li key={b.line}>
                  line {b.line}: {b.reason}
                </li>
              ))}
            </ul>
          )}

          <button onClick={onImport} disabled={pending || freshCount === 0} className="btn-primary w-full sm:w-auto">
            {pending ? "Importing…" : freshCount === 0 ? "Nothing new to import" : `Import ${freshCount} rows`}
          </button>
        </>
      )}
    </div>
  );
}
