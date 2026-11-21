const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {Prisma}=require('@prisma/client');
// Validate literal enum values in database calls even when a helper uses `any`.
// Computed values require separate runtime tests; display labels are not database enums.
test('database query and write literals use declared enum values',()=>{
 const models=new Map(Prisma.dmmf.datamodel.models.map(m=>[m.name,m]));
 const delegates=new Map([...models.values()].map(m=>[m.name[0].toLowerCase()+m.name.slice(1),m]));
 const enums=new Map(Prisma.dmmf.datamodel.enums.map(e=>[e.name,new Set(e.values.map(v=>v.name))]));
 const errors=[];let checked=0;
 function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):/\.tsx?$/.test(e.name)?[path.join(dir,e.name)]:[])}
 for(const file of [...files('src'),...files('app')]){
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
  const name=n=>n&&(ts.isIdentifier(n)||ts.isStringLiteral(n))?n.text:'';
  function value(node,type){
   if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){checked++;if(!enums.get(type).has(node.text))errors.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1}: ${type} does not include ${node.text}`);}
   else if(ts.isArrayLiteralExpression(node))node.elements.forEach(n=>value(n,type));
   else if(ts.isObjectLiteralExpression(node))for(const p of node.properties)if(ts.isPropertyAssignment(p)&&['equals','not','in','notIn','set'].includes(name(p.name)))value(p.initializer,type);
  }
  function object(node,model){
   if(ts.isArrayLiteralExpression(node)){node.elements.forEach(n=>object(n,model));return;}
   if(!ts.isObjectLiteralExpression(node))return;
   for(const p of node.properties){if(!ts.isPropertyAssignment(p))continue;const key=name(p.name),field=model.fields.find(f=>f.name===key);
    if(field?.kind==='enum')value(p.initializer,field.type);
    else if(field?.kind==='object'&&models.has(field.type))object(p.initializer,models.get(field.type));
    else if(['where','data','create','update','createMany','updateMany','upsert','connect','connectOrCreate','disconnect','delete','deleteMany','some','every','none','is','isNot','AND','OR','NOT'].includes(key))object(p.initializer,model);
   }
  }
  function visit(node){if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['findFirst','findUnique','findMany','count','aggregate','groupBy','create','createMany','update','updateMany','upsert','delete','deleteMany'].includes(node.expression.name.text)){
   const receiver=node.expression.expression;
   if(ts.isPropertyAccessExpression(receiver)){const model=delegates.get(receiver.name.text);if(model&&node.arguments[0])object(node.arguments[0],model);}
  }ts.forEachChild(node,visit)}visit(source);
 }
 assert.ok(checked>100,'Scanner must inspect real database literals');
 assert.deepEqual(errors,[]);
});
