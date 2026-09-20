/**
 * Пока онбординг моковый, факт прохождения храним локально.
 * Когда появится бэкенд — источником правды станет `isOnboarded` у пользователя.
 */
const KEY = "honest-month:onboarded";

const keyFor = (email: string | null | undefined) => `${KEY}:${email ?? "guest"}`;

export const isOnboarded = (email: string | null | undefined): boolean => {
  try {
    return window.localStorage.getItem(keyFor(email)) === "1";
  } catch {
    return false;
  }
};

export const markOnboarded = (email: string | null | undefined) => {
  try {
    window.localStorage.setItem(keyFor(email), "1");
  } catch {
    /* приватный режим — онбординг просто покажется ещё раз */
  }
};

export const resetOnboarding = (email: string | null | undefined) => {
  try {
    window.localStorage.removeItem(keyFor(email));
  } catch {
    /* нечего чистить */
  }
};
