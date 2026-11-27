export type InstallPrompt=Event&{
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};
type InstallState={prompt:InstallPrompt|null;installed:boolean};
declare global{interface Window{__groomproInstall?:InstallState}}

export const installChanged='groompro:install-change';

// Runs synchronously in the document head, before Calendar hydrates. The native
// prompt can arrive before the toolbar mounts and can only be used once.
export const installPromptBootstrap=`(()=>{
 if(window.__groomproInstall)return;
 const state=window.__groomproInstall={prompt:null,installed:false};
 const notify=()=>window.dispatchEvent(new Event('${installChanged}'));
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();state.prompt=event;notify();
 });
 window.addEventListener('appinstalled',()=>{
  state.installed=true;state.prompt=null;notify();
 });
})();`;

export function takeInstallPrompt(){
 const state=window.__groomproInstall;
 const prompt=state?.prompt??null;
 if(state&&prompt){state.prompt=null;window.dispatchEvent(new Event(installChanged))}
 return prompt;
}
