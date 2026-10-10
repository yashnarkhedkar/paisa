"use client";

/** Ticks or clears every row box that belongs to the bulk form. */
export default function SelectAll() {
  const set = (on: boolean) =>
    document.querySelectorAll<HTMLInputElement>('input[form="bulk"][name="ids"]').forEach((c) => (c.checked = on));
  return (
    <>
      <button type="button" onClick={() => set(true)} className="btn btn-sm">
        Select all
      </button>
      <button type="button" onClick={() => set(false)} className="btn btn-sm">
        Clear
      </button>
    </>
  );
}
