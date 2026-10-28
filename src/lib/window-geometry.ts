// Presentation-only geometry; never changes ticket state or saved data.
export function fitWindow(g:{left:number;top:number;width:number;height:number},viewportWidth:number,viewportHeight:number){
 const width=Math.max(1,Math.min(g.width,viewportWidth-16));
 const height=Math.max(1,Math.min(g.height,viewportHeight-16));
 return {width,height,left:Math.max(8,Math.min(g.left,viewportWidth-width-8)),top:Math.max(8,Math.min(g.top,viewportHeight-height-8))};
}
