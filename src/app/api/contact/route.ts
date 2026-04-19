import { NextResponse } from "next/server";

const DEFAULT_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby2qPt8C0Lg7Vc0vY6BwoGJleVsXPAXr8eMOzqF_6gdcrPfqEmiPL3l6orvKEKYcvGtLQ/exec";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const subject = String(body.subject ?? "").trim();
    const message = String(body.message ?? "").trim();
    const website = String(body.website ?? "").trim();

    if (website) {
      return NextResponse.json({ ok: true });
    }

    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Invalid name" }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
    }

    if (subject.length < 2) {
      return NextResponse.json({ ok: false, error: "Invalid subject" }, { status: 400 });
    }

    if (message.length < 10) {
      return NextResponse.json(
        { ok: false, error: "Message must be at least 10 characters" },
        { status: 400 },
      );
    }

    const endpoint = process.env.GOOGLE_SCRIPT_URL ?? DEFAULT_SCRIPT_URL;

    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        subject,
        message,
      }),
      cache: "no-store",
    });

    const upstreamText = await upstreamResponse.text();

    let upstreamJson: { ok?: boolean; error?: string } | null = null;
    try {
      upstreamJson = JSON.parse(upstreamText) as { ok?: boolean; error?: string };
    } catch {
      upstreamJson = null;
    }

    if (!upstreamResponse.ok || upstreamJson?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          error: upstreamJson?.error ?? "Could not deliver message",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload" }, { status: 400 });
  }
}
