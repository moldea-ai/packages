import { Think, type Session } from '@cloudflare/think';

export class SupportAgent extends Think {
  getSystemPrompt() {
    return 'You help with orders.';
  }

  configureSession(session: Session) {
    return session
      .withContext('soul', {
        provider: { get: async () => 'You help with orders.' },
      })
      .withCachedPrompt();
  }
}
