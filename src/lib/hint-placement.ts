type Box={left:number;right:number;top:number;bottom:number};
export function sideHintPlacement(box:Box,viewport:{width:number;height:number}){
 const margin=8,gap=10,minWidth=180;
 const right=viewport.width-margin-box.right-gap,left=box.left-gap-margin;
 const side=right>=320?'right':left>=320?'left':right>=left?'right':'left';
 const available=side==='right'?right:left;
 if(available<minWidth){
  const below=viewport.height-margin-box.bottom-gap,above=box.top-gap-margin;
  const useBelow=below>=100||below>=above;
  const maxHeight=Math.max(0,Math.min(200,useBelow?below:above));
  const width=Math.min(320,viewport.width-margin*2);
  return {left:Math.max(margin,Math.min(box.left,viewport.width-margin-width)),top:useBelow?box.bottom+gap:box.top-gap-maxHeight,width,maxHeight};
 }
 const width=Math.min(320,available),maxHeight=Math.min(200,viewport.height-margin*2);
 return {left:side==='right'?box.right+gap:box.left-gap-width,top:Math.max(margin,Math.min(box.top,viewport.height-margin-maxHeight)),width,maxHeight};
}

export function hintTargets(element:HTMLElement):HTMLElement[]{
 const label=element.matches('label')?element:element.closest('label')||(element.previousElementSibling?.matches('label')?element.previousElementSibling:null);
 const associated=label instanceof HTMLLabelElement?label.control:null;
 const group=element.closest('.gp-agreement-field');
 const control=associated||group?.querySelector<HTMLElement>('input,select,textarea');
 const target=label||group?.querySelector<HTMLElement>('label')||element;
 return [...new Set([target,control].filter((v):v is HTMLElement=>v instanceof HTMLElement))];
}

export function targetsBox(targets:HTMLElement[]){
 const boxes=targets.map(t=>t.getBoundingClientRect());
 return {left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))};
}
