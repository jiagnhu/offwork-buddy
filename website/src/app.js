import {detectPlatform,recommendDownload,createSelection} from './platform.js';
import {assembleDownload} from './download.js';
const $ = id => document.getElementById(id);
const deviceInput = {
  userAgent:navigator.userAgent, platform:navigator.userAgentData?.platform || navigator.platform,
  maxTouchPoints:navigator.maxTouchPoints,
};
const selection = createSelection(detectPlatform(deviceInput));
let releases = [];
let loadFailed = false;
let downloading = false;
const names = {windows:'Windows',mac:'macOS',linux:'Linux',mobile:'移动设备',unknown:'当前设备'};

function renderDownload() {
  const device = selection.current();
  const recommendation = recommendDownload(device,releases);
  const release = recommendation.release;
  const available = release && (release.url || release.parts?.length);
  const manual = $('platform-select').value !== 'auto';
  $('hero-download').innerHTML = device.os === 'windows' ? '获取 Windows 版 <span aria-hidden="true">↓</span>' : '查看下载版本 <span aria-hidden="true">↓</span>';
  let title = '选择适合你的版本';
  let message = '无法确认当前系统，请手动选择电脑系统。';
  if(device.os === 'windows') {
    title = 'Windows 版，准备就绪。';
    message = `${manual ? '已选择' : '已识别'} Windows${device.arch === 'x64' ? ' x64' : ''}。`;
    if(device.arch === 'unknown') message += '请确认你的电脑使用 x64 架构后下载。';
    else if(['arm','x86'].includes(device.arch)) {title = '暂未提供对应架构版本'; message += `目前没有${device.arch === 'arm' ? '原生 ARM64' : '32 位'}安装包，可查看下方全部版本。`;}
    else message += '把搭子带回桌面，和它一起期待下班。';
  } else if(device.os === 'mobile') {
    title = '在电脑上，遇见你的搭子。'; message = '这是桌面应用，请在 Windows x64 电脑上打开本页下载。';
  } else if(device.os === 'mac' || device.os === 'linux') {
    title = `${names[device.os]} 版暂未提供`; message = `目前仅提供 Windows x64 版。你也可以手动切换系统，为另一台电脑下载。`;
  }
  if(loadFailed) {title = '下载信息暂时无法加载'; message = '请刷新页面重试。当前发行版本为 Windows x64 v1.1.2。';}
  else if(release && !available) {title = '下载通道准备中'; message += '安装包尚未上线，请稍后再来。';}
  $('download-heading').textContent = title;
  $('system-message').textContent = message;
  const action = $('download-action');
  action.setAttribute('aria-disabled', String(!available || downloading));
  action.href = available && release.url ? release.url : '#download';
  if(available && release.url) action.setAttribute('download',release.filename); else action.removeAttribute('download');
  action.innerHTML = `${downloading ? '正在准备安装包…' : available ? '下载 Windows x64 版' : loadFailed ? '请刷新后重试' : release ? '下载暂未上线' : '当前设备暂无适用版本'} <span aria-hidden="true">↓</span>`;
  $('platform-select').disabled = downloading;
}
$('platform-select').addEventListener('change', event => {
  if(event.target.value === 'auto') selection.resumeAutomatic(detectPlatform(deviceInput));
  else selection.manual({os:event.target.value,arch:event.target.value === 'windows' ? 'x64' : 'unknown'});
  $('download-progress').textContent = '';
  renderDownload();
});
$('download-action').addEventListener('click', async event => {
  const {release} = recommendDownload(selection.current(),releases);
  if(downloading || !release || (!release.url && !release.parts?.length)) {event.preventDefault(); return;}
  if(release.url) {$('download-progress').textContent = '已发起下载，请在浏览器下载列表中查看。'; return;}
  event.preventDefault();
  downloading = true; renderDownload();
  $('download-progress').textContent = '正在获取安装包，请保持本页打开…';
  try {
    const blob = await assembleDownload(release, percent => {$('download-progress').textContent = percent === 100 ? '下载完成，正在验证安装包…' : `正在下载安装包 ${percent}% · 请保持本页打开`;});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = release.filename;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url),60000);
    $('download-progress').textContent = '校验通过，已交给浏览器保存。请查看下载列表。';
  } catch(error) {$('download-progress').textContent = `${error.message || '下载失败'}。可再次点击下载按钮重试。`;}
  finally {downloading = false; renderDownload();}
});
renderDownload();
fetch('releases.json',{cache:'no-cache'}).then(response => {if(!response.ok) throw new Error('release unavailable'); return response.json();}).then(data => {if(!Array.isArray(data)) throw new Error('invalid release'); releases = data; renderDownload();}).catch(() => {loadFailed = true; renderDownload();});
if(navigator.userAgentData?.getHighEntropyValues) {
  navigator.userAgentData.getHighEntropyValues(['architecture','bitness']).then(info => {
    Object.assign(deviceInput,info);
    selection.automatic(detectPlatform(deviceInput)); renderDownload();
  }).catch(() => {}); // Synchronous classification remains usable when the query fails or hangs.
}

const buddies = {
  niangao:{name:'年糕 · 陪伴不用多说',alt:'戴着薄荷绿围巾的奶油猫年糕',description:'软乎乎的奶油猫，系着一条薄荷绿围巾。安静待在桌面一角，陪你把平凡的工作日过得可爱一点。',sticker:'今日份治愈<br>已送达 ♡'},
  xiaomu:{name:'小沐 · 一起期待好时光',alt:'淡紫长发的桌面看板娘小沐',description:'淡紫色的长发，搭配一枚薄荷绿蝴蝶结。小沐会在你的桌面上，陪你看时间流动，也陪你期待下班后的好时光。',sticker:'生活的主角<br>一直是你 ✦'},
};
for(const button of document.querySelectorAll('[data-buddy]')) button.addEventListener('click',() => {
  const key = button.dataset.buddy; const buddy = buddies[key];
  for(const item of document.querySelectorAll('[data-buddy]')) item.setAttribute('aria-pressed',String(item === button));
  $('buddy-image').src = `assets/${key}.svg`; $('buddy-image').alt = buddy.alt;
  $('buddy-name').textContent = buddy.name; $('buddy-description').textContent = buddy.description;
  $('buddy-sticker').innerHTML = buddy.sticker;
});
if(!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const started = Date.now();
  setInterval(() => {
    const remaining = Math.max(0,5316-Math.floor((Date.now()-started)/1000));
    const parts = [Math.floor(remaining/3600),Math.floor(remaining%3600/60),remaining%60].map(n => String(n).padStart(2,'0'));
    $('demo-countdown').innerHTML = parts.join('<span>:</span>');
  },1000);
}
