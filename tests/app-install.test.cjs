require('./load-ts.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {installPromptBootstrap,installChanged,takeInstallPrompt}=require('../src/lib/app-install.ts');

test('early native prompt survives delayed Calendar mounting and can be consumed only once',()=>{
 const window=new EventTarget();vm.runInNewContext(installPromptBootstrap,{window,Event});
 const event=new Event('beforeinstallprompt',{cancelable:true});
 window.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 assert.equal(window.__groomproInstall.prompt,event);
 let changes=0;window.addEventListener(installChanged,()=>changes++);
 global.window=window;
 try{assert.equal(takeInstallPrompt(),event);assert.equal(takeInstallPrompt(),null);assert.equal(changes,1)}finally{delete global.window}
});

test('bootstrap does not duplicate listeners or discard a saved prompt; installation clears it',()=>{
 const window=new EventTarget(),context={window,Event};
 vm.runInNewContext(installPromptBootstrap,context);
 const event=new Event('beforeinstallprompt',{cancelable:true});window.dispatchEvent(event);
 vm.runInNewContext(installPromptBootstrap,context);assert.equal(window.__groomproInstall.prompt,event);
 let changes=0;window.addEventListener(installChanged,()=>changes++);
 window.dispatchEvent(new Event('appinstalled'));
 assert.equal(window.__groomproInstall.installed,true);assert.equal(window.__groomproInstall.prompt,null);assert.equal(changes,1);
});
