import type {MetadataRoute} from 'next';

// Keep the existing URL, but link explicitly so preview access cookies accompany
// the browser's manifest request. Next's file convention omits them on GoDaddy.
export function GET(){
 const manifest:MetadataRoute.Manifest={
  id:'/',name:'GroomPro',short_name:'GroomPro',description:'GroomPro salon management',
  start_url:'/',scope:'/',display:'standalone',background_color:'#ffffff',theme_color:'#17354d',
  icons:[192,512].map(size=>({src:`/icons/groompro-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))
 };
 return Response.json(manifest,{headers:{'Content-Type':'application/manifest+json'}});
}
