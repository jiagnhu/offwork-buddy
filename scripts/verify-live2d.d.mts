export interface AssetLock {
  sdkVersion: string;
  frameworkCommit: string;
  modelCommit: string;
  files: Array<{path:string;sha256:string;mime:string}>;
  sources: Array<{url:string;license:string}>;
  modifications: string[];
}
export function verifyAssets(root: string, lock: AssetLock): Promise<void>;
