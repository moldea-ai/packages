import { Think, type Session } from '@cloudflare/think';

export class SupportAgent extends Think {
  configureContext() {
    return [{ label: 'soul', provider: { get: async () => 'You help with orders.' } }];
  }

  configureSession(session: Session) {
    return session.withContext('memory', { description: 'Facts about the customer.' });
  }
}
