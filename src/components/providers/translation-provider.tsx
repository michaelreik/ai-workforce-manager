"use client";

import { TranslationContext } from "@/i18n/use-translations";
import type { Locale } from "@/i18n/config";

type Props = {
  locale: Locale;
  messages: Record<string, unknown>;
  children: React.ReactNode;
};

export function TranslationProvider({ locale, messages, children }: Props) {
  return (
    <TranslationContext.Provider value={{ locale, messages }}>
      {children}
    </TranslationContext.Provider>
  );
}
