# Authorization integration guide

Áp dụng cho backend Node hiện tại trên branch `Du` (kiểm tra tại `55430bf`). Đây là hướng dẫn tích hợp khi teammate **thực sự thêm API mới**, không phải danh sách API đã tồn tại. Hiện backend chỉ có auth routes, `GET /api/v1/admin/check` và `GET /` health. Schema/frontend có khái niệm business nhưng chưa có các backend route tương ứng.

## 1. Mô hình hiện tại và ranh giới tin cậy

| Đối tượng | Quyền hiện tại |
|---|---|
| Guest | Chỉ dùng route public/unauthenticated và các flow auth public theo điều kiện riêng của route. |
| Authenticated user | User `active` có access token hợp lệ và session DB còn hiệu lực; dùng các thao tác tài khoản của chính mình. |
| Admin | Authenticated user có `users.role = 'admin'` được backend đọc từ DB; hiện chỉ có `GET /api/v1/admin/check` là admin endpoint. |

`frontend/src/routes/ProtectedRoute.jsx` chỉ điều hướng/render cho UX. **Backend authorization là security boundary.** `requireAuth` verify JWT `HS256`, đối chiếu `sub`/`sid` với `auth_sessions`, kiểm tra revoked/idle expiry/absolute expiry và `users.status = 'active'`, rồi nạp `req.user` và `req.auth.sessionId`. `requireRole` dùng `req.user.role` này. JWT có role claim nhưng claim đó **không** quyết định quyền; frontend state cũng không quyết định quyền. Mọi protected API mới phải qua `requireAuth` trước khi xét resource hoặc role; không tự decode/parse JWT để thay thế middleware.

## 2. Middleware và bốn pattern

Các snippet dưới đây minh họa **route tương lai, chưa tồn tại**. Source hiện dùng Express `app.get(...)` trong `src/app.js` và `authRouter.post/get/delete(...)` trong `auth.routes.js`. Đặt `requireAuth` trước `requireRole`, validation và handler. Với write route cần chống cross-origin, dùng `requireFrontendOrigin` theo policy của các auth state-changing route hiện tại; xét thêm rate limit phù hợp. Middleware không thay thế validation dữ liệu.

```js
// A. PUBLIC: dữ liệu thực sự được phép công khai.
router.get("/public-resource", handler);

// B. AUTHENTICATED USER: mọi user active có session hợp lệ.
router.get("/resource", requireAuth, handler);

// C. ADMIN ONLY: quản trị, như pattern thật ở src/app.js.
router.patch(
  "/admin/example/:id",
  requireAuth,
  requireRole("admin"),
  requireFrontendOrigin,
  validateInput,
  handler,
);

// D. OWNER OR ADMIN: xác thực trước; handler/service kiểm tra owner từ DB.
router.patch(
  "/resource/:id",
  requireAuth,
  requireFrontendOrigin,
  validateInput,
  handler,
);
```

`validateInput` và `handler` ở đây là tên placeholder giải thích thứ tự, không phải middleware/export đang có. Nếu route cần chính sách Owner (không cho admin override), bỏ nhánh admin trong phép kiểm tra bên dưới. Chốt policy theo từng resource trước khi code.

## 3. Identity, role và ownership

**Hard rule cho endpoint “của tôi”:** lấy actor ID từ `req.user.id`, không lấy từ `req.body.userId`, `req.query.userId` hoặc `req.params.userId`, kể cả khi URL/body có các giá trị này. Áp dụng cho “my profile”, “my sessions”, “my favorites”, “my history”. Target user ID do client gửi chỉ có ý nghĩa khi route thực sự là thao tác admin và đã đi qua `requireAuth`, `requireRole("admin")`.

```js
// BAD: client quyết định actor.
const userId = req.body.userId;

// GOOD: requireAuth đã nạp actor từ DB-backed session.
const userId = req.user.id;
```

Không authorize theo `req.body.role`, `req.query.role`, frontend state, JWT chỉ được decode nhưng chưa verify, hoặc JWT role claim một mình. Pattern hiện có là `requireAuth` nạp `users.role` từ DB, sau đó `requireRole("admin")` kiểm tra `req.user.role`. Registration hiện ghi cố định `role='user'`, `provider='local'`, `status='active'`; request body không được nâng quyền.

Với **Owner or Admin**: sau `requireAuth`, load resource bằng ID đã validate từ DB, lấy cột owner **thật** từ hàng đó, cho phép khi `resource.user_id === req.user.id` hoặc `req.user.role === "admin"`; nếu không, trả `403` hoặc `404` theo policy đã chọn nhất quán cho resource. Resource không tồn tại trả `404`. Không dùng owner ID do client khai để chứng minh ownership. Sau khi check, mutation cần ràng buộc owner/target trong câu SQL hoặc transaction khi có nguy cơ race; dùng parameterized SQL.

```js
// Trong handler/service tương lai, sau khi load resource từ DB.
// `resource` là hàng DB thật; chọn 403 hoặc 404 theo policy của resource.
if (resource.user_id !== req.user.id && req.user.role !== "admin") {
  return res.status(404).json({ message: "Resource not found" });
}
```

**Pattern thật đang có:** `GET /api/v1/auth/sessions` lọc `WHERE user_id = ?` với `req.user.id`; `DELETE /api/v1/auth/sessions/:sessionId` cập nhật `WHERE id = ? AND user_id = ?`, foreign session trả `404`, own session đã revoke trả `204`. Các thao tác MFA và password cũng lấy actor từ `req.user.id`. Chưa có `requireOwnership()` dùng chung. Không thêm generic helper khi chưa có resource API thật: owner key, policy admin override và cách trả `403/404` tùy resource.

## 4. Mass assignment và dữ liệu nhạy cảm

Không truyền nguyên `req.body` vào lệnh update/insert. Validate rồi chỉ lấy các field endpoint cho phép. Ví dụ profile dưới đây **chưa có API**; `avatarUrl` là tên request minh họa và `avatar_url` là cột thật trong `users`:

```js
// BAD
updateUser(req.body);

// GOOD: chỉ là pattern, không phải hàm/route hiện có.
const { avatarUrl } = req.body;
await pool.execute(
  "UPDATE users SET avatar_url = ? WHERE id = ?",
  [avatarUrl, req.user.id],
);
```

Không để client tự gán `users.id`, `role`, `status`, `password`, `password_changed_at`, `vip_expires_at`, `provider`, `auth_sessions.user_id`, `refresh_token_hash`, `revoked_at` hoặc owner/creator field của resource. Tên payload như `userId`, `ownerId`, `createdBy`, `isAdmin`, `passwordHash`, `subscriptionStatus` cũng không được chấp nhận chỉ vì xuất hiện trong body. Hash/secret/session internals không được trả trong response thường. Admin write API tương lai cũng cần `requireAuth` → `requireRole("admin")`, parameterized SQL, input allow-list, kiểm tra privilege escalation qua body, safe response projection và log action nhạy cảm khi phù hợp.

## 5. FUTURE AUTHORIZATION REQUIREMENT — chưa có các business API này

Bảng là baseline để review khi thiết kế endpoint thật; quyền đọc/ghi chi tiết, admin override và tính công khai phải được chốt theo nghiệp vụ. “Owner” là owner xác nhận từ DB, không phải ID do client gửi.

| Resource tương lai | READ | CREATE | UPDATE | DELETE |
|---|---|---|---|---|
| Profile | Owner or Admin | Chưa có API riêng; account registration public hiện có | Owner or Admin, field allow-list | Owner or Admin, cần policy xóa tài khoản riêng |
| Favorites/bookmarks | Owner | Authenticated, gán owner từ `req.user.id` | Owner | Owner |
| History | Owner | Authenticated, gán owner từ `req.user.id` | Owner | Owner |
| Comments | Public nếu nội dung công khai | Authenticated, gán owner từ `req.user.id` | Owner or Admin | Owner or Admin |
| Ratings | Public nếu nội dung công khai | Authenticated, gán owner từ `req.user.id` | Owner or Admin | Owner or Admin |
| Watching Party | Authenticated hoặc Public theo visibility | Authenticated, host từ `req.user.id` | Host/owner or Admin theo party record | Host/owner or Admin |
| Premium/Subscription | Owner; premium content cần Entitlement check | Authenticated, thêm xác thực payment/entitlement theo thiết kế | Owner hoặc Admin theo nghiệp vụ; không cho tự đổi entitlement | Owner hoặc Admin theo nghiệp vụ |
| Admin User Management | Admin | Admin | Admin, chặn privilege escalation | Admin |
| Admin Movie Management | Public cho nội dung đã publish; quản trị Admin | Admin | Admin | Admin |

Premium/subscription **không** trở thành `role = "premium"`: global role hiện chỉ là `user`/`admin`. Quyền xem premium tương lai phải kiểm tra subscription/entitlement server-side riêng, không tin `vip_expires_at` hay cờ premium trong request. Schema có `users.vip_expires_at` và bảng subscription nhưng hiện chưa có backend entitlement API/check.

Watching party host là quyền gắn với **party record**, không phải global `role = "host"`. Schema hiện dùng `watch_parties.host_id` (không phải `party.host_user_id`); policy host phải đọc owner từ cột thật đó. Schema có participant role riêng theo party, không phải `users.role`; backend watching-party API hiện chưa tồn tại.

## 6. HTTP status và regression checklist

- `401`: chưa authenticated, access token invalid/expired hoặc DB session/account không còn hợp lệ. Disabled account bị `requireAuth` chặn **trước** resource authorization.
- `403`: đã authenticated nhưng thiếu quyền, như user thường vào `/api/v1/admin/check`.
- `404`: có thể dùng cho ownership để ẩn resource; session revoke hiện dùng `404` khi session không thuộc user. Không tự đổi behavior hiện có để ép đồng nhất; ghi nhận inconsistency nếu phát hiện.

Khi thêm **mỗi authenticated resource API**, viết regression test: guest → `401`; owner → success; user khác → `403/404`; admin → đúng policy cụ thể; disabled user → `401`; JWT role claim giả admin trên session DB role=user → không nâng quyền. Thử thao túng `userId`/owner ID trong body, query và params nếu áp dụng; phải không bypass ownership. Kiểm tra response không lộ hash/secret và mutation không nhận field ngoài allow-list. Với **mỗi admin endpoint**: guest `401`, user `403`, admin success; test body cố gắng tự nâng role/status/entitlement.

**IDOR bắt buộc khi có resource API:** tạo resource A thuộc User A và resource B thuộc User B; login A; thử `GET`, `PATCH`, `DELETE` B bằng ID của B và bằng ID thao túng; xác nhận request bị từ chối (`403/404`), B không đổi; lặp lại với role/admin policy đã chọn. Test cả list để B không xuất hiện trong dữ liệu riêng của A. Đây là template regression, không phải test đang chạy cho API chưa có.

Regression hiện có để tham khảo: `backend-node/integration/auth-smoke.js` kiểm tra session ownership, disabled user, guest/user/admin trên admin route thật và JWT role forgery; `registration-smoke.js` kiểm tra body cố gắng gán `role`, `status`, `provider`, `vip_expires_at`. Frontend guard test không thay thế backend authorization test.
