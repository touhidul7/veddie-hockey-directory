export function setMetadata(title,indexable,description='Browse published hockey programmes and official sources on RinkCircuit.'){
  document.title=title;
  function meta(selector,attribute,key,value){let node=document.querySelector(selector);if(!node){node=document.createElement('meta');node.setAttribute(attribute,key);document.head.append(node);}node.content=value;}
  const enabled=document.querySelector('meta[name="rinkcircuit-indexing"]')?.content==='enabled';
  const canonical=document.querySelector('link[rel="canonical"]');
  meta('meta[name="robots"]','name','robots',indexable&&enabled&&canonical&&!window.location.search?'index,follow':'noindex,follow');
  meta('meta[name="description"]','name','description',description);
  meta('meta[property="og:title"]','property','og:title',title);
  meta('meta[property="og:description"]','property','og:description',description);
  if(canonical){const base=new URL(canonical.href).origin;canonical.href=base+window.location.pathname;}
}
