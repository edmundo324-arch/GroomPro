export function profileBirthday(input:Record<string,unknown>){
 if(input.dateOfBirth===undefined)return {};
 if(input.dateOfBirth===null||input.dateOfBirth==='')return {dateOfBirth:null};
 const value=input.dateOfBirth;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Enter the birthday as a complete calendar date, or leave it blank.');
 const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)throw Error('Enter a valid birthday date.');return {dateOfBirth:date};
}
