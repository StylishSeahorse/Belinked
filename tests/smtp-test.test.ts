import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { normalizeSmtpConfig, testSmtpConnection } from "../lib/smtp-test";

let server: net.Server | null = null;

afterEach(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

async function startSmtpServer() {
  server = net.createServer((socket) => {
    socket.write("220 local smtp test\r\n");
    socket.on("data", (chunk) => {
      const commands = chunk
        .toString()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (const command of commands) {
        if (command.toUpperCase().startsWith("EHLO")) socket.write("250-localhost\r\n250 OK\r\n");
        else if (command.toUpperCase() === "QUIT") socket.end("221 bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });

  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start SMTP test server.");
  return address.port;
}

describe("normalizeSmtpConfig", () => {
  it("normalizes valid SMTP settings", () => {
    expect(normalizeSmtpConfig({ host: " mailhog ", port: "1025", secure: "on" })).toEqual({
      host: "mailhog",
      port: 1025,
      secure: true,
      user: undefined,
      password: undefined
    });
  });

  it("rejects invalid hosts and ports", () => {
    expect(() => normalizeSmtpConfig({ host: "https://smtp.example.com", port: 587 })).toThrow("hostname or IP");
    expect(() => normalizeSmtpConfig({ host: "smtp.example.com", port: 70000 })).toThrow("between 1 and 65535");
  });
});

describe("testSmtpConnection", () => {
  it("connects and runs EHLO against an SMTP server", async () => {
    const port = await startSmtpServer();
    await expect(testSmtpConnection({ host: "127.0.0.1", port, secure: false }, 1000)).resolves.toBeUndefined();
  });
});
