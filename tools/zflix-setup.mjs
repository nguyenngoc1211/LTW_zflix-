#!/usr/bin/env node
// Bootstrap môi trường dev Zflix — không bắt buộc cài sẵn MySQL.
//
// Ba chế độ, tự chọn:
//   A. Có MySQL sẵn (XAMPP/Laragon/MySQL Server/PATH) -> dùng luôn
//   B. Không có gì                                    -> tải MariaDB portable
//                                                        vào .localdb/, chạy port 3307
//   C. --db-url <url>                                 -> nối DB dùng chung (cloud)
//
// Cách dùng:
//   setup-zflix.bat                                           # tự chọn A hoặc B
//   setup-zflix.bat --embedded                                # ép dùng MariaDB portable
//   setup-zflix.bat --db-url "mysql://user:pass@host:3306/db"  # DB dùng chung
//   setup-zflix.bat --force                                   # XOÁ schema, nạp lại (MẤT DỮ LIỆU)
//   setup-zflix.bat --skip-install                            # bỏ qua npm install
//
// AN TOÀN: với --db-url (DB dùng chung), script KHÔNG BAO GIỜ tự chạy init.sql
// (32 câu DROP TABLE) trừ khi bạn gõ đúng tên database để xác nhận.

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB_NAME = "movie_streaming_db";
const SQL_DIR = path.join(ROOT, "database");
const LOCALDB_DIR = path.join(ROOT, ".localdb");
const EMBEDDED_PORT = 3307;

// MariaDB portable winx64 ~86MB: giải nén là chạy, không cần quyền admin.
const MARIA_VERSION = "10.11.10";
const MARIA_ZIP_URL = `https://archive.mariadb.org/mariadb-${MARIA_VERSION}/winx64-packages/mariadb-${MARIA_VERSION}-winx64.zip`;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const flagValue = (name, fallback = null) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const next = args[index + 1];
  return next === undefined || next.startsWith("--") ? "" : next;
};

const FORCE = hasFlag("--force");
const SKIP_INSTALL = hasFlag("--skip-install");
const NON_INTERACTIVE = hasFlag("--yes");
const FORCE_EMBEDDED = hasFlag("--embedded");
const DB_URL_FLAG = flagValue("--db-url", null);
const DB_NAME = flagValue("--db-name", DEFAULT_DB_NAME);
const DB_USER = flagValue("--db-user", "root");

// ---------------------------------------------------------------- tiện ích in
const ok = (message) => console.log(`  \x1b[32mOK\x1b[0m    ${message}`);
const warn = (message) => console.log(`  \x1b[33mCANH BAO\x1b[0m ${message}`);
const fail = (message) => console.log(`  \x1b[31mLOI\x1b[0m   ${message}`);
const step = (index, total, title) => console.log(`\n[${index}/${total}] ${title}`);
const die = (message, hint) => {
  fail(message);
  if (hint) console.log(`         ${hint}`);
  process.exit(1);
};

const ask = (question, { hidden = false } = {}) => {
  if (NON_INTERACTIVE) return Promise.resolve("");
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!hidden) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }
    // Ẩn ký tự khi nhập mật khẩu
    const onData = (char) => {
      if (char.toString() === "\n" || char.toString() === "\r" || char.toString() === "\u0004") return;
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(question + "*".repeat(rl.line.length));
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
  });
};

const run = (command, commandArgs, options = {}) => {
  // Trên Windows, npm/npx là file .cmd nên phải chạy qua shell mới spawn được.
  const needsShell = process.platform === "win32" && /^(npm|npx|yarn|pnpm)$/i.test(command);
  const result = spawnSync(command, commandArgs, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    cwd: options.cwd || ROOT,
    shell: needsShell,
    encoding: "utf8",
    env: options.env || process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error,
  };
};

const which = (name) => {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = run(finder, [name], { capture: true });
  if (result.status !== 0 || !result.stdout.trim()) return null;
  return result.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || null;
};

// ------------------------------------------------------------------- 1. MySQL
const MYSQL_CANDIDATES = [
  "C:\\xampp\\mysql\\bin\\mysql.exe",
  "C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysql.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe",
  "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe",
  "/usr/bin/mysql",
  "/usr/local/bin/mysql",
  "/opt/homebrew/bin/mysql",
];

const findMysql = () => {
  const onPath = which("mysql") || which("mysql.exe");
  if (onPath) return onPath;
  for (const candidate of MYSQL_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

// ------------------------------------------------ MariaDB portable (chế độ B)
// Tải zip ~86MB về .localdb/, giải nén, chạy mysqld trên port riêng.
// Không cần quyền admin, không đụng MySQL nào khác trên máy.

const embeddedPaths = () => {
  const base = path.join(LOCALDB_DIR, `mariadb-${MARIA_VERSION}-winx64`);
  return {
    base,
    bin: path.join(base, "bin"),
    mysql: path.join(base, "bin", "mysql.exe"),
    mysqld: path.join(base, "bin", "mysqld.exe"),
    installDb: path.join(base, "bin", "mysql_install_db.exe"),
    data: path.join(LOCALDB_DIR, "data"),
    ini: path.join(LOCALDB_DIR, "my.ini"),
    marker: path.join(LOCALDB_DIR, ".ready"),
  };
};

const embeddedReady = () => {
  const p = embeddedPaths();
  return fs.existsSync(p.mysqld) && fs.existsSync(p.data) && fs.existsSync(p.mysql);
};

const downloadFile = (url, target) => {
  // Node 22 có fetch global; tải theo stream để không nạp 86MB vào RAM.
  return new Promise((resolve, reject) => {
    const script = `
      const { createWriteStream } = require('node:fs');
      const { pipeline } = require('node:stream/promises');
      const { Readable } = require('node:stream');
      (async () => {
        const res = await fetch(${JSON.stringify(url)});
        if (!res.ok) throw new Error('HTTP ' + res.status);
        await pipeline(Readable.fromWeb(res.body), createWriteStream(${JSON.stringify(target)}));
      })().catch((e) => { console.error(e.message); process.exit(1); });
    `;
    const child = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let lastPct = -1;
    const started = Date.now();
    const timer = setInterval(() => {
      if (!fs.existsSync(target)) return;
      const mb = fs.statSync(target).size / (1024 * 1024);
      const pct = Math.floor((mb / 86) * 100);
      if (pct !== lastPct && pct % 10 === 0) {
        lastPct = pct;
        process.stdout.write(`         ... ${pct}% (${mb.toFixed(1)} MB)\n`);
      }
    }, 1000);
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => {
      clearInterval(timer);
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      if (code === 0 && fs.existsSync(target) && fs.statSync(target).size > 1_000_000) {
        resolve(secs);
      } else {
        reject(new Error(stderr.trim() || `tai that bai (exit ${code})`));
      }
    });
  });
};

const unzip = (zipPath, destDir) => {
  if (process.platform === "win32") {
    const result = run("powershell", [
      "-NoProfile", "-Command",
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`,
    ], { capture: true });
    return result.status === 0;
  }
  const result = run("unzip", ["-o", "-q", zipPath, "-d", destDir], { capture: true });
  return result.status === 0;
};

const installEmbedded = async () => {
  if (process.platform !== "win32") {
    return { ok: false, reason: "platform" };
  }
  const p = embeddedPaths();
  fs.mkdirSync(LOCALDB_DIR, { recursive: true });

  if (embeddedReady()) return { ok: true, cached: true };

  console.log(`         Tai MariaDB ${MARIA_VERSION} portable (~86 MB, chi lan dau)...`);
  const zipPath = path.join(LOCALDB_DIR, "mariadb.zip");
  try {
    const secs = await downloadFile(MARIA_ZIP_URL, zipPath);
    ok(`da tai xong (${secs}s)`);
  } catch (error) {
    fs.rmSync(zipPath, { force: true });
    return { ok: false, reason: "download", detail: error.message };
  }

  console.log("         Giai nen...");
  if (!unzip(zipPath, LOCALDB_DIR)) {
    return { ok: false, reason: "unzip" };
  }
  fs.rmSync(zipPath, { force: true });

  if (!fs.existsSync(p.mysql)) {
    return { ok: false, reason: "layout", detail: `khong thay ${p.mysql}` };
  }

  console.log("         Khoi tao data dir...");
  const init = run(p.installDb, [`--datadir=${p.data}`, "--password="], { capture: true });
  if (!fs.existsSync(p.data)) {
    return { ok: false, reason: "init", detail: (init.stderr || init.stdout || "").slice(0, 200) };
  }

  // my.ini riêng: port 3307 + utf8mb4 để không đụng MySQL khác trên máy.
  fs.writeFileSync(p.ini, [
    "[mysqld]",
    `datadir=${p.data.replace(/\\/g, "/")}`,
    `port=${EMBEDDED_PORT}`,
    "bind-address=127.0.0.1",
    "character-set-server=utf8mb4",
    "collation-server=utf8mb4_unicode_ci",
    "skip-name-resolve",
    "",
  ].join("\n"), "utf8");

  fs.writeFileSync(p.marker, new Date().toISOString(), "utf8");
  return { ok: true, cached: false };
};

const embeddedRunning = () => {
  const netstat = run("netstat", ["-ano"], { capture: true });
  return new RegExp(`:${EMBEDDED_PORT}\\s.*LISTENING`, "i").test(netstat.stdout || "");
};

const startEmbedded = () => {
  const p = embeddedPaths();
  if (embeddedRunning()) return { ok: true, alreadyRunning: true };

  const child = spawn(p.mysqld, [`--defaults-file=${p.ini}`], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  // Chờ tối đa 30s cho port mở
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (embeddedRunning()) return { ok: true, alreadyRunning: false };
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},1000)"]);
  }
  return { ok: false };
};


// Thông tin kết nối hiện hành — được set ở bước 1/2 tuỳ chế độ (local / embedded / remote).
const CONN = {
  host: "127.0.0.1",
  port: 3306,
  user: DB_USER,
  password: "",
  database: DB_NAME,
  mode: "local", // local | embedded | remote
};

const connArgs = () => [
  "-u", CONN.user,
  `--password=${CONN.password}`,
  "-h", CONN.host,
  "-P", String(CONN.port),
  "--default-character-set=utf8mb4",
];

const mysqlQuery = (mysqlExe, sql, database = null) => {
  if (!mysqlExe) {
    return { status: 1, stdout: "", stderr: "ERROR: khong co mysql client" };
  }
  const queryArgs = [...connArgs(), "--batch"];
  if (database) queryArgs.push(database);
  queryArgs.push("-e", sql);
  return run(mysqlExe, queryArgs, { capture: true });
};

// init.sql là dump từ MySQL 8.0 nên có `utf8mb4_0900_ai_ci` (collation chỉ MySQL 8 có).
// MariaDB 10.4/10.5 không biết collation này và sẽ lỗi 1273 -> phải thay trước khi import.
const COLLATION_FIXES = [
  ["utf8mb4_0900_ai_ci", "utf8mb4_unicode_ci"],
  ["utf8mb4_0900_as_cs", "utf8mb4_unicode_ci"],
];

const mysqlSourceFile = (mysqlExe, file, database) => {
  if (!mysqlExe) {
    return { status: 1, stdout: "", stderr: "ERROR: khong co mysql client", patched: false };
  }
  // `source` là lệnh client nên xử lý được DELIMITER ;; trong dump.
  let sql = fs.readFileSync(file, "utf8");
  const original = sql;
  for (const [from, to] of COLLATION_FIXES) sql = sql.split(from).join(to);
  const patched = sql !== original;

  // File tạm nằm ngoài repo để không làm bẩn git status.
  const tempFile = path.join(
    os.tmpdir(),
    `zflix-setup-${process.pid}-${path.basename(file)}`,
  );
  fs.writeFileSync(tempFile, sql, "utf8");

  const queryArgs = [...connArgs(), database, "-e", `source ${tempFile.replace(/\\/g, "/")}`];

  let result;
  try {
    result = run(mysqlExe, queryArgs, { capture: true });
  } finally {
    fs.rmSync(tempFile, { force: true });
  }

  // `mysql -e source` trả 0 dù có lỗi bên trong -> phải soi stderr
  const hadError = /ERROR \d+/i.test(result.stderr || "");
  return {
    status: hadError ? 1 : result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    patched,
  };
};

// ---------------------------------------------------------------- 2. env files
// Chỉ sinh secret cho biến mà code THỰC SỰ đọc: JWT_ACCESS_SECRET
// (security.config.js) và VIDEO_WEBHOOK_SECRET (app.js verifyVideoWebhook).
const generateEnvFiles = () => {
  const files = [
    {
      source: path.join(ROOT, "backend-node", ".env.example"),
      target: path.join(ROOT, "backend-node", ".env"),
      secrets: ["JWT_ACCESS_SECRET", "VIDEO_WEBHOOK_SECRET"],
    },
    {
      source: path.join(ROOT, "backend-python", "video-processor", ".env.example"),
      target: path.join(ROOT, "backend-python", "video-processor", ".env"),
      secrets: ["VIDEO_WEBHOOK_SECRET"],
    },
    {
      source: path.join(ROOT, "frontend", ".env.example"),
      target: path.join(ROOT, "frontend", ".env"),
      secrets: [],
    },
  ];

  const shared = {
    jwt: randomBytes(48).toString("base64url"),
    webhook: randomBytes(32).toString("hex"),
  };

  const created = [];
  const skipped = [];

  for (const entry of files) {
    if (!fs.existsSync(entry.source)) {
      warn(`thiếu template ${path.relative(ROOT, entry.source)} - bỏ qua`);
      continue;
    }
    // KHÔNG dùng --force ở đây: --force nghĩa là "xoá database", không phải
    // "xoá .env". Ghi đè .env sẽ làm mất secret thật của người dùng.
    // Muốn ghi đè .env phải dùng --force-env (rõ ràng, có sao lưu).
    if (fs.existsSync(entry.target)) {
      skipped.push(path.relative(ROOT, entry.target));
      continue;
    }

    let content = fs.readFileSync(entry.source, "utf8");
    for (const key of entry.secrets) {
      const value = key === "VIDEO_WEBHOOK_SECRET" ? shared.webhook : shared.jwt;
      const pattern = new RegExp(`^${key}=.*$`, "m");
      content = pattern.test(content)
        ? content.replace(pattern, `${key}=${value}`)
        : `${content.trimEnd()}\n${key}=${value}\n`;
    }
    fs.writeFileSync(entry.target, content, "utf8");
    created.push(path.relative(ROOT, entry.target));
  }

  return { created, skipped };
};

// ------------------------------------------------------------------ main flow
const TOTAL_STEPS = 5;

const parseDbUrl = (raw) => {
  try {
    const url = new URL(raw);
    if (!["mysql:", "mysql2:"].includes(url.protocol)) return null;
    return {
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username) || "root",
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, "") || DEFAULT_DB_NAME,
    };
  } catch {
    return null;
  }
};

// Xác nhận trước khi động vào DB dùng chung — vì init.sql có 32 câu DROP TABLE.
const confirmRemoteReset = async (database) => {
  if (NON_INTERACTIVE) return false;
  warn("DB dung chung: KHONG tu dong nap lai schema (se xoa du lieu cua ca nhom).");
  console.log(`         Neu chac chan muon XOA SACH va nap lai, go dung ten database:`);
  console.log(`             ${database}`);
  const answer = await ask("         Nhap ten database de xac nhan (Enter de bo qua): ");
  return answer.trim() === database;
};

const main = async () => {
  console.log("==============================================");
  console.log("       ZFLIX - CAI DAT MOI TRUONG DEV");
  console.log("==============================================");

  let mysqlExe = null;
  let isRemote = false;
  let embeddedStarted = false;

  // -- 1. Xác định chế độ ---------------------------------------------------
  step(1, TOTAL_STEPS, "Xac dinh nguon database...");

  if (DB_URL_FLAG) {
    // Chế độ C: DB dùng chung
    const parsed = parseDbUrl(DB_URL_FLAG);
    if (!parsed) {
      die("--db-url khong hop le", 'Dang dung: mysql://user:password@host:3306/database');
    }
    Object.assign(CONN, parsed, { mode: "remote" });
    isRemote = true;
    ok(`DB dung chung: ${parsed.user}@${parsed.host}:${parsed.port}/${parsed.database}`);

    // Vẫn cần mysql client để import schema / chạy migrate. Nếu máy không có
    // MySQL thì dùng client từ MariaDB portable (chỉ lấy mysql.exe, không bật server).
    mysqlExe = findMysql();
    if (mysqlExe) {
      ok(`mysql client: ${mysqlExe}`);
    } else {
      console.log("         Khong co mysql client - dung client tu MariaDB portable...");
      const install = await installEmbedded();
      if (!install.ok) {
        die(
          "Can mysql client de nap schema nhung khong cai duoc",
          "Cai MySQL client: " + (process.platform === "win32"
            ? "winget install MariaDB.Server"
            : "brew install mariadb / sudo apt install mariadb-client"),
        );
      }
      mysqlExe = embeddedPaths().mysql;
      ok("mysql client tu .localdb/ (server khong chay)");
    }
  }

  if (FORCE_EMBEDDED && isRemote) {
    die("--embedded va --db-url khong dung cung luc");
  }

  if (!isRemote && FORCE_EMBEDDED) {
    // Chế độ B (ép)
    console.log("         --embedded: dung MariaDB portable");
    const install = await installEmbedded();
    if (!install.ok) {
      die(
        install.reason === "platform"
          ? "Che do --embedded chi ho tro Windows"
          : `Khong cai duoc MariaDB portable (${install.reason})${install.detail ? ": " + install.detail : ""}`,
        install.reason === "platform"
          ? "Tren macOS/Linux hay cai MySQL: brew install mariadb  /  sudo apt install mariadb-server"
          : "Kiem tra ket noi mang roi chay lai, hoac cai MySQL thu cong.",
      );
    }
    if (!install.cached) ok("da cai MariaDB portable vao .localdb/");
    mysqlExe = embeddedPaths().mysql;
    Object.assign(CONN, { host: "127.0.0.1", port: EMBEDDED_PORT, user: "root", password: "" });
    CONN.mode = "embedded";
  } else if (!isRemote) {
    // Chế độ A: MySQL có sẵn
    mysqlExe = findMysql();
    if (mysqlExe) {
      ok(mysqlExe);
    } else {
      console.log("         Khong thay MySQL tren may - chuyen sang MariaDB portable");
      const install = await installEmbedded();
      if (!install.ok) {
        die(
          install.reason === "platform"
            ? "Khong tim thay MySQL, va che do portable chi ho tro Windows"
            : `Khong tim thay MySQL, tai MariaDB portable that bai (${install.reason})${install.detail ? ": " + install.detail : ""}`,
          install.reason === "platform"
            ? "Cai MySQL: brew install mariadb  /  sudo apt install mariadb-server"
            : "Kiem tra mang, hoac cai MySQL thu cong: " + (SYSTEM_INSTALL_HINT[process.platform] || "xem docs/SETUP_TEAM.md"),
        );
      }
      if (!install.cached) ok("da cai MariaDB portable vao .localdb/");
      mysqlExe = embeddedPaths().mysql;
      Object.assign(CONN, { host: "127.0.0.1", port: EMBEDDED_PORT, user: "root", password: "" });
      CONN.mode = "embedded";
    }
  }

  // -- 2. Kết nối -----------------------------------------------------------
  step(2, TOTAL_STEPS, "Ket noi database...");

  if (CONN.mode === "embedded") {
    const started = startEmbedded();
    if (!started.ok) {
      die("MariaDB portable khong khoi dong duoc", "Xem log: .localdb/data/*.err");
    }
    embeddedStarted = true;
    ok(`MariaDB portable dang chay (port ${EMBEDDED_PORT})`);
  } else if (!isRemote) {
    let dbPassword = flagValue("--db-password", null);
    if (dbPassword === null) {
      if (!process.stdin.isTTY) {
        dbPassword = "";
      } else {
        dbPassword = await ask("Mat khau user 'root' cua MySQL (Enter neu khong co): ", { hidden: true });
      }
    }
    CONN.password = dbPassword.trim();
    CONN.port = Number(flagValue("--db-port", 3306));
  }

  let probe = mysqlQuery(mysqlExe, "SELECT VERSION() AS v");

  // MySQL có trên máy nhưng CHƯA CHẠY (XAMPP chưa bật) -> tự chuyển MariaDB portable,
  // thay vì bắt người dùng bật XAMPP. Không áp dụng cho --db-url (DB dùng chung).
  if (probe.status !== 0 && CONN.mode === "local" && !isRemote
      && /connect|refused|can't connect|2002|10061/i.test(probe.stderr || "")) {
    warn("MySQL co tren may nhung khong ket noi duoc - chuyen sang MariaDB portable");
    const install = await installEmbedded();
    if (!install.ok) {
      die(
        `Khong ket noi duoc MySQL, va cai MariaDB portable cung that bai (${install.reason})`,
        install.reason === "platform"
          ? "Bat MySQL thu cong roi chay lai: net start mysql"
          : "Kiem tra mang, hoac bat MySQL roi chay lai.",
      );
    }
    if (!install.cached) ok("da cai MariaDB portable vao .localdb/");
    mysqlExe = embeddedPaths().mysql;
    Object.assign(CONN, { host: "127.0.0.1", port: EMBEDDED_PORT, user: "root", password: "" });
    CONN.mode = "embedded";

    const started = startEmbedded();
    if (!started.ok) die("MariaDB portable khong khoi dong duoc", "Xem log: .localdb/data/*.err");
    embeddedStarted = true;
    ok(`MariaDB portable dang chay (port ${EMBEDDED_PORT})`);
    probe = mysqlQuery(mysqlExe, "SELECT VERSION() AS v");
  }

  if (probe.status !== 0) {
    if (CONN.mode === "embedded") {
      die(
        "Khong ket noi duoc MariaDB portable",
        "Thu xoa thu muc .localdb/ roi chay lai de cai sach.",
      );
    }
    if (/connect|refused|can't connect|2002/i.test(probe.stderr)) {
      die(
        "Khong ket noi duoc MySQL",
        "MySQL chua chay. Bat MySQL trong XAMPP Control Panel (hoac: net start mysql), hoac dung --embedded.",
      );
    }
    die(
      `Dang nhap that bai voi user '${CONN.user}'` + (CONN.password ? " va mat khau da nhap" : " khong mat khau"),
      "Kiem tra lai --db-url / --db-password, hoac --db-user <user khac>.",
    );
  }
  const version = (probe.stdout || "").split(/\r?\n/).filter((l) => l && !l.startsWith("v")).pop() || "?";
  ok(`MySQL ${version.trim()}`);

  // -- 3. Database + schema -------------------------------------------------
  step(3, TOTAL_STEPS, isRemote ? `Kiem tra database dung chung ${CONN.database}...` : `Tao database ${CONN.database} + nap schema...`);

  const dbExists = mysqlQuery(
    mysqlExe,
    `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${CONN.database}'`,
  );
  const exists = (dbExists.stdout || "").includes(CONN.database);

  // DB dùng chung: TUYỆT ĐỐI không tự DROP, phải xác nhận bằng cách gõ tên DB.
  let shouldImport = !exists || FORCE;
  if (isRemote) {
    if (!exists) {
      shouldImport = false;
      die(
        `Database '${CONN.database}' khong ton tai tren ${CONN.host}`,
        "Nho nguoi tao DB chay setup-zflix.bat truoc, hoac kiem tra lai --db-url.",
      );
    }
    if (FORCE) {
      const confirmed = await confirmRemoteReset(CONN.database);
      shouldImport = confirmed;
      if (!confirmed) {
        warn("khong xac nhan - giu nguyen du lieu dung chung");
      }
    } else {
      shouldImport = false;
    }
  }

  if (exists && !shouldImport) {
    warn(`database ${CONN.database} da ton tai - BO QUA nap schema (giu du lieu hien co).`);
    if (!isRemote) console.log("         Muon xoa va nap lai tu dau: --force  (SE MAT TOAN BO DU LIEU)");
  } else {
    if (exists && shouldImport) {
      warn(`XOA database ${CONN.database} cu`);
      const drop = mysqlQuery(mysqlExe, `DROP DATABASE \`${CONN.database}\``);
      if (drop.status !== 0) die(`Khong xoa duoc database cu: ${drop.stderr.trim()}`);
    }

    if (!exists) {
      const create = mysqlQuery(
        mysqlExe,
        `CREATE DATABASE \`${CONN.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
      if (create.status !== 0) die(`Khong tao duoc database: ${create.stderr.trim()}`);
      ok(`da tao ${CONN.database}`);
    }

    // init.sql: 32 bảng + seed + trigger + procedure
    const initFile = path.join(SQL_DIR, "init.sql");
    if (!fs.existsSync(initFile)) die(`thieu ${path.relative(ROOT, initFile)}`);
    const initResult = mysqlSourceFile(mysqlExe, initFile, CONN.database);
    if (initResult.patched) ok("da thay utf8mb4_0900_ai_ci -> utf8mb4_unicode_ci (MariaDB)");
    if (initResult.status !== 0) {
      const firstError = (initResult.stderr || "").split(/\r?\n/).find((l) => /ERROR \d+/i.test(l));
      die("import init.sql that bai", firstError || "Xem loi phia tren.");
    }
    ok("init.sql (32 bang + seed + trigger + procedure)");

    // migrate-visual-shopping.sql: 3 bảng visual mà init.sql không có
    const visualFile = path.join(SQL_DIR, "migrate-visual-shopping.sql");
    if (fs.existsSync(visualFile)) {
      const visualResult = mysqlSourceFile(mysqlExe, visualFile, CONN.database);
      if (visualResult.status !== 0) {
        warn(`migrate-visual-shopping.sql loi: ${visualResult.stderr.split(/\r?\n/)[0]}`);
      } else {
        ok("migrate-visual-shopping.sql (+3 bang: visual_products, visual_searches, affiliate_clicks)");
      }
    }
  }

  // Đếm bảng để xác nhận đủ 35
  const tableCount = mysqlQuery(
    mysqlExe,
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${CONN.database}'`,
  );
  const count = Number((tableCount.stdout || "").trim().split(/\r?\n/).pop());
  if (Number.isFinite(count)) {
    if (count >= 35) ok(`${count} bang`);
    else warn(`chi co ${count} bang (mong doi 35) - co the thieu migration`);
  }

  // URL cuối cùng dùng cho app (khớp chính xác host/port của chế độ đang chạy)
  const finalDbUrl = isRemote
    ? DB_URL_FLAG
    : `mysql://${CONN.user}:${encodeURIComponent(CONN.password)}@${CONN.host}:${CONN.port}/${CONN.database}`;

  // -- 4. Sinh .env ---------------------------------------------------------
  step(4, TOTAL_STEPS, "Sinh file .env...");
  // Chạy thử (--db-name khác mặc định) thì TUYỆT ĐỐI không đọc/ghi .env của máy,
  // để không bao giờ làm hỏng cấu hình thật.
  const isDryRun = DB_NAME !== DEFAULT_DB_NAME;
  let envResult = { created: [], skipped: [] };

  if (isDryRun) {
    warn(`--db-name ${DB_NAME}: che do thu nghiem - KHONG dung toi file .env nao`);
  } else {
    envResult = generateEnvFiles();
    for (const file of envResult.created) ok(`da tao ${file}`);
    for (const file of envResult.skipped) warn(`${file} da ton tai - giu nguyen`);

    const backendEnvPath = path.join(ROOT, "backend-node", ".env");
    if (fs.existsSync(backendEnvPath)) {
      const envContent = fs.readFileSync(backendEnvPath, "utf8");
      const currentUrl = (envContent.match(/^DATABASE_URL=(.*)$/m) || [])[1] || "";
      // Placeholder = chưa ai cấu hình gì -> ghi đè an toàn.
      const isPlaceholder = currentUrl.trim() === ""
        || /root@localhost|root:rootpassword|@db:3306/m.test(currentUrl);
      const currentNormalized = currentUrl.trim().replace(/^"|"$/g, "");
      // Quy tắc tuyệt đối: CHỈ ghi DATABASE_URL khi file .env vừa được tạo trong
      // lần chạy này (tức là template mới). Nếu .env đã tồn tại từ trước thì đó là
      // cấu hình thật của máy — KHÔNG suy đoán, phải có --force mới ghi đè.
      const fileWasJustCreated = envResult.created.includes(path.join("backend-node", ".env"));

      if (fileWasJustCreated) {
        const updated = envContent.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${finalDbUrl}`);
        if (updated !== envContent) {
          fs.writeFileSync(backendEnvPath, updated, "utf8");
          ok(`da ghi DATABASE_URL (${CONN.mode})`);
        }
      } else if (currentNormalized === finalDbUrl) {
        ok("DATABASE_URL da dung - khong doi");
      } else {
        // .env da ton tai tu truoc => cau hinh that cua may. KHONG BAO GIO tu ghi de.
        warn("backend-node/.env da ton tai - GIU NGUYEN DATABASE_URL cua ban");
        console.log(`         hien tai : ${currentNormalized.replace(/:[^:@/]*@/, ":***@")}`);
        console.log(`         yeu cau  : ${finalDbUrl.replace(/:[^:@/]*@/, ":***@")}`);
        console.log("         Muon doi: sua tay dong DATABASE_URL trong backend-node/.env");
      }
    }
  }

  // -- 5. npm install + prisma + migrate:auth + mật khẩu dev ----------------
  step(5, TOTAL_STEPS, "Cai dependency + Prisma + mat khau dev...");

  const hasBackendModules = fs.existsSync(path.join(ROOT, "backend-node", "node_modules"));
  if (SKIP_INSTALL) {
    warn("--skip-install: bo qua npm install");
  } else if (!hasBackendModules) {
    console.log("         npm install backend-node...");
    const install = run("npm", ["install", "--no-audit", "--no-fund"], { cwd: path.join(ROOT, "backend-node") });
    if (install.status !== 0) die("npm install backend-node that bai");
    ok("backend-node/node_modules");
  } else {
    ok("backend-node/node_modules da co");
  }

  const hasFrontendModules = fs.existsSync(path.join(ROOT, "frontend", "node_modules"));
  if (!SKIP_INSTALL && !hasFrontendModules) {
    console.log("         npm install frontend...");
    const install = run("npm", ["install", "--no-audit", "--no-fund"], { cwd: path.join(ROOT, "frontend") });
    if (install.status !== 0) warn("npm install frontend that bai - chay tay: cd frontend && npm install");
    else ok("frontend/node_modules");
  } else if (hasFrontendModules) {
    ok("frontend/node_modules da co");
  }

  if (hasBackendModules || !SKIP_INSTALL) {
    const prisma = run("npx", ["prisma", "generate"], { cwd: path.join(ROOT, "backend-node") });
    if (prisma.status !== 0) warn("prisma generate that bai - module quan ly phim se khong chay");
    else ok("Prisma Client");
  }

  // Cho script con trỏ đúng database (quan trọng khi test bằng --db-name)
  const childEnv = { ...process.env, DATABASE_URL: finalDbUrl };

  const migrate = run("node", ["scripts/migrate-auth.js"], {
    cwd: path.join(ROOT, "backend-node"),
    env: childEnv,
  });
  if (migrate.status !== 0) warn("migrate:auth that bai - dang nhap/MFA se loi");
  else ok("migrate:auth");

  const passwordScript = run("node", ["scripts/set-dev-password.js"], {
    cwd: path.join(ROOT, "backend-node"),
    env: childEnv,
  });

  console.log("\n==============================================");
  if (passwordScript.status === 0) {
    console.log("  CAI DAT XONG!");
  } else {
    console.log("  CAI DAT XONG (nhung chua dat duoc mat khau dev)");
    console.log("  Chay tay: cd backend-node && npm run db:password");
  }
  console.log("");
  if (CONN.mode === "embedded") {
    console.log(`  Database         : MariaDB portable (.localdb/, port ${EMBEDDED_PORT})`);
    console.log("                     start-zflix.bat se tu bat lai.");
  } else if (CONN.mode === "remote") {
    console.log(`  Database         : dung chung ${CONN.host}/${CONN.database}`);
  } else {
    console.log(`  Database         : MySQL san co (port ${CONN.port})`);
  }
  console.log("  Khoi dong server : start-zflix.bat");
  console.log("  Web              : http://localhost:5173");
  console.log("  Admin            : http://localhost:5173/admin-login");
  console.log("");
  console.log("  Tai khoan demo   : admin@moviehub.com / Zflix@2026");
  console.log("  (hoac chay: cd backend-node && npm run db:password -- --password MatKhauRieng)");
  console.log("==============================================");
};

main().catch((error) => {
  fail(error.message);
  process.exitCode = 1;
});
