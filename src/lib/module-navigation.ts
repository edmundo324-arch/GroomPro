import {WORKSPACE_FEATURES,ALWAYS_VISIBLE_WORKSPACES} from './module-catalog';
export type FeatureSetting={code?:string;featureCode?:string;enabled?:boolean};
// Missing settings never remove navigation. Only explicit feature opt-outs apply.
export function visibleModules<T extends string>(modules:readonly T[],features:FeatureSetting[]):T[]{
 const core=ALWAYS_VISIBLE_WORKSPACES;
 const disabled=new Set(features.filter(f=>f.enabled===false).map(f=>f.code||f.featureCode).filter(Boolean));
 return modules.filter(m=>core.has(m)||!disabled.has(WORKSPACE_FEATURES[m]||m.toUpperCase().replaceAll(' ','_')));
}

