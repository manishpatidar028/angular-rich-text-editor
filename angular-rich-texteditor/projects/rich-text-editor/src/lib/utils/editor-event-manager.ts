export type EditorEventHandler = () => void;

export interface EditorEvent {
  event: string;
  handler: EditorEventHandler;
}

export class EditorEventManager {
  private listeners: EditorEvent[] = [];

  constructor(private editorInstance: any) {}

  attach(event: string, handler: EditorEventHandler): void {
    if (this.editorInstance?.attachEvent) {
      this.editorInstance.attachEvent(event, handler);
      this.listeners.push({ event, handler });
    }
  }

  attachMany(events: string[], handler: EditorEventHandler): void {
    events.forEach(event => this.attach(event, handler));
  }

  detachAll(): void {
    if (this.editorInstance?.detachEvent) {
      this.listeners.forEach(({ event, handler }) => {
        try {
          this.editorInstance.detachEvent(event, handler);
        } catch {}
      });
    }
    this.listeners = [];
  }
}
