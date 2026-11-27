"use client";
import {FloatingEditorWindow} from './floating-editor-window';
import {PetPhotos} from './pet-photos';
import type {PetPictureUpdate} from './pet-picture';
export function PetPhotoEditor({pet,onClose,onSaved}:{pet:{id:string;name:string;pictureUrl?:string|null};onClose:()=>void;onSaved?:(pet:PetPictureUpdate)=>void}){
 return <FloatingEditorWindow windowKey="pet-photos" title={pet.name+' — Photos'} onClose={onClose} initialSize={{width:650,height:690}} style={{zIndex:2100}}><div style={{padding:16}}><PetPhotos petId={pet.id} petName={pet.name} pictureUrl={pet.pictureUrl} profileMode onProfileSaved={onSaved}/></div></FloatingEditorWindow>;
}
