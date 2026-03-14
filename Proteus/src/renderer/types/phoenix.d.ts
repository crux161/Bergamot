declare module "phoenix" {
  export class Socket {
    constructor(endPoint: string, opts?: Record<string, any>);
    connect(): void;
    disconnect(callback?: () => void, code?: number, reason?: string): void;
    channel(topic: string, params?: Record<string, any>): Channel;
    onOpen(callback: () => void): void;
    onClose(callback: (event: any) => void): void;
    onError(callback: (error: any) => void): void;
  }

  export class Channel {
    join(timeout?: number): Push;
    leave(timeout?: number): Push;
    push(event: string, payload: Record<string, any>, timeout?: number): Push;
    on(event: string, callback: (payload: any) => void): number;
    off(event: string, ref?: number): void;
  }

  export class Push {
    receive(status: string, callback: (response: any) => void): Push;
  }
}
