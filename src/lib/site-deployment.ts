export type SiteRole = 'current'|'sales'|'admin'|'development'|'staging'|'tenant';
export const {siteRole,isTestSite,allowsHost,validateDeployment,runsSchedulers} = require('../../scripts/site-deployment.cjs') as {
 siteRole:(env?:NodeJS.ProcessEnv)=>SiteRole;
 isTestSite:(env?:NodeJS.ProcessEnv)=>boolean;
 allowsHost:(host:string|null,env?:NodeJS.ProcessEnv)=>boolean;
 validateDeployment:(env?:NodeJS.ProcessEnv)=>void;
 runsSchedulers:(env?:NodeJS.ProcessEnv)=>boolean;
};
