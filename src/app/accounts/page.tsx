import { db } from "@/lib/db";
import { StatementFormat } from "@prisma/client";
import { createAccount, deleteAccount, renameAccount } from "./actions";

function FormatSelect({ value }: { value?: string | null }) {
  return (
    <select name="format" defaultValue={value ?? ""} className="select w-auto" aria-label="Statement format">
      <option value="">CSV only</option>
      {Object.values(StatementFormat).map((f) => (
        <option key={f} value={f}>
          {f} PDF
        </option>
      ))}
    </select>
  );
}

export default async function Accounts() {
  const accounts = await db.account.findMany({ orderBy: { code: "asc" } });
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="h1">Accounts</h1>
          <form action="/api/logout" method="post"><button className="btn btn-sm">Logout</button></form>
        </div>
        <p className="hint">
          The code is what you write in the CSV account column. One per bank account and credit card. Set the statement format to upload
          that bank&apos;s PDF directly.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <ul className="card-tight divide-rows order-2 min-w-0 lg:order-1">
          {accounts.length === 0 && <li className="row muted">No accounts yet.</li>}
          {accounts.map((a) => (
            <li key={a.id} className="row flex-wrap">
              <span className="font-mono font-medium">{a.code}</span>
              <span className="pill">{a.kind}</span>
              <form action={renameAccount} className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto">
                <input type="hidden" name="id" value={a.id} />
                <input name="name" defaultValue={a.name} required className="input w-auto min-w-0 flex-1" />
                <FormatSelect value={a.format} />
                <button className="btn btn-sm">Save</button>
              </form>
              <form action={deleteAccount} className="flex basis-full items-center gap-2 sm:basis-auto">
                <input type="hidden" name="id" value={a.id} />
                <button className="btn-danger btn-sm">Delete</button>
                <span className="hint">deletes all its transactions</span>
              </form>
            </li>
          ))}
        </ul>

        <div className="order-1 lg:order-2">
          <form action={createAccount} className="card space-y-3 lg:sticky lg:top-6">
            <h2 className="h2">Add account</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <input name="code" placeholder="Code" required className="input" />
              <input name="name" placeholder="Name" required className="input" />
              <select name="kind" className="select">
                <option>BANK</option>
                <option>CARD</option>
              </select>
              <FormatSelect />
            </div>
            <button className="btn-primary w-full">Add</button>
          </form>
        </div>
      </div>
    </div>
  );
}
