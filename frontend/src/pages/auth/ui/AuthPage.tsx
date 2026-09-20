import { useState, type FormEvent, type ReactElement } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, FileText, Layers, Wallet } from "lucide-react";

import { useAuth } from "@/app/providers/auth/useAuth";
import type { AuthCredentials } from "@/entities/auth/model";
import { demoSummary } from "@/entities/finance";
import { money } from "@/shared/lib/format";
import { SilverOrbit } from "@/features/auth/ui/SilverOrbit";

type Mode = "login" | "register";
type Stage = "intro" | "form";

const PROMISE = [
  { icon: FileText, text: "Загружаете выписку" },
  { icon: Layers, text: "Мы восстанавливаем события" },
  { icon: Wallet, text: "Видите реальные траты" },
];

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
  const [stage, setStage] = useState<Stage>("intro");
  const [mode, setMode] = useState<Mode>("register");
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
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-6 pb-10 safe-top">
        {stage === "form" ? (
          <button
            type="button"
            onClick={() => setStage("intro")}
            aria-label="Назад"
            className="-ml-2 w-fit rounded-full p-2 text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <span className="text-[14px] font-semibold -tracking-[0.01em]">Честный месяц</span>
        )}

        <AnimatePresence mode="wait">
          {stage === "intro" ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col"
            >
              <div className="mt-12">
                <h1 className="text-[23px] font-bold leading-[1.25] -tracking-[0.02em]">
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
                        style={{
                          width: `${Math.round((demoSummary.realExpense / demoSummary.bankSpent) * 100)}%`,
                        }}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 1.1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full origin-left rounded-full bg-sage"
                      />
                    </div>
                  </div>
                </div>

                <ul className="mt-9 space-y-3.5">
                  {PROMISE.map((item) => (
                    <li key={item.text} className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-surface text-fg-muted">
                        <item.icon className="size-[18px]" strokeWidth={1.8} />
                      </span>
                      <span className="text-[14.5px]">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto space-y-2 pt-10">
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setStage("form");
                  }}
                  className="w-full rounded-2xl bg-sage px-4 py-4 text-[15px] font-semibold text-white"
                >
                  Начать
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setStage("form");
                  }}
                  className="w-full py-2 text-[13.5px] text-fg-muted transition-colors hover:text-fg"
                >
                  У меня уже есть аккаунт
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col"
            >
              <h1 className="mt-8 text-[24px] font-bold leading-tight -tracking-[0.02em]">
                {mode === "login" ? "С возвращением" : "Создадим аккаунт"}
              </h1>
              <p className="mt-2 text-[14px] text-fg-muted">
                {mode === "login" ? "Войдите, чтобы открыть свой месяц" : "Дальше загрузим выписку"}
              </p>

              {mode === "register" ? <SilverOrbit /> : null}

              <form onSubmit={submit} className={`mt-auto space-y-2.5 ${mode === "register" ? "pt-5" : "pt-10"}`}>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Почта"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-fg-faint focus:border-sage"
                />
                <input
                  type="password"
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="Пароль"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] outline-none transition-colors placeholder:text-fg-faint focus:border-sage"
                />

                {errorMessage ? <p className="px-1 text-[13px] text-destructive">{errorMessage}</p> : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full rounded-2xl bg-sage px-4 py-4 text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
