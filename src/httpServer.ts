import http from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type StartedHttpServer = {
  close: () => Promise<void>;
  port: number;
};

export type McpServerFactory = () => McpServer;

type McpSession = {
  closed: boolean;
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

export async function startMcpHttpServer(serverFactory: McpServerFactory, port: number): Promise<StartedHttpServer> {
  const sessions = new Map<string, McpSession>();

  const httpServer = http.createServer(async (request, response) => {
    if (!request.url?.startsWith("/mcp")) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
      return;
    }

    const sessionId = readHeader(request.headers["mcp-session-id"]);
    const isNewSession = !sessionId;
    let session: McpSession | undefined;

    try {
      session = sessionId ? sessions.get(sessionId) : await createSession(serverFactory, sessions);

      if (!session) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided"
          },
          id: null
        }));
        return;
      }

      await session.transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) {
        response.writeHead(500, { "content-type": "application/json" });
      }
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }));
    } finally {
      if (isNewSession && session && !session.transport.sessionId) {
        await closeSession(session, sessions);
      }
    }
  });

  let boundPort = port;

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, () => {
      httpServer.off("error", reject);
      const address = httpServer.address() as AddressInfo | null;
      if (address) {
        boundPort = address.port;
      }
      resolve();
    });
  });

  return {
    port: boundPort,
    close: async () => {
      await Promise.all(Array.from(sessions.values(), (session) => closeSession(session, sessions)));
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}

async function createSession(
  serverFactory: McpServerFactory,
  sessions: Map<string, McpSession>
): Promise<McpSession> {
  const server = serverFactory();
  let session: McpSession;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, session);
    }
  });

  session = { closed: false, server, transport };
  transport.onclose = () => {
    void closeSession(session, sessions);
  };

  await server.connect(transport);
  return session;
}

async function closeSession(
  session: McpSession,
  sessions: Map<string, McpSession>
): Promise<void> {
  if (session.closed) return;
  session.closed = true;

  const sessionId = session.transport.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
  }

  await session.server.close().catch(() => undefined);
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
