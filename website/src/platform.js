/** Conservative device classification; no identifiers are sent to a server. */
export function detectPlatform(input = {}) {
  const text = `${input.platform || ''} ${input.userAgent || ''}`;
  let os = 'unknown';
  if (/android|iphone|ipad|ipod/i.test(text) || (/mac/i.test(text) && input.maxTouchPoints > 1)) os = 'mobile';
  else if (/win/i.test(text)) os = 'windows';
  else if (/mac/i.test(text)) os = 'mac';
  else if (/linux|cros/i.test(text)) os = 'linux';
  let arch = 'unknown';
  if (/arm|aarch/i.test(input.architecture || '') || /arm64|aarch64/i.test(text)) arch = 'arm';
  else if (input.bitness === '32') arch = 'x86';
  else if (input.bitness === '64' && /x86|x64/i.test(input.architecture || '')) arch = 'x64';
  // Windows browsers may freeze Win64/x64 in the UA even on other hardware.
  else if (os !== 'windows' && /x86_64|x64|amd64/i.test(text)) arch = 'x64';
  else if (/i[3-6]86/i.test(text)) arch = 'x86';
  return { os, arch };
}

export function recommendDownload(device, releases) {
  const release = releases.find(r => r.platform === device.os && r.arch === device.arch);
  if (release) return {release, status:'recommended'};
  if (device.os === 'windows' && device.arch === 'unknown') {
    return {release:releases.find(r => r.platform === 'windows' && r.arch === 'x64') || null, status:'check-architecture'};
  }
  return {release:null, status:'unavailable'};
}

export function createSelection(initial) {
  let value = initial;
  let manual = false;
  return {
    current: () => value,
    manual(next) { manual = true; value = next; },
    resumeAutomatic(next) { manual = false; value = next; },
    automatic(next) { if (!manual) value = next; },
  };
}
