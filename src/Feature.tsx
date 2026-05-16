import { useEffect, useState } from "react";
import {
  QRExchange,
  makeScanPayload,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Card = {
  name: string;
  title: string;
  email: string;
  phone: string;
  url: string;
  org: string;
};

const KEY = (p: string, k: string) => `${p}:card:${k}`;

const blank: Card = { name: "", title: "", email: "", phone: "", url: "", org: "" };

function encodeCard(c: Card): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(c))));
}
function decodeCard(s: string): Card | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (parsed && typeof parsed === "object" && typeof parsed.name === "string") {
      return { ...blank, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toVcf(c: Card): string {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${c.name}`,
    c.org ? `ORG:${c.org}` : null,
    c.title ? `TITLE:${c.title}` : null,
    c.email ? `EMAIL:${c.email}` : null,
    c.phone ? `TEL:${c.phone}` : null,
    c.url ? `URL:${c.url}` : null,
    "END:VCARD",
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
}

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="viral-screen">
        <h1>business card</h1>
        <p className="viral-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const fields: Array<keyof Card> = ["name", "title", "org", "email", "phone", "url"];
  const [card, setCard] = useState<Card>(() => {
    const out: Card = { ...blank };
    for (const k of fields) out[k] = localStorage.getItem(KEY(config.storagePrefix, k)) ?? "";
    return out;
  });
  const [, rerender] = useState(0);

  useEffect(() => {
    for (const k of fields) localStorage.setItem(KEY(config.storagePrefix, k), card[k]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  useEffect(() => {
    const m = room.doc.getMap<Card>("cards");
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  const cards = room.doc.getMap<Card>("cards");

  useEffect(() => {
    if (card.name.trim()) cards.set(room.peerId, card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.name, card.email, card.phone, card.url, card.org, card.title]);

  const myPayload = makeScanPayload(room.roomId, room.peerId, encodeCard(card).slice(0, 800));

  const collectCard = (peerId: string, encoded?: string) => {
    if (peerId === room.peerId) return;
    if (encoded) {
      const decoded = decodeCard(encoded);
      if (decoded) {
        cards.set(peerId, decoded);
        return;
      }
    }
    // fallback — at least record presence
    if (!cards.has(peerId)) cards.set(peerId, { ...blank, name: peerId.slice(0, 6) });
  };

  const collected: Array<Card & { peerId: string }> = [];
  cards.forEach((v, k) => {
    if (k !== room.peerId) collected.push({ ...v, peerId: k });
  });
  collected.sort((a, b) => a.name.localeCompare(b.name));

  const exportAllVcf = () => {
    if (collected.length === 0) return;
    const blob = new Blob([collected.map(toVcf).join("\n")], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts.vcf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = (k: keyof Card, v: string) => setCard((c) => ({ ...c, [k]: v }));

  return (
    <div className="viral-screen">
      <header>
        <h1>business card</h1>
        <p className="viral-status">
          {collected.length} contacts collected · {room.peerCount + 1} present
        </p>
      </header>

      <section>
        <h2 className="viral-section-title">your card</h2>
        <div className="bc-form">
          <input
            placeholder="full name"
            value={card.name}
            onChange={(e) => set("name", e.target.value)}
            maxLength={60}
          />
          <input
            placeholder="title"
            value={card.title}
            onChange={(e) => set("title", e.target.value)}
            maxLength={60}
          />
          <input
            placeholder="organization"
            value={card.org}
            onChange={(e) => set("org", e.target.value)}
            maxLength={60}
          />
          <input
            placeholder="email"
            value={card.email}
            onChange={(e) => set("email", e.target.value)}
            maxLength={120}
          />
          <input
            placeholder="phone"
            value={card.phone}
            onChange={(e) => set("phone", e.target.value)}
            maxLength={40}
          />
          <input
            placeholder="url"
            value={card.url}
            onChange={(e) => set("url", e.target.value)}
            maxLength={120}
          />
        </div>
      </section>

      <QRExchange
        myPayload={myPayload}
        showLabel="your card as a QR"
        scanLabel="scan someone's card"
        onScan={(parsed) => collectCard(parsed.peerId, parsed.extra ?? undefined)}
      />

      <section>
        <h2 className="viral-section-title">collected ({collected.length})</h2>
        {collected.length === 0 ? (
          <p className="viral-empty">no contacts yet — scan someone's QR</p>
        ) : (
          <ul className="bc-list">
            {collected.map((c) => (
              <li key={c.peerId} className="viral-card">
                <strong>{c.name || "(unknown)"}</strong>
                {c.title && <span>{c.title}</span>}
                {c.org && <span>{c.org}</span>}
                {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                {c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer">
                    {c.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="viral-primary"
          onClick={exportAllVcf}
          disabled={collected.length === 0}
          style={{ marginTop: "0.6rem" }}
        >
          export all as .vcf
        </button>
      </section>
    </div>
  );
}
