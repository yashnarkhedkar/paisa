import type { StatementFormat } from "@prisma/client";
import type { Page } from "./pdf";
import { axis } from "./axis";
import { bob } from "./bob";
import { icici } from "./icici";
import { idfc } from "./idfc";

/** amount signed: negative = money out. A reader throws if its own totals check fails. */
export type StmtRow = { date: string; description: string; amount: number; ref?: string };
export type Reader = { detect: (firstPageText: string) => boolean; parse: (pages: Page[]) => StmtRow[] };

export const READERS: Record<StatementFormat, Reader> = { BOB: bob, IDFC: idfc, AXIS: axis, ICICI: icici };
