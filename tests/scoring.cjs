const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=readFileSync('index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements={};
const element=id=>elements[id]??={innerHTML:'',style:{},setAttribute(){},addEventListener(){},classList:{contains(){return false},add(){},remove(){}}};
const saved={'hq.rec':JSON.stringify({'1-01':{s:'D',r:0},'1-14':{s:'A',r:0},'1-02':{s:'E',r:0},bogus:{s:'A',r:1},'1-03':{s:'Z',r:1}})};
const ctx=vm.createContext({document:{getElementById:element,addEventListener(){}},localStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v},setTimeout,clearTimeout});
vm.runInContext(script,ctx);
function check(code){vm.runInContext(code,ctx)}
ctx.assert=assert;
check(`
assert.equal(QS.length,183);
assert.equal(QS.filter(scorable).length,145);
assert.equal(rec['1-01'].r,null);
assert.equal(rec['1-14'].r,null);
assert.equal(rec['1-02'].r,1);
assert.equal(rec.bogus,undefined);
assert.equal(rec['1-03'],undefined);
for(const q of QS){
 for(const s of ['A','B','C','D','E']){
  const result=evaluate(q,s);
  if(result) assert.equal(result.r,scorable(q)?+(s===q.ans):null);
 }
 if(!scorable(q)) assert.equal(inScope(q,'wrong'),false);
}
for(const raw of [null,[],5,'bad']) assert.equal(Object.keys(migrateRecords(raw)).length,0);
const synthetic={opts:['one','two','three'],ans:'AC',reliability:['reliable']};
assert.equal(evaluate(synthetic,'CA').r,1);
assert.equal(evaluate(synthetic,'A').r,0);
assert.equal(evaluate(synthetic,'AA'),null);
assert.equal(evaluate(synthetic,'E'),null);
assert.equal(evaluate({...synthetic,reliability:['inferred']},'A').r,null);
assert.equal(evaluate({...synthetic,opts:['one','……','three'],reliability:['incomplete']},'B'),null);
for(const q of QS){list=[q];pos=0;pick.clear();render();choose('A');render();}
list=QS;renderScore();
assert.ok(document.getElementById('score').innerHTML.includes('参考练习'));
list=[QS[0]];pos=0;render();
assert.ok(document.getElementById('card').innerHTML.includes('不判对错'));
assert.ok(!document.getElementById('card').innerHTML.includes('回答错误'));
assert.ok(!document.getElementById('card').innerHTML.includes('class="opt wrong'));
const original=QS[0].reliability;QS[0].reliability=['reliable'];
assert.throws(validateBank);QS[0].reliability=original;validateBank();
`);
console.log('PASS: bank integrity, every question/option, migration, multi-select, filters, statistics and rendering');
