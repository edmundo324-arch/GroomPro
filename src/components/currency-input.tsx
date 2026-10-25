"use client";
import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';

// Keep API/storage amounts unchanged; people always enter dollars and cents.
export function CurrencyInput({value,onValueChange,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:string|number;onValueChange:(cents:string)=>void}){
 const format=(v:string|number)=>v===''?'':(Number(v)/100).toFixed(2);
 const [text,setText]=useState(()=>format(value));
 const previous=useRef(String(value));
 useEffect(()=>{if(String(value)!==previous.current){previous.current=String(value);setText(format(value))}},[value]);
 return <input {...props} type="text" inputMode="decimal" value={text} onChange={e=>{
  const next=e.target.value;if(!/^-?\d*(\.\d{0,2})?$/.test(next))return;
  setText(next);const amount=next===''||next==='-'||next==='.'||next==='-.'?'':String(Math.round(Number(next)*100));
  previous.current=amount;onValueChange(amount);
 }} onBlur={e=>{setText(format(value));props.onBlur?.(e)}}/>;
}
