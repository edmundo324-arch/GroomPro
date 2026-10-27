import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export const connectorPrefix='123PET_CONNECTOR:';
export type ConnectorConfig={id:string;tenantId:string;name:string;environment:'TEST'|'PRODUCTION';initialSource?:'123PET'|'GROOMPRO_DEMO';server:string;database:string;readEnabled:boolean;writeEnabled:boolean;revoked:boolean;tokenHash:string;createdAt:string;updatedAt:string;lastSeen?:string;schemaFingerprint?:string;status?:string;lease?:{holder:string;expires:number}};
export function newConnector(tenantId:string,input:any){
 if(!['TEST','PRODUCTION'].includes(input.environment))throw Error('Choose Test or Production.');
 const name=String(input.name||'').trim(),server=String(input.server||'').trim(),database=String(input.database||'').trim();
 if(!name||name.length>100||!server||server.length>191||!database||database.length>128)throw Error('Enter a connection name, SQL Server and database.');
 const initialSource=input.initialSource??'123PET';
 if(!['123PET','GROOMPRO_DEMO'].includes(initialSource))throw Error('Choose the source for initial setup.');
 if(initialSource==='GROOMPRO_DEMO'&&input.environment!=='TEST')throw Error('GroomPro-first initial setup is available only for a test database.');
 const id=randomBytes(16).toString('hex'),secret=randomBytes(32).toString('hex'),now=new Date().toISOString();
 const token=[tenantId,id,secret].map(encodeURIComponent).join('.');
 const config:ConnectorConfig={id,tenantId,name,server,database,environment:input.environment,initialSource,readEnabled:initialSource==='123PET',writeEnabled:false,revoked:false,tokenHash:hashToken(token),createdAt:now,updatedAt:now,status:'Awaiting local connector'};
 return {config,token};
}
export function hashToken(token:string){return createHash('sha256').update(token).digest('hex');}
export function tokenIdentity(token:string){
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid connector credential.');
 const [tenantId,id,secret]=parts.map(decodeURIComponent);
 if(!/^[a-zA-Z0-9_-]{1,191}$/.test(tenantId)||!/^[a-f0-9]{32}$/.test(id)||!/^[a-f0-9]{64}$/.test(secret))throw Error('Invalid connector credential.');
 return {tenantId,id};
}
export function acceptsToken(config:ConnectorConfig,token:string){
 if(config.revoked||!/^[a-f0-9]{64}$/.test(config.tokenHash))return false;
 return timingSafeEqual(Buffer.from(config.tokenHash,'hex'),Buffer.from(hashToken(token),'hex'));
}
export function publicConnector(config:ConnectorConfig){const {tokenHash,lease,...safe}=config;return safe;}
export function renewLease(config:ConnectorConfig,holder:string,now=Date.now()){
 if(!/^[a-f0-9-]{36}$/.test(holder))throw Error('Invalid connector instance.');
 if(config.lease&&config.lease.holder!==holder&&config.lease.expires>now)throw Error('Another connector instance is active.');
 config.lease={holder,expires:now+180000};
}
export function assertRead(config:ConnectorConfig){if(config.revoked||!config.readEnabled)throw Error('Reading is disabled for this connection.');}
// Business-operation compatibility is deliberately separate from connection
// reachability. A successful SQL statement alone cannot authorize live writes.
export function assertWrite(config:ConnectorConfig,operation:{verifiedTest:boolean;productionAuthorized:boolean}){
 if(config.revoked||!config.writeEnabled)throw Error('Writing is disabled for this connection.');
 if(!operation.verifiedTest)throw Error('This write operation has not passed 123Pet compatibility testing.');
 if(config.environment==='PRODUCTION'&&!operation.productionAuthorized)throw Error('Production writing requires separate operation-level authorization.');
}
export function validateSchema(input:any,config:ConnectorConfig){
 if(input?.formatVersion!==1||input.server!==config.server||input.database!==config.database)throw Error('Schema report does not match the authorized SQL Server and database.');
 for(const field of ['engine','columns','keys','relationships','changeTracking','trackingSettings','triggers','permissions'])if(!Array.isArray(input[field]))throw Error('Incomplete schema inspection: '+field);
 if(!input.engine.length||!input.columns.length)throw Error('No database schema was visible. Check metadata permissions.');
 if(input.columns.length>30000)throw Error('Schema report exceeds the supported inspection size.');
 return input;
}
