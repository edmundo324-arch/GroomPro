"use client";
import {CustomerProfile} from './customer-profile';
// Compatibility entry point: creation and editing stay inside the same window.
export function CustomerCreateWindow({onClose}:{onClose:()=>void}){
 return <CustomerProfile onClose={onClose}/>;
}
