import { db } from "@/lib/db";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

const STEPS = [
  "Convert the bank or card statement to the CSV format (see README).",
  "Pick the file. Preview shows what will be imported and the category each row got.",
  "Import. Re-uploading the same file is safe, duplicates are skipped.",
];

export default async function UploadPage() {
  const accounts = await db.account.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="h1">Upload statement</h1>
      <ol className="card space-y-2">
        {STEPS.map((s, i) => (
          <li key={i} className="hint flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-white">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <UploadForm accounts={accounts} />
    </div>
  );
}
