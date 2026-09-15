import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";

export function createFunctionHandler(createApp: () => FastifyInstance) {
  let ready: Promise<FastifyInstance> | undefined;
  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      ready ??= Promise.resolve().then(async () => {
        const app = createApp();
        try {
          await app.ready();
          return app;
        } catch (error) {
          await app.close();
          throw error;
        }
      }).catch(() => {
        ready = undefined;
        throw new Error("API initialization failed");
      });
      const app = await ready;
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          response.off("finish", finish);
          response.off("close", finish);
          response.off("error", fail);
        };
        const finish = () => { cleanup(); resolve(); };
        const fail = (error: Error) => { cleanup(); reject(error); };
        response.once("finish", finish);
        response.once("close", finish);
        response.once("error", fail);
        app.server.emit("request", request, response);
      });
    } catch {
      if (!response.headersSent) {
        response.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(JSON.stringify({ error: "API temporarily unavailable" }));
      } else if (!response.writableEnded) {
        response.destroy();
      }
    }
  };
}
