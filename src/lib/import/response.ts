/** Hosting proxies can reject uploads before GroomPro returns a JSON response. */
export async function readImportResponse(response: Response) {
 const text=await response.text();let data:any;
 try{data=JSON.parse(text)}catch{
  if(response.status===401||response.status===403||/^unauthorized\b/i.test(text.trim()))throw Error('The hosting server denied access to the import. Refresh GroomPro using your current GoDaddy preview link, sign in, and choose the file again. No import was started.');
  if(response.status===413)throw Error('The hosting server rejected the file size. Use a smaller related-file export or ask the hosting administrator to increase the upload limit.');
  throw Error(`The server could not return the import result (HTTP ${response.status}). Check Import history before trying again.`);
 }
 if(!response.ok)throw Error(data?.error||`Import request failed (HTTP ${response.status}).`);
 return data;
}
