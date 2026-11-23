"use client";
import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';

// Keep API/storage amounts unchanged; people always enter dollars and cents.
export function CurrencyInput({value,onValueChange,selectOnEntry=false,...props}:Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:string|number;selectOnEntry?:boolean;onValueChange:(cents:string)=>void}){
 const format=(v:string|number)=>v===''?'':(Number(v)/100).toFixed(2);
 const [text,setText]=useState(()=>format(value));
 const selectPointer=useRef(false);
 const previous=useRef(String(value));
 useEffect(()=>{if(String(value)!==previous.current){previous.current=String(value);setText(format(value))}},[value]);
 return <input {...props} type="text" inputMode="decimal" value={text} onPointerDown={e=>{selectPointer.current=selectOnEntry&&document.activeElement!==e.currentTarget;props.onPointerDown?.(e)}} onPointerUp={e=>{if(selectPointer.current)e.currentTarget.select();selectPointer.current=false;props.onPointerUp?.(e)}} onFocus={e=>{if(selectOnEntry)e.currentTarget.select();props.onFocus?.(e)}} onChange={e=>{
  const next=e.target.value;if(!/^-?\d*(\.\d{0,2})?$/.test(next))return;
  setText(next);const amount=next===''||next==='-'||next==='.'||next==='-.'?'':String(Math.round(Number(next)*100));
  previous.current=amount;onValueChange(amount);
 }} onBlur={e=>{setText(format(value));props.onBlur?.(e)}}/>;
}
