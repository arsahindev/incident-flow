"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

import { realtimeIncidentSignalSchema } from "@incidentflow/contracts";
import {
  acceptRealtimeIncidentSignal,
  synchronizeIncidentVersions,
  SocketConnectionStatus,
} from "@/lib/realtime";
import { clientEnvironment } from "@/lib/env/client";

export function RealtimeIncidentRefresh({
  incidents,
  incidentId,
}: {
  incidents: ReadonlyArray<{ id: string; version: number }>;
  incidentId?: string;
}) {
  const router = useRouter();
  const latestVersions = useRef(new Map<string, number>());
  const [status, setStatus] = useState<SocketConnectionStatus>("connecting");

  useEffect(() => {
    synchronizeIncidentVersions(latestVersions.current, incidents);
  }, [incidents]);

  useEffect(() => {
    let hasConnected = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleCanonicalRefetch = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        router.refresh();
      }, 75);
    };

    const realtimeUrl =
      clientEnvironment.NEXT_PUBLIC_REALTIME_URL === "same-origin"
        ? window.location.origin
        : clientEnvironment.NEXT_PUBLIC_REALTIME_URL;
    const socket = io(realtimeUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setStatus("connected");
      if (incidentId) {
        socket.emit("realtime:join-incident", { incidentId });
      }
      if (hasConnected) scheduleCanonicalRefetch();
      hasConnected = true;
    });
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", (error: Error & { data?: { code?: string } }) => {
      if (error.data?.code === "authentication_required") {
        router.replace("/login");
        router.refresh();
        return;
      }
      setStatus("connecting");
    });
    socket.on("realtime:session-revoked", () => {
      router.replace("/login");
      router.refresh();
    });
    socket.on("realtime:incident", (payload) => {
      const parsed = realtimeIncidentSignalSchema.safeParse(payload);
      if (!parsed.success) return;
      if (incidentId && parsed.data.incidentId !== incidentId) return;
      if (acceptRealtimeIncidentSignal(latestVersions.current, parsed.data)) {
        scheduleCanonicalRefetch();
      }
    });

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.close();
    };
  }, [incidentId, router]);

  const labels: Record<SocketConnectionStatus, string> = {
    connecting: "Connecting live updates",
    connected: "Live updates connected",
    disconnected: "Live updates reconnecting",
  };

  return (
    <span
      className="inline-flex items-center gap-2 text-xs text-slate-500"
      aria-live="polite"
      title="Realtime messages trigger a canonical API refetch"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          status === "connected" ? "bg-emerald-400" : "bg-amber-400"
        }`}
        aria-hidden="true"
      />
      {labels[status]}
    </span>
  );
}
