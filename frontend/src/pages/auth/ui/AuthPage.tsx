import { useState, type FormEvent, type ReactElement } from "react";
import { motion } from "motion/react";

import { useAuth } from "@/app/providers/auth/useAuth";
import type { AuthCredentials } from "@/entities/auth/model";
import { demoSummary } from "@/entities/finance";
import { money } from "@/shared/lib/format";

type Mode = "login" | "register";

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string") return error;

  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string") return detail;
  }

  if (error instanceof Error && error.message) return error.message;

  return "Не получилось — попробуйте ещё раз";
};

export default function AuthPage(): ReactElement {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const auth = useAuth();

  if (!auth) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink px-6 text-center">
        <p className="text-[14px] text-fg-muted">Сессия недоступна. Обновите страницу.</p>
      </div>
    );
  }

  const { login, register, isLoggingIn, loginError, isRegistering, registerError } = auth;

  const isLoading = isLoggingIn || isRegistering;
  const error = mode === "login" ? loginError : registerError;
  const errorMessage = error ? getErrorMessage(error) : null;
  const canSubmit = Boolean(email.trim() && password.trim() && !isLoading);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const credentials: AuthCredentials = { email: email.trim(), password };
    try {
      if (mode === "login") {
        await login(credentials);
      } else {
        await register(credentials);
      }
    } catch {
      /* ошибка показывается под формой */
    }
  };

  return (
    <div className="min-h-dvh bg-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-6 pb-10 pt-12 safe-top">
        <span className="text-[14px] font-semibold -tracking-[0.01em]">Честный месяц</span>

        <div className="mt-12">
          <h1 className="text-[26px] font-bold leading-[1.2] -tracking-[0.02em]">
            Банк показывает списания.
            <br />
            Мы — реальные траты.
          </h1>

          <div className="mt-7 space-y-3">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                <span className="text-fg-faint">Банк списал</span>
                <span className="tnum text-fg-muted">{money(demoSummary.bankSpent)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-line-strong" />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                <span className="text-fg">Ваши траты</span>
                <span className="tnum text-fg">{money(demoSummary.realExpense)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-raised">
                <motion.div
                  style={{ width: `${Math.round((demoSummary.realExpense / demoSummary.bankSpent) * 100)}%` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full origin-left rounded-full bg-sage"
                />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={submit} className="mt-auto space-y-2.5 pt-12">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Почта"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isLoading}
            className="h-13 w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-fg-faint focus:border-sage/60"
          />
          <input
            type="password"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isLoading}
            className="h-13 w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-fg-faint focus:border-sage/60"
          />

          {errorMessage ? <p className="px-1 text-[13px] text-destructive">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-2xl bg-sage px-4 py-4 text-[15px] font-semibold text-ink transition-opacity disabled:opacity-40"
          >
            {isLoading ? "Секунду…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="w-full py-2 text-[13.5px] text-fg-muted transition-colors hover:text-fg"
          >
            {mode === "login" ? "Создать аккаунт" : "У меня уже есть аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
