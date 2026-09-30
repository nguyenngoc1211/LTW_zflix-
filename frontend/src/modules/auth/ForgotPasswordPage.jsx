import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../../services/api.js";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }, false);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Could not request a password reset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-red-600">MovieHub</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email address to request password reset instructions.
        </p>
        {submitted ? (
          <p className="mt-6 rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800" role="status">
            If the account is eligible and email delivery is configured, reset instructions will be sent.
          </p>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={submit}>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
            <button className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60" type="submit" disabled={loading}>
              {loading ? "Requesting..." : "Request reset"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link className="font-medium text-red-600 hover:underline" to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
