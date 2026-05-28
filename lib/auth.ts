import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { hashIp, hashSecret, randomToken, requestIp } from "./security";

const COOKIE = "belinked_session";
const SESSION_DAYS = 14;

export async function ownerExists() {
  return (await prisma.owner.count()) > 0;
}

export async function createOwner(email: string, password: string, displayName: string) {
  const count = await prisma.owner.count();
  if (count > 0) throw new Error("Owner already exists");
  const owner = await prisma.owner.create({
    data: { email, passwordHash: await bcrypt.hash(password, 12), displayName }
  });
  await prisma.auditLog.create({ data: { ownerId: owner.id, action: "owner.created.from_setup" } });
  return owner;
}

export async function login(email: string, password: string) {
  const ip = await requestIp();
  const ipHash = hashIp(ip);
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const failures = await prisma.loginAttempt.count({
    where: { email, ipHash, success: false, createdAt: { gt: since } }
  });
  if (failures >= 8) throw new Error("Too many login attempts. Try again later.");

  const owner = await prisma.owner.findUnique({ where: { email } });
  const ok = owner ? await bcrypt.compare(password, owner.passwordHash) : false;
  await prisma.loginAttempt.create({ data: { email, ipHash, success: ok } });
  if (!owner || !ok) throw new Error("Invalid email or password");

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { ownerId: owner.id, tokenHash: hashSecret(token), expiresAt }
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });
}

export async function logout() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSecret(token) } });
  cookieStore.delete(COOKIE);
}

export async function currentOwner() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: { owner: true }
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.owner;
}

export async function requireOwner() {
  const owner = await currentOwner();
  if (!owner) redirect("/admin/login");
  return owner;
}
