import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

// Trang đăng nhập riêng cho quản trị viên — KHÔNG được liên kết từ bất kỳ menu
// công khai nào; chỉ truy cập bằng URL trực tiếp /admin-login.
const AdminLoginPage = () => {
  const { user, loading, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-600">Đang kiểm tra phiên đăng nhập...</div>;
  }

  if (user) {
    return <Navigate to={["admin", "moderator"].includes(user.role) ? "/admin" : "/"} replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await adminLogin(email, password);
      if (result.mfaRequired) {
        setError("Vui lòng đăng nhập tại trang chủ để hoàn tất xác thực hai bước, rồi quay lại đây.");
        return;
      }
      if (result.forbidden) {
        setError("Tài khoản này không có quyền quản trị.");
        return;
      }
      navigate("/admin", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Không thể đăng nhập");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-2xl ring-1 ring-slate-700">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-500">ZFLIX · QUẢN TRỊ</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Đăng nhập hệ quản trị</h1>
        <p className="mt-2 text-sm text-slate-400">
          Khu vực riêng của quản trị viên. Tài khoản người dùng thường không thể truy cập.
        </p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-300">
            Email quản trị
            <input
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-white outline-none focus:border-red-500"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block text-sm font-medium text-slate-300">
            Mật khẩu
            <input
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-white outline-none focus:border-red-500"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Đang đăng nhập..." : "Vào hệ quản trị"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link className="hover:underline" to="/">← Về trang người dùng</Link>
        </p>
      </section>
    </main>
  );
};

export default AdminLoginPage;
