"use client";
import {useEffect,useState,type CSSProperties} from 'react';
import {employeeFetch} from '../lib/employee-fetch';
export type PetPictureUpdate={id:string;pictureUrl:string|null};
export function announcePetPicture(pet:PetPictureUpdate){window.dispatchEvent(new CustomEvent('groompro:pet-picture-changed',{detail:pet}));}
export function PetPicture({petId,pictureUrl,name,className,style}:{petId:string;pictureUrl?:string|null;name:string;className?:string;style?:CSSProperties}){
 const [source,setSource]=useState(pictureUrl||''),[url,setUrl]=useState('');
 useEffect(()=>setSource(pictureUrl||''),[petId,pictureUrl]);
 useEffect(()=>{const changed=(event:Event)=>{const pet=(event as CustomEvent<PetPictureUpdate>).detail;if(pet?.id===petId)setSource(pet.pictureUrl||'')};window.addEventListener('groompro:pet-picture-changed',changed);return()=>window.removeEventListener('groompro:pet-picture-changed',changed)},[petId]);
 useEffect(()=>{let alive=true,objectUrl='';setUrl('');if(!source)return;
  if(source.startsWith('/api/pets/photos?')){employeeFetch(source).then(async r=>{if(!r.ok)return;objectUrl=URL.createObjectURL(await r.blob());if(alive)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl)}).catch(()=>{});}
  else if(/^(https:\/\/|\/(?!\/))/.test(source))setUrl(source);
  return()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[source]);
 return url?<img src={url} alt={name+'’s Picture'} className={className} style={style}/>:<span className={className} style={{...style,display:'inline-flex',alignItems:'center',justifyContent:'center'}} aria-label={'No Picture for '+name}><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 4h18v16H3zM3 16l5-6 5 5 3-3 5 6"/></svg></span>;
}
