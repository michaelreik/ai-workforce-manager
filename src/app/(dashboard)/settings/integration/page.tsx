"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/use-translations";
import { toast } from "sonner";
import { Copy, CheckCircle2, XCircle } from "lucide-react";

const BASE_URL = typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app";

const snippets = {
  "python-openai": `from openai import OpenAI

client = OpenAI(
    api_key="awm_sk_your_key_here",
    base_url="${BASE_URL}/api/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,

  "typescript-openai": `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'awm_sk_your_key_here',
  baseURL: '${BASE_URL}/api/v1',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);`,

  "python-anthropic": `from openai import OpenAI

# Use OpenAI SDK with Anthropic models through the proxy
client = OpenAI(
    api_key="awm_sk_your_key_here",
    base_url="${BASE_URL}/api/v1"
)

response = client.chat.completions.create(
    model="claude-sonnet",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`,

  curl: `curl ${BASE_URL}/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer awm_sk_your_key_here" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,

  langchain: `from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    api_key="awm_sk_your_key_here",
    base_url="${BASE_URL}/api/v1",
)

response = llm.invoke("Hello!")
print(response.content)`,
};

export default function IntegrationPage() {
  const { t } = useTranslations("settings");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  function copySnippet(key: keyof typeof snippets) {
    navigator.clipboard.writeText(snippets[key]);
    toast.success(t("copied"));
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "test" }],
        }),
      });
      // Even a 401 means the endpoint is reachable
      setTestResult(res.status === 401 ? "success" : res.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("integration")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("integrationDesc")}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("integrationEndpoint")}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? t("testing") : t("testConnection")}
            </Button>
            {testResult === "success" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            )}
            {testResult === "error" && (
              <XCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <code className="rounded-md bg-muted px-3 py-2 text-sm block">
            {BASE_URL}/api/v1/chat/completions
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("codeSnippets")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="python-openai">
            <TabsList>
              <TabsTrigger value="python-openai">OpenAI (Python)</TabsTrigger>
              <TabsTrigger value="typescript-openai">OpenAI (TS)</TabsTrigger>
              <TabsTrigger value="python-anthropic">Anthropic</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="langchain">LangChain</TabsTrigger>
            </TabsList>

            {(Object.keys(snippets) as Array<keyof typeof snippets>).map(
              (key) => (
                <TabsContent key={key} value={key} className="mt-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copySnippet(key)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <pre className="rounded-lg bg-muted p-4 text-xs overflow-x-auto">
                      <code>{snippets[key]}</code>
                    </pre>
                  </div>
                </TabsContent>
              )
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
