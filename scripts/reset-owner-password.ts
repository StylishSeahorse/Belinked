/**
 * Resets the owner password from the server shell (the recovery path for a
 * self-hosted single-user install). Also disables 2FA and signs out all sessions.
 *
 *   npm run owner:reset-password
 *   docker compose exec app npx tsx scripts/reset-owner-password.ts
 *
 * Reads the new password from BELINKED_NEW_PASSWORD, or prompts for it.
 */
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { prisma } from "../lib/prisma";

async function main() {
  const owner = await prisma.owner.findFirst();
  if (!owner) {
    console.log("No owner exists yet. Open /admin/setup in your browser to create one.");
    return;
  }
  let password = process.env.BELINKED_NEW_PASSWORD || "";
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question(`New password for ${owner.email} (min 12 characters): `);
    rl.close();
  }
  if (password.length < 12) throw new Error("Password must be at least 12 characters.");
  await prisma.owner.update({ where: { id: owner.id }, data: { passwordHash: await bcrypt.hash(password, 12), totpEnabled: false, totpSecret: null } });
  const sessions = await prisma.session.deleteMany({ where: { ownerId: owner.id } });
  await prisma.loginAttempt.deleteMany();
  await prisma.auditLog.create({ data: { ownerId: owner.id, action: "auth.password_reset_cli" } });
  console.log(`Password reset for ${owner.email}. 2FA disabled, ${sessions.count} session(s) signed out, login lockouts cleared.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
