// Historical same-origin Socket.IO smoke check; not the Vercel/Ably production check.
// Run with SMOKE_PASSWORD resolved by asm-exec; never prints credentials/cookies.
import assert from "node:assert/strict";
import { io } from "../../apps/api/node_modules/socket.io-client/build/esm/index.js";
const origin = process.argv[2];
assert(origin && new URL(origin).protocol === "https:");
for (const path of ["/health", "/ready", "/login"]) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `${path} status`);
  if (path !== "/login") console.log(`${path}: 200 ${await response.text()}`);
  else console.log("/login: 200");
}
if (process.env.SMOKE_PASSWORD) {
  const html = await (await fetch(`${origin}/login`)).text();
  if (process.env.SMOKE_EXPECT_PUBLIC_DEMO === "true") {
    assert(
      html.includes(process.env.SMOKE_EMAIL),
      "Public demo email is displayed",
    );
    assert(
      html.includes(process.env.SMOKE_PASSWORD),
      "Public demo password is displayed",
    );
  }
  const decode = (s) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  const form = new FormData();
  for (const input of html.matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/\bname="([^"]*)"/)?.[1];
    const value = input[0].match(/\bvalue="([^"]*)"/)?.[1] ?? "";
    if (name?.startsWith("$ACTION")) form.append(decode(name), decode(value));
  }
  assert(form.keys().next().value, "Server Action form fields exist");
  form.set("email", process.env.SMOKE_EMAIL);
  form.set("password", process.env.SMOKE_PASSWORD);
  const login = await fetch(`${origin}/login`, {
    method: "POST",
    body: form,
    headers: { Origin: origin },
    redirect: "manual",
  });
  assert.equal(login.status, 303, "Login redirects");
  const session = login.headers
    .getSetCookie()
    .find((x) => x.startsWith("incidentflow_session="));
  assert(
    session?.includes("HttpOnly") && session.includes("Secure"),
    "Secure HttpOnly cookie",
  );
  const cookie = session.split(";")[0];
  const dashboard = await fetch(origin, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.equal(dashboard.status, 200, "Authenticated dashboard");
  console.log(
    "Login and authenticated dashboard: PASS (Secure, HttpOnly cookie)",
  );
  for (const transport of ["polling", "fallback"]) {
    await new Promise((resolve, reject) => {
      const socket = io(origin, {
        transports:
          transport === "fallback" ? ["websocket", "polling"] : [transport],
        tryAllTransports: true,
        extraHeaders: { Origin: origin, Cookie: cookie },
        reconnection: false,
        timeout: 15000,
      });
      socket.once("connect", () => {
        console.log(`Authenticated Socket.IO ${transport}: PASS`);
        socket.disconnect();
        resolve();
      });
      socket.once("connect_error", () => {
        socket.disconnect();
        reject(new Error(`Authenticated Socket.IO ${transport}: FAILED`));
      });
    });
  }
}
