import type { ChatMessage } from "../shared/chat";
export class ReplyLifetime {
  private id = "";
  private dismissed = false;
  private terminal = false;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private publish: (message: ChatMessage | null) => void) {}
  update(message: ChatMessage) {
    if (message.id !== this.id) {
      if (message.status !== "streaming") return;
      clearTimeout(this.timer);
      this.id = message.id;
      this.dismissed = false;
      this.terminal = false;
    }
    if (this.dismissed) return;
    this.publish(message);
    if (message.status !== "streaming" && !this.terminal) {
      this.terminal = true;
      this.timer = setTimeout(() => this.dismiss(), 10000);
    }
  }
  dismiss() {
    clearTimeout(this.timer);
    this.dismissed = true;
    this.publish(null);
  }
}
