export function track(event){
  try{if(localStorage.getItem('rinkcircuit_analytics_consent')!=='true')return;
    fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event,consent:true}),keepalive:true}).catch(()=>{});
  }catch{}
}
