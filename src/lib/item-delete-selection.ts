// A keyboard batch is captured by an intentional click, and never crosses to another dog.
export function itemDeleteSelection(lines:any[],index:number){const selected=lines[index];if(!selected?.petId)return [];return lines.slice(index).filter(line=>line.petId===selected.petId);}
