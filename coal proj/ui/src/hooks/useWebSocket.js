import { useEffect, useRef, useCallback, useState } from 'react';
import { createBrowserPipelineRuntime } from '../simulator/browserRuntime';
import { shouldPreferBrowserRuntime } from './runtimeMode';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
const PREFER_BROWSER_RUNTIME = shouldPreferBrowserRuntime(import.meta.env);
const RECONNECT_DELAY = 3000;

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const browserRuntime = useRef(null);
  const browserRuntimeActive = useRef(false);
  const [connected, setConnected] = useState(false);
  const [transport, setTransport] = useState('connecting');
  const reconnectTimer = useRef(null);
  const mountedRef = useRef(true);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const enableBrowserRuntime = useCallback(() => {
    if (browserRuntimeActive.current) return;

    browserRuntimeActive.current = true;
    clearReconnectTimer();

    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }

    browserRuntime.current = createBrowserPipelineRuntime(onMessage);

    if (mountedRef.current) {
      setConnected(true);
      setTransport('browser');
      onMessage({ type: 'ready', mode: 'browser' });
    }
  }, [clearReconnectTimer, onMessage]);

  const connect = useCallback(() => {
    if (browserRuntimeActive.current) return;

    if (PREFER_BROWSER_RUNTIME) {
      enableBrowserRuntime();
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const socket = new WebSocket(WS_URL);
      ws.current = socket;

      socket.onopen = () => {
        if (mountedRef.current && !browserRuntimeActive.current) {
          setConnected(true);
          setTransport('websocket');
        }
      };

      socket.onclose = () => {
        if (mountedRef.current && !browserRuntimeActive.current) {
          setConnected(false);
          ws.current = null;
          reconnectTimer.current = setTimeout(enableBrowserRuntime, RECONNECT_DELAY);
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {}
      };
    } catch {
      reconnectTimer.current = setTimeout(enableBrowserRuntime, RECONNECT_DELAY);
    }
  }, [enableBrowserRuntime, onMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearReconnectTimer();
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
      if (browserRuntime.current) {
        browserRuntime.current.dispose();
        browserRuntime.current = null;
      }
      browserRuntimeActive.current = false;
    };
  }, [clearReconnectTimer, connect]);

  const send = useCallback((data) => {
    if (browserRuntimeActive.current) {
      browserRuntime.current?.send(data);
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, send, transport };
}
