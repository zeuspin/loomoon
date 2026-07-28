import { useEffect, useRef, useState } from "react";

interface LoginDialogProps {
  busy: boolean;
  error: string;
  open: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

export function LoginDialog({
  busy,
  error,
  open,
  onClose,
  onLogin,
}: LoginDialogProps) {
  const [email, setEmail] = useState("demo@loomoon.local");
  const [password, setPassword] = useState("loomoon-demo");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) emailRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="lm-auth-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        aria-labelledby="lm-auth-title"
        aria-modal="true"
        className="lm-auth-dialog"
        role="dialog"
      >
        <div className="lm-auth-visual" aria-hidden="true">
          <LoomoonGlyph />
          <div>
            <strong>Loomoon</strong>
            <span>让设计变简单</span>
          </div>
          <i />
          <i />
        </div>
        <form
          className="lm-auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onLogin(email.trim(), password);
          }}
        >
          <button
            aria-label="关闭登录"
            className="lm-auth-close"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
          <div>
            <small>WELCOME TO LOOMOON</small>
            <h2 id="lm-auth-title">登录 Loomoon</h2>
            <p>登录后继续刚才的创作操作</p>
          </div>
          <label>
            邮箱
            <input
              ref={emailRef}
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
              value={email}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
          {error && (
            <p className="lm-auth-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="lm-auth-submit"
            disabled={busy || !email.trim() || !password}
            type="submit"
          >
            {busy ? "登录中…" : "登录"}
          </button>
          <p className="lm-auth-legal">
            登录即代表同意《用户协议》和《隐私政策》
          </p>
          <aside>
            <b>演示账号</b>
            <span>demo@loomoon.local / loomoon-demo</span>
          </aside>
        </form>
      </section>
    </div>
  );
}

export function LoomoonGlyph() {
  return (
    <span className="lm-glyph" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
