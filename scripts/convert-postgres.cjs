const fs=require('fs'), path=require('path');
const parser=require('@babel/parser'), traverse=require('@babel/traverse').default, t=require('@babel/types'), generate=require('@babel/generator').default;
const tables=require('../server/db/tables.json');
const files=[...fs.readdirSync('server/routes').map(f=>'server/routes/'+f),'server/services/emailService.js','server/services/importService.js'];
const asyncNames=new Set(['sendVerificationEmail','previewAndStageBatch','commitStagedBatch']);
for(const file of files){
 const ast=parser.parse(fs.readFileSync(file,'utf8'));
 const prepared=new Set(); let needsEach=false;
 traverse(ast,{VariableDeclarator(p){const n=p.node;if(t.isCallExpression(n.init)&&t.isMemberExpression(n.init.callee)&&t.isIdentifier(n.init.callee.object,{name:'db'})&&t.isIdentifier(n.init.callee.property,{name:'prepare'})){prepared.add(n.id.name);n.init=n.init.arguments[0];}}});
 traverse(ast,{CallExpression:{exit(p){const n=p.node,c=n.callee;
 if(t.isIdentifier(c,{name:'transaction'})&&n.arguments.length===0){p.parentPath.remove();return;}
 if(t.isMemberExpression(c)&&['get','all','run'].includes(c.property.name)){
 let sql,args=n.arguments;
 if(t.isCallExpression(c.object)&&t.isMemberExpression(c.object.callee)&&t.isIdentifier(c.object.callee.object,{name:'db'})&&t.isIdentifier(c.object.callee.property,{name:'prepare'})) sql=c.object.arguments[0];
 else if(t.isIdentifier(c.object)&&prepared.has(c.object.name))sql=c.object;
 if(sql){p.replaceWith(t.awaitExpression(t.callExpression(t.memberExpression(t.identifier('db'),c.property),[sql,...args])));return;}
 }
 if(t.isMemberExpression(c)&&t.isIdentifier(c.object,{name:'db'})&&['exec','transaction'].includes(c.property.name)){
 if(!p.parentPath.isAwaitExpression())p.replaceWith(t.awaitExpression(n));
 }else if(t.isIdentifier(c)&&asyncNames.has(c.name)&&!p.parentPath.isAwaitExpression()) p.replaceWith(t.awaitExpression(n));
 }}});
 // Turn the transaction thunk convention into a directly awaited transaction.
 traverse(ast,{VariableDeclaration(p){if(p.node.declarations.length===1&&p.node.declarations[0].id.name==='transaction')p.replaceWith(t.expressionStatement(p.node.declarations[0].init));}});
 let changed=true;
 while(changed){changed=false;
 traverse(ast,{AwaitExpression(p){const f=p.getFunctionParent();if(f&&!f.node.async){f.node.async=true;changed=true;}}});
 traverse(ast,{CallExpression:{exit(p){const n=p.node,c=n.callee;
 if(t.isMemberExpression(c)&&['map','forEach'].includes(c.property.name)&&n.arguments.some(a=>(t.isFunctionExpression(a)||t.isArrowFunctionExpression(a))&&a.async)){
 if(c.property.name==='map'){
  if(p.parentPath.isCallExpression()&&t.isMemberExpression(p.parentPath.node.callee)&&t.isIdentifier(p.parentPath.node.callee.object,{name:'Promise'}))return;
  p.replaceWith(t.awaitExpression(t.callExpression(t.memberExpression(t.identifier('Promise'),t.identifier('all')),[n])));
 }else{needsEach=true;p.replaceWith(t.awaitExpression(t.callExpression(t.identifier('eachSeries'),[c.object,...n.arguments])));}
 changed=true;p.skip();
 }
 }}});
 }
 function sqlText(s){for(const table of tables)s=s.replace(new RegExp('\\b(FROM|JOIN|INTO|UPDATE|REFERENCES|TABLE)\\s+'+table+'\\b','gi'),(_,kw)=>kw+' rinkcircuit.'+table);return s;}
 traverse(ast,{StringLiteral(p){p.node.value=sqlText(p.node.value);},TemplateElement(p){p.node.value.raw=sqlText(p.node.value.raw);p.node.value.cooked=sqlText(p.node.value.cooked);}});
 if(needsEach)ast.program.body.unshift(parser.parse("const { eachSeries } = require('../db/async');").program.body[0]);
 fs.writeFileSync(file,generate(ast,{retainLines:true,comments:true}).code+'\n');
}
