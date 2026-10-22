import type {State} from '../shared/model';import {dateKey} from './date';
export const unlocks=(points:number)=>({star:points>=10,pillow:points>=30,celebration:points>=60});
export function rewardInteraction(state:State,now:Date):State {
 const next=structuredClone(state),date=dateKey(now);
 const day=next.growth.days[date]??={interacted:false,rewardedPlanIds:[],planRewardCount:0};
 if(!day.interacted){day.interacted=true;next.growth.points++}return next;
}
