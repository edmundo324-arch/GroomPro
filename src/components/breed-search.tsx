"use client";
import {useId} from 'react';
import {Breed,findBreed} from '../lib/breed-classification';
export function BreedSearch({label,value,breeds,onChange}:{label:string;value:string;breeds:Breed[];onChange:(text:string,breed:Breed|null)=>void}){
 const id=useId();return <label className="gp-field">{label}<input list={id} value={value} maxLength={191} placeholder="Search breed or nickname" onChange={e=>onChange(e.target.value,findBreed(e.target.value,breeds))}/><datalist id={id}>{breeds.flatMap(b=>[b.name,...b.aliases].map(name=><option key={b.id+name} value={name}>{b.name}</option>))}</datalist>{value&&!findBreed(value,breeds)&&<small>Other / breed not listed — kept for review.</small>}</label>;
}
