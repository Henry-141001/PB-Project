"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { createSession, deleteSession } from "@/lib/session";
import { cleanCode, type Role } from "@/lib/tournament";

export type FormState = { error?: string; values?: Record<string, string> } | undefined;

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const normPhone = (v: string) => v.replace(/[^\d+]/g, "");
const roleOf = (v: unknown): Role => (v === "Organizer" ? "Organizer" : "Player");

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const role = roleOf(fd.get("role"));
  const values = { name: text(fd, "name"), email: text(fd, "email"), phone: text(fd, "phone") };
  const email = values.email.toLowerCase();
  const phone = normPhone(values.phone);
  const password = String(fd.get("password") ?? "");

  if (!values.name || values.name.length > 60) return { error: "Please enter your full name.", values };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Please enter a valid email address.", values };
  if (phone.length < 8 || phone.length > 15) return { error: "Please enter a valid mobile number.", values };
  if (password.length < 6) return { error: "Your password must be at least 6 characters.", values };

  const taken = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.phone, phone));
  if (taken.length) return { error: "This mobile number is already registered. Please log in.", values };

  const id = crypto.randomUUID();
  await db.insert(schema.users).values({ id, name: values.name, email, phone, passwordHash: await bcrypt.hash(password, 10), role });
  await createSession({ kind: "user", userId: id, role, name: values.name });
  redirect("/dashboard");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const role = roleOf(fd.get("role"));
  const values = { phone: text(fd, "phone") };
  const [user] = await db.select().from(schema.users).where(eq(schema.users.phone, normPhone(values.phone)));
  if (!user || !(await bcrypt.compare(String(fd.get("password") ?? ""), user.passwordHash))) {
    return { error: "Wrong phone number or password.", values };
  }
  if (user.role !== role) return { error: `This account is registered as ${user.role}. Switch the toggle above.`, values };
  await createSession({ kind: "user", userId: user.id, role: user.role, name: user.name });
  redirect("/dashboard");
}

/** Umpires need no account: a match code unlocks that one scoreboard. */
export async function umpireLogin(_: FormState, fd: FormData): Promise<FormState> {
  const code = cleanCode(fd.get("code"));
  if (code.length !== 6) return { error: "A match code has 6 letters or numbers." };
  const [match] = await db
    .select({ id: schema.matches.id, tournamentId: schema.matches.tournamentId })
    .from(schema.matches)
    .where(eq(schema.matches.code, code));
  if (!match) return { error: `No match found with code ${code}.` };
  await createSession({ kind: "umpire", matchId: match.id, tournamentId: match.tournamentId });
  redirect(`/t/${match.tournamentId}/score/${match.id}`);
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
