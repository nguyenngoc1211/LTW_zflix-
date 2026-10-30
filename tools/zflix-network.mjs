// Dong bo dia chi mang LAN vao cau hinh dev.
//   frontend/.env      -> VITE_API_URL de trong (frontend tu goi API theo host dang mo)
//   backend-node/.env  -> FRONTEND_ORIGIN (CORS + Socket.IO) them origin cua may khac trong LAN
//   .env (goc)         -> FRONTEND_ORIGIN cho docker compose (backend trong container)
// Chay tu dong boi start-zflix.bat. Chay tay:
//   node tools/zflix-network.mjs        # dong bo .env
//   node tools/zflix-network.mjs --ip   # chi in IP LAN (dung cho banner)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT_ENV = path.join(rootDir, ".env");
const FRONTEND_ENV = path.join(rootDir, "frontend", ".env");
const BACKEND_ENV = path.join(rootDir, "backend-node", ".env");
const DEV_PORTS = [5173, 4173];

// Bo qua adapter ao (VMware/Hyper-V/Docker) va dia chi link-local cua Windows.
const VIRTUAL_ADAPTER = /(vmware|virtualbox|vethernet|hyper-?v|docker|wsl|npcap|loopback|hamachi|zerotier)/i;
const LINK_LOCAL = /^169\.254\./;

const adapterRank = (name) => {
  if (/^ethernet/i.test(name) || /wi-?fi|wlan|wireless/i.test(name)) return 0;
  if (/tailscale/i.test(name)) return 1;
  return 2;
};

const detectLocalIpv4 = () =>
  Object.entries(os.networkInterfaces())
    .flatMap(([name, addresses]) =>
      (addresses || [])
        .filter(
          (addr) =>
            (addr.family === "IPv4" || addr.family === 4) &&
            !addr.internal &&
            !LINK_LOCAL.test(addr.address) &&
            !VIRTUAL_ADAPTER.test(name),
        )
        .map((addr) => ({ name, address: addr.address })),
    )
    .sort((a, b) => adapterRank(a.name) - adapterRank(b.name) || a.name.localeCompare(b.name))
    .filter((entry, index, list) => list.findIndex((item) => item.address === entry.address) === index);

const updateEnvFile = (filePath, updates) => {
  if (!fs.existsSync(filePath)) return false;
  const original = fs.readFileSync(filePath, "utf8");
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const hadTrailingEol = original.endsWith("\n");
  const lines = original.split(/\r?\n/);
  if (hadTrailingEol) lines.pop();

  for (const [key, value] of Object.entries(updates)) {
    const matcher = new RegExp(`^\\s*${key}\\s*=`);
    const line = `${key}=${value}`;
    const index = lines.findIndex((candidate) => matcher.test(candidate));
    if (index === -1) lines.push(line);
    else lines[index] = line;
  }

  fs.writeFileSync(filePath, lines.join(eol) + (hadTrailingEol ? eol : ""));
  return true;
};

const readEnvValue = (filePath, key) => {
  if (!fs.existsSync(filePath)) return "";
  const matcher = new RegExp(`^\\s*${key}\\s*=(.*)$`);
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(matcher);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
};

// Origin do script quan ly = localhost hoac IP noi bo (LAN/Tailscale).
// Origin khac (vd https://zflix.vn) duoc giu nguyen de khong pha cau hinh that.
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/i;
const isManagedUrl = (value) => {
  try {
    return PRIVATE_HOST.test(new URL(value).hostname);
  } catch {
    return false;
  }
};

const results = detectLocalIpv4();
const wantIpOnly = process.argv.includes("--ip");

if (wantIpOnly) {
  const preferred = results.find((entry) => !/tailscale/i.test(entry.name)) || results[0];
  if (preferred) console.log(preferred.address);
  process.exit(0);
}

const origins = [
  ...DEV_PORTS.map((port) => `http://localhost:${port}`),
  ...results.flatMap(({ address }) => DEV_PORTS.map((port) => `http://${address}:${port}`)),
];

const currentApiUrl = readEnvValue(FRONTEND_ENV, "VITE_API_URL");
const keepCustomApiUrl = currentApiUrl !== "" && !isManagedUrl(currentApiUrl);

const currentOrigins = readEnvValue(BACKEND_ENV, "FRONTEND_ORIGIN")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const customOrigins = currentOrigins.filter((origin) => !isManagedUrl(origin));
const mergedOrigins = [...new Set([...origins, ...customOrigins])];

const rootOrigins = readEnvValue(ROOT_ENV, "FRONTEND_ORIGIN")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rootCustomOrigins = rootOrigins.filter((origin) => !isManagedUrl(origin));
const mergedRootOrigins = [...new Set([...origins, ...rootCustomOrigins])];

const frontendUpdated = updateEnvFile(
  FRONTEND_ENV,
  keepCustomApiUrl ? {} : { VITE_API_URL: "" },
);
const backendUpdated = updateEnvFile(BACKEND_ENV, {
  FRONTEND_ORIGIN: mergedOrigins.join(","),
});
const rootUpdated = updateEnvFile(ROOT_ENV, {
  FRONTEND_ORIGIN: mergedRootOrigins.join(","),
});

if (results.length === 0) {
  console.log("[network] Khong tim thay IP LAN - chi dung duoc localhost.");
} else {
  console.log(`[network] IP noi bo: ${results.map((entry) => `${entry.address} (${entry.name})`).join(", ")}`);
}

if (!frontendUpdated) {
  console.log("[network] CANH BAO: chua co frontend/.env - copy tu frontend/.env.example");
} else if (keepCustomApiUrl) {
  console.log(`[network] frontend/.env: giu nguyen VITE_API_URL=${currentApiUrl}`);
} else {
  console.log("[network] frontend/.env: VITE_API_URL= (tu dong theo host dang mo)");
}

if (backendUpdated) {
  console.log(`[network] backend-node/.env: FRONTEND_ORIGIN=${mergedOrigins.join(",")}`);
} else {
  console.log("[network] CANH BAO: chua co backend-node/.env - bo qua FRONTEND_ORIGIN");
}

if (rootUpdated) {
  console.log(`[network] .env (Docker): FRONTEND_ORIGIN=${mergedRootOrigins.join(",")}`);
} else {
  console.log("[network] CANH BAO: chua co .env goc - start-zflix.bat se tao tu .env.example");
}

const lanEntry = results.find((entry) => !/tailscale/i.test(entry.name)) || results[0];
if (lanEntry) {
  console.log(`[network] May khac trong mang mo: http://${lanEntry.address}:5173`);
  console.log("[network] Neu bi timeout, mo firewall tren may nay (PowerShell Admin):");
  console.log(
    '          netsh advfirewall firewall add rule name="Zflix 5173" dir=in action=allow protocol=TCP localport=5173',
  );
  console.log(
    '          netsh advfirewall firewall add rule name="Zflix 3000" dir=in action=allow protocol=TCP localport=3000',
  );
}
