/** Human-facing catalog discovery; never use descriptions as record identifiers. */
export function matchesCatalogSearch(item:{name?:string;description?:string|null;code?:string|null;sku?:string|null;category?:string|null},query:string){
 const text=[item.name,item.description,item.code,item.sku,item.category].filter(Boolean).join(' ').toLocaleLowerCase();
 return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean).every(word=>text.includes(word));
}
