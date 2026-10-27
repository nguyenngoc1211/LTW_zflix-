// Đặt mật khẩu dev cho các tài khoản seed trong database/init.sql.
//
// Vì sao cần: 44 user seed dùng chung một hash bcrypt không rõ plaintext, nên
// clone repo -> import DB -> không đăng nhập được (kể cả admin).
//
// Chỉ UPDATE cột password của các user local đã tồn tại; KHÔNG tạo user mới và
// KHÔNG đụng logic auth (bcrypt cost 12 khớp auth.service.js).
//
// Cách dùng:
//   node scripts/set-dev-password.js                    # admin@moviehub.com / Zflix@2026
//   node scripts/set-dev-password.js --password MyPass123
//   node scripts/set-dev-password.js --email a@b.c,admin@moviehub.com
//   node scripts/set-dev-password.js --include-users     # đặt cho mọi user provider='local'

import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: new URL("../../.env", import.meta.url), override: false });
const { pool } = await import("../src/core/database/pool.js");

const BCRYPT_COST = 12;
const DEFAULT_PASSWORD = "Zflix@2026";
const DEFAULT_EMAILS = ["admin@moviehub.com"];

const parseArgs = (argv) => {
  const args = { password: DEFAULT_PASSWORD, emails: DEFAULT_EMAILS, includeUsers: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--password") args.password = argv[++i] || "";
    else if (arg === "--email") {
      args.emails = (argv[++i] || "").split(",").map((e) => e.trim()).filter(Boolean);
    } else if (arg === "--include-users") args.includeUsers = true;
  }
  return args;
};

const main = async () => {
  const { password, emails, includeUsers } = parseArgs(process.argv.slice(2));

  if (!password || password.length > 128) {
    console.error("❌ Mật khẩu phải có 1..128 ký tự.");
    process.exitCode = 1;
    return;
  }

  const targetQuery = includeUsers
    ? "SELECT id, email FROM users WHERE provider = 'local'"
    : `SELECT id, email FROM users WHERE provider = 'local' AND email IN (${emails.map(() => "?").join(",")})`;

  const [users] = await pool.execute(targetQuery, includeUsers ? [] : emails);

  if (!users.length) {
    console.error("❌ Không tìm thấy user local nào khớp.");
    console.error("   Kiểm tra DATABASE_URL trong .env và đảm bảo đã import database/init.sql.");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const ids = users.map((u) => u.id);

  await pool.execute(
    `UPDATE users
        SET password = ?, password_changed_at = NOW(), failed_login_attempts = 0, locked_until = NULL
      WHERE id IN (${ids.map(() => "?").join(",")})`,
    [hash, ...ids],
  );

  console.log("");
  console.log("✅ Đã đặt mật khẩu dev cho:");
  for (const u of users) console.log(`   - ${u.email}`);
  console.log("");
  console.log(`   Mật khẩu: ${password}`);
  console.log("");
};

try {
  await main();
} catch (error) {
  console.error("❌ Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
