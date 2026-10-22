import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, recommendDownload, createSelection } from '../src/platform.js';

const releases = [{ platform: 'windows', arch: 'x64', version: '1.1.2' }];
for (const [name, input, expected] of [
  ['Windows 64', { platform: 'Windows', architecture: 'x86', bitness: '64' }, {os:'windows',arch:'x64'}],
  ['Windows UA', {userAgent:'Mozilla Windows NT 10.0; Win64; x64'}, {os:'windows',arch:'x64'}],
  ['Windows unknown', {platform:'Win32'}, {os:'windows',arch:'unknown'}],
  ['Windows ARM', {platform:'Windows',architecture:'arm',bitness:'64'}, {os:'windows',arch:'arm'}],
  ['Windows 32', {platform:'Windows',architecture:'x86',bitness:'32'}, {os:'windows',arch:'x86'}],
  ['Mac', {platform:'MacIntel'}, {os:'mac',arch:'unknown'}],
  ['Linux', {platform:'Linux x86_64'}, {os:'linux',arch:'x64'}],
  ['Android', {userAgent:'Linux; Android 13'}, {os:'mobile',arch:'unknown'}],
  ['iPhone', {userAgent:'iPhone OS'}, {os:'mobile',arch:'unknown'}],
  ['iPad desktop', {platform:'MacIntel',maxTouchPoints:5}, {os:'mobile',arch:'unknown'}],
  ['empty', {}, {os:'unknown',arch:'unknown'}],
]) test(name, () => assert.deepEqual(detectPlatform(input), expected));
test('recommend only known supported architecture', () => {
  assert.equal(recommendDownload({os:'windows',arch:'x64'},releases).status,'recommended');
  assert.equal(recommendDownload({os:'windows',arch:'unknown'},releases).status,'check-architecture');
  for (const device of [{os:'mac'}, {os:'linux'}, {os:'mobile'}, {os:'unknown'}, {os:'windows',arch:'arm'}, {os:'windows',arch:'x86'}]) {
    assert.equal(recommendDownload(device,releases).status,'unavailable');
  }
});
test('manual selection survives late automatic detection', () => {
  const selection = createSelection({os:'unknown',arch:'unknown'});
  selection.manual({os:'mac',arch:'unknown'});
  selection.automatic({os:'windows',arch:'x64'});
  assert.equal(selection.current().os,'mac');
});
