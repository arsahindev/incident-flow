import cors from "@fastify/cors";
import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "incidentflow-api",
  }));

  return app;
}
