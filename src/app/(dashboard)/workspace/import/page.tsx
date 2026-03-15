"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslations } from "@/i18n/use-translations";
import { useOrg } from "@/components/providers/org-provider";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

type ParsedRow = {
  email: string;
  date: string;
  messages: number;
  conversations: number;
  tokens: number;
  cost: number;
  model: string;
  task_category: string;
  valid: boolean;
  error?: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const TEMPLATE_CSV = `email,date,messages,conversations,tokens,cost,model,task_category
john@company.com,2026-03-01,45,12,15000,0.85,gpt-4o,coding
sarah@company.com,2026-03-01,23,8,8000,0.42,gpt-4o,writing
mike@company.com,2026-03-01,67,20,25000,1.20,claude-sonnet,research`;

export default function ImportPage() {
  const { t } = useTranslations("workspace");
  const { t: tCommon } = useTranslations("common");
  const { currentOrg } = useOrg();
  const supabase = useMemo(() => createClient(), []);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usage-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const parseCSV = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const emailIdx = headers.indexOf("email");
    const dateIdx = headers.indexOf("date");
    const messagesIdx = headers.indexOf("messages");
    const convoIdx = headers.indexOf("conversations");
    const tokensIdx = headers.indexOf("tokens");
    const costIdx = headers.indexOf("cost");
    const modelIdx = headers.indexOf("model");
    const categoryIdx = headers.indexOf("task_category");

    if (emailIdx === -1 || dateIdx === -1) {
      toast.error(t("importMissingColumns"));
      return [];
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      if (cols.length < 2 || !cols[emailIdx]) continue;

      const email = cols[emailIdx];
      const date = cols[dateIdx];
      const messages = parseInt(cols[messagesIdx]) || 0;
      const conversations = parseInt(cols[convoIdx]) || 0;
      const tokens = parseInt(cols[tokensIdx]) || 0;
      const cost = parseFloat(cols[costIdx]) || 0;
      const model = cols[modelIdx] || "";
      const task_category = cols[categoryIdx] || "";

      let valid = true;
      let error: string | undefined;

      if (!email.includes("@")) {
        valid = false;
        error = "Invalid email";
      } else if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        valid = false;
        error = "Invalid date (use YYYY-MM-DD)";
      }

      rows.push({
        email,
        date,
        messages,
        conversations,
        tokens,
        cost,
        model,
        task_category,
        valid,
        error,
      });
    }
    return rows;
  }, [t]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f || !f.name.endsWith(".csv")) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setParsedRows(rows);
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!currentOrg || parsedRows.length === 0) return;
    setImporting(true);

    const validRows = parsedRows.filter((r) => r.valid);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      // Find or create workspace member
      let { data: member } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("org_id", currentOrg.id)
        .eq("email", row.email)
        .single();

      if (!member) {
        const { data: newMember, error } = await supabase
          .from("workspace_members")
          .insert({
            org_id: currentOrg.id,
            email: row.email,
            name: row.email.split("@")[0],
          })
          .select("id")
          .single();

        if (error) {
          errors.push(`${row.email}: ${error.message}`);
          skipped++;
          continue;
        }
        member = newMember;
      }

      // Upsert human_usage
      const { error } = await supabase.from("human_usage").upsert(
        {
          org_id: currentOrg.id,
          member_id: member!.id,
          source_id: null,
          date: row.date,
          messages_count: row.messages,
          conversations_count: row.conversations,
          tokens_used: row.tokens,
          cost: row.cost,
          models_used: row.model ? [row.model] : [],
          task_categories: row.task_category
            ? { [row.task_category]: row.messages }
            : {},
        },
        { onConflict: "org_id,source_id,member_id,date" }
      );

      if (error) {
        errors.push(`${row.email} (${row.date}): ${error.message}`);
        skipped++;
      } else {
        imported++;
      }
    }

    const invalidCount = parsedRows.filter((r) => !r.valid).length;
    setResult({
      imported,
      skipped: skipped + invalidCount,
      errors,
    });
    setImporting(false);
    if (imported > 0) toast.success(t("importSuccess", { count: imported }));
  }

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/workspace/sources" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("importTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("importSubtitle")}</p>
        </div>
      </div>

      {/* Template download */}
      <Card>
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t("importTemplate")}</p>
              <p className="text-xs text-muted-foreground">{t("importTemplateDesc")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            {t("downloadTemplate")}
          </Button>
        </CardContent>
      </Card>

      {/* Upload zone */}
      <Card>
        <CardContent className="py-8">
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById("csv-input")?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">{t("importDragDrop")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("importOrClick")}</p>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground mt-3 text-center">
              {file.name} — {parsedRows.length} rows parsed
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {parsedRows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("importPreview")}</CardTitle>
            <div className="flex items-center gap-2">
              {validCount > 0 && (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20">
                  {validCount} valid
                </Badge>
              )}
              {invalidCount > 0 && (
                <Badge variant="destructive">{invalidCount} invalid</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <TableRow key={i} className={row.valid ? "" : "bg-destructive/5"}>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{row.email}</TableCell>
                      <TableCell className="text-xs">{row.date}</TableCell>
                      <TableCell className="text-xs">{row.messages}</TableCell>
                      <TableCell className="text-xs">{row.tokens}</TableCell>
                      <TableCell className="text-xs">${row.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{row.model}</TableCell>
                      <TableCell className="text-xs">{row.task_category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {parsedRows.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing first 20 of {parsedRows.length} rows
              </p>
            )}

            <div className="flex justify-end mt-4">
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("importNow", { count: validCount })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="text-sm font-medium">
                {result.imported} imported, {result.skipped} skipped
              </p>
            </div>
            {result.errors.length > 0 && (
              <div className="text-xs text-destructive space-y-1 mt-2">
                {result.errors.slice(0, 5).map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
                {result.errors.length > 5 && (
                  <p>...and {result.errors.length - 5} more errors</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
