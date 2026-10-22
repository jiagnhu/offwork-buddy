export async function assembleDownload(release, onProgress = () => {}, fetcher = fetch, subtle = crypto.subtle) {
  if (!Array.isArray(release.parts) || !release.parts.length) throw new Error('没有可用的下载文件');
  const buffers = [];
  let total = 0;
  const digest = async buffer => Array.from(new Uint8Array(await subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2,'0')).join('');
  for (const part of release.parts) {
    const response = await fetcher(part.url, {signal:AbortSignal.timeout(120000)});
    if (!response.ok) throw new Error(`下载失败（${response.status}），请重试`);
    if (/html/i.test(response.headers.get('content-type') || '')) throw new Error('下载文件格式不正确，请重试');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== part.bytes || await digest(buffer) !== part.sha256) throw new Error('文件校验未通过，请重新下载');
    buffers.push(buffer); total += buffer.byteLength;
    onProgress(Math.round(total / release.bytes * 100));
  }
  if (total !== release.bytes) throw new Error('安装包大小不匹配');
  const blob = new Blob(buffers, {type:'application/octet-stream'});
  if (await digest(await blob.arrayBuffer()) !== release.sha256) throw new Error('安装包完整性校验未通过');
  return blob;
}
