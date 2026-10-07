import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialRoom} from './store';
import {CodexSupervisor,parseSupervisorReply} from './codex-supervisor';
import type {Agent37} from './agent37';
import type {RoomStore} from './store';
import type {UnityService} from './service';
test('subscription supervisor executes a structured brief only after reading the project worker',async()=>{
 const room=initialRoom('demo');const target=room.threads[0];let delivered='';const events:unknown[]=[];
 const replies=[{tool:'read_thread',input:{threadId:target.id}},{tool:'delegate_task',input:{threadId:target.id,goal:'Add persistence',context:'Existing navigation prototype',constraints:['Keep isolated workspace'],verification:['Run a regression check']}},{message:'Instruction delivered; awaiting worker results.'}];
 const worker={async *run(){yield {type:'response.created',data:{session_id:'supervisor-session'}};yield {type:'response.completed',data:{output_text:JSON.stringify(replies.shift())}};}} as unknown as Agent37;
 const service={thread(id:string){if(id!==target.id)throw Error('Thread not found');return target;},async control(_id:string,_action:string,text:string){delivered=text;target.status='running';}} as unknown as UnityService;
 const supervisor=new CodexSupervisor(worker,{room} as RoomStore,()=>service);
 const result=await supervisor.send(null,'Delegate persistence',undefined,e=>events.push(e));
 assert.match(delivered,/Goal\nAdd persistence/);assert.match(delivered,/Verification\n- Run a regression check/);assert.equal(result.sessionId,'supervisor-session');assert.equal(events.filter((e:any)=>e.type==='action.result').length,2);
});
test('supervisor refuses arbitrary tool names and incomplete delegation',()=>{
 assert.throws(()=>parseSupervisorReply('{"tool":"shell","input":{"command":"anything"}}'));
 assert.throws(()=>parseSupervisorReply('{"tool":"delegate_task","input":{"threadId":"other"}}'));
});
