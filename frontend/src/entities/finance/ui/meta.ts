import {
  ArrowDownLeft,
  Car,
  Coffee,
  Dumbbell,
  House,
  Shirt,
  ShoppingCart,
  Ticket,
  Repeat,
  ArrowLeftRight,
  Banknote,
  CreditCard,
  HandCoins,
  HelpCircle,
  RotateCcw,
  ShoppingBag,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Category, EventType } from "../model/types";

type Meta = {
  label: string;
  icon: LucideIcon;
  /** Нейтрально по умолчанию: цветом выделяем только то, что меняет смысл суммы */
  tone: "neutral" | "sage" | "brass";
};

export const eventMeta: Record<EventType, Meta> = {
  EXPENSE: { label: "Покупка", icon: ShoppingBag, tone: "neutral" },
  INCOME: { label: "Доход", icon: ArrowDownLeft, tone: "sage" },
  OWN_TRANSFER: { label: "Перевод себе", icon: ArrowLeftRight, tone: "neutral" },
  DEBT_GIVEN: { label: "В долг", icon: HandCoins, tone: "neutral" },
  DEBT_REPAYMENT: { label: "Вернули долг", icon: Undo2, tone: "neutral" },
  REFUND: { label: "Возврат", icon: RotateCcw, tone: "sage" },
  SHARED_EXPENSE: { label: "Общий счёт", icon: Users, tone: "neutral" },
  MARKETPLACE_TRANSFER: { label: "Пополнение карты", icon: CreditCard, tone: "neutral" },
  CASH_WITHDRAWAL: { label: "Наличные", icon: Banknote, tone: "neutral" },
  UNKNOWN: { label: "Нужно решить", icon: HelpCircle, tone: "brass" },
};

/** Фирменные цвета банков — единственное место, где палитра выходит за токены */
export const bankMeta: Record<string, { name: string; short: string; color: string; ink: string }> = {
  tbank: { name: "Т-Банк", short: "Т", color: "#ffdd2d", ink: "#0b0c0e" },
  sber: { name: "Сбер", short: "С", color: "#21a038", ink: "#ffffff" },
  alfa: { name: "Альфа", short: "А", color: "#ef3124", ink: "#ffffff" },
  ozon: { name: "Ozon", short: "O", color: "#005bff", ink: "#ffffff" },
};

/** Для обычных покупок иконка берётся по категории — так список читается быстрее */
export const categoryIcon: Partial<Record<Category, LucideIcon>> = {
  Продукты: ShoppingCart,
  Кафе: Coffee,
  Транспорт: Car,
  Дом: House,
  Здоровье: Dumbbell,
  Развлечения: Ticket,
  Подписки: Repeat,
  Одежда: Shirt,
  Наличные: Banknote,
};
