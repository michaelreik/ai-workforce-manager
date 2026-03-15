"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>
      )}
      {(actionLabel || secondaryLabel) && (
        <div className="flex items-center gap-2 mt-4">
          {actionLabel && actionHref && (
            <Button size="sm" nativeButton={false} render={<Link href={actionHref} />}>
              {actionLabel}
            </Button>
          )}
          {actionLabel && onAction && !actionHref && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && secondaryHref && (
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={secondaryHref} />}
            >
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
