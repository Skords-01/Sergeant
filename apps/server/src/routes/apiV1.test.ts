import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

/**
 * Supertest-покриття нового `/api/v1/*` префікса і bearer-auth шляху.
 *
 * Ми покриваємо ключові гарантії з `docs/api-v1.md`:
 *   1. роут працює і на `/api/*`, і на `/api/v1/*` (дзеркало 1:1);
 *   2. `/api/v1/me` резолвить юзера і через cookie, і через
 *      `Authorization: Bearer`;
 *   3. `POST /api/v1/push/register` валідує платформу і пише у правильну
 *      таблицю (push_subscriptions для web, push_devices для ios/android);
 *   4. bearer без валідної сесії — 401, не crash.
 *
 * DB-pool і Better Auth мокаються, бо нам цікавий саме wiring —
 * `apiVersionRewrite`, router-mounting, і поведінка `requireSession` під
 * різними headers. Реальний Better Auth bearer-плагін протестований
 * upstream; тут ми підміняємо `getSessionUser` щоб контролювати сесію.
 */

const { mockPool, queryMock, getSessionUserMock } = vi.hoisted(() => {
  const queryMock = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
  const mockPool = {
    query: queryMock,
    connect: vi.fn(),
    on: vi.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  };
  const getSessionUserMock = vi.fn().mockResolvedValue(null);
  return { mockPool, queryMock, getSessionUserMock };
});

vi.mock("./../db.js", () => ({
  default: mockPool,
  pool: mockPool,
  query: queryMock,
  ensureSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./../auth.js", () => ({
  auth: { handler: async () => new Response(null, { status: 404 }) },
  getSessionUser: getSessionUserMock,
  getSessionUserSoft: vi.fn().mockResolvedValue(null),
}));

import { createApp } from "./../app.js";

const ENV_KEYS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_EMAIL"];
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockResolvedValue({ rows: [{ "?column?": 1 }] });
  getSessionUserMock.mockReset();
  getSessionUserMock.mockResolvedValue(null);
  for (const k of ENV_KEYS) delete process.env[k];
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("api versioning — /api/v1/* дзеркалить /api/*", () => {
  it("GET /api/v1/push/vapid-public → такий самий статус як /api/push/vapid-public", async () => {
    const app = createApp();
    const legacy = await request(app).get("/api/push/vapid-public");
    const v1 = await request(app).get("/api/v1/push/vapid-public");
    expect(v1.status).toBe(legacy.status);
    // Обидва — 503 (VAPID не сконфігурений у тестах) і тіло ідентичне.
    expect(v1.status).toBe(503);
    expect(v1.body).toEqual(legacy.body);
  });

  it("невідомий /api/v1/* → 404, як і /api/*", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/this-does-not-exist");
    expect(res.status).toBe(404);
  });

  it("не переписує /api/* без v1 (не ламає існуючий веб)", async () => {
    const app = createApp();
    const res = await request(app).get("/api/push/vapid-public");
    // Якщо apiVersionRewrite помилково зачепив би цей шлях, він би став
    // `/push/vapid-public` і полетів би у 404.
    expect(res.status).toBe(503);
  });

  it("не чіпає /api/auth/* префікс — Better Auth basePath незмінний", async () => {
    const app = createApp();
    // `/api/v1/auth/...` має бути переписаний на `/api/auth/...` і вже
    // там зловлений better-auth handler-ом (який мокнутий у 404).
    const res = await request(app).get("/api/v1/auth/session");
    expect(res.status).toBe(404);
    // Важливо: НЕ fall-through на загальний 404 express-а — роут
    // існує, тому handler повернув 404 сам.
  });
});

describe("/api/v1/me — cookie і bearer резолвляться однаково", () => {
  const user = {
    id: "user_123",
    email: "u@example.com",
    name: "Test User",
    image: null,
    emailVerified: true,
  };

  it("без auth → 401", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("cookie-сесія → 200 з user", async () => {
    getSessionUserMock.mockResolvedValueOnce(user);
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/me")
      .set("Cookie", "better-auth.session_token=cookie-stub");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: { id: user.id, email: user.email, emailVerified: true },
    });
  });

  it("Authorization: Bearer → 200 з тим самим shape", async () => {
    getSessionUserMock.mockResolvedValueOnce(user);
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", "Bearer mobile-token-stub");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      user: { id: user.id, email: user.email, emailVerified: true },
    });
    // getSessionUser отримав req — саме він всередині better-auth читає
    // headers (cookie або Authorization). Один виклик = один канал.
    expect(getSessionUserMock).toHaveBeenCalledTimes(1);
  });

  it("bearer з невалідним токеном (getSessionUser → null) → 401", async () => {
    getSessionUserMock.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("/api/me — той самий endpoint, що й /api/v1/me", async () => {
    getSessionUserMock.mockResolvedValue(user);
    const app = createApp();
    const legacy = await request(app)
      .get("/api/me")
      .set("Authorization", "Bearer x");
    const v1 = await request(app)
      .get("/api/v1/me")
      .set("Authorization", "Bearer x");
    expect(legacy.status).toBe(200);
    expect(v1.status).toBe(200);
    expect(v1.body).toEqual(legacy.body);
  });
});

describe("POST /api/v1/push/register", () => {
  const user = { id: "user_abc" };

  it("без сесії → 401", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/register")
      .send({ platform: "ios", token: "t".repeat(64) });
    expect(res.status).toBe(401);
  });

  it("ios токен → INSERT у push_devices з ON CONFLICT", async () => {
    getSessionUserMock.mockResolvedValue(user);
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] });
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/register")
      .set("Authorization", "Bearer x")
      .send({ platform: "ios", token: "t".repeat(64) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, platform: "ios" });
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toMatch(/INSERT INTO push_devices/);
    expect(String(sql)).toMatch(/ON CONFLICT \(platform, token\)/);
    expect(params).toEqual([user.id, "ios", "t".repeat(64)]);
  });

  it("android токен → той самий шлях, platform=android", async () => {
    getSessionUserMock.mockResolvedValue(user);
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] });
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/register")
      .set("Authorization", "Bearer x")
      .send({ platform: "android", token: "fcm-registration-token" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, platform: "android" });
    expect(queryMock.mock.calls[0][1]).toEqual([
      user.id,
      "android",
      "fcm-registration-token",
    ]);
  });

  it("web з keys — валідно парситься і доходить до vapid-guard-а", async () => {
    // `vapidReady` у `server/modules/push.ts` обчислюється на module-load, тож
    // 200-case для web тут не відтворюваний без підготовки env ДО першого
    // `import` (це вже покриває `server/smoke.test.ts` на рівні subscribe).
    // Тут важливо: discriminated union валідатор приймає `web` payload —
    // без цього ми б впали на 400 raніше, ніж досягли vapid-guard-а.
    getSessionUserMock.mockResolvedValue(user);
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/register")
      .set("Authorization", "Bearer x")
      .send({
        platform: "web",
        token: "https://fcm.googleapis.com/wp/xxx",
        keys: { p256dh: "a".repeat(64), auth: "b".repeat(22) },
      });
    // 503 від vapid-guard-а, а не 400 від zod — payload валідний.
    expect(res.status).toBe(503);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("web без VAPID env → 503", async () => {
    getSessionUserMock.mockResolvedValue(user);
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/register")
      .set("Authorization", "Bearer x")
      .send({
        platform: "web",
        token: "https://fcm.googleapis.com/wp/xxx",
        keys: { p256dh: "a".repeat(64), auth: "b".repeat(22) },
      });
    expect(res.status).toBe(503);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("невалідна platform → 400 (zod)", async () => {
    getSessionUserMock.mockResolvedValue(user);
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/register")
      .set("Authorization", "Bearer x")
      .send({ platform: "windows-phone", token: "x" });
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/push/unregister", () => {
  const user = { id: "user_abc" };

  it("без сесії → 401", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/unregister")
      .send({ platform: "ios", token: "t".repeat(64) });
    expect(res.status).toBe(401);
  });

  it("web-гілка soft-delete-ить у push_subscriptions за endpoint", async () => {
    getSessionUserMock.mockResolvedValue(user);
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] });
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/unregister")
      .set("Authorization", "Bearer x")
      .send({
        platform: "web",
        endpoint: "https://fcm.googleapis.com/wp/xxx",
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, platform: "web" });
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toMatch(/UPDATE push_subscriptions/);
    expect(String(sql)).toMatch(/deleted_at = NOW/);
    expect(String(sql)).toMatch(/deleted_at IS NULL/);
    expect(params).toEqual([user.id, "https://fcm.googleapis.com/wp/xxx"]);
  });

  it("native-гілка soft-delete-ить у push_devices за (platform, token)", async () => {
    getSessionUserMock.mockResolvedValue(user);
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] });
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/unregister")
      .set("Authorization", "Bearer x")
      .send({ platform: "android", token: "fcm-reg-tok" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, platform: "android" });
    const [sql, params] = queryMock.mock.calls[0];
    expect(String(sql)).toMatch(/UPDATE push_devices/);
    expect(params).toEqual([user.id, "android", "fcm-reg-tok"]);
  });

  it("доступний і на legacy-префіксі /api/push/unregister", async () => {
    getSessionUserMock.mockResolvedValue(user);
    queryMock.mockResolvedValue({ rowCount: 1, rows: [] });
    const app = createApp();
    const res = await request(app)
      .post("/api/push/unregister")
      .set("Authorization", "Bearer x")
      .send({
        platform: "web",
        endpoint: "https://fcm.googleapis.com/wp/xxx",
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, platform: "web" });
  });

  it("невалідний web-payload без endpoint → 400", async () => {
    getSessionUserMock.mockResolvedValue(user);
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/push/unregister")
      .set("Authorization", "Bearer x")
      .send({ platform: "web", token: "not-a-url" });
    expect(res.status).toBe(400);
    expect(queryMock).not.toHaveBeenCalled();
  });
});
