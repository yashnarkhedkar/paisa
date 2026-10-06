import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  // Hash is stored base64-encoded: bcrypt hashes contain `$`, which env loaders expand.
  const hash = Buffer.from(process.env.APP_PASSWORD_HASH_B64 ?? "", "base64").toString();
  const ok = typeof password === "string" && hash.length > 0 && (await bcrypt.compare(password, hash));
  if (!ok) return NextResponse.json({ error: "wrong password" }, { status: 401 });
  await createSession();
  return NextResponse.json({ ok: true });
}
