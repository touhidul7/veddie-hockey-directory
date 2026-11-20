function invalid(message){const error=new Error(message);error.status=400;throw error;}
function parseImportCsv(text){
  if(typeof text!=='string'||!text.trim()||text.length>1500000)invalid('Provide CSV text up to 1.5 MB.');
  const records=[];let record=[],field='',quoted=false,closed=false;
  const pushField=()=>{record.push(field);field='';closed=false;};
  const pushRow=()=>{pushField();if(record.some(value=>value.trim()))records.push(record);record=[];if(records.length>1001)invalid('Import at most 1000 rows at a time.');};
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=char;continue;}
    if(char===','){pushField();continue;}
    if(char==='\r'||char==='\n'){if(char==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
    if(closed){if(char===' '||char==='\t')continue;invalid('Unexpected text after a quoted CSV field.');}
    if(char==='"'){if(field.length)invalid('Quote found inside an unquoted CSV field.');quoted=true;continue;}
    field+=char;
  }
  if(quoted)invalid('CSV contains an unclosed quoted field.');
  pushRow();
  const headers=records.shift()?.map(value=>value.trim());
  if(!headers||!records.length)invalid('CSV requires headers and at least one data row.');
  if(headers.some(h=>!h)||new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)invalid('CSV headers must be nonempty and unique.');
  const groups=[['League','name','Programme Name'],['Area','area','City'],['Category','category'],['Source','source','url']];
  const canonical=['League','Area','Category','Source'];
  const mapped=headers.map(h=>{const index=groups.findIndex(group=>group.includes(h));return index<0?h:canonical[index];});
  if(new Set(mapped).size!==mapped.length)invalid('Use only one header alias for each field.');
  if(canonical.some(h=>!mapped.includes(h)))invalid('Required headers: League, Area, Category and Source (supported aliases are accepted).');
  return records.map((cells,index)=>{
    if(cells.length!==headers.length)invalid(`CSV row ${index+2} has ${cells.length} columns; expected ${headers.length}.`);
    return Object.fromEntries(mapped.map((key,i)=>[key,cells[i].trim()]));
  });
}
module.exports={parseImportCsv};
