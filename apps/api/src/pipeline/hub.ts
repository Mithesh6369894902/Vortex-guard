import type { WebSocket } from 'ws';
import type { PipelineEvent } from '@vertexguard/shared';

/** Tiny fan-out hub: every WebSocket client receives every pipeline event. */
export class EventHub {
  private clients = new Set<WebSocket>();

  add(ws: WebSocket): void {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  remove(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  broadcast(evt: PipelineEvent): void {
    const payload = JSON.stringify(evt);
    for (const ws of [...this.clients]) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }

  get size(): number {
    return this.clients.size;
  }
}

let _hub: EventHub | null = null;
export function hub(): EventHub {
  if (!_hub) _hub = new EventHub();
  return _hub;
}