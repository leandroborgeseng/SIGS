import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = {
  correlationId: string;
  requestId: string;
  userId?: string;
  ip?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}
