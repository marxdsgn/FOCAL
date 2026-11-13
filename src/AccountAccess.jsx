import React, { useEffect, useState } from "react";
import {
  getAuthClient,
  subscribeAuth,
  clearRecovery,
  signOut,
} from "./auth.js";
import { PlayerAccount } from "./Community.jsx";
export default function AccountAccess({
  onClose,
  onSaved,
  initial,
  fullPage = false,
  required = false,
}) {
  const [auth, setAuth] = useState({
      ready: false,
      session: null,
      recovery: false,
    }),
    [view, setView] = useState("signup"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => subscribeAuth(setAuth), []);
  useEffect(() => {
    if (auth.recovery) setView("reset");
  }, [auth.recovery]);
  if (auth.ready && auth.session && !auth.recovery && !fullPage)
    return (
      <PlayerAccount
        key={auth.session.user.id}
        initial={initial}
        required={required}
        onClose={onClose}
        onSaved={onSaved}
        onSignOut={async () => {
          await signOut();
          onClose();
        }}
      />
    );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const client = await getAuthClient();
      if (view === "signup") {
        if (password.length < 12)
          throw Error("Choose a password with at least 12 characters.");
        if (password !== repeat) throw Error("Passwords do not match.");
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/" },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            "Check your email to confirm your account, then return here to sign in.",
          );
          setView("signin");
          setPassword("");
          setRepeat("");
        }
      } else if (view === "signin") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (view === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/?reset=1",
        });
        if (error) throw error;
        setNotice(
          "If an account uses that address, a password reset link will be emailed to it.",
        );
      } else if (view === "reset") {
        if (password.length < 12) throw Error("Choose at least 12 characters.");
        if (password !== repeat) throw Error("Passwords do not match.");
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        clearRecovery();
        setPassword("");
        setRepeat("");
        setNotice("Your password has been updated.");
      }
    } catch (e) {
      setError(e.message || "Could not complete this request.");
    } finally {
      setBusy(false);
    }
  }
  const title =
    view === "signup"
      ? "Create your free account."
      : view === "forgot"
        ? "Let’s get you back in."
        : view === "reset"
          ? "Choose a new password."
          : "Welcome back, photographer.";
  return (
    <div className={fullPage ? "auth-startup" : "modal-backdrop"}>
      {fullPage && (
        <section
          className="auth-startup-story"
          aria-label="FOCAL photography arena"
        >
          <a className="auth-startup-brand" href="/">
            FOCAL<span>.</span>
          </a>
          <div>
            <span className="eyebrow">EVERY SHOT COUNTS</span>
            <h1>
              Your lens.
              <br />
              <em>Your legacy.</em>
            </h1>
            <p>
              Challenge photographers, share your best frames, and find your
              creative community.
            </p>
          </div>
          <div className="auth-startup-features">
            <span>01 · Photo battles</span>
            <span>02 · Creative missions</span>
            <span>03 · Your community</span>
          </div>
        </section>
      )}
      <section
        className={
          "account-modal auth-modal" + (fullPage ? " auth-startup-form" : "")
        }
        role={fullPage ? undefined : "dialog"}
        aria-modal={fullPage ? undefined : "true"}
        aria-labelledby="authTitle"
      >
        {!fullPage && (
          <button
            className="close-modal"
            aria-label="Close account form"
            onClick={onClose}
          >
            ×
          </button>
        )}
        <span className="eyebrow">FOCAL · EVERY SHOT COUNTS</span>
        <h2 id="authTitle">{title}</h2>
        <p>
          Use your email to join photo battles, build your character, and find
          your community.
        </p>
        {!auth.ready ? (
          <p>Connecting to accounts…</p>
        ) : (
          <form onSubmit={submit}>
            {view !== "reset" && (
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
            )}
            {view !== "forgot" && (
              <label>
                Password
                <input
                  required
                  type="password"
                  minLength={view === "signin" ? 1 : 12}
                  maxLength={128}
                  autoComplete={
                    view === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    view === "signin"
                      ? "Your password"
                      : "At least 12 characters"
                  }
                />
              </label>
            )}
            {["signup", "reset"].includes(view) && (
              <label>
                Confirm password
                <input
                  required
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </label>
            )}
            {(error || auth.error) && (
              <div className="notice" role="alert">
                {error || auth.error}
              </div>
            )}
            {notice && (
              <div className="notice" role="status">
                {notice}
              </div>
            )}
            <button
              className="primary big"
              disabled={busy || Boolean(auth.error)}
            >
              {busy
                ? "PLEASE WAIT…"
                : view === "signup"
                  ? "CREATE FREE ACCOUNT →"
                  : view === "forgot"
                    ? "EMAIL RESET LINK"
                    : view === "reset"
                      ? "SAVE NEW PASSWORD"
                      : "SIGN IN →"}
            </button>
            <div className="auth-switches">
              {view !== "reset" && (
                <button
                  type="button"
                  className="back"
                  onClick={() => {
                    setView(view === "signin" ? "signup" : "signin");
                    setError("");
                    setNotice("");
                  }}
                >
                  {view === "signin"
                    ? "New to FOCAL? Create an account"
                    : "Already have an account? Sign in"}
                </button>
              )}
              {view === "signin" && (
                <button
                  type="button"
                  className="back"
                  onClick={() => {
                    setView("forgot");
                    setError("");
                  }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          </form>
        )}
        <p className="fineprint">
          Your character, bio and social links are set up after you confirm your
          account. Sign in to enter the arena.
        </p>
      </section>
    </div>
  );
}
