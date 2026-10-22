import type {State} from '../shared/model';import {dateKey} from './date';
import {dateSchema,planActionSchema} from '../shared/schema';
export type PlanAction={type:'add';id:string;text:string}|{type:'complete';id:string;completed:boolean}|{type:'delete';id:string};
export function applyPlanAction(state:State,date:string,input:PlanAction,now:Date):State {
 dateSchema.parse(date);const action=planActionSchema.parse(input),next=structuredClone(state),plans=next.plans[date]??=[];
 const plan=plans.find(p=>p.id===action.id);
 if(action.type==='add'){
  if(plan)throw new Error('计划编号重复');if(plans.length>=100)throw new Error('每天最多 100 项计划');plans.push({id:action.id,text:action.text,completed:false});
 }else{
  if(!plan)throw new Error('计划已被删除，请刷新后重试');
  if(action.type==='delete')next.plans[date]=plans.filter(p=>p.id!==action.id);
  else{
   if(action.completed&&!plan.completed&&date===dateKey(now)&&!plan.rewardClaimed){
    const day=next.growth.days[date]??={interacted:false,rewardedPlanIds:[],planRewardCount:0};
    if(day.planRewardCount<5&&!day.rewardedPlanIds.includes(plan.id)){day.planRewardCount++;day.rewardedPlanIds.push(plan.id);next.growth.points+=2;}
    plan.rewardClaimed=true;
   }
   plan.completed=action.completed;
  }
 }
 if(!next.plans[date]?.length)delete next.plans[date];return next;
}
