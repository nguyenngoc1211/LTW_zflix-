import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const LoginPage = () => {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-600">Checking session...</div>;
  }

  if (!loading && user) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      const requestedPath = location.state?.from;
      const destination =
        requestedPath?.startsWith("/admin") && loggedInUser.role === "admin"
          ? requestedPath
          : loggedInUser.role === "admin"
            ? "/admin"
            : "/";
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">MovieHub</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-500">Use your email and password to continue.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <button
            className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default LoginPage;
