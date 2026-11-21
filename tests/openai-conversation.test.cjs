require('./load-ts.cjs');const test=require('node:test'),assert=require('node:assert/strict');
const {interpretConversation}=require('../src/lib/openai-conversation.ts');
const decision={intent:'PAUSE_NEXT_MONTH',date:null,time:null,reply:'Thank you.',reason:'Customer requested next month.'};
const result=value=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
test('structured reply uses server key, supplied context and no provider conversation storage',async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fictional-test-key';try{
 const actual=await interpretConversation({currentMessage:'Next month please',history:[{text:'Earlier offer'}]},async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer fictional-test-key');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(JSON.parse(body.input).history[0].text,'Earlier offer');assert.ok(options.signal);return result(decision)});assert.deepEqual(actual,decision);
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old}
});
test('missing setup never calls provider',async()=>{const old=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;try{await assert.rejects(interpretConversation({},async()=>{throw Error('must not call')}),/not been configured/)}finally{if(old!==undefined)process.env.OPENAI_API_KEY=old}});
test('invalid, refused and incomplete replies go to review without revealing provider errors',async()=>{
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='fictional-test-key';try{
 for(const response of [{ok:false}, {ok:true,json:async()=>({status:'incomplete'})},{ok:true,json:async()=>({status:'completed',output:[{content:[{type:'refusal'}]}]})},result({...decision,intent:'CHANGE_BALANCE'}),result({...decision,reply:'<script>bad</script>'}),result({...decision,reply:'Visit https://untrusted.example'}),result({...decision,reply:'a'.repeat(901)}),result(null)])await assert.rejects(interpretConversation({},async()=>response),/review|could not answer/);
 }finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old}
});
