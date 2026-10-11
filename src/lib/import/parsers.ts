import * as XLSX from 'xlsx';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {unzipSync} from 'fflate';
import {Dataset,guessMapping,identify,sourceIdColumn} from './fields';
const MAX_BYTES=40*1024*1024,MAX_ROWS=50000;
export function table(name:string,headers:string[],values:unknown[][]):Dataset{
 if(!headers.length||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error(`${name}: empty or duplicate column headings must be corrected.`);
 if(headers.length>1000||values.length>MAX_ROWS)throw Error('Dataset exceeds 1,000 columns or 50,000 rows; split into related files.');
 if(values.some(r=>r.length>headers.length))throw Error(`${name}: a row has more values than column headings.`);
 const entity=identify(headers);return {name,entity,headers,rows:values.map(row=>Object.fromEntries(headers.map((h,i)=>[h,i<row.length?row[i]:null]))),mapping:guessMapping(entity,headers),idColumn:sourceIdColumn(entity,headers),selected:true};
}
export function delimited(text:string,delimiter=','){
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'&&!cell&&!closed){quoted=true;continue;}if(c===delimiter){row.push(cell);cell='';closed=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;}else{if(closed)throw Error('Invalid characters after a quoted cell.');cell+=c;}}
 if(quoted)throw Error('Unclosed quoted cell.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
function objectTable(name:string,rows:any[]):Dataset{if(rows.some(v=>!v||typeof v!=='object'||Array.isArray(v)))throw Error('Records must be objects.');const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))];return table(name,headers,rows.map(r=>headers.map(h=>Object.hasOwn(r,h)?r[h]:null)));}
export async function parseFile(name:string,bytes:Uint8Array,depth=0):Promise<Dataset[]>{
 if(bytes.length>MAX_BYTES)throw Error('Files are limited to 40 MB.');const ext=name.split('.').pop()?.toLowerCase();const text=()=>new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'');
 if(['csv','tsv','txt'].includes(ext||'')){const rows=delimited(text(),ext==='csv'?',':'\t');if(!rows.length)throw Error('Empty file.');return [table(name,rows[0],rows.slice(1))];}
 if(['xlsx','xls'].includes(ext||'')){if(ext==='xlsx'){let size=0;unzipSync(bytes,{filter:e=>{size+=e.originalSize;if(size>128*1024*1024)throw Error('Workbook expands beyond 128 MB.');return false;}});}const w=XLSX.read(bytes,{type:'array',cellFormula:true,cellText:true,cellNF:true});return w.SheetNames.map(sheet=>{const rows=XLSX.utils.sheet_to_json<unknown[]>(w.Sheets[sheet],{header:1,raw:false,defval:null,blankrows:false});const d=table(name+'/'+sheet,(rows[0]||[]).map(v=>String(v??'')),rows.slice(1));d.sourceCells=Object.fromEntries(Object.entries(w.Sheets[sheet]).filter(([k])=>!k.startsWith('!')).map(([k,c]:any)=>[k,{type:c.t,value:c.v,format:c.z,formula:c.f}]));return d;});}
 if(ext==='json'){const v=JSON.parse(text());return Array.isArray(v)?[objectTable(name,v)]:Object.entries(v).map(([k,r])=>{if(!Array.isArray(r))throw Error('JSON must contain an array of records, or named arrays.');return objectTable(name+'/'+k,r);});}
 if(ext==='xml'){const s=text();if(/<!DOCTYPE|<!ENTITY/i.test(s)||XMLValidator.validate(s)!==true)throw Error('Invalid XML or unsupported document entities.');const v=new XMLParser({ignoreAttributes:false,parseTagValue:false,parseAttributeValue:false,trimValues:false}).parse(s);const root=Object.values(v)[0] as any;return Object.entries(root||{}).map(([k,v])=>objectTable(name+'/'+k,Array.isArray(v)?v:[v]));}
 if(ext==='zip'){if(depth)throw Error('Nested archives are not supported.');let total=0;const rejected:string[]=[];const entries=unzipSync(bytes,{filter:e=>{total+=e.originalSize;if(total>MAX_BYTES||e.originalSize>MAX_BYTES)throw Error('Uncompressed archive exceeds 40 MB.');if(e.name.endsWith('/'))return false;if(/(^|\/)\.\.(\/|$)|^[/\\]/.test(e.name))throw Error('Unsafe archive entry.');if(!/\.(csv|tsv|txt|xlsx|xls|json|xml|sqlite|db|sql|png|jpg|jpeg|pdf|webp|gif|docx)$/i.test(e.name)){rejected.push(e.name);return false;}return true;}});if(rejected.length)throw Error('Archive contains unsupported files; nothing was discarded. Separate attachments for document migration: '+rejected.slice(0,10).join(', '));if(Object.keys(entries).length>100)throw Error('Archive has too many files.');return (await Promise.all(Object.entries(entries).map(([n,b])=>parseFile(name+'/'+n,b,depth+1)))).flat();}
 if(['png','jpg','jpeg','pdf','webp','gif','docx'].includes(ext||'')){const d=table(name,['AttachmentID','Filename','ProtectedAttachmentContent'],[[name,name,Buffer.from(bytes).toString('base64')]]);d.entity='HISTORY';d.idColumn='AttachmentID';d.mapping={AttachmentID:'LEGACY',Filename:'LEGACY',ProtectedAttachmentContent:'SECURE'};return[d];}
 if(ext==='sqlite'||ext==='db'){
  // sql.js executes only fixed read queries against an isolated, uploaded database.
  const init=require('sql.js/dist/sql-asm.js');const SQL=await init();const db=new SQL.Database(bytes);
  try{const names=db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]?.values||[];return names.map(([n]:any[])=>{const result=db.exec('SELECT * FROM "'+String(n).replaceAll('"','""')+'" LIMIT 50001')[0];if(!result)throw Error('Empty table requires a CSV header export.');if(result.values.some((r:any[])=>r.some(v=>v instanceof Uint8Array)))throw Error('Binary database columns require a separate reviewed attachment migration.');return table(name+'/'+n,result.columns,result.values);});}finally{db.close();}
 }
 if(ext==='sql')return sqlData(text(),name);
 throw Error('Unsupported source. Export CSV/XLSX, JSON, XML, SQLite or explicit-column INSERT SQL. Native database backups require the source database export tool.');
}
// Deliberately never execute uploaded SQL. Only an explicit-column INSERT export is accepted.
export function sqlData(sql:string,name:string){
 const stripped=sql.replace(/^\s*--[^\n]*$/gm,'').trim();const tables=new Map<string,{headers:string[];rows:unknown[][]}>();let rest=stripped;
 while(rest){const m=rest.match(/^INSERT\s+INTO\s+[`"\[]?([\w]+)[`"\]]?\s*\(([^)]+)\)\s*VALUES\s*/i);if(!m)throw Error('Use a data-only SQL export with explicit-column INSERT statements. DDL, expressions, COPY and executable SQL are not accepted.');const headers=m[2].split(',').map(s=>s.trim().replace(/^[`"\[]|[`"\]]$/g,''));rest=rest.slice(m[0].length);const rows:unknown[][]=[];
 while(rest.startsWith('(')){rest=rest.slice(1);const row:unknown[]=[];while(true){rest=rest.trimStart();let value:unknown;if(rest[0]==="'"){let v='',i=1,ended=false;for(;i<rest.length;i++){if(rest[i]==="'"){if(rest[i+1]==="'"){v+="'";i++;}else{ended=true;i++;break;}}else if(rest[i]==='\\')throw Error('Backslash SQL escaping needs a CSV export.');else v+=rest[i];}if(!ended)throw Error('Unclosed SQL string.');value=v;rest=rest.slice(i);}else{const v=rest.match(/^(NULL|-?\d+(?:\.\d+)?)(?=\s*[,\)])/i);if(!v)throw Error('Unsupported SQL value.');value=v[1].toUpperCase()==='NULL'?null:v[1];rest=rest.slice(v[0].length);}row.push(value);rest=rest.trimStart();if(rest[0]===')'){rest=rest.slice(1).trimStart();break;}if(rest[0]!==',')throw Error('Malformed SQL row.');rest=rest.slice(1);}rows.push(row);if(rest[0]===',')rest=rest.slice(1).trimStart();else break;}
 if(rest[0]!==';')throw Error('SQL statement terminator required.');rest=rest.slice(1).trimStart();const previous=tables.get(m[1]);if(previous&&JSON.stringify(previous.headers)!==JSON.stringify(headers))throw Error('Inconsistent SQL column order.');tables.set(m[1],{headers,rows:[...(previous?.rows||[]),...rows]});}
 if(!tables.size)throw Error('No data found.');return [...tables].map(([n,t])=>table(name+'/'+n,t.headers,t.rows));
}
