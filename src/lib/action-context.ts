import {AsyncLocalStorage} from 'node:async_hooks';

// Only server code can establish this context. It lasts for one composite request.
export const actionContext = new AsyncLocalStorage<{tenantId:string;session:any}>();
