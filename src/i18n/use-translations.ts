"use client";

import { useContext, createContext, useCallback } from "react";
import type { Locale } from "./config";

type Messages = Record<string, unknown>;

type TranslationContextType = {
  locale: Locale;
  messages: Messages;
};

export const TranslationContext = createContext<TranslationContextType>({
  locale: "en",
  messages: {},
});

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export function useTranslations(namespace?: string) {
  const { messages, locale } = useContext(TranslationContext);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      let value = getNestedValue(messages, fullKey);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [messages, namespace]
  );

  return { t, locale };
}
