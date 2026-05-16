import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("A fills card; B scans (via paste) and sees alice's email/title", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("full name").fill("alice");
    await a.getByPlaceholder("title").fill("engineer");
    await a.getByPlaceholder("email").fill("alice@example.com");

    await b.getByPlaceholder("full name").fill("bob");

    await a.locator(".mesh-qrx-payload summary").click();
    const payload = (await a.locator(".mesh-qrx-payload code").textContent()) ?? "";
    await b.getByPlaceholder("or paste a mesh:// payload").fill(payload);
    await b.getByRole("button", { name: "use", exact: true }).click();

    await expect(b.locator(".bc-list")).toContainText("alice");
    await expect(b.locator(".bc-list")).toContainText("alice@example.com");
  } finally {
    await cleanup();
  }
});
