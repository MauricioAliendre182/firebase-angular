export interface ChatMessage {
  id?: string;
  userId: string;
  content: string;
  sentAt: Date;
  type: 'user' | 'assistant';
  status?: 'sending' | 'sent' | 'error' | 'temporary';
}

export interface ChatConversation {
  id?: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
  title?: string;
}
