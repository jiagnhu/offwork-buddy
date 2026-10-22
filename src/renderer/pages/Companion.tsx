import {useState} from 'react';import type {Snapshot} from '../../shared/model';
import Character from '../characters/Character';import CompanionControls from '../components/CompanionControls';
import {useCompanionEvent,useDesktopScale} from '../hooks/useCompanionEvent';
export default function Companion({snapshot}:{snapshot:Snapshot}){
 const p=snapshot.state.preferences,{event,dismiss}=useCompanionEvent(),[error,setError]=useState('');
 const scale=useDesktopScale(p.scale,310);
 return <div className="companion-root" style={{width:360,height:310,transform:`scale(${scale})`}}>
 <CompanionControls snapshot={snapshot} onError={setError}/><div className="companion-stage">
 {event&&<button className="speech-bubble" onClick={dismiss} aria-label="关闭伙伴提示">{event.text}</button>}
 <Character kind={p.character} status={snapshot.progress.status} reducedMotion={p.reducedMotion} onInteract={()=>void window.buddy.interact().catch(e=>setError(e.message))}/>
 </div>{error&&<p className="error">{error}</p>}</div>
}
