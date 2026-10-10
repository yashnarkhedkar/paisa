import { merchantKeyword } from "@/lib/categorise";
import CategoryPicker from "./CategoryPicker";

type Props = {
  id: number;
  date: string;
  description: string;
  accountCode: string;
  amount: number;
  categoryId: number | null;
  categories: { id: number; name: string }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const day = (date: string) => `${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;
export const rupees = (n: number) =>
  `${n < 0 ? "−" : "+"}₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function Row({ id, date, description, accountCode, amount, categoryId, categories }: Props) {
  return (
    <div className={`px-4 py-3 text-sm ${categoryId === null ? "border-l-2 border-amber-400" : ""}`}>
      {/* line 1: merchant + amount */}
      <div className="flex items-baseline justify-between gap-3">
        <input type="checkbox" form="bulk" name="ids" value={id} aria-label="Select" className="shrink-0 self-center" />
        <span className="min-w-0 flex-1 truncate font-medium" title={description}>
          {description}
        </span>
        <span className={`shrink-0 font-medium ${amount < 0 ? "amount-neg" : "amount-pos"}`}>{rupees(amount)}</span>
      </div>

      {/* line 2: meta + category control */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
        <span className="shrink-0 tabular-nums">{day(date)}</span>
        <span className="pill shrink-0">{accountCode}</span>
        <span className="ml-auto">
          <CategoryPicker ids={[id]} categoryId={categoryId} keyword={merchantKeyword(description)} categories={categories} />
        </span>
      </div>
    </div>
  );
}
