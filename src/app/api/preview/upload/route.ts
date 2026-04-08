import { NextRequest } from "next/server";

function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE?.trim() || "http://localhost:8000";
  return base.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get("agent_id");
  if (!agentId) {
    return Response.json({ error: "agent_id is required" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const url = `${getApiBase()}/agents/${encodeURIComponent(agentId)}/chat/image`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: req.signal,
    });
  } catch (e) {
    return Response.json({ error: "Failed to reach backend", message: String(e) }, { status: 502 });
  }

  const json = await res.json();
  return Response.json(json, { status: res.status });
}
