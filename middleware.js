import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

export function middleware(req) {
  const res = NextResponse.next();
  const cookie = req.cookies.get("anon_id")?.value;
  if (!cookie) {
    res.cookies.set("anon_id", nanoid(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }
  return res;
}
