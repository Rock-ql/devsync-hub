import { useCallback, useEffect, useRef } from "react";

interface SSEOptions {
  events?: string[];
  onMessage?: (event: string, data: string) => void;
  onError?: (error: Event) => void;
}

export function useSSE(options?: SSEOptions) {
  const sourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef<SSEOptions | undefined>(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const source = new EventSource("http://127.0.0.1:3721/events");

    source.addEventListener("heartbeat", () => {
      // heartbeat received
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
      // 自动重连由 EventSource 处理
    };

    sourceRef.current = source;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
    };
  }, [connect]);

  return { reconnect: connect };
}
