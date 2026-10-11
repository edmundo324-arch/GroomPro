export function requestMaterial(method:string,url:string,body:string) {
  const parsed=new URL(url,'http://groompro.local');
  return `${method.toUpperCase()}\n${parsed.pathname}${parsed.search}\n${body}`;
}
