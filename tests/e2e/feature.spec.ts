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
    await b.getByPlaceholder("or paste a payload (URL or mesh://)").fill(payload);
    await b.getByRole("button", { name: "use", exact: true }).click();

    await expect(b.locator(".bc-list")).toContainText("alice");
    await expect(b.locator(".bc-list")).toContainText("alice@example.com");
  } finally {
    await cleanup();
  }
});

test("two peers exchange QR vCards bidirectionally; .vcf export carries the other card", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Each peer fills their own card.
    await a.getByPlaceholder("full name").fill("Alice Anderson");
    await a.getByPlaceholder("title").fill("Engineer");
    await a.getByPlaceholder("organization").fill("Acme Co");
    await a.getByPlaceholder("email").fill("alice@acme.test");
    await a.getByPlaceholder("phone").fill("+15550001111");

    await b.getByPlaceholder("full name").fill("Bob Baker");
    await b.getByPlaceholder("title").fill("Designer");
    await b.getByPlaceholder("organization").fill("Globex");
    await b.getByPlaceholder("email").fill("bob@globex.test");

    // A reveals its raw QR payload; B "scans" it via the paste fallback.
    await a.locator(".mesh-qrx-payload summary").click();
    const aPayload = (await a.locator(".mesh-qrx-payload code").textContent()) ?? "";
    expect(aPayload.length).toBeGreaterThan(0);
    await b.getByPlaceholder("or paste a payload (URL or mesh://)").fill(aPayload);
    await b.getByRole("button", { name: "use", exact: true }).click();

    // B reveals its QR payload; A scans it back — proves the exchange is two-way.
    await b.locator(".mesh-qrx-payload summary").click();
    const bPayload = (await b.locator(".mesh-qrx-payload code").textContent()) ?? "";
    expect(bPayload.length).toBeGreaterThan(0);
    await a.getByPlaceholder("or paste a payload (URL or mesh://)").fill(bPayload);
    await a.getByRole("button", { name: "use", exact: true }).click();

    // Cross-peer assertion: each peer now holds the OTHER's full card on screen.
    await expect(b.locator(".bc-list")).toContainText("Alice Anderson");
    await expect(b.locator(".bc-list")).toContainText("alice@acme.test");
    await expect(b.locator(".bc-list")).toContainText("Acme Co");

    await expect(a.locator(".bc-list")).toContainText("Bob Baker");
    await expect(a.locator(".bc-list")).toContainText("bob@globex.test");
    await expect(a.locator(".bc-list")).toContainText("Globex");

    // .vcf export: the generated vCard text must be valid and contain the
    // OTHER peer's card (this is the advertised "export to .vcf" claim).
    await b.locator(".bc-vcf-preview summary").click();
    const bVcf = (await b.locator(".bc-vcf-text").textContent()) ?? "";
    expect(bVcf).toContain("BEGIN:VCARD");
    expect(bVcf).toContain("VERSION:3.0");
    expect(bVcf).toContain("END:VCARD");
    expect(bVcf).toContain("FN:Alice Anderson");
    expect(bVcf).toContain("EMAIL:alice@acme.test");
    expect(bVcf).toContain("ORG:Acme Co");
    expect(bVcf).toContain("TEL:+15550001111");

    await a.locator(".bc-vcf-preview summary").click();
    const aVcf = (await a.locator(".bc-vcf-text").textContent()) ?? "";
    expect(aVcf).toContain("BEGIN:VCARD");
    expect(aVcf).toContain("FN:Bob Baker");
    expect(aVcf).toContain("EMAIL:bob@globex.test");
    expect(aVcf).toContain("ORG:Globex");
  } finally {
    await cleanup();
  }
});
