import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must be at most 72 UTF-8 bytes.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      }, false);
      setPassword("");
      setConfirmPassword("");
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (requestError) {
      setError(requestError.message || "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">MovieHub</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Create account</h1>
        <p className="mt-2 text-sm text-slate-600">Create a local account, then sign in.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700">
            Username
            <input className={inputClass} type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} pattern="[A-Za-z0-9_]{3,50}" minLength={3} maxLength={50} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={100} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input className={inputClass} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required />
          </label>
          <p className="text-xs text-slate-500">Use 8–128 characters, up to 72 UTF-8 bytes.</p>
          <label className="block text-sm font-medium text-slate-700">
            Confirm password
            <input className={inputClass} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60" type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          Already have an account? <Link className="font-medium text-red-600 hover:underline" to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
};

export default RegisterPage;
