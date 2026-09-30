import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, "", "/reset-password");
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Password must be at most 72 UTF-8 bytes.");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }, false);
      setNewPassword("");
      setConfirmPassword("");
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (requestError) {
      setError(requestError.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">MovieHub</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Reset password</h1>
        {!token ? (
          <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
            This reset link is missing a token. Request a new reset link.
          </p>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-700">
              New password
              <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} required />
            </label>
            <p className="text-xs text-slate-500">Use 8–128 characters, up to 72 UTF-8 bytes.</p>
            <label className="block text-sm font-medium text-slate-700">
              Confirm new password
              <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <button className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60" type="submit" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link className="font-medium text-red-600 hover:underline" to="/forgot-password">Request a new link</Link>
        </p>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
