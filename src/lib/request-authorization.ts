import {AsyncLocalStorage} from 'node:async_hooks';
export const requestAuthorization=new AsyncLocalStorage<Map<string,Promise<any>>>();
