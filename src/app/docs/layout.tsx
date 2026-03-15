import { TranslationProvider } from "@/components/providers/translation-provider";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help Center — AI Workforce Manager",
  description:
    "Complete guide to AI Workforce Manager — setup, integration, use cases, and troubleshooting",
  openGraph: {
    title: "Help Center — AI Workforce Manager",
    description:
      "Complete guide to AI Workforce Manager — setup, integration, use cases, and troubleshooting",
    type: "website",
  },
};

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages(defaultLocale);

  return (
    <TranslationProvider locale={defaultLocale} messages={messages}>
      {children}
    </TranslationProvider>
  );
}
