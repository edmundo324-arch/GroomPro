import {createHash} from 'node:crypto';
export const catalogVersion=(record:unknown)=>createHash('sha256').update(JSON.stringify(record)).digest('hex');
