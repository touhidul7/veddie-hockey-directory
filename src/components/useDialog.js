import {useEffect,useRef} from 'react';
export default function useDialog(open,onClose){
  const ref=useRef(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    if(!open||!ref.current)return;
    const dialog=ref.current,previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const controls=()=>[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    (controls()[0]||dialog).focus();
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();close.current();}
      if(event.key==='Tab'){
        const items=controls(),first=items[0],last=items.at(-1);
        if(!first){event.preventDefault();dialog.focus();return;}
        if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[open]);
  return ref;
}
