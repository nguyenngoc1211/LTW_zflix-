# Tiến độ bảo mật Authentication & Authorization

Ngày rà soát source và Git gần nhất: 2026-09-29  
Current branch: `Du`  
Current latest security commit: `2946c00`
Mốc source hiện tại: `2946c00 security: add session management phase 5A`
Current uncommitted security phase: `Phase 6 — security logging and cleanup`

Tài liệu này là bản ghi nhớ để các phiên Codex sau có thể tiếp tục công việc. Nội dung mô tả implementation hiện tại, không phải các API dự kiến. Nếu tài liệu khác source thì source code là technical truth.

## Current working tree expectation

Current expectation while Phase 6 is under review:

```text
git status -> Phase 6 security logger, auth event instrumentation, cleanup command/tests, config, and this document are modified/untracked
```

Do not overwrite or discard those changes. After an explicit future commit, the expected state returns to:

```text
git status -> clean
```

Mọi thay đổi khác ngoài scope trên vẫn phải dừng lại để kiểm tra. Không được ghi đè hoặc giả định các thay đổi dở dang trong working tree.

## Kiến trúc hiện tại

- **Login:** `POST /api/v1/auth/login` validate request, tìm local user active theo email đã chuẩn hóa, kiểm tra temporary lock và so sánh mật khẩu bằng bcrypt. User không bật MFA được cấp session như trước; user bật MFA chỉ nhận challenge ngắn hạn, chưa có session/access token/refresh cookie cho tới khi factor hợp lệ.
- **Logout:** `POST /api/v1/auth/logout` có Origin protection; revoke session tương ứng nếu có refresh token và luôn xóa refresh cookie.
- **Refresh token:** raw token được tạo bằng CSPRNG và chỉ tồn tại trong cookie client. `auth_sessions` chỉ lưu SHA-256 hash. Refresh rotation thay hash trong cùng session và từ chối token cũ bị dùng lại.
- **JWT:** access token dùng `HS256`, thời hạn mặc định 15 phút, có `sub` và `sid`. Claim role có thể tồn tại vì tương thích nhưng không được dùng làm nguồn phân quyền; verify allow-list rõ `HS256`.
- **`auth_sessions`:** session server-side lưu user ID, refresh-token hash, idle expiry, absolute expiry, last-used, revoked-at, created-at và metadata user-agent/IP tùy chọn. Cả access authentication và refresh đều phụ thuộc database session hiện tại.
- **Role:** `requireAuth` đọc lại user từ database và tạo `req.user`; `requireRole("admin")` dùng role lấy từ database. JWT role giả không thể nâng quyền.
- **Account status:** `active/disabled` được đọc từ database. User disabled không login, refresh hoặc tiếp tục dùng access token cũ. Temporary login lock cũng lưu trong database.
- **Frontend `AuthContext`:** bootstrap bằng refresh, giữ access token qua API service in-memory, cung cấp login/logout/logout-all/change-password và xóa user/token khi auth thất bại hoặc session bị revoke.
- **`ProtectedRoute`:** chỉ phục vụ UX điều hướng/render. Đây không phải security boundary; API protected/admin vẫn enforce ở backend.

## Git checkpoints

Các checkpoint auth/security theo thứ tự thời gian:

| Commit | Ngày | Checkpoint |
|---|---|---|
| `a2a84cf` | 2026-09-29 | `checkpoint: working auth flow before security hardening` |
| `feb1fc4` | 2026-09-29 | `security: harden auth phase 1A` |
| `32a6add` | 2026-09-29 | `security: harden account and session phase 1B` |
| `cd9a4a8` | 2026-09-29 | `test: strengthen authorization regression coverage` |
| `00de989` | 2026-09-29 | `security: implement password lifecycle hardening` |
| `c6357f2` | 2026-09-29 | `docs: add auth security project context` |
| `c61103d` | 2026-09-29 | `security: add MFA TOTP phase 4A` |
| `318f6dd` | 2026-09-29 | `security: add MFA management phase 4B` |
| `2946c00` | 2026-09-29 | `security: add session management phase 5A` |

Các checkpoint trên đều đã commit. Phase 6 hiện là thay đổi working tree chưa commit theo yêu cầu.

## Chi tiết từng phase

### Checkpoint auth cơ bản

- **Commit:** `a2a84cf`
- **Đã triển khai:** route login, refresh, logout, current user, admin check; database-backed sessions; React AuthContext; access token in-memory; ProtectedRoute; login UI và smoke test.
- **Schema/database:** đưa vào model/migration/bootstrap cho `auth_sessions`; migration utility chuyển legacy local plaintext password sang bcrypt và xóa password ở non-local account.
- **Security controls:** bcrypt, refresh token hash, HttpOnly cookie, access JWT ngắn hạn, server-side revoke và backend role enforcement.
- **Tests:** backend unit/auth, integration auth smoke và frontend auth UI smoke.
- **Rủi ro còn lại lúc đó:** thiếu security headers/origin defense, account lock/status, absolute session lifetime, logout-all và password recovery. Các phần này được xử lý ở phase sau.

### Phase 1A — hardening biên authentication

- **Commit:** `feb1fc4`
- **Đã triển khai:** security config tập trung, rate limit login/refresh, exact-origin protection cho cookie/state routes, Helmet, credentialed CORS giới hạn origin, JWT algorithm allow-list và production JWT-secret validation.
- **Schema/database:** không cần thay đổi schema.
- **Security controls:** chỉ chấp nhận `HS256`, từ chối production thiếu/yếu JWT secret, giới hạn frontend origin, giới hạn JSON body và throttling auth endpoint.
- **Tests:** login rate limit, Origin accept/reject, thuật toán JWT không hợp lệ, Helmet headers và lỗi secret production an toàn.
- **Rủi ro còn lại:** CSP tạm disabled để chờ policy tương thích streaming; account/session lifecycle chuyển sang Phase 1B.

### Phase 1B — hardening account và session

- **Commit:** `32a6add`
- **Đã triển khai:** failed-login tracking, lock 5 lần sai trong 5 phút mặc định, active/disabled status, absolute session expiry, logout-all và frontend helper.
- **Migration:** `backend-node/migrations/20260929_phase_1b_account_session_hardening.sql` thêm `users.failed_login_attempts`, `users.locked_until`, `users.status`, `users.disabled_at`, `users.password_changed_at` và `auth_sessions.absolute_expires_at`. Session cũ được backfill absolute expiry bằng expiry cũ, không tự gia hạn.
- **Security controls:** login đúng reset counter/lock; disabled user bị từ chối ở login, refresh và `requireAuth`; idle expiry không vượt absolute expiry bất biến; logout-all luôn dùng `req.user.id`.
- **Tests:** lock/recovery, reset attempts, disabled-user rejection, idle/absolute expiry, capped refresh rotation, revoke access/refresh nhiều session và auth/RBAC regression.
- **Rủi ro còn lại:** chưa có session-management UI và refresh-token family/history.

### Phase 2 — authorization regression hardening

- **Commit:** `cd9a4a8`
- **Đã triển khai:** regression cho role authoritative từ database, disabled user và toàn bộ route thật `/api/v1/admin/*`; không thêm abstraction/API giả chưa dùng.
- **Schema/database:** không thay đổi.
- **Security controls:** JWT hợp lệ có `role=admin` nhưng session thuộc DB user role `user` vẫn nhận `403`; disabled user không dùng credential cũ; admin route được kiểm tra đúng guest/user/admin.
- **Tests:** dynamic admin route coverage, guest `401` / user `403` / admin success; forged-role; disabled access-token/refresh/protected-route; giữ các auth regression cũ.
- **Rủi ro còn lại:** chưa thể test ownership, IDOR/BOLA, mass assignment khi chưa có resource API thật.

### Phase 3 — password lifecycle security

- **Commit:** `00de989`
- **Đã triển khai:** change-password có auth, forgot-password generic, reset-password, development/test delivery capture, token hash/expiry, one-time/concurrency safety, invalidate reset cũ và revoke mọi session sau change/reset.
- **Migration:** `backend-node/migrations/20260929_phase_3_password_reset.sql` tạo `password_reset_tokens` gồm `id`, `user_id`, unique `token_hash`, `created_at`, `expires_at`, `used_at`; index `user_id`, `expires_at`; foreign key cascade. `database/init.sql` có bảng tương ứng cho DB mới.
- **Security controls:** reset token CSPRNG 32 byte, chỉ lưu SHA-256 hash, TTL mặc định 30 phút, không trả/log/lưu raw token, một reset flow active/user, chỉ local active account, update token/password/session atomic và rate limit riêng.
- **Tests:** password validation/change, revoke access/refresh cũ, old/new password login, generic no-enumeration, không expose token, hash/TTL, invalidate nhiều request, reject reuse/expiry/random/malformed, revoke session và concurrent single-use.
- **Rủi ro còn lại:** production email provider chưa cấu hình; dev/test dùng in-memory capture; chưa có scheduled cleanup token hết hạn.

### Phase 4A — backend MFA/TOTP và login second step

- **Trạng thái:** đã commit tại `c61103d` và verify live trên MySQL dev.
- **Đã triển khai:** encrypted TOTP enrollment/confirmation, MFA login challenge, TOTP hoặc recovery-code verification, MFA disable và frontend login second step tối thiểu.
- **Migration:** `backend-node/migrations/20260929_phase_4a_mfa_totp.sql` thêm trạng thái/secret MFA vào `users`, bảng `auth_mfa_challenges` và `auth_mfa_recovery_codes`. `scripts/migrate-auth.js` và `database/init.sql` đã đồng bộ cho database hiện hữu và database mới.
- **Security controls:** TOTP secret AES-256-GCM; production bắt buộc key base64 32 byte riêng. Challenge và recovery code chỉ lưu SHA-256 hash; challenge TTL 5 phút, tối đa 5 lần thử, one-time; recovery code 128-bit và one-time. TOTP time step cuối được cập nhật atomic để chặn replay.
- **Session boundary:** password đúng với user bật MFA chỉ trả HTTP 202 challenge. Chỉ `/mfa/verify` thành công mới tạo `auth_sessions`, access JWT và refresh cookie.
- **Lifecycle:** password reset giữ nguyên MFA; disabled user bị từ chối; enable/disable MFA revoke toàn bộ session; disable cần current password và TOTP/recovery code.
- **Tests:** backend unit `13/13`, schema-consistency, full backend integration trên MySQL thật, frontend lint/build, full auth UI smoke và focused MFA browser smoke đều pass. Integration live bao phủ enrollment/enable, không cấp credential trước factor, TOTP đúng/sai/replay, challenge expiry/attempt cap/one-time, recovery code one-time, disabled user, password-reset preservation, MFA disable và session revocation.
- **Live migration verification:** `npm run migrate:auth` đã chạy thành công trong backend container trên MySQL dev; live schema có đủ 6 cột MFA ở `users`, 2 bảng MFA và `auth_sessions.absolute_expires_at` là `NOT NULL`.
- **Verification fix:** sửa biểu thức consume challenge để MySQL đánh dấu used đúng ở lần sai thứ 5, không phải lần thứ 4; toàn bộ integration được chạy lại và pass.

### Phase 4B — MFA management UI

- **Trạng thái:** đã commit tại `318f6dd` và verify live trên MySQL dev.
- **Backend:** thêm `GET /api/v1/auth/mfa/status` với safe projection và `POST /api/v1/auth/mfa/recovery-codes/regenerate`. Cả hai lấy identity từ `req.user.id`; regeneration yêu cầu current password + TOTP, dùng rate limit hiện hữu, chặn replay TOTP, xóa toàn bộ code cũ và chỉ lưu hash của code mới.
- **Frontend:** thêm protected route `/account/security`, link Security nhỏ trong navigation hiện hữu, QR provisioning bằng `qrcode.react`, xác nhận enrollment, recovery-code acknowledgement/copy, regeneration và disable. Provisioning URI, TOTP secret và raw recovery codes chỉ ở component memory, không vào browser storage.
- **Session behavior:** enable và disable tiếp tục revoke toàn bộ session; UI giữ recovery codes sau enable đủ lâu để user lưu rồi xóa auth state và chuyển về `/login`. Regeneration không đổi TOTP secret và không revoke session; endpoint bắt buộc strong reauthentication.
- **Tests:** backend unit `13/13`, full integration live trên MySQL, frontend lint/build, auth UI smoke, MFA login smoke và MFA management smoke đều pass. Coverage mới gồm status disabled/enabled/safe projection, guest rejection, regeneration wrong password/TOTP, invalidation code cũ, code mới one-time, disabled-user rejection, QR/setup error/success, recovery codes memory-only và disable sign-out.
- **MFA work còn lại ngoài scope:** trusted/remembered devices, SMS/email OTP và passkeys/WebAuthn chưa triển khai.

### Phase 5A — session and device management

- **Trạng thái:** đã commit tại `2946c00` và verify live trên MySQL dev; không cần migration vì `auth_sessions` đã có đủ metadata.
- **Backend:** thêm `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/:sessionId` và `POST /api/v1/auth/logout-others`. Identity luôn lấy từ `req.user.id`; current session lấy từ `req.auth.sessionId`; không nhận hoặc tin `userId` từ body/query.
- **List policy:** chỉ trả session chưa revoke, chưa idle-expired và chưa absolute-expired. Safe projection gồm ID, created/last-used/idle-expiry/absolute-expiry, user-agent, IP và cờ current; tuyệt đối không trả refresh-token hash hoặc token/secret.
- **Ownership/revocation:** per-session revoke dùng atomic `UPDATE ... WHERE id = ? AND user_id = ?`; foreign session trả `404`, session của chính user đã revoke trả idempotent `204`. Revoke current session xóa refresh cookie. Logout-others revoke mọi session khác nhưng giữ current; logout-all giữ nguyên hành vi revoke toàn bộ.
- **Frontend:** mở rộng `/account/security` với danh sách Active sessions, current badge, raw user-agent/IP, thời gian tạo/refresh/expiry, revoke từng session khác, logout others và logout all. Không thêm fingerprinting hoặc geo-IP.
- **Last-used semantics:** `lastUsedAt` là lần refresh session gần nhất được auth system ghi nhận, không phải request HTTP gần nhất.
- **Tests:** backend unit `13/13`, full backend integration live trên MySQL, frontend lint/build và toàn bộ auth/MFA/session browser smoke đều pass. IDOR coverage xác nhận User A không list/revoke session User B, body/query `userId` bị bỏ qua và session User B vẫn hợp lệ sau tấn công.
- **Rủi ro còn lại:** user-agent/IP là metadata quan sát được, không phải device identity đáng tin; chưa có refresh-token family/history, multi-tab auth sync hoặc scheduled cleanup session cũ.

### Phase 6 — security logging và cleanup

- **Trạng thái:** đã triển khai và verify, chưa commit; không thêm bảng hoặc migration.
- **Structured logger:** `securityLog(event, metadata)` phát một JSON line với timestamp và allow-list field gồm user/session/target-session ID, IP, user-agent, reason, factor và revoked count. User-agent giới hạn 255 ký tự, IP giới hạn 45 ký tự; lỗi log sink không làm thay đổi auth flow.
- **Events:** login success/failure, account locked/disabled attempt, refresh success/failure, logout/logout-all/logout-others, session revoke success/failure, password change/reset request/reset success/failure, MFA setup/enable/verify failure/login success/recovery use/regeneration/disable, access denied và admin access denied.
- **Fields cố ý loại trừ:** password mọi loại, access/refresh token và hash, Authorization/Cookie header, reset token/hash, TOTP secret/ciphertext/code, recovery code/hash, MFA challenge token/hash, JWT secret và MFA encryption key. Unknown-account login/reset request không tạo giả user ID và không log email.
- **Cleanup targets:** session revoked/idle-expired/absolute-expired đủ cũ; reset token used/expired đủ cũ; MFA challenge consumed/expired đủ cũ; recovery code đã dùng đủ cũ. Active session, valid reset token, active MFA challenge và unused recovery code luôn được giữ. Pending MFA setup nằm trên `users` nhưng không có timestamp an toàn nên Phase 6 không tự xóa.
- **Retention mặc định:** session `30` ngày, reset token `7` ngày, MFA challenge `1` ngày, used recovery code `30` ngày; cấu hình qua `AUTH_SESSION_RETENTION_DAYS`, `PASSWORD_RESET_RETENTION_DAYS`, `MFA_CHALLENGE_RETENTION_DAYS`, `USED_RECOVERY_CODE_RETENTION_DAYS`.
- **Run mode:** `npm run cleanup:auth` chạy thủ công, dùng transaction và chỉ in JSON count; chưa tự chạy ở startup. Production có thể schedule lệnh này bằng cron/container scheduler sau.
- **Tests:** backend unit `14/14`; full auth/password/MFA integration live MySQL pass; cleanup integration xóa đúng 3 session cũ, 2 reset token, 2 MFA challenge, 1 used recovery code và giữ toàn bộ record active/recent; frontend lint/build và toàn bộ UI smoke pass. Integration cũng kiểm tra event bắt buộc và credential thực không xuất hiện trong log.
- **Rủi ro vận hành còn lại:** chưa có external log transport/SIEM, alerting, scheduler deployment, refresh-token family/history để phân biệt replay với token ngẫu nhiên, hoặc chính sách archive/audit bất biến.

## Security controls hiện có

- Password dùng bcrypt cost `12`; không dùng SHA-256 để hash password.
- Password mới dài 8–128 ký tự; không trim và không bắt buộc composition.
- Rate limit: login `10/15 phút`, forgot `5/15 phút`, reset `10/15 phút`, refresh `120/15 phút`.
- Sai password 5 lần khóa tạm 5 phút; login đúng reset counter.
- User status `active/disabled` được kiểm tra từ database ở login, refresh và mọi `requireAuth`.
- JWT verify allow-list `HS256`; production từ chối secret thiếu/yếu.
- Frontend giữ access token trong memory module, không dùng localStorage/sessionStorage.
- Raw refresh token chỉ nằm trong HttpOnly SameSite=Lax cookie, Secure ở production, path `/api/v1/auth`.
- Database chỉ lưu SHA-256 hash của refresh token.
- Refresh rotation mỗi lần thành công; token cũ bị reject khi replay.
- Session DB được kiểm tra tồn tại, revoked, idle expiry, absolute expiry, khớp subject/session, user active và role database.
- Idle TTL mặc định 7 ngày, absolute TTL 30 ngày; refresh chỉ gia hạn idle tới absolute expiry ban đầu.
- Logout-all revoke tất cả session active của `req.user.id` và clear cookie.
- Origin protection exact match cho auth cookie/state routes.
- CORS chỉ cho frontend origin cấu hình với credentials; không tin origin tùy ý.
- Helmet bật; CSP hiện disabled vì chưa có policy tương thích streaming.
- Backend dùng role từ database; JWT/frontend role không authoritative.
- Change password cần current password, không cho password mới giống cũ, cập nhật `password_changed_at` và revoke mọi session.
- Forgot response giống nhau cho account tồn tại, không tồn tại và non-local.
- Reset token 32 random bytes, chỉ lưu SHA-256 hash, TTL 30 phút, one-time và claim trong transaction.
- Reset thành công update bcrypt password, invalidate token khác và revoke mọi session atomic.
- Không chủ động log password, raw refresh/reset token, Authorization header hoặc Cookie header.
- TOTP secret chỉ lưu ciphertext AES-256-GCM cùng IV/tag; raw secret chỉ trả ở bước setup với `Cache-Control: no-store`.
- MFA challenge và recovery code không lưu raw value; challenge có TTL/attempt cap/one-time consumption.
- Không tạo auth session, access token hoặc refresh cookie trước khi MFA login challenge thành công.
- TOTP time step đã dùng không được chấp nhận lại; recovery code chỉ dùng một lần.

## Real APIs hiện đang tồn tại

Chỉ liệt kê route thực sự có trong source.

### Node backend

| Method | Route | Policy hiện tại |
|---|---|---|
| GET | `/` | Public health |
| POST | `/api/v1/auth/login` | Public; validation, rate limit, local/active policy, lock tracking |
| POST | `/api/v1/auth/mfa/setup` | `requireAuth`; Origin; current-password reauthentication; trả enrollment secret/URI một lần |
| GET | `/api/v1/auth/mfa/status` | `requireAuth`; chỉ trả enabled, enabledAt và số recovery code còn lại |
| POST | `/api/v1/auth/mfa/enable` | `requireAuth`; Origin; xác minh TOTP; tạo recovery codes; revoke sessions |
| POST | `/api/v1/auth/mfa/verify` | Origin; rate limit; challenge one-time; chỉ endpoint này hoàn tất MFA login và cấp session |
| POST | `/api/v1/auth/mfa/disable` | `requireAuth`; Origin; current password + TOTP/recovery; revoke sessions |
| POST | `/api/v1/auth/mfa/recovery-codes/regenerate` | `requireAuth`; Origin; rate limit; current password + TOTP; thay toàn bộ recovery codes |
| POST | `/api/v1/auth/refresh-token` | Cookie endpoint; Origin, rate limit, session/status/expiry checks |
| POST | `/api/v1/auth/change-password` | `requireAuth`; user lấy từ `req.user.id`; Origin check |
| POST | `/api/v1/auth/forgot-password` | Public; generic response, validation, rate limit |
| POST | `/api/v1/auth/reset-password` | Public; generic invalid-token response, validation, rate limit |
| POST | `/api/v1/auth/logout` | Origin check; revoke matching session và clear cookie |
| GET | `/api/v1/auth/sessions` | `requireAuth`; active-only safe projection của `req.user.id`; current theo `req.auth.sessionId` |
| DELETE | `/api/v1/auth/sessions/:sessionId` | `requireAuth`; Origin; atomic ownership constraint; current revoke clear cookie |
| POST | `/api/v1/auth/logout-others` | `requireAuth`; Origin; revoke mọi session khác của current user |
| POST | `/api/v1/auth/logout-all` | `requireAuth`; revoke session của `req.user.id`; Origin check |
| GET | `/api/v1/auth/me` | `requireAuth`; safe user projection |
| GET | `/api/v1/admin/check` | `requireAuth` + `requireRole("admin")` |

### Python services

| Service | Method | Route | Policy |
|---|---|---|---|
| AI chatbot | GET | `/` | Public health |
| Video processor | GET | `/` | Public health |

Python services hiện không expose user resource, premium, subscription, moderation hay admin CRUD API.

## Modules chưa triển khai

Các khái niệm có thể xuất hiện trong schema/frontend nhưng chưa có backend API thật:

- Profile update/delete
- Favorites/bookmarks
- Watch history
- Comments/comment likes
- Ratings/reviews
- Watching party, participant, chat, host management
- Premium entitlement hoặc premium enforcement backend
- Subscription/transaction
- Admin user/content/community CRUD và moderation
- User registration
- Session-management UI

Không tạo các endpoint này chỉ để làm authorization test. Chỉ thêm ownership, IDOR/BOLA, mass-assignment hoặc premium test khi resource API tương ứng thực sự được triển khai.

## Các quyết định bảo mật quan trọng

- Access token frontend phải memory-only.
- Raw refresh token chỉ ở HttpOnly cookie; không lưu trong database hoặc browser storage.
- Không lưu/log raw password-reset token; database chỉ lưu SHA-256 hash.
- Database role và account status là authoritative; JWT claim và frontend state không phải nguồn quyền.
- Current user luôn lấy từ `req.user.id`; không nhận `userId`, actor ID hoặc owner ID từ client để xác định identity.
- `ProtectedRoute` chỉ là UX; mọi protected action phải được backend enforce.
- Không trust `role`, `status`, `isAdmin`, `premium`, `subscription`, `ownerId` hoặc field đặc quyền do client gửi.
- Không trả password hash, lock internals, refresh-token data hoặc reset-token data trong response thông thường.
- Không tạo fake endpoint hoặc authorization abstraction chưa dùng chỉ để làm test pass.
- Giữ refresh rotation/session model hiện tại nếu phase mới không yêu cầu rõ thay đổi.
- Không tạo `auth_refresh_tokens` family/history table nếu chưa có yêu cầu mới.

## Tests dự kiến phải pass

### Lệnh chạy

- Backend unit: `npm test` trong `backend-node`.
- Backend integration: `npm run test:integration` trong `backend-node` với DB/service test.
- Frontend lint: `npm run lint` trong `frontend`.
- Frontend build: `npm run build` trong `frontend`.
- Frontend auth smoke: `npm run test:ui` trong `frontend`.
- Kiểm tra whitespace/error: `git diff --check`.

### Hành vi đã được test

- Login đúng/sai, validation, generic credential error và login rate limit.
- Failed attempts, lần sai thứ 5 lock, password đúng trong lock bị reject, unlock recovery và reset counter sau login đúng.
- Refresh, hash rotation, replay token cũ, idle expiry, absolute expiry và capped idle extension.
- Logout, clear cookie, logout-all và invalidation access/refresh trên nhiều session.
- Disabled-user login/access/refresh/logout-all/protected-route rejection.
- Origin protection, JWT algorithm allow-list và production-secret validation.
- JWT ký hợp lệ có `role=admin` nhưng DB role=user nhận `403`.
- Admin coverage: guest `401`, user `403`, admin success trên mọi `/api/v1/admin/*` thật (hiện chỉ có `GET /api/v1/admin/check`).
- Change password, wrong/same password, revoke session và old/new password login.
- Forgot generic equality, unknown/non-local account và không expose token trong production response.
- Reset token hash, TTL, invalidate token cũ, valid/reuse/expired/random/malformed và concurrent one-time.
- Frontend login/admin guard, refresh bootstrap/failure, logout state clearing và ordinary-user redirect.
- MFA setup/enable, không cấp credential trước factor, challenge expiry/attempt cap/one-time, TOTP replay, recovery-code one-time, disabled user, password-reset preservation và disable session revocation.
- Frontend login chuyển sang second step bằng challenge giữ trong memory và chấp nhận TOTP/recovery code.

## Remaining work

- CAPTCHA hoặc bot-abuse control bổ sung
- Production email provider và delivery monitoring cho password reset
- CSP tương thích streaming; hiện Helmet chạy với CSP disabled
- Multi-tab auth state sync
- Refresh-token family/history và replay-family response
- IDOR/BOLA, ownership, mass-assignment khi các resource API thật xuất hiện
- Server-side premium/subscription authorization khi có API tương ứng
- Admin CRUD và community/content moderation authorization khi có API tương ứng
- Email verification, OAuth, passkeys/WebAuthn và recovery nâng cao

## Next recommended phase

Next candidate:

**Phase 7 — bot-abuse controls hoặc production password-reset delivery**

Do not start automatically.  
First audit current source and propose scope.

## Hướng dẫn cho các phiên Codex sau

1. Đọc file này.
2. Chạy `git status`.
3. Chạy `git log --oneline -10`.
4. Đọc source hiện tại trước khi sửa.
5. Nếu tài liệu khác source, source code là technical truth.
6. Không commit nếu chưa được yêu cầu rõ.
7. Sau mỗi phase auth/security, cập nhật lại file này.
