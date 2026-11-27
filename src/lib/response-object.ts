// Hosting errors can return HTML or an empty body instead of the API response.
// Never replace saved screen data with an incomplete response.
export async function responseObject(response:Response,message:string):Promise<Record<string,any>>{
 let value:unknown;
 try{value=await response.json()}catch{throw Error(message)}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error(message);
 return value as Record<string,any>;
}
