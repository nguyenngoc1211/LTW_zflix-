#!/usr/bin/env node
// Bootstrap môi trường dev Zflix trên Windows (và macOS/Linux).
//
// Việc script làm, đúng thứ tự:
//   1. Tìm mysql.exe / mysqld.exe (PATH, XAMPP, Laragon, MySQL Server)
//   2. Sinh 3 file .env từ .env.example (JWT secret random, VIDEO_WEBHOOK_SECRET random)
//   3. Tạo database + import init.sql + migrate-visual-shopping.sql  -> đủ 35 bảng
//   4. npm run migrate:auth (thêm cột MFA + 3 bảng auth còn thiếu nếu có)
//   5. Đặt mật khẩu dev cho tài khoản seed
//
// Cách dùng:
//   node tools/zflix-setup.mjs                    # hỏi mật khẩu root MySQL
//   node tools/zflix-setup.mjs --db-password ""   # root không mật khẩu (XAMPP mặc định)
//   node tools/zflix-setup.mjs --force            # ghi đè database đã tồn tại
//   node tools/zflix-setup.mjs --skip-install     # không chạy npm install

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DB_NAME = "movie_streaming_db";
const SQL_DIR = path.join(ROOT, "database");

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

const mysqlQuery = (mysqlExe, password, sql, database = null) => {
  const queryArgs = ["-u", DB_USER, `--password=${password}`, "--default-character-set=utf8mb4", "--batch"];
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

const mysqlSourceFile = (mysqlExe, password, file, database) => {
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

  const queryArgs = [
    "-u", DB_USER, `--password=${password}`,
    "--default-character-set=utf8mb4",
    database,
    "-e", `source ${tempFile.replace(/\\/g, "/")}`,
  ];

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
    if (fs.existsSync(entry.target) && !FORCE) {
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

const main = async () => {
  console.log("==============================================");
  console.log("       ZFLIX - CAI DAT MOI TRUONG DEV");
  console.log("==============================================");

  // -- 1. Tìm MySQL ---------------------------------------------------------
  step(1, TOTAL_STEPS, "Tim MySQL client...");
  const mysqlExe = findMysql();
  if (!mysqlExe) {
    die(
      "Khong tim thay mysql.exe",
      "Cai XAMPP (https://www.apachefriends.org) hoac MySQL Server, roi them thu muc bin vao PATH.",
    );
  }
  ok(mysqlExe);

  // -- 2. Mật khẩu root -----------------------------------------------------
  step(2, TOTAL_STEPS, "Ket noi MySQL...");
  let dbPassword = flagValue("--db-password", null);
  if (dbPassword === null) {
    if (!process.stdin.isTTY) {
      // Chay tu CI / pipeline: khong hoi duoc -> mac dinh root khong mat khau.
      dbPassword = "";
    } else {
      dbPassword = await ask("Mat khau user 'root' cua MySQL (Enter neu khong co): ", { hidden: true });
    }
  }
  // XAMPP mặc định root không mật khẩu; prod-ish setup có thể có.
  dbPassword = dbPassword.trim();

  const probe = mysqlQuery(mysqlExe, dbPassword, "SELECT VERSION() AS v");
  if (probe.status !== 0) {
    if (/connect|refused|can't connect|2002/i.test(probe.stderr)) {
      die(
        "Khong ket noi duoc MySQL",
        "MySQL chua chay. Bat MySQL trong XAMPP Control Panel (hoac: net start mysql) roi chay lai.",
      );
    }
    die(
      "Dang nhap MySQL that bai voi user '" + DB_USER + "'" + (dbPassword ? " va mat khau da nhap" : " khong mat khau"),
      "Chay lai voi --db-password <mat khau dung>, hoac --db-user <user khac>.",
    );
  }
  const version = (probe.stdout || "").split(/\r?\n/).filter((l) => l && !l.startsWith("v")).pop() || "?";
  ok(`MySQL ${version.trim()}`);

  // -- 3. Database + schema -------------------------------------------------
  step(3, TOTAL_STEPS, `Tao database ${DB_NAME} + nap schema...`);

  const dbExists = mysqlQuery(
    mysqlExe,
    dbPassword,
    `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${DB_NAME}'`,
  );
  const exists = (dbExists.stdout || "").includes(DB_NAME);

  if (exists && !FORCE) {
    warn(`database ${DB_NAME} da ton tai - BO QUA buoc nap schema (giu du lieu hien co).`);
    console.log("         Muon xoa va nap lai tu dau: --force  (SE MAT TOAN BO DU LIEU)");
  } else {
    if (exists && FORCE) {
      warn(`--force: XOA database ${DB_NAME} cu`);
      const drop = mysqlQuery(mysqlExe, dbPassword, `DROP DATABASE \`${DB_NAME}\``);
      if (drop.status !== 0) die(`Khong xoa duoc database cu: ${drop.stderr.trim()}`);
    }

    const create = mysqlQuery(
      mysqlExe,
      dbPassword,
      `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    if (create.status !== 0) die(`Khong tao duoc database: ${create.stderr.trim()}`);
    ok(`da tao ${DB_NAME}`);

    // init.sql: 32 bảng + seed + trigger + procedure
    const initFile = path.join(SQL_DIR, "init.sql");
    if (!fs.existsSync(initFile)) die(`thieu ${path.relative(ROOT, initFile)}`);
    const initResult = mysqlSourceFile(mysqlExe, dbPassword, initFile, DB_NAME);
    if (initResult.patched) ok("da thay utf8mb4_0900_ai_ci -> utf8mb4_unicode_ci (MariaDB)");
    if (initResult.status !== 0) {
      const firstError = (initResult.stderr || "").split(/\r?\n/).find((l) => /ERROR \d+/i.test(l));
      die("import init.sql that bai", firstError || "Xem loi phia tren.");
    }
    ok("init.sql (32 bang + seed + trigger + procedure)");

    // migrate-visual-shopping.sql: 3 bảng visual mà init.sql không có
    const visualFile = path.join(SQL_DIR, "migrate-visual-shopping.sql");
    if (fs.existsSync(visualFile)) {
      const visualResult = mysqlSourceFile(mysqlExe, dbPassword, visualFile, DB_NAME);
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
    dbPassword,
    `SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${DB_NAME}'`,
  );
  const count = Number((tableCount.stdout || "").trim().split(/\r?\n/).pop());
  if (Number.isFinite(count)) {
    if (count >= 35) ok(`${count} bang`);
    else warn(`chi co ${count} bang (mong doi 35) - co the thieu migration`);
  }

  // -- 4. Sinh .env ---------------------------------------------------------
  step(4, TOTAL_STEPS, "Sinh file .env...");
  let envResult = { created: [], skipped: [] };
  if (DB_NAME !== DEFAULT_DB_NAME) {
    // Chạy thử với database tên khác thì KHÔNG đụng vào .env thật của máy.
    warn(`--db-name ${DB_NAME}: bo qua buoc sinh .env de khong ghi de cau hinh that`);
  } else {
    envResult = generateEnvFiles();
    for (const file of envResult.created) ok(`da tao ${file}`);
    for (const file of envResult.skipped) warn(`${file} da ton tai - giu nguyen`);
  }

  // Cập nhật DATABASE_URL trong backend-node/.env nếu vừa tạo và mật khẩu khác rỗng
  const backendEnvPath = path.join(ROOT, "backend-node", ".env");
  if (envResult.created.includes(path.join("backend-node", ".env")) && dbPassword) {
    const envContent = fs.readFileSync(backendEnvPath, "utf8");
    const updated = envContent.replace(
      /^DATABASE_URL=.*$/m,
      `DATABASE_URL=mysql://${DB_USER}:${encodeURIComponent(dbPassword)}@localhost:3306/${DB_NAME}`,
    );
    fs.writeFileSync(backendEnvPath, updated, "utf8");
    ok("da ghi mat khau MySQL vao DATABASE_URL");
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
  const childEnv = {
    ...process.env,
    DATABASE_URL: `mysql://${DB_USER}:${encodeURIComponent(dbPassword)}@localhost:3306/${DB_NAME}`,
  };

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
