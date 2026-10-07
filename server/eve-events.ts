import type {MessageStreamEvent} from 'eve/client';
import type {UnityRoom} from '../src/domain/unity';
import {publicToolDetail} from '../src/domain/tool-detail';
export function projectEveEvent(room:UnityRoom,event:MessageStreamEvent) {
 const now=new Date().toISOString();
 const tool=(id:string,name:string)=>{let item=room.supervisorTools.find(t=>t.id===id);if(!item){item={id,name,input:'',output:'',status:'inProgress',at:now};room.supervisorTools.push(item);}return item;};
 if(event.type==='action.input.appended'){const t=tool(event.data.callId,event.data.toolName);t.input+=event.data.inputTextDelta;}
 if(event.type==='actions.requested')for(const action of event.data.actions){if(action.kind==='tool-call'){const t=tool(action.callId,action.toolName);t.input=publicToolDetail(action.input);}}
 if(event.type==='action.result'){const result=event.data.result;if(result.kind==='tool-result'){const t=tool(result.callId,result.toolName);t.status=event.data.status==='completed'?'completed':'failed';t.output=publicToolDetail(result.output);}}
 if(event.type==='task.settled'){const t=tool(event.data.callId,event.data.name??'tool');t.status=event.data.status==='completed'?'completed':'failed';t.output=publicToolDetail(event.data.output??event.data.error??{status:event.data.status});}
 if(event.type==='message.appended'||event.type==='message.completed'){
  const id=`eve:${event.data.turnId}:${event.data.stepIndex}`;
  let m=room.messages.find(m=>m.id===id);
  if(!m){m={id,role:'assistant',text:'',at:now,streaming:true};room.messages.push(m);}
  if(event.type==='message.appended'){m.text+=event.data.messageDelta;m.streaming=true;}else {m.text=event.data.message;m.streaming=false;}
 }
 room.supervisorTools=room.supervisorTools.slice(-200);
}
