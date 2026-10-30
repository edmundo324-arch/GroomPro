// Presentation-only geometry; never changes ticket state or saved data.
export function fitWindow(g:{left:number;top:number;width:number;height:number},viewportWidth:number,viewportHeight:number){
 const width=Math.max(1,Math.min(g.width,viewportWidth-16));
 const height=Math.max(1,Math.min(g.height,viewportHeight-16));
 return {width,height,left:Math.max(8,Math.min(g.left,viewportWidth-width-8)),top:Math.max(8,Math.min(g.top,viewportHeight-height-8))};
}

export type WindowGeometry={left:number;top:number;width:number;height:number};
export function defaultPosGeometry(width:number,height:number){
 if(width<600)return fitWindow({left:8,top:8,width:width-16,height:height-16},width,height);
 if(width>=1000&&height>=700){const w=Math.round(width*.575),h=Math.round(height*.575);return fitWindow({left:Math.round((width-w)/2),top:Math.round((height-h)/2),width:w,height:h},width,height);}
 const w=Math.min(width-16,Math.max(720,Math.round(width*.58))),h=Math.min(height-16,Math.max(600,Math.round(height*.58)));
 return fitWindow({left:Math.round((width-w)/2),top:Math.round((height-h)/2),width:w,height:h},width,height);
}
export function validWindowGeometry(value:any):value is WindowGeometry{return !!value&&['left','top','width','height'].every(k=>typeof value[k]==='number'&&Number.isFinite(value[k]))&&value.width>0&&value.height>0}
export function resizeEditorWindow(g:WindowGeometry,edge:string,dx:number,dy:number,width:number,height:number){
 const fitted=fitWindow(g,width,height),minW=Math.min(360,width-16),minH=Math.min(280,height-16);
 let left=fitted.left,right=left+fitted.width,top=fitted.top,bottom=top+fitted.height;
 if(edge.includes('e'))right=Math.min(width-8,Math.max(left+minW,right+dx));
 if(edge.includes('w'))left=Math.max(8,Math.min(right-minW,left+dx));
 if(edge.includes('s'))bottom=Math.min(height-8,Math.max(top+minH,bottom+dy));
 if(edge.includes('n'))top=Math.max(8,Math.min(bottom-minH,top+dy));
 return fitWindow({left,top,width:right-left,height:bottom-top},width,height);
}

// Intentional dragging keeps at least 20% of each dimension visible.
export function dragWindow(g:WindowGeometry,width:number,height:number){
 const visibleW=Math.min(g.width*.2,width),visibleH=Math.min(g.height*.2,height);
 return {...g,left:Math.max(-g.width*.8,Math.min(width-visibleW,g.left)),top:Math.max(-g.height*.8,Math.min(height-visibleH,g.top))};
}
