import {Client,type MessageStreamEvent,type MessageResponse} from 'eve/client';
export class EveSupervisor {
 private client:Client;
 constructor(host:string){this.client=new Client({host,redirect:'error'});}
 async send(sessionId:string|null,prompt:string,onStarted?:(id:string)=>void,onEvent?:(event:MessageStreamEvent)=>void):Promise<{sessionId:string;text:string}>{
  prompt+='\n\nFor coding tasks, inspect the target transcript and turn the request into an executable brief: goal, known context, boundaries and verification. Send coding briefs with delegate_task; use control_thread for explicit literal relays. Preserve literal messages when the user explicitly asks you to relay them. Do not simply forward a vague coding request without resolving its context. Keep your final confirmation under 80 words; do not dump a roster of waiting agents.';
  let response:MessageResponse;
  if(sessionId){response=await this.client.sessions.attach(sessionId).send(prompt);}else {const created=await this.client.sessions.create({message:prompt});if(!created.response)throw Error('Eve did not start the supervisor turn');response=created.response;onStarted?.(created.session.state.sessionId);}
  let text='';let terminal=false;
  for await(const event of response){
   onEvent?.(event);
   if(event.type==='message.completed')text=event.data.message;
   if(event.type==='turn.failed'||event.type==='session.failed')throw Error(event.data.message);
   if(event.type==='turn.completed'||event.type==='turn.waiting'||event.type==='session.completed')terminal=true;
   if(event.type==='turn.cancelled')throw Error('Unity turn was cancelled');
  }
  if(!terminal)throw Error('Unity stream ended before its turn completed');
  return {sessionId:response.sessionId,text:text||'Unity finished without a message.'};
 }
}
