import { NextResponse, type NextRequest } from "next/server";

// Site-wide password gate (HTTP Basic Auth, any username). Protects the pages and, more importantly,
// /api/chat, which spends the OpenAI key. Off locally unless DEMO_PASSWORD is set; on Vercel it fails
// closed so a deployment without a password is never open to the public.
export function middleware(req: NextRequest) {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    if (process.env.VERCEL) return new NextResponse("Set DEMO_PASSWORD in the Vercel project settings.", { status: 503 });
    return NextResponse.next();
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(supplied, password)) return NextResponse.next();
    } catch {
      // malformed header: fall through to the challenge
    }
  }
  return new NextResponse("Password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CareAgent", charset="UTF-8"' },
  });
}

// Compare without returning early on the first differing character.
function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
