import { expect, test } from "@playwright/test";

test("GET /api/health answers ok as plain text", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  expect(await response.text()).toBe("ok");
});
