import type { ChatMessage } from "../shared/chat";
export class ReplyLifetime {
  private id = "";
  private dismissed = false;
  private terminal = false;
  private timer?: ReturnType<typeof setTimeout>;
  private hovered = false;
  private remaining = 10000;
  private deadline = 0;
  constructor(private publish: (message: ChatMessage | null) => void) {}
  update(message: ChatMessage) {
    if (message.id !== this.id) {
      if (message.status !== "streaming") return;
      clearTimeout(this.timer);
      this.id = message.id;
      this.dismissed = false;
      this.terminal = false;
      this.remaining = 10000;
    }
    if (this.dismissed) return;
    this.publish(message);
    if (message.status !== "streaming" && !this.terminal) {
      this.terminal = true;
      this.schedule();
    }
  }
  dismiss() {
    clearTimeout(this.timer);
    this.dismissed = true;
    this.hovered = false;
    this.publish(null);
  }
  keepAlive() {
    if (this.dismissed || !this.terminal) return;
    clearTimeout(this.timer);
    this.remaining = 10000;
    this.schedule();
  }
  setHovered(value: boolean) {
    if (this.dismissed || this.hovered === value) return;
    this.hovered = value;
    if (!this.terminal) return;
    if (value) {
      this.remaining = Math.max(0, this.deadline - Date.now());
      clearTimeout(this.timer);
    } else this.schedule();
  }
  private schedule() {
    if (this.hovered) return;
    this.deadline = Date.now() + this.remaining;
    this.timer = setTimeout(() => this.dismiss(), this.remaining);
  }
}
