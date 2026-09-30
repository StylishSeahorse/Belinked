import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { hashIp, hashSecret, randomToken, requestIp } from "./security";
import { verifyTotp } from "./totp";
import { UserError } from "./errors";

const COOKIE = "belinked_session";
const SESSION_DAYS = 14;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
/** Failed attempts allowed per client IP per window. */
export const MAX_FAILURES_PER_IP = 8;
/**
 * Failed attempts allowed across all IPs per window. Bounds brute force even if an
 * attacker controls many IPs or can spoof forwarding headers.
 */
export const MAX_FAILURES_GLOBAL = 40;
export const MIN_PASSWORD_LENGTH = 12;

// Compared against when no owner matches so response timing does not reveal the email.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= bcrypt.hash("belinked-timing-equalizer", 12);
  return dummyHash;
}

export class AuthError extends UserError {}

function secureSessionCookie() {
  const explicit = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (explicit) return ["1", "true", "yes", "on"].includes(explicit);

  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) return appUrl.startsWith("https://");

  return process.env.NODE_ENV === "production";
}

export function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new AuthError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > 200) throw new AuthError("Use at most 200 characters.");
}

export async function ownerExists() {
  return (await prisma.owner.count()) > 0;
}

export async function createOwner(email: string, password: string, displayName: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedDisplayName = displayName.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new AuthError("Enter a valid email address.");
  if (!normalizedDisplayName) throw new AuthError("Display name is required.");
  validatePassword(password);

  const passwordHash = await bcrypt.hash(password, 12);
  // Re-check inside a transaction so two concurrent setup submissions cannot both succeed.
  return prisma.$transaction(async (tx) => {
    if ((await tx.owner.count()) > 0) throw new AuthError("Owner already exists.");
    const owner = await tx.owner.create({ data: { email: normalizedEmail, passwordHash, displayName: normalizedDisplayName } });
    await tx.auditLog.create({ data: { ownerId: owner.id, action: "owner.created.from_setup" } });
    return owner;
  });
}

async function setSessionCookie(ownerId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { ownerId, tokenHash: hashSecret(token), expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureSessionCookie(),
    expires: expiresAt,
    path: "/"
  });
}

export type LoginResult = { ok: true } | { ok: false; error: string; needsTotp?: boolean };

export async function login(emailInput: string, password: string, totp = ""): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase().slice(0, 254);
  const ipHash = hashIp(await requestIp());
  const since = new Date(Date.now() - LOCK_WINDOW_MS);

  const [ipFailures, globalFailures] = await Promise.all([
    prisma.loginAttempt.count({ where: { ipHash, success: false, createdAt: { gt: since } } }),
    prisma.loginAttempt.count({ where: { success: false, createdAt: { gt: since } } })
  ]);
  if (ipFailures >= MAX_FAILURES_PER_IP || globalFailures >= MAX_FAILURES_GLOBAL) {
    return { ok: false, error: "Too many failed sign-in attempts. Wait 15 minutes and try again." };
  }

  // Single-owner app: compare emails case-insensitively (older installs stored them as typed).
  const candidate = await prisma.owner.findFirst();
  const owner = candidate && candidate.email.trim().toLowerCase() === email ? candidate : null;
  const passwordOk = await bcrypt.compare(password.slice(0, 200), owner?.passwordHash || (await getDummyHash()));

  if (owner && passwordOk && owner.totpEnabled && owner.totpSecret) {
    if (!totp) return { ok: false, error: "Enter the 6-digit code from your authenticator app.", needsTotp: true };
    if (!verifyTotp(owner.totpSecret, totp)) {
      await prisma.loginAttempt.create({ data: { email, ipHash, success: false } });
      await prisma.auditLog.create({ data: { ownerId: owner.id, action: "auth.totp_failed" } });
      return { ok: false, error: "That authentication code is not valid.", needsTotp: true };
    }
  }

  const ok = Boolean(owner && passwordOk);
  await prisma.loginAttempt.create({ data: { email, ipHash, success: ok } });
  if (!owner || !ok) return { ok: false, error: "Invalid email or password." };

  await setSessionCookie(owner.id);
  await prisma.auditLog.create({ data: { ownerId: owner.id, action: "auth.login" } });
  // Housekeeping: drop expired sessions and old login attempts.
  await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } })
  ]);
  return { ok: true };
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSecret(token) } });
  cookieStore.delete(COOKIE);
}

async function currentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { owner: true }
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function currentOwner() {
  return (await currentSession())?.owner ?? null;
}

export async function requireOwner() {
  const owner = await currentOwner();
  if (!owner) {
    if (!(await ownerExists())) redirect("/admin/setup");
    redirect("/admin/login");
  }
  return owner;
}

/** Verifies the owner's current password; used before sensitive changes. */
export async function verifyOwnerPassword(ownerId: string, password: string) {
  const owner = await prisma.owner.findUnique({ where: { id: ownerId } });
  return Boolean(owner && (await bcrypt.compare(password.slice(0, 200), owner.passwordHash)));
}

/** Changes the password and revokes every other session, keeping the current one. */
export async function changeOwnerPassword(ownerId: string, currentPassword: string, nextPassword: string) {
  if (!(await verifyOwnerPassword(ownerId, currentPassword))) throw new AuthError("Your current password is incorrect.");
  validatePassword(nextPassword);
  const session = await currentSession();
  await prisma.owner.update({ where: { id: ownerId }, data: { passwordHash: await bcrypt.hash(nextPassword, 12) } });
  await prisma.session.deleteMany({ where: { ownerId, ...(session ? { NOT: { id: session.id } } : {}) } });
  await prisma.auditLog.create({ data: { ownerId, action: "auth.password_changed" } });
}

export async function revokeOtherSessions(ownerId: string) {
  const session = await currentSession();
  const result = await prisma.session.deleteMany({ where: { ownerId, ...(session ? { NOT: { id: session.id } } : {}) } });
  await prisma.auditLog.create({ data: { ownerId, action: "auth.sessions_revoked", metadata: JSON.stringify({ count: result.count }) } });
  return result.count;
}
