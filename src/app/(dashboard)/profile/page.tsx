"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/i18n/use-translations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  User,
  Shield,
  Bell,
  Download,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Lock,
} from "lucide-react";
import type { UserProfile } from "@/types/database";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const THEME_OPTIONS = [
  { value: "dark", icon: Moon },
  { value: "light", icon: Sun },
  { value: "system", icon: Monitor },
] as const;

export default function ProfilePage() {
  const { t } = useTranslations("profile");
  const { t: tCommon } = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<{
    display_name: string;
    avatar_url: string;
    timezone: string;
    theme: "light" | "dark" | "system";
    two_factor_enabled: boolean;
    notification_prefs: {
      critical: boolean;
      warning: boolean;
      info: boolean;
      digest: boolean;
    };
  }>({
    display_name: "",
    avatar_url: "",
    timezone: "UTC",
    theme: "dark",
    two_factor_enabled: false,
    notification_prefs: {
      critical: true,
      warning: true,
      info: false,
      digest: true,
    },
  });

  // Password change
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        setEmail(user.email || "");

        // Try to load existing profile
        const { data: profileData } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileData) {
          const p = profileData as UserProfile;
          setProfile({
            display_name: p.display_name || "",
            avatar_url: p.avatar_url || "",
            timezone: p.timezone,
            theme: p.theme,
            two_factor_enabled: p.two_factor_enabled,
            notification_prefs: p.notification_prefs,
          });
        } else {
          // Create default profile
          await supabase.from("user_profiles").insert({
            user_id: user.id,
            display_name: user.email?.split("@")[0] || "",
          });
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabase]);

  async function handleSave() {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user.id,
          display_name: profile.display_name || null,
          avatar_url: profile.avatar_url || null,
          timezone: profile.timezone,
          theme: profile.theme,
          two_factor_enabled: profile.two_factor_enabled,
          notification_prefs: profile.notification_prefs,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Apply theme change
      const html = document.documentElement;
      if (profile.theme === "system") {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        html.className = prefersDark ? "dark" : "";
      } else {
        html.className = profile.theme === "dark" ? "dark" : "";
      }

      toast.success(t("saved"));
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast.error(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setPasswordError("");

    if (passwordForm.newPassword.length < 8) {
      setPasswordError(t("passwordTooShort"));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t("passwordMismatch"));
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(t("passwordChanged"));
    setPasswordForm({ newPassword: "", confirmPassword: "" });
  }

  async function handleExportData() {
    // In production, this would trigger a background job to compile user data
    // and send a download link via email
    toast.success(t("exportRequested"));
  }

  function updateProfile<K extends keyof typeof profile>(
    key: K,
    value: (typeof profile)[K]
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function updateNotifPref(key: keyof typeof profile.notification_prefs, value: boolean) {
    setProfile((prev) => ({
      ...prev,
      notification_prefs: { ...prev.notification_prefs, [key]: value },
    }));
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  const initials = (
    profile.display_name || email.split("@")[0] || "?"
  )
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            {t("personalInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              {profile.avatar_url ? (
                <AvatarImage src={profile.avatar_url} />
              ) : null}
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("avatar")}</p>
              <p className="text-xs text-muted-foreground">{t("avatarHint")}</p>
            </div>
          </div>

          <Separator />

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">{t("displayName")}</Label>
            <Input
              id="display-name"
              value={profile.display_name}
              onChange={(e) => updateProfile("display_name", e.target.value)}
              placeholder={t("displayNamePlaceholder")}
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input value={email} disabled />
            <p className="text-xs text-muted-foreground">
              {t("emailReadonly")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="h-4 w-4" />
            {t("appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme */}
          <div className="space-y-2">
            <Label>{t("theme")}</Label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = profile.theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      updateProfile("theme", option.value as typeof profile.theme)
                    }
                    className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(
                      `theme${option.value.charAt(0).toUpperCase() + option.value.slice(1)}` as
                        | "themeDark"
                        | "themeLight"
                        | "themeSystem"
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label>{t("timezone")}</Label>
            <Select
              value={profile.timezone}
              onValueChange={(v) => v && updateProfile("timezone", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            {t("security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 2FA */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("twoFactor")}</p>
              <p className="text-xs text-muted-foreground">
                {t("twoFactorDesc")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  profile.two_factor_enabled ? "default" : "secondary"
                }
                className={
                  profile.two_factor_enabled
                    ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                    : ""
                }
              >
                {profile.two_factor_enabled
                  ? t("twoFactorEnabled")
                  : t("twoFactorDisabled")}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled
                title={t("twoFactorComingSoon")}
              >
                <Lock className="h-3 w-3" />
                {profile.two_factor_enabled
                  ? t("twoFactorDisable")
                  : t("twoFactorEnable")}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Change Password */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("changePassword")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t("newPassword")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      newPassword: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  {t("confirmPassword")}
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({
                      ...p,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {passwordError && (
              <p className="text-xs text-destructive">{passwordError}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleChangePassword}
              disabled={!passwordForm.newPassword}
            >
              {t("changePassword")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            {t("notifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              {
                key: "critical" as const,
                label: "notifCritical",
                desc: "notifCriticalDesc",
              },
              {
                key: "warning" as const,
                label: "notifWarning",
                desc: "notifWarningDesc",
              },
              {
                key: "info" as const,
                label: "notifInfo",
                desc: "notifInfoDesc",
              },
              {
                key: "digest" as const,
                label: "notifDigest",
                desc: "notifDigestDesc",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{t(item.label)}</p>
                <p className="text-xs text-muted-foreground">
                  {t(item.desc)}
                </p>
              </div>
              <Switch
                checked={profile.notification_prefs[item.key]}
                onCheckedChange={(checked) =>
                  updateNotifPref(item.key, checked)
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            {t("dataPrivacy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Export Data */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("exportData")}</p>
              <p className="text-xs text-muted-foreground">
                {t("exportDataDesc")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData}>
              <Download className="h-3 w-3" />
              {t("exportRequest")}
            </Button>
          </div>

          <Separator />

          {/* Delete Account */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-destructive">
                {t("deleteAccount")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("deleteAccountDesc")}
              </p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              <Trash2 className="h-3 w-3" />
              {t("deleteAccountButton")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? tCommon("loading") : tCommon("save")}
        </Button>
      </div>
    </div>
  );
}
