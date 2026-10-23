import type { ChatMessage } from "./chat";
export interface DesktopReply {
  message: ChatMessage;
  side: "left" | "right";
  theme: "light" | "dark";
}
