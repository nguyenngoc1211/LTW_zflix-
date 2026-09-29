import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";
const primaryButton =
  "rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const ErrorMessage = ({ children }) =>
  children ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {children}
    </p>
  ) : null;

const RecoveryCodes = ({ codes, afterEnrollment, onDone }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
  };

  return (
    <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-xl font-bold text-slate-900">Save your recovery codes</h2>
      <p className="mt-2 text-sm text-slate-700">
        Save these somewhere safe. Each code works once, and they will not be shown again.
      </p>
      <ul className="mt-4 grid gap-2 rounded-lg bg-white p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button type="button" className={`${secondaryButton} mt-4`} onClick={copyAll}>
        {copied ? "Copied" : "Copy all"}
      </button>
      <label className="mt-5 flex items-start gap-2 text-sm text-slate-700">
        <input
          className="mt-1"
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        I have saved my recovery codes
      </label>
      <button
        type="button"
        className={`${primaryButton} mt-4`}
        disabled={!acknowledged}
        onClick={onDone}
      >
        {afterEnrollment ? "Done and sign in again" : "Done"}
      </button>
    </section>
  );
};

const AccountSecurityPage = () => {
  const { apiRequest, clearAuthState } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [action, setAction] = useState(null);
  const [setup, setSetup] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadStatus = async () => {
    const data = await apiRequest("/api/v1/auth/mfa/status");
    setStatus(data);
  };

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/auth/mfa/status")
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setError("Could not load two-factor authentication status.");
      });
    return () => {
      active = false;
    };
  }, [apiRequest]);

  const resetForm = () => {
    setCurrentPassword("");
    setCode("");
    setError("");
  };

  const cancelAction = () => {
    setAction(null);
    setSetup(null);
    resetForm();
  };

  const beginSetup = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/v1/auth/mfa/setup", {
        method: "POST",
        body: JSON.stringify({ currentPassword }),
      });
      setSetup(data);
      setCurrentPassword("");
      setAction("setup");
    } catch {
      setError("Could not start two-factor authentication setup.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmSetup = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/v1/auth/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ code }),
      }, false);
      setSetup(null);
      setCode("");
      setStatus((current) => ({ ...current, enabled: true }));
      setRecovery({ codes: data.recoveryCodes, afterEnrollment: true });
      setAction(null);
    } catch {
      setError("Invalid authentication code.");
    } finally {
      setSubmitting(false);
    }
  };

  const regenerate = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiRequest("/api/v1/auth/mfa/recovery-codes/regenerate", {
        method: "POST",
        body: JSON.stringify({ currentPassword, code }),
      });
      resetForm();
      setRecovery({ codes: data.recoveryCodes, afterEnrollment: false });
      setAction(null);
    } catch {
      setError("Could not regenerate recovery codes.");
    } finally {
      setSubmitting(false);
    }
  };

  const disable = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest("/api/v1/auth/mfa/disable", {
        method: "POST",
        body: JSON.stringify({ currentPassword, code }),
      }, false);
      clearAuthState();
      navigate("/login", { replace: true });
    } catch {
      setError("Could not disable two-factor authentication.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!status && !error) {
    return <main className="grid min-h-[60vh] place-items-center text-slate-600">Loading security settings...</main>;
  }

  if (recovery) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-slate-900">Account Security</h1>
        <RecoveryCodes
          codes={recovery.codes}
          afterEnrollment={recovery.afterEnrollment}
          onDone={async () => {
            if (recovery.afterEnrollment) {
              clearAuthState();
              navigate("/login", { replace: true });
              return;
            }
            setRecovery(null);
            await loadStatus();
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Account Security</h1>
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Two-factor authentication</h2>
        {status && (
          <p className="mt-2 text-sm text-slate-600">
            Status: <strong>{status.enabled ? "Enabled" : "Disabled"}</strong>
            {status.enabled ? ` · ${status.recoveryCodesRemaining} recovery codes remaining` : ""}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {status?.enabled ? (
            <>
              <button type="button" className={primaryButton} onClick={() => { resetForm(); setAction("regenerate"); }}>
                Regenerate recovery codes
              </button>
              <button type="button" className={secondaryButton} onClick={() => { resetForm(); setAction("disable"); }}>
                Disable two-factor authentication
              </button>
            </>
          ) : (
            <button type="button" className={primaryButton} onClick={() => { resetForm(); setAction("enable"); }}>
              Enable two-factor authentication
            </button>
          )}
        </div>

        {action === "enable" && (
          <form className="mt-6 space-y-4 border-t border-slate-200 pt-6" onSubmit={beginSetup}>
            <h3 className="font-semibold text-slate-900">Confirm your password</h3>
            <label className="block text-sm font-medium text-slate-700">
              Current password
              <input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3">
              <button className={primaryButton} type="submit" disabled={submitting}>Continue</button>
              <button className={secondaryButton} type="button" onClick={cancelAction}>Cancel</button>
            </div>
          </form>
        )}

        {action === "setup" && setup && (
          <form className="mt-6 space-y-5 border-t border-slate-200 pt-6" onSubmit={confirmSetup}>
            <div>
              <h3 className="font-semibold text-slate-900">1. Scan the QR code</h3>
              <div className="mt-4 inline-block rounded-lg border border-slate-200 bg-white p-4" role="img" aria-label="Authenticator QR code">
                <QRCodeSVG value={setup.otpauthUrl} size={200} />
              </div>
              <p className="mt-3 text-sm text-slate-600">Manual setup key:</p>
              <code className="mt-1 block break-all rounded bg-slate-100 p-3 text-sm">{setup.secret}</code>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              2. Enter the six-digit code
              <input className={inputClass} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3">
              <button className={primaryButton} type="submit" disabled={submitting}>Verify and enable</button>
              <button className={secondaryButton} type="button" onClick={cancelAction}>Cancel</button>
            </div>
          </form>
        )}

        {action === "regenerate" && (
          <form className="mt-6 space-y-4 border-t border-slate-200 pt-6" onSubmit={regenerate}>
            <h3 className="font-semibold text-slate-900">Regenerate recovery codes</h3>
            <p className="text-sm text-slate-600">Your old recovery codes will stop working.</p>
            <label className="block text-sm font-medium text-slate-700">Current password<input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-slate-700">Authenticator code<input className={inputClass} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3"><button className={primaryButton} type="submit" disabled={submitting}>Regenerate codes</button><button className={secondaryButton} type="button" onClick={cancelAction}>Cancel</button></div>
          </form>
        )}

        {action === "disable" && (
          <form className="mt-6 space-y-4 border-t border-slate-200 pt-6" onSubmit={disable}>
            <h3 className="font-semibold text-slate-900">Disable two-factor authentication</h3>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Disabling two-factor authentication reduces account security and will sign you out.</p>
            <label className="block text-sm font-medium text-slate-700">Current password<input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-slate-700">Authenticator code<input className={inputClass} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3"><button className={primaryButton} type="submit" disabled={submitting}>Disable MFA and sign out</button><button className={secondaryButton} type="button" onClick={cancelAction}>Cancel</button></div>
          </form>
        )}
      </section>
    </main>
  );
};

export default AccountSecurityPage;
