import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";

const inputClass =
  "mt-2 w-full rounded-lg border border-white/15 bg-[#0e1017] px-3 py-2.5 text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20";
const primaryButton =
  "rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "rounded-lg border border-white/15 px-4 py-2.5 font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60";

const ErrorMessage = ({ children }) =>
  children ? (
    <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
      {children}
    </p>
  ) : null;

const formatDate = (value) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Chưa có";

const RecoveryCodes = ({ codes, afterEnrollment, onDone }) => {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
  };

  return (
    <section className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
      <h2 className="text-xl font-bold text-amber-100">Lưu mã khôi phục của bạn</h2>
      <p className="mt-2 text-sm text-amber-100/80">
        Hãy lưu những mã này ở nơi an toàn. Mỗi mã chỉ dùng được một lần và sẽ không hiển thị lại.
      </p>
      <ul className="mt-4 grid gap-2 rounded-lg bg-black/30 p-4 font-mono text-sm text-amber-50 sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button type="button" className={`${secondaryButton} mt-4`} onClick={copyAll}>
        {copied ? "Đã copy" : "Copy tất cả"}
      </button>
      <label className="mt-5 flex items-start gap-2 text-sm text-amber-100">
        <input
          className="mt-1"
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        Tôi đã lưu mã khôi phục
      </label>
      <button
        type="button"
        className={`${primaryButton} mt-4`}
        disabled={!acknowledged}
        onClick={onDone}
      >
        {afterEnrollment ? "Xong và đăng nhập lại" : "Xong"}
      </button>
    </section>
  );
};

const ChangePasswordSection = ({ changePassword }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới nhập lại không khớp.");
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError("Mật khẩu tối đa 72 byte UTF-8.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.location.replace("/login?passwordChanged=1");
    } catch (requestError) {
      setError(requestError.message || "Không đổi được mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-[#12151d] p-6">
      <h2 className="text-xl font-bold text-white">Đổi mật khẩu</h2>
      <p className="mt-2 text-sm text-slate-400">Đổi mật khẩu sẽ đăng xuất toàn bộ phiên đăng nhập.</p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-300">
          Mật khẩu hiện tại
          <input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} maxLength={128} required />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Mật khẩu mới
          <input className={inputClass} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} maxLength={128} required />
        </label>
        <p className="text-xs text-slate-500">Dùng 8–128 ký tự, tối đa 72 byte UTF-8.</p>
        <label className="block text-sm font-medium text-slate-300">
          Nhập lại mật khẩu mới
          <input className={inputClass} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required />
        </label>
        <ErrorMessage>{error}</ErrorMessage>
        <button className={primaryButton} type="submit" disabled={submitting}>
          {submitting ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
        </button>
      </form>
    </section>
  );
};

const AccountSecurityPage = () => {
  const {
    apiRequest,
    changePassword,
    clearAuthState,
    getSessions,
    logoutAll,
    logoutOtherSessions,
    revokeSession,
  } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [action, setAction] = useState(null);
  const [setup, setSetup] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionAction, setSessionAction] = useState("");

  const loadStatus = async () => {
    const data = await apiRequest("/api/v1/auth/mfa/status");
    setStatus(data);
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      setSessions(await getSessions());
      setSessionsError("");
    } catch {
      setSessionsError("Không tải được danh sách phiên đăng nhập.");
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiRequest("/api/v1/auth/mfa/status")
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch(() => {
        if (active) setError("Không tải được trạng thái xác thực hai bước.");
      });
    return () => {
      active = false;
    };
  }, [apiRequest]);

  useEffect(() => {
    let active = true;
    getSessions()
      .then((data) => {
        if (active) setSessions(data);
      })
      .catch(() => {
        if (active) setSessionsError("Không tải được danh sách phiên đăng nhập.");
      })
      .finally(() => {
        if (active) setSessionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getSessions]);

  const signOutSession = async (session) => {
    setSessionAction(session.id);
    setSessionsError("");
    try {
      await revokeSession(session.id, session.current);
      if (session.current) {
        navigate("/login", { replace: true });
        return;
      }
      await loadSessions();
    } catch {
      setSessionsError("Không đăng xuất được phiên đó.");
    } finally {
      setSessionAction("");
    }
  };

  const signOutOthers = async () => {
    setSessionAction("others");
    setSessionsError("");
    try {
      await logoutOtherSessions();
      await loadSessions();
    } catch {
      setSessionsError("Không đăng xuất được các phiên khác.");
    } finally {
      setSessionAction("");
    }
  };

  const signOutAll = async () => {
    setSessionAction("all");
    setSessionsError("");
    try {
      await logoutAll();
      navigate("/login", { replace: true });
    } catch {
      setSessionsError("Không đăng xuất được toàn bộ phiên.");
    } finally {
      setSessionAction("");
    }
  };

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
      setError("Không bắt đầu được cấu hình xác thực hai bước.");
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
      setError("Mã xác thực không đúng.");
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
      setError("Không tạo lại được mã khôi phục.");
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
      setError("Không tắt được xác thực hai bước.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!status && !error) {
    return <main className="grid min-h-[60vh] place-items-center text-slate-400">Đang tải cài đặt bảo mật...</main>;
  }

  if (recovery) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-white">Bảo mật tài khoản</h1>
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
      <h1 className="text-3xl font-bold text-white">Bảo mật tài khoản</h1>
      <ChangePasswordSection changePassword={changePassword} />
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#12151d] p-6">
        <h2 className="text-xl font-bold text-white">Xác thực hai bước (2FA)</h2>
        {status && (
          <p className="mt-2 text-sm text-slate-400">
            Trạng thái: <strong>{status.enabled ? "Bật" : "Tắt"}</strong>
            {status.enabled ? ` · còn ${status.recoveryCodesRemaining} mã khôi phục` : ""}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {status?.enabled ? (
            <>
              <button type="button" className={primaryButton} onClick={() => { resetForm(); setAction("regenerate"); }}>
                Tạo lại mã khôi phục
              </button>
              <button type="button" className={secondaryButton} onClick={() => { resetForm(); setAction("disable"); }}>
                Tắt xác thực hai bước
              </button>
            </>
          ) : (
            <button type="button" className={primaryButton} onClick={() => { resetForm(); setAction("enable"); }}>
              Bật xác thực hai bước
            </button>
          )}
        </div>

        {action === "enable" && (
          <form className="mt-6 space-y-4 border-t border-white/10 pt-6" onSubmit={beginSetup}>
            <h3 className="font-semibold text-white">Xác nhận mật khẩu của bạn</h3>
            <label className="block text-sm font-medium text-slate-300">
              Mật khẩu hiện tại
              <input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3">
              <button className={primaryButton} type="submit" disabled={submitting}>Tiếp tục</button>
              <button className={secondaryButton} type="button" onClick={cancelAction}>Hủy</button>
            </div>
          </form>
        )}

        {action === "setup" && setup && (
          <form className="mt-6 space-y-5 border-t border-white/10 pt-6" onSubmit={confirmSetup}>
            <div>
              <h3 className="font-semibold text-white">1. Quét mã QR</h3>
              <div className="mt-4 inline-block rounded-lg border border-slate-200 bg-white p-4" role="img" aria-label="Mã QR xác thực">
                <QRCodeSVG value={setup.otpauthUrl} size={200} />
              </div>
              <p className="mt-3 text-sm text-slate-400">Khóa cài đặt thủ công:</p>
              <code className="mt-1 block break-all rounded border border-white/10 bg-white/5 p-3 text-sm text-slate-100">{setup.secret}</code>
            </div>
            <label className="block text-sm font-medium text-slate-300">
              2. Nhập mã 6 chữ số
              <input className={inputClass} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3">
              <button className={primaryButton} type="submit" disabled={submitting}>Xác nhận và bật</button>
              <button className={secondaryButton} type="button" onClick={cancelAction}>Hủy</button>
            </div>
          </form>
        )}

        {action === "regenerate" && (
          <form className="mt-6 space-y-4 border-t border-white/10 pt-6" onSubmit={regenerate}>
            <h3 className="font-semibold text-white">Tạo lại mã khôi phục</h3>
            <p className="text-sm text-slate-400">Các mã khôi phục cũ sẽ hết hiệu lực.</p>
            <label className="block text-sm font-medium text-slate-300">Mật khẩu hiện tại<input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-slate-300">Mã xác thực<input className={inputClass} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3"><button className={primaryButton} type="submit" disabled={submitting}>Tạo lại mã</button><button className={secondaryButton} type="button" onClick={cancelAction}>Hủy</button></div>
          </form>
        )}

        {action === "disable" && (
          <form className="mt-6 space-y-4 border-t border-white/10 pt-6" onSubmit={disable}>
            <h3 className="font-semibold text-white">Tắt xác thực hai bước</h3>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Tắt xác thực hai bước làm giảm bảo mật tài khoản và sẽ đăng xuất bạn khỏi hệ thống.</p>
            <label className="block text-sm font-medium text-slate-300">Mật khẩu hiện tại<input className={inputClass} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-slate-300">Mã xác thực<input className={inputClass} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} required /></label>
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex gap-3"><button className={primaryButton} type="submit" disabled={submitting}>Tắt MFA và đăng xuất</button><button className={secondaryButton} type="button" onClick={cancelAction}>Hủy</button></div>
          </form>
        )}
      </section>
      <section className="mt-6 rounded-2xl border border-white/10 bg-[#12151d] p-6">
        <h2 className="text-xl font-bold text-white">Phiên đăng nhập</h2>
        <p className="mt-2 text-sm text-slate-400">
          "Dùng gần nhất" là lần làm mới phiên mới nhất được hệ thống xác thực ghi lại.
        </p>
        {sessionsLoading ? (
          <p className="mt-5 text-sm text-slate-400">Đang tải phiên đăng nhập...</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {sessions.map((session) => (
              <li key={session.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-all font-medium text-white">
                        {session.userAgent || "Trình duyệt/thiết bị không rõ"}
                      </p>
                      {session.current && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          Phiên hiện tại
                        </span>
                      )}
                    </div>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-400 sm:grid-cols-2">
                      <div><dt className="inline font-medium">IP: </dt><dd className="inline">{session.ipAddress || "Không có"}</dd></div>
                      <div><dt className="inline font-medium">Tạo lúc: </dt><dd className="inline">{formatDate(session.createdAt)}</dd></div>
                      <div><dt className="inline font-medium">Dùng gần nhất: </dt><dd className="inline">{formatDate(session.lastUsedAt)}</dd></div>
                      <div><dt className="inline font-medium">Hết hạn nếu Idle: </dt><dd className="inline">{formatDate(session.expiresAt)}</dd></div>
                    </dl>
                  </div>
                  {!session.current && (
                    <button
                      type="button"
                      className={secondaryButton}
                      disabled={Boolean(sessionAction)}
                      onClick={() => signOutSession(session)}
                    >
                      {sessionAction === session.id ? "Đang đăng xuất..." : "Đăng xuất"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <ErrorMessage>{sessionsError}</ErrorMessage>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
          <button type="button" className={secondaryButton} disabled={Boolean(sessionAction)} onClick={signOutOthers}>
            {sessionAction === "others" ? "Đang đăng xuất..." : "Đăng xuất các phiên khác"}
          </button>
          <button type="button" className={primaryButton} disabled={Boolean(sessionAction)} onClick={signOutAll}>
            {sessionAction === "all" ? "Đang đăng xuất..." : "Đăng xuất tất cả phiên"}
          </button>
        </div>
      </section>
    </main>
  );
};

export default AccountSecurityPage;
