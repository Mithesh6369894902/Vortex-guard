import type { PipelineEvent } from '@vertexguard/shared';

type Handler = (evt: PipelineEvent) => void;

class WsManager {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private retries = 0;

  connect(): void {
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onmessage = (e) => {
      try {
        this.handlers.forEach((h) => h(JSON.parse(e.data as string) as PipelineEvent));
      } catch {
        /* ignore malformed */
      }
    };
    this.ws.onclose = () => {
      this.retries += 1;
      if (this.retries <= 10) setTimeout(() => this.connect(), this.retries * 700);
    };
    this.ws.onopen = () => (this.retries = 0);
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

export const ws = new WsManager();