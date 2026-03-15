"use client";

import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HelpTooltipProps = {
  content: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

export function HelpTooltip({
  content,
  learnMoreHref,
  learnMoreLabel = "Learn more →",
  side = "top",
  className,
}: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <CircleHelp
            className={`h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-help transition-colors ${className || ""}`}
          />
        }
      />
      <TooltipContent side={side} className="max-w-64">
        <p className="text-xs leading-relaxed">{content}</p>
        {learnMoreHref && (
          <a
            href={learnMoreHref}
            className="text-xs text-primary hover:underline mt-1 inline-block"
            target="_blank"
            rel="noopener noreferrer"
          >
            {learnMoreLabel}
          </a>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
