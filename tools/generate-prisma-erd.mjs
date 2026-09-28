import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "backend-node", "prisma", "schema.prisma");
const outputDir = path.join(root, "docs");
const outputPath = path.join(outputDir, "schema-prisma-erd.svg");
const schema = fs.readFileSync(schemaPath, "utf8");

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const models = new Map();
for (const match of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
  const [, name, body] = match;
  const blockLines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const modelAttrs = blockLines.filter((line) => line.startsWith("@@"));
  const compoundPk = modelAttrs.find((line) => line.startsWith("@@id"))?.match(/\[([^\]]+)\]/)?.[1]
    ?.split(",").map((item) => item.trim()) ?? [];
  const compoundUnique = modelAttrs.filter((line) => line.startsWith("@@unique"))
    .flatMap((line) => line.match(/\[([^\]]+)\]/)?.[1]?.split(",").map((item) => item.trim()) ?? []);

  const rawFields = blockLines
    .filter((line) => !line.startsWith("@@") && !line.startsWith("///"))
    .map((line) => {
      const parts = line.split(/\s+/);
      return { name: parts[0], type: parts[1], attrs: parts.slice(2).join(" ") };
    });

  const relationFieldNames = new Set();
  for (const field of rawFields) {
    const relFields = field.attrs.match(/@relation\(fields:\s*\[([^\]]+)\]/)?.[1];
    if (relFields) relFields.split(",").map((item) => item.trim()).forEach((item) => relationFieldNames.add(item));
  }

  const fields = rawFields
    .filter((field) => {
      const baseType = field.type.replace(/[?\[\]]/g, "");
      return !schema.match(new RegExp(`model\\s+${baseType}\\s*\\{`));
    })
    .map((field) => ({
      ...field,
      pk: field.attrs.includes("@id") || compoundPk.includes(field.name),
      fk: relationFieldNames.has(field.name),
      unique: field.attrs.includes("@unique"),
      compoundUnique: compoundUnique.includes(field.name),
      nullable: field.type.endsWith("?"),
    }));

  models.set(name, { name, fields });
}

const positions = {
  movies: [80, 180],
  series: [80, 520],
  seasons: [80, 820],
  episodes: [1080, 930],
  productions: [1080, 180],
  actors: [2080, 180],
  production_actors: [2080, 690],
  genres: [3080, 180],
  production_genres: [3080, 600],
  daily_stats: [4080, 180],
  comments: [2080, 1260],
  comment_reactions: [3080, 1300],
  ratings: [4080, 1100],
  bookmarks: [80, 1580],
  watch_history: [80, 2050],
  users: [1080, 1730],
  notifications: [2080, 1940],
  subscription_plans: [80, 2800],
  transactions: [1080, 2640],
  user_subscriptions: [2080, 2770],
  watch_parties: [3080, 2260],
  watch_party_participants: [4080, 2760],
};

const relations = [
  ["movies", "id", "productions", "id"],
  ["series", "id", "productions", "id"],
  ["seasons", "id", "productions", "id"],
  ["seasons", "series_id", "series", "id"],
  ["episodes", "production_id", "productions", "id"],
  ["production_actors", "production_id", "productions", "id"],
  ["production_actors", "actor_id", "actors", "id"],
  ["production_genres", "production_id", "productions", "id"],
  ["production_genres", "genre_id", "genres", "id"],
  ["daily_stats", "top_production_id", "productions", "id"],
  ["daily_stats", "top_genre_id", "genres", "id"],
  ["bookmarks", "user_id", "users", "id"],
  ["bookmarks", "production_id", "productions", "id"],
  ["comments", "user_id", "users", "id"],
  ["comments", "production_id", "productions", "id"],
  ["comments", "episode_id", "episodes", "id"],
  ["comments", "parent_id", "comments", "id"],
  ["comment_reactions", "user_id", "users", "id"],
  ["comment_reactions", "comment_id", "comments", "id"],
  ["ratings", "user_id", "users", "id"],
  ["ratings", "production_id", "productions", "id"],
  ["notifications", "user_id", "users", "id"],
  ["transactions", "user_id", "users", "id"],
  ["transactions", "plan_id", "subscription_plans", "id"],
  ["user_subscriptions", "user_id", "users", "id"],
  ["user_subscriptions", "plan_id", "subscription_plans", "id"],
  ["user_subscriptions", "transaction_id", "transactions", "id"],
  ["watch_history", "user_id", "users", "id"],
  ["watch_history", "episode_id", "episodes", "id"],
  ["watch_parties", "host_id", "users", "id"],
  ["watch_parties", "production_id", "productions", "id"],
  ["watch_parties", "episode_id", "episodes", "id"],
  ["watch_party_participants", "party_id", "watch_parties", "id"],
  ["watch_party_participants", "user_id", "users", "id"],
];

const W = 840;
const HEADER = 66;
const ROW = 34;
const PAD = 14;
const tableHeight = (model) => HEADER + model.fields.length * ROW + PAD;
const fieldY = (model, fieldName) => {
  const index = Math.max(0, model.fields.findIndex((field) => field.name === fieldName));
  return HEADER + index * ROW + ROW / 2;
};

const boxes = new Map();
for (const [name, model] of models) {
  const [x, y] = positions[name];
  boxes.set(name, { x, y, w: W, h: tableHeight(model), model });
}

const tableGroup = ({ x, y, w, h, model }) => {
  const rows = model.fields.map((field, index) => {
    const rowY = HEADER + index * ROW;
    const key = field.pk ? "PK" : field.fk ? "FK" : "";
    const keyClass = field.pk ? "pk" : field.fk ? "fk" : "key-empty";
    const markers = [field.unique ? "UQ" : field.compoundUnique ? "UQ*" : "", field.nullable ? "NULL" : "NOT NULL"].filter(Boolean).join(" · ");
    return `
      <rect x="0" y="${rowY}" width="${w}" height="${ROW}" class="row ${index % 2 ? "row-alt" : ""}"/>
      <text x="${PAD}" y="${rowY + 23}" class="key ${keyClass}">${key}</text>
      <text x="72" y="${rowY + 23}" class="field">${esc(field.name)}</text>
      <text x="455" y="${rowY + 23}" class="type">${esc(field.type.replace("?", ""))}</text>
      <text x="${w - PAD}" y="${rowY + 23}" text-anchor="end" class="marker">${esc(markers)}</text>`;
  }).join("");

  return `<g transform="translate(${x},${y})" class="table">
    <rect width="${w}" height="${h}" rx="14" class="table-bg"/>
    <path d="M14 0 H${w - 14} Q${w} 0 ${w} 14 V${HEADER} H0 V14 Q0 0 14 0Z" class="table-header"/>
    <text x="${PAD + 4}" y="43" class="table-name">${esc(model.name)}</text>
    <text x="${w - PAD}" y="42" text-anchor="end" class="count">${model.fields.length} columns</text>
    ${rows}
  </g>`;
};

const connector = ([fromName, fromField, toName, toField], index) => {
  const from = boxes.get(fromName);
  const to = boxes.get(toName);
  if (!from || !to) return "";

  if (fromName === toName) {
    const y1 = from.y + fieldY(from.model, fromField);
    const y2 = from.y + fieldY(from.model, toField);
    const x = from.x + from.w;
    const loopX = x + 90;
    return `<path d="M${x},${y1} H${loopX} V${y2} H${x}" class="relation self" marker-end="url(#arrow)"/>`;
  }

  const fromCenter = from.x + from.w / 2;
  const toCenter = to.x + to.w / 2;
  const leftToRight = fromCenter < toCenter;
  const x1 = leftToRight ? from.x + from.w : from.x;
  const x2 = leftToRight ? to.x : to.x + to.w;
  const y1 = from.y + fieldY(from.model, fromField);
  const y2 = to.y + fieldY(to.model, toField);
  const offset = 38 + (index % 7) * 9;
  const midX = leftToRight
    ? Math.min(x2 - offset, x1 + Math.max(offset, (x2 - x1) / 2))
    : Math.max(x2 + offset, x1 - Math.max(offset, (x1 - x2) / 2));

  return `<path d="M${x1},${y1} H${midX} V${y2} H${x2}" class="relation" marker-end="url(#arrow)"/>`;
};

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="5000" height="3800" viewBox="0 0 5000 3800" role="img" aria-labelledby="title desc">
  <title id="title">ERD generated from backend-node/prisma/schema.prisma</title>
  <desc id="desc">Twenty-one database tables and their foreign-key relationships.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.55" stop-color="#0b1628"/>
      <stop offset="1" stop-color="#101827"/>
    </linearGradient>
    <linearGradient id="header" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#0891b2"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity=".35"/>
    </filter>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
    </marker>
    <style>
      text { font-family: Inter, "Segoe UI", Arial, sans-serif; }
      .title { fill:#f8fafc; font-size:54px; font-weight:800; letter-spacing:.2px; }
      .subtitle { fill:#94a3b8; font-size:25px; }
      .badge { fill:#0f766e; }
      .badge-text { fill:#ecfeff; font-size:22px; font-weight:700; }
      .table { filter:url(#shadow); }
      .table-bg { fill:#111c2f; stroke:#334155; stroke-width:2; }
      .table-header { fill:url(#header); }
      .table-name { fill:#fff; font-size:27px; font-weight:800; }
      .count { fill:#cffafe; font-size:17px; font-weight:600; }
      .row { fill:#111c2f; stroke:#263449; stroke-width:1; }
      .row-alt { fill:#152238; }
      .key { font-size:16px; font-weight:900; }
      .pk { fill:#fbbf24; }
      .fk { fill:#38bdf8; }
      .key-empty { fill:transparent; }
      .field { fill:#e2e8f0; font-size:20px; font-weight:650; }
      .type { fill:#a5b4fc; font-size:18px; }
      .marker { fill:#64748b; font-size:15px; font-weight:600; }
      .relation { fill:none; stroke:#64748b; stroke-width:3; opacity:.62; }
      .relation:hover { stroke:#22d3ee; stroke-width:6; opacity:1; }
      .self { stroke:#f59e0b; }
      .legend { fill:#cbd5e1; font-size:21px; }
      .section { fill:#334155; font-size:18px; font-weight:800; letter-spacing:2px; }
    </style>
  </defs>
  <rect width="5000" height="3800" fill="url(#bg)"/>
  <circle cx="4580" cy="250" r="420" fill="#0e7490" opacity=".07"/>
  <circle cx="350" cy="3450" r="520" fill="#0f766e" opacity=".06"/>
  <text x="80" y="82" class="title">Movie-Watching-Web · Prisma ERD</text>
  <text x="80" y="124" class="subtitle">Generated exclusively from backend-node/prisma/schema.prisma</text>
  <rect x="4250" y="55" width="670" height="72" rx="36" class="badge"/>
  <text x="4585" y="100" text-anchor="middle" class="badge-text">21 TABLES · MYSQL · PRISMA</text>
  <g transform="translate(3260,3650)">
    <text x="0" y="0" class="legend"><tspan fill="#fbbf24" font-weight="900">PK</tspan> Primary key</text>
    <text x="300" y="0" class="legend"><tspan fill="#38bdf8" font-weight="900">FK</tspan> Foreign key</text>
    <text x="610" y="0" class="legend"><tspan fill="#a5b4fc" font-weight="900">TYPE</tspan> Prisma type</text>
    <text x="980" y="0" class="legend"><tspan fill="#64748b" font-weight="900">UQ/UQ*</tspan> Unique / compound unique</text>
    <text x="1420" y="0" class="legend">Arrow points to referenced table</text>
  </g>
  <g aria-label="relationships">${relations.map(connector).join("\n")}</g>
  <g aria-label="tables">${[...boxes.values()].map(tableGroup).join("\n")}</g>
</svg>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, svg, "utf8");
console.log(outputPath);
