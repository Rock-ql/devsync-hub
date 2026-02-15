import { useCallback, useEffect, useRef } from "react";

const SSE_URL = "http://127.0.0.1:3721/events";
const HEARTBEAT_TIMEOUT_MS = 35_000;

interface SSEOptions {
  events?: string[];
  onMessage?: (event: string, data: string) => void;
  onError?: (error: Event) => void;
}

export function useSSE(options?: SSEOptions) {
  const sourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef<SSEOptions | undefined>(options);
  const heartbeatTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const resetHeartbeatTimer = useCallback((reconnectFn: () => void) => {
    clearTimeout(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setTimeout(() => {
      sourceRef.current?.close();
      reconnectFn();
    }, HEARTBEAT_TIMEOUT_MS);
  }, []);

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const source = new EventSource(SSE_URL);

    source.addEventListener("heartbeat", () => {
      resetHeartbeatTimer(connect);
    });

    const customEvents = optionsRef.current?.events || [];
    customEvents.forEach((eventName) => {
      source.addEventListener(eventName, (event) => {
        optionsRef.current?.onMessage?.(eventName, (event as MessageEvent).data);
      });
    });

    source.onmessage = (event) => {
      optionsRef.current?.onMessage?.("message", event.data);
    };

    source.onerror = (event) => {
      optionsRef.current?.onError?.(event);
    };

    sourceRef.current = source;
    resetHeartbeatTimer(connect);
  }, [resetHeartbeatTimer]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(heartbeatTimerRef.current);
      sourceRef.current?.close();
    };
  }, [connect]);

  return { reconnect: connect };
}
