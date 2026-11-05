import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { Role } from "./tournament";

/**
 * Login sessions are signed (not readable-and-editable) cookies.
 * A user session belongs to an organizer or player; an umpire session
 * only unlocks one match's scoreboard and has no account behind it.
 */
export type Session =
  | { kind: "user"; userId: string; role: Role; name: string }
  | { kind: "umpire"; matchId: string; tournamentId: string };

const COOKIE = "pb_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET is not set");
    return new TextEncoder().encode("dev-only-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const p = payload as Record<string, unknown>;
    if (p.kind === "user" && typeof p.userId === "string" && (p.role === "Organizer" || p.role === "Player")) {
      return { kind: "user", userId: p.userId, role: p.role, name: String(p.name ?? "") };
    }
    if (p.kind === "umpire" && typeof p.matchId === "string" && typeof p.tournamentId === "string") {
      return { kind: "umpire", matchId: p.matchId, tournamentId: p.tournamentId };
    }
    return null;
  } catch {
    return null; // expired or tampered
  }
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE);
}
