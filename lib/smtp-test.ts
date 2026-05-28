import net from "node:net";
import tls from "node:tls";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
};

type SmtpResponse = {
  code: number;
  lines: string[];
};

const DEFAULT_TIMEOUT_MS = 10000;

export function normalizeSmtpConfig(input: {
  host?: unknown;
  port?: unknown;
  secure?: unknown;
  user?: unknown;
  password?: unknown;
}): SmtpConfig {
  const host = String(input.host || "").trim();
  const port = Number(input.port || 587);
  const user = String(input.user || "").trim();
  const password = typeof input.password === "string" ? input.password : "";

  if (!host) throw new Error("SMTP host is required.");
  if (host.length > 255 || /[\s/\\]/.test(host)) throw new Error("SMTP host must be a hostname or IP address.");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP port must be between 1 and 65535.");
  if (user && !password) throw new Error("SMTP password is required when a username is set.");

  return {
    host,
    port,
    secure: input.secure === true || input.secure === "true" || input.secure === "on",
    user: user || undefined,
    password: password || undefined
  };
}

class SmtpConnection {
  private buffer = "";

  constructor(
    private socket: net.Socket | tls.TLSSocket,
    private readonly timeoutMs: number
  ) {
    this.socket.setEncoding("utf8");
  }

  write(command: string) {
    this.socket.write(`${command}\r\n`);
  }

  async readResponse(): Promise<SmtpResponse> {
    const existing = this.consumeResponse();
    if (existing) return existing;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => cleanup(new Error("SMTP server response timed out.")), this.timeoutMs);

      const cleanup = (error?: Error, response?: SmtpResponse) => {
        clearTimeout(timer);
        this.socket.off("data", onData);
        this.socket.off("error", onError);
        if (error) reject(error);
        else if (response) resolve(response);
      };

      const onError = (error: Error) => cleanup(error);
      const onData = (chunk: string | Buffer) => {
        this.buffer += chunk.toString();
        const response = this.consumeResponse();
        if (response) cleanup(undefined, response);
      };

      this.socket.on("data", onData);
      this.socket.once("error", onError);
    });
  }

  async expect(command: string | null, expectedCode: number) {
    if (command) this.write(command);
    const response = await this.readResponse();
    if (response.code !== expectedCode) {
      throw new Error(`SMTP command failed with ${response.code}: ${response.lines.join(" ")}`);
    }
    return response;
  }

  async startTls(host: string) {
    this.socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
      const secureSocket = tls.connect({ socket: this.socket, servername: host });
      const timer = setTimeout(() => {
        secureSocket.destroy();
        reject(new Error("STARTTLS handshake timed out."));
      }, this.timeoutMs);

      secureSocket.once("secureConnect", () => {
        clearTimeout(timer);
        secureSocket.setEncoding("utf8");
        resolve(secureSocket);
      });
      secureSocket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    this.buffer = "";
  }

  close() {
    this.socket.end();
  }

  destroy() {
    this.socket.destroy();
  }

  private consumeResponse(): SmtpResponse | null {
    const lineEnd = this.buffer.indexOf("\n");
    if (lineEnd === -1) return null;

    const lines = this.buffer.split(/\r?\n/);
    if (this.buffer.endsWith("\n")) lines.pop();
    else lines.pop();

    const responseLines: string[] = [];
    let consumed = 0;
    let code = 0;
    for (const line of lines) {
      responseLines.push(line);
      consumed += line.length + (this.buffer.includes("\r\n") ? 2 : 1);
      const match = /^(\d{3})([ -])/.exec(line);
      if (!match) continue;
      code = Number(match[1]);
      if (match[2] === " ") {
        this.buffer = this.buffer.slice(consumed);
        return { code, lines: responseLines };
      }
    }

    return null;
  }
}

function hasCapability(response: SmtpResponse, capability: string) {
  return response.lines.some((line) => line.toUpperCase().includes(capability.toUpperCase()));
}

async function connectSocket(config: SmtpConfig, timeoutMs: number) {
  return new Promise<net.Socket | tls.TLSSocket>((resolve, reject) => {
    const socket = config.secure ? tls.connect({ host: config.host, port: config.port, servername: config.host }) : net.connect({ host: config.host, port: config.port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("SMTP connection timed out."));
    }, timeoutMs);

    const event = config.secure ? "secureConnect" : "connect";
    socket.once(event, () => {
      clearTimeout(timer);
      socket.setEncoding("utf8");
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function authenticate(connection: SmtpConnection, ehlo: SmtpResponse, config: SmtpConfig) {
  if (!config.user || !config.password) return;
  if (!hasCapability(ehlo, "AUTH")) throw new Error("SMTP server does not advertise AUTH.");

  if (hasCapability(ehlo, "PLAIN")) {
    const payload = Buffer.from(`\0${config.user}\0${config.password}`).toString("base64");
    await connection.expect(`AUTH PLAIN ${payload}`, 235);
    return;
  }

  if (hasCapability(ehlo, "LOGIN")) {
    await connection.expect("AUTH LOGIN", 334);
    await connection.expect(Buffer.from(config.user).toString("base64"), 334);
    await connection.expect(Buffer.from(config.password).toString("base64"), 235);
    return;
  }

  throw new Error("SMTP server does not advertise a supported AUTH method.");
}

export async function testSmtpConnection(config: SmtpConfig, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const socket = await connectSocket(config, timeoutMs);
  const connection = new SmtpConnection(socket, timeoutMs);

  try {
    await connection.expect(null, 220);
    let ehlo = await connection.expect("EHLO belinked.local", 250);

    if (!config.secure && hasCapability(ehlo, "STARTTLS")) {
      await connection.expect("STARTTLS", 220);
      await connection.startTls(config.host);
      ehlo = await connection.expect("EHLO belinked.local", 250);
    }

    await authenticate(connection, ehlo, config);
    connection.write("QUIT");
    connection.close();
  } catch (error) {
    connection.destroy();
    throw error;
  }
}
