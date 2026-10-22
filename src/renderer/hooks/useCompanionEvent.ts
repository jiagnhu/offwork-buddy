import {useEffect,useState} from 'react';
import type {CompanionEvent} from '../../shared/model';
export function useCompanionEvent(){const[event,setEvent]=useState<CompanionEvent|null>(null);useEffect(()=>window.buddy.onCompanionEvent(setEvent),[]);useEffect(()=>{if(!event)return;const timer=setTimeout(()=>setEvent(null),Math.max(0,event.createdAt+event.durationMs-Date.now()));return()=>clearTimeout(timer)},[event]);return {event,dismiss:()=>setEvent(null)}}
export function useDesktopScale(preferred:number,height:number){const[size,setSize]=useState({w:innerWidth,h:innerHeight});useEffect(()=>{const fn=()=>setSize({w:innerWidth,h:innerHeight});window.addEventListener('resize',fn);return()=>window.removeEventListener('resize',fn)},[]);return Math.min(preferred,size.w/360,size.h/height)}
