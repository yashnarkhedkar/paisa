"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { rememberRule, setCategory } from "./actions";

type Props = {
  ids: number[];
  categoryId: number | null;
  keyword: string;
  categories: { id: number; name: string }[];
  placeholder?: string;
};

/** Pick saves right away. Then, if the description gives a safe keyword, ask whether to make it a rule. */
export default function CategoryPicker({ ids, categoryId, keyword, categories, placeholder = "Pick category" }: Props) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState<{ id: number; name: string } | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(categoryId);
  const [prev, setPrev] = useState(categoryId);
  if (prev !== categoryId) {
    // server says this row changed (e.g. a rule tagged it): follow it
    setPrev(categoryId);
    setPicked(categoryId);
  }
  const router = useRouter();

  const pick = (v: string) => {
    const cat = categories.find((c) => c.id === Number(v)) ?? null;
    setNote("");
    const willAsk = Boolean(cat && keyword);
    setPicked(cat?.id ?? null);
    start(async () => {
      await setCategory(ids, cat?.id ?? null, willAsk);
      setAsk(willAsk ? cat : null);
    });
  };

  const remember = () =>
    start(async () => {
      if (!ask) return;
      const n = await rememberRule(keyword, ask.id);
      setNote(`Saved. ${n} more tagged.`);
      setAsk(null);
    });

  const skip = () => {
    setAsk(null);
    router.refresh();
  };

  return (
    <span className={`flex flex-wrap items-center justify-end gap-1.5 ${pending ? "opacity-50" : ""}`}>
      <select
        className={`select w-auto py-1 text-xs ${picked === null ? "border-amber-400" : ""}`}
        value={picked ?? ""}
        disabled={pending}
        onChange={(e) => pick(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {ask && (
        <span className="flex items-center gap-1.5 rounded-full bg-bg px-2 py-0.5">
          <span>
            Always tag <b className="font-mono">{keyword}</b> as {ask.name}?
          </span>
          <button type="button" onClick={remember} className="btn btn-sm py-0">
            Yes
          </button>
          <button type="button" onClick={skip} className="btn btn-sm py-0">
            No
          </button>
        </span>
      )}
      {note && <span className="text-green-700">{note}</span>}
    </span>
  );
}
