"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

type UseRealtimeOptions<T> = {
  table: string;
  event?: PostgresChangeEvent;
  filter?: string; // e.g. "org_id=eq.xxx"
  onInsert?: (record: T) => void;
  onUpdate?: (record: T) => void;
  onDelete?: (old: T) => void;
  enabled?: boolean;
};

type RealtimeStatus = "connecting" | "connected" | "disconnected";

/**
 * Hook for subscribing to Supabase Realtime postgres_changes.
 * Cleans up subscription on unmount.
 */
export function useRealtime<T = Record<string, unknown>>(
  options: UseRealtimeOptions<T>
) {
  const {
    table,
    event = "*",
    filter,
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
  } = options;

  const [status, setStatus] = useState<RealtimeStatus>("disconnected");
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Stable refs for callbacks so we don't re-subscribe on every render
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");

    const channelName = `${table}-${filter || "all"}-${Date.now()}`;

    const channelConfig: {
      event: PostgresChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema: "public",
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        channelConfig,
        (payload: {
          eventType: string;
          new: T;
          old: T;
        }) => {
          if (payload.eventType === "INSERT" && onInsertRef.current) {
            onInsertRef.current(payload.new);
          } else if (payload.eventType === "UPDATE" && onUpdateRef.current) {
            onUpdateRef.current(payload.new);
          } else if (payload.eventType === "DELETE" && onDeleteRef.current) {
            onDeleteRef.current(payload.old);
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setStatus("disconnected");
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setStatus("disconnected");
    };
  }, [table, event, filter, enabled, supabase]);

  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      setStatus("disconnected");
    }
  }, [supabase]);

  return { status, unsubscribe };
}
