import { kv } from "@vercel/kv";
import { cookies } from "next/headers";

const keyFor = (id) => `task-tracker:${id}`;

export async function GET() {
  const id = cookies().get("anon_id")?.value;
  const data = id ? await kv.get(keyFor(id)) : null;
  return new Response(JSON.stringify(data ?? { tasks: [], projects: [], sessions: [], notes: [] }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  const id = cookies().get("anon_id")?.value;
  if (!id) return new Response(JSON.stringify({ ok: false }), { status: 400 });
  const body = await req.json();
  await kv.set(keyFor(id), body);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
