import { app, BrowserWindow, Menu, Tray, screen, nativeImage } from "electron";
import path from "node:path";
import type { Preferences } from "../shared/model";
import { clampBounds } from "./bounds";
export let panel: BrowserWindow, companion: BrowserWindow, desktopCard: BrowserWindow;
let tray: Tray, quitting = false, currentPreferences: Preferences;
let desktopVisible=true;
let automaticPosition:{x:number;y:number}|null=null;
let recalled=()=>{};
export function onRecall(fn:()=>void){recalled=fn}
export function moveCharacter(x:number,y:number){automaticPosition={x,y};companion.setPosition(x,y)}
let visibilityChanged=()=>{};
export function onDesktopVisibility(fn:()=>void){visibilityChanged=fn}
export function isDesktopVisible(){return desktopVisible}
const page = path.join(__dirname, "../renderer/index.html");
export function openPanel(){panel.show();panel.focus()}
export function hideCompanion(){desktopVisible=false;companion.hide();desktopCard.hide();visibilityChanged()}
export function showCompanion(){desktopVisible=true;applyPreferences(currentPreferences);if(companion.isMinimized())companion.restore();companion.show();if(currentPreferences.alwaysOnTop)companion.moveTop();visibilityChanged()}
export function recallCompanion(){
 const c=desktopCard.getBounds(),b=companion.getBounds();const area=screen.getDisplayMatching(c).workArea;
 const next=clampBounds({...b,x:c.x-b.width-12,y:c.y},[area]);companion.setPosition(next.x,next.y);showCompanion();recalled();
}
export function createWindows(prefs:Preferences,onPosition:(p:{x:number;y:number},kind?:'card'|'character')=>void,onToggleTop:()=>void){
 const webPreferences={preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true};
 panel=new BrowserWindow({width:1180,height:820,minWidth:880,minHeight:660,title:'下班搭子',backgroundColor:'#f7f8fa',autoHideMenuBar:true,icon:path.join(__dirname,'../resources/icon.png'),webPreferences});
 const desktopOptions={transparent:true,frame:false,resizable:false,skipTaskbar:true,alwaysOnTop:prefs.alwaysOnTop,hasShadow:false,maximizable:false,fullscreenable:false,webPreferences};
 companion=new BrowserWindow({...desktopOptions,width:360,height:310});
 desktopCard=new BrowserWindow({...desktopOptions,width:360,height:440,show:!prefs.collapsed&&!prefs.cardHidden});
 Menu.setApplicationMenu(null);
 for(const win of [panel,companion,desktopCard]){win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault())}
 void panel.loadFile(page);void companion.loadFile(page,{hash:'companion'});void desktopCard.loadFile(page,{hash:'desktop-card'});
 panel.on('close',e=>{if(!quitting){e.preventDefault();panel.hide()}});
 companion.on('close',e=>{if(!quitting){e.preventDefault();hideCompanion()}});
 desktopCard.on('close',e=>{if(!quitting){e.preventDefault();desktopCard.hide()}});
 const area=screen.getPrimaryDisplay().workArea;
 companion.setPosition(prefs.position?.x??area.x+area.width-390,prefs.position?.y??area.y+area.height-340);
 desktopCard.setPosition(prefs.cardPosition?.x??prefs.position?.x??area.x+area.width-390,prefs.cardPosition?.y??area.y+area.height-790);
 for(const [win,kind] of [[companion,'character'],[desktopCard,'card']] as const){
  let timer:ReturnType<typeof setTimeout>;
  win.on('will-move',()=>{if(kind==='character')automaticPosition=null});
  win.on('moved',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(!quitting){const[x,y]=win.getPosition();if(kind==='character'&&automaticPosition?.x===x&&automaticPosition?.y===y)return;onPosition({x,y},kind)}},300)});
  app.on('before-quit',()=>clearTimeout(timer));
 }
 tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'../resources/icon.png')).resize({width:32,height:32}));
 tray.setToolTip('下班搭子 · 每一秒，都有回报');tray.on('double-click',openPanel);
 tray.setContextMenu(Menu.buildFromTemplate([{label:'打开下班搭子',click:openPanel},{label:'显示 / 隐藏桌面伙伴',click:()=>desktopVisible?hideCompanion():showCompanion()},{label:'叫回伙伴',click:recallCompanion},{label:'切换置顶',click:onToggleTop},{type:'separator'},{label:'退出',click:()=>app.quit()}]));
 app.on('before-quit',()=>{quitting=true});
 screen.on('display-removed',()=>applyPreferences(currentPreferences));screen.on('display-metrics-changed',()=>applyPreferences(currentPreferences));
 applyPreferences(prefs);
}
export function applyPreferences(prefs:Preferences){
 const previous=currentPreferences;currentPreferences=prefs;
 if(!companion||companion.isDestroyed())return;
 for(const [win,height] of [[companion,310],[desktopCard,440]] as const){
  if(win.isAlwaysOnTop()!==prefs.alwaysOnTop)win.setAlwaysOnTop(prefs.alwaysOnTop,'floating');
  const bounds=win.getBounds(),target=clampBounds({...bounds,width:Math.round(360*prefs.scale),height:Math.round(height*prefs.scale)},screen.getAllDisplays().map(d=>d.workArea));
  if(bounds.x!==target.x||bounds.y!==target.y||bounds.width!==target.width||bounds.height!==target.height)win.setBounds(target);
 }
 const cardShouldShow=desktopVisible&&!prefs.cardHidden&&!prefs.collapsed;
 if(cardShouldShow&&!desktopCard.isVisible())desktopCard.showInactive();else if(!cardShouldShow&&desktopCard.isVisible())desktopCard.hide();
 if(app.isPackaged&&(!previous||previous.autoStart!==prefs.autoStart))app.setLoginItemSettings({openAtLogin:prefs.autoStart});
}
