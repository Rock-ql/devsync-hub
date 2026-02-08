import { useEffect, useCallback, useRef } from "react";

interface SSEOptions {
  onMessage?: (event: string, data: string) => void;
  onError?: (error: Event) => void;
}

export function useSSE(options?: SSEOptions) {
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const source = new EventSource("http://127.0.0.1:3721/events");

    source.addEventListener("heartbeat", () => {
      // heartbeat received
    });

    source.onmessage = (event) => {
      options?.onMessage?.("message", event.data);
    };

    source.onerror = (event) => {
      options?.onError?.(event);
      // 自动重连由 EventSource 处理
    };

    sourceRef.current = source;
  }, [options]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
    };
  }, [connect]);

  return { reconnect: connect };
}
