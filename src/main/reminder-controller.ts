import type {State} from '../shared/model';import {dueReminders} from '../core/reminders';
export function startReminderController(deps:{getState:()=>State;commit:(s:State)=>Promise<unknown>;isVisible:()=>boolean;emit:(text:string)=>void;now:()=>Date;exclusive:(fn:()=>Promise<void>)=>Promise<void>;onError:(e:unknown)=>void}){
 let previous=deps.now(),busy=false,stopped=false;const seen=new Map<string,number>();
 async function check(){if(busy||stopped)return;busy=true;try{await deps.exclusive(async()=>{
  const now=deps.now(),s=deps.getState(),cutoff=now.getTime()-30*86400000;
  for(const [key,time]of seen)if(time<cutoff)seen.delete(key);
  const candidates=dueReminders(s,previous,now).filter(c=>!seen.has(c.key));previous=now;
  if(!candidates.length)return;
  const next=structuredClone(s);next.reminderHistory=Object.fromEntries(Object.entries(next.reminderHistory).filter(([,t])=>t>=cutoff));
  for(const c of candidates){seen.set(c.key,c.at);next.reminderHistory[c.key]=c.at;}
  try{await deps.commit(next)}catch(e){deps.onError(e)}
  if(!stopped&&deps.isVisible())for(const c of candidates)deps.emit(c.text);
 })}catch(e){deps.onError(e)}finally{busy=false}}
 const timer=setInterval(()=>void check(),1000);
 return {resume:check,stop(){stopped=true;clearInterval(timer)}};
}
