import { isAxiosError } from "axios";

import apiProtected from "@/shared/api/axiosInstance";

/** Категории, которые распознаёт голосовой шлюз на бэкенде */
export type VoiceCategory =
  | "groceries"
  | "restaurants"
  | "transport"
  | "electronics"
  | "household"
  | "subscriptions"
  | "health"
  | "shopping"
  | "cash"
  | "other";

export const VOICE_CATEGORY_LABELS: Record<VoiceCategory, string> = {
  groceries: "Продукты",
  restaurants: "Кафе",
  transport: "Транспорт",
  electronics: "Техника",
  household: "Дом",
  subscriptions: "Подписки",
  health: "Здоровье",
  shopping: "Покупки",
  cash: "Наличные",
  other: "Прочее",
};

/** Черновик операции: бэкенд не пишет его в базу до подтверждения */
export type VoiceTransaction = {
  external_id: string;
  account_id: string;
  amount_minor: number;
  occurred_at: string;
  currency?: string;
  description?: string;
  merchant?: string | null;
  counterparty?: string | null;
  category?: VoiceCategory | null;
  card_last4?: string | null;
  source: string;
};

export type VoicePreview = {
  transcript: string;
  transaction: VoiceTransaction;
  candidate_transaction_ids: string[];
  requires_confirmation: boolean;
};

export type VoiceConfirmResult = {
  matched_transaction_id: string | null;
  import_result: { imported?: number; duplicates?: number } | null;
  resolution: unknown | null;
};

export type VoiceAccount = {
  id: string;
  bank: string;
  name: string;
  currency: string;
  balance_minor: number;
};

export const getAccounts = async (): Promise<VoiceAccount[]> => {
  const { data } = await apiProtected.get<VoiceAccount[]>("/accounts");
  return data;
};

/** Аудио уходит на распознавание; в ответе — черновик и похожие операции из выписки */
export const previewVoice = async (accountId: string, file: File): Promise<VoicePreview> => {
  const form = new FormData();
  form.append("file", file);

  const { data } = await apiProtected.post<VoicePreview>("/voice/preview", form, {
    params: { account_id: accountId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const confirmVoice = async (
  transaction: VoiceTransaction,
  matchedTransactionId: string | null
): Promise<VoiceConfirmResult> => {
  const { data } = await apiProtected.post<VoiceConfirmResult>("/voice/confirm", {
    transaction,
    matched_transaction_id: matchedTransactionId,
  });
  return data;
};

/** Бэкенд отвечает по RFC 7807; переводим известные причины на человеческий */
const DETAILS: Record<string, string> = {
  "Voice input is not configured": "Голосовой ввод не настроен на сервере",
  "Audio file is empty": "Запись пустая — похоже, микрофон не слышал",
  "No speech was recognized": "Не расслышали ни слова. Попробуйте ещё раз",
  "Voice model returned invalid transaction JSON": "Не разобрали трату из сказанного. Скажите сумму и место",
  "Upload an audio file": "Браузер записал не аудио — попробуйте другой",
  "Audio must be at most 20 MiB": "Запись слишком длинная",
  "Zero-value operations are not supported": "Не услышали сумму",
  "Account not found": "Счёт не найден",
};

export const voiceErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (detail && DETAILS[detail]) return DETAILS[detail];
    if (detail) return detail;
    if (error.response?.status === 413) return "Запись слишком длинная";
    if (!error.response) return "Сервер не отвечает";
  }
  return "Не получилось записать трату";
};
