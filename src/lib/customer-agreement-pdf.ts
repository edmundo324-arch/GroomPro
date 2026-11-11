import {createHash} from 'node:crypto';
import {agreementTitle,customerFields,dogFields,formatAgreementPrice,type AgreementKind,type AgreementProfile,type Quote,type Signature,type Terms,type Stroke} from './customer-agreement-model';

export type SignedAgreement={
 business:string;kind:AgreementKind;profile:AgreementProfile;terms:Terms;quote:Quote[];
 signature:Signature;signedAt:string;
};
export const agreementRevision=(profile:AgreementProfile,terms:Terms,quote:Quote[])=>createHash('sha256').update(JSON.stringify({profile,terms,quote})).digest('hex');

const pdfText=(value:string)=>value.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\x20-\xff]/g,'?').replace(/[\\()]/g,'\\$&');
function wrap(text:string,length:number){
 return (text.match(new RegExp('.{1,'+length+'}(?:\\s|$)|.{1,'+length+'}','g'))||['']).map(s=>s.trim());
}
export function renderAgreementPdf(agreement:SignedAgreement){
 const pages:string[]=[];
 let content='',y=752;
 function finish(){pages.push(content);content='';y=752;}
 function line(text:string,size=11,font='F1'){
  const step=size+5;
  if(y-step<46)finish();
  content+='BT /'+font+' '+size+' Tf 1 0 0 1 45 '+y+' Tm ('+pdfText(text)+') Tj ET\n';
  y-=step;
 }
 function text(value:string,size=11){for(const part of wrap(value,size===11?87:64))line(part,size);}
 function initials(strokes:Stroke[]){
  if(y<94)finish();
  content+='0.75 G 45 '+(y-34)+' 136 34 re S 0 G 1.3 w\n';
  for(const stroke of strokes){
   content+=stroke.map(([x,pointY],i)=>(45+x*136).toFixed(2)+' '+(y-pointY*34).toFixed(2)+(i?' l':' m')).join(' ')+' S\n';
  }
  y-=48;
 }
 line(agreement.business,16);line(agreementTitle[agreement.kind],14);
 text('Policy version: '+agreement.terms.version);text('Signed: '+agreement.signedAt);
 for(const [key,label] of Object.entries(customerFields)){
  const value=agreement.profile[key as keyof typeof customerFields];
  if(value)text(label+': '+value);
 }
 text('Primary phone: '+agreement.profile.phone);
 for(const pet of agreement.profile.pets){
  text('Dog: '+pet.name,13);
  const quote=agreement.quote.find(q=>q.petId===pet.id);
  if(quote){if(quote.planName)text('VIP plan: '+quote.planName);text('Agreed recurring price: '+formatAgreementPrice(quote.priceCents));if(quote.billing)text('Billing schedule: '+quote.billing);}
  for(const [key,label] of Object.entries(dogFields)){
   const value=pet[key as keyof typeof dogFields];
   if(key!=='name'&&value)text(label+': '+value);
  }
 }
 for(const [i,clause] of agreement.terms.clauses.entries()){
  text(clause.title,13);
  text(clause.text);
  if(clause.video)text('Policy video: '+clause.video);
  text('Acknowledged');
  if(clause.initialsRequired!==false){
   for(const part of wrap(agreement.signature.name,60))line(part,14,'F2');
   initials(agreement.signature.initials[i]);
  }
 }
 text('Adopted electronic signature:');
 for(const part of wrap(agreement.signature.name,60))line(part,16,'F2');
 finish();
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>','',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic /Encoding /WinAnsiEncoding >>',
 ];
 const references:number[]=[];
 for(const page of pages){
  const id=objects.length+1;
  references.push(id);
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(id+1)+' 0 R >>');
  objects.push('<< /Length '+Buffer.byteLength(page,'latin1')+' >>\nstream\n'+page+'endstream');
 }
 objects[1]='<< /Type /Pages /Count '+pages.length+' /Kids ['+references.map(id=>id+' 0 R').join(' ')+'] >>';
 let pdf='%PDF-1.4\n';
 const offsets=[0];
 for(const [i,object] of objects.entries()){offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+object+'\nendobj\n';}
 const xref=pdf.length;
 pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
 pdf+='trailer\n<< /Root 1 0 R /Size '+offsets.length+' >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(pdf,'latin1');
}
