'use client';

import {createContext,useEffect,useId,useRef,useState} from 'react';
import {findSettings,settingsBreadcrumb,type SettingsSearchEntry} from '../lib/settings-search';

export const SettingsBranch = createContext<string[]>([]);
export const SettingsDestination = createContext<{
  entry: SettingsSearchEntry;
  done: () => void;
} | null>(null);

export function SettingsSearch({role,children}:{role?:string;children:React.ReactNode}) {
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [destination,setDestination]=useState<SettingsSearchEntry|null>(null);
  const [message,setMessage]=useState('');
  const id=useId();
  useEffect(()=>{
    if(!destination)return;
    const timer=setTimeout(()=>{
      setDestination(null);
      setMessage('That setting could not open. Check your access or follow the path shown in search.');
    },6000);
    return()=>clearTimeout(timer);
  },[destination]);
  const input=useRef<HTMLInputElement>(null);
  const results=useRef<HTMLUListElement>(null);
  const matches=open?findSettings(query,role):[];
  const show=open&&!!query.trim();
  function go(entry:SettingsSearchEntry) {
    setOpen(false);
    setMessage("");setDestination({...entry});
  }
  return <SettingsDestination.Provider value={destination?{entry:destination,done:()=>setDestination(null)}:null}>
    <form className="gp-settings-finder" role="search" aria-label="Settings search"
      onSubmit={event=>{event.preventDefault();if(matches[0])go(matches[0]);else input.current?.focus()}}
      onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}
      onKeyDown={event=>{
        if(event.key==='Escape'&&open){event.preventDefault();input.current?.focus();setOpen(false)}
        if(event.key==='ArrowDown'&&event.target===input.current&&matches.length){event.preventDefault();results.current?.querySelector('button')?.focus()}
      }}>
      <div className="gp-settings-finder-input">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/></svg>
        <input ref={input} type="search" aria-label="Search Settings" aria-controls={show?id:undefined}
          placeholder="Search Settings" value={query} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)}
          onChange={event=>{setQuery(event.target.value);setMessage("");setOpen(true)}}/>
      </div>
      {message&&<p className="gp-settings-finder-message" role="status">{message}</p>}{show&&<div className="gp-settings-finder-results" id={id}>
        {matches.length?<ul ref={results}>{matches.map(entry=><li key={entry.title}>
          <button type="button" onClick={()=>go(entry)}>
            <strong>{entry.title}</strong>
            <small>{settingsBreadcrumb(entry)}</small>
            <span>{entry.description}</span>
            {!role&&entry.access&&<small>{entry.access==='platform'?'Owner or Developer PIN required':entry.access==='admin'?'Administrator PIN required':'Manager PIN required'}</small>}
          </button>
        </li>)}</ul>:<p role="status">No settings match. Try a task like “import customers” or “Calendar colors”.</p>}
      </div>}
    </form>
    {children}
  </SettingsDestination.Provider>;
}

const icons: Record<string,string> = {
  'visual-layouts':'M3 4h18v16H3zM3 9h18M9 9v11',
  workflow:'M3 6h18v15H3zM7 3v6m10-6v6M3 11h18m-13 5h2m4 0h2',
  locations:'M12 21s6-5 6-11a6 6 0 0 0-12 0c0 6 6 11 6 11zM12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  pricing:'M3 4h8l10 10-7 7L3 10zM7 8h.01',
  breeds:'M8 4c2 0 3 4 1 5-2 1-3-5-1-5zm8 0c2 0 1 6-1 5-2-1-1-5 1-5zM4 9c2 0 3 4 1 5-2 0-3-5-1-5zm16 0c2 0 1 5-1 5-2-1-1-5 1-5zM7 18c0-3 4-6 5-6s5 3 5 6c0 3-4 2-5 2s-5 1-5-2z',
  categories:'M4 5h3m4 0h9M4 12h3m4 0h9M4 19h3m4 0h9',
  rewards:'M4 9h16v12H4zM3 6h18v3H3zM12 6v15m0-15C5 6 6 1 9 2c2 1 3 4 3 4zm0 0c7 0 6-5 3-4-2 1-3 4-3 4z',
  communications:'M4 4h16v12h-9l-5 4v-4H4zM8 8h8m-8 4h5',
  data:'M4 6c0-4 16-4 16 0s-16 4-16 0zm0 0v12c0 4 16 4 16 0V6M4 12c0 4 16 4 16 0',
  administration:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12l2 2 4-4',
  imports:'M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5',
  hours:'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  appearance:'M12 3l9 9-9 9-9-9zM9 12h6m-3-3v6',
  popup:'M4 4h16v12h-9l-5 4v-4H4zM8 8h8m-8 4h5',
};
export function SettingsTabIcon({name}:{name:string}){
  return <svg className="gp-settings-tab-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={icons[name]||icons.categories}/></svg>;
}
