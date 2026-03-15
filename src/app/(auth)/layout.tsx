export const dynamic = "force-dynamic";

import { TranslationProvider } from "@/components/providers/translation-provider";
import { defaultLocale } from "@/i18n/config";
import { getMessages } from "@/i18n/get-messages";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages(defaultLocale);

  return (
    <TranslationProvider locale={defaultLocale} messages={messages}>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">{children}</div>
      </div>
    </TranslationProvider>
  );
}
