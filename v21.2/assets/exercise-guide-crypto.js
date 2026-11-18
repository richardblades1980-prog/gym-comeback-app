(function(g){"use strict";
const DOMAINS=Object.freeze(["PC-GUIDE-CONTENT-v1","PC-GUIDE-ASSET-SET-v1","PC-GUIDE-ASSIGNMENT-v1","PC-GUIDE-REVIEW-v1","PC-GUIDE-CANONICAL-v1"]);
function validUnicode(s){for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){if(i+1>=s.length||s.charCodeAt(i+1)<0xdc00||s.charCodeAt(i+1)>0xdfff)throw new TypeError("Canonical JSON rejects unpaired surrogates.");i++;}else if(c>=0xdc00&&c<=0xdfff)throw new TypeError("Canonical JSON rejects unpaired surrogates.");}return s;}
function canonicalize(value){
 const seen=new Set();
 function walk(v){
  if(v===null||typeof v==="boolean")return JSON.stringify(v);
  if(typeof v==="string")return JSON.stringify(validUnicode(v));
  if(typeof v==="number"){if(!Number.isFinite(v))throw new TypeError("Canonical JSON rejects non-finite numbers.");return JSON.stringify(v);}
  if(typeof v!=="object")throw new TypeError("Canonical JSON rejects unsupported values.");
  if(seen.has(v))throw new TypeError("Canonical JSON rejects cyclic values.");seen.add(v);
  let out;
  if(Array.isArray(v)){for(let i=0;i<v.length;i++)if(!Object.prototype.hasOwnProperty.call(v,i))throw new TypeError("Canonical JSON rejects sparse arrays.");if(Reflect.ownKeys(v).some(k=>k!=="length"&&!(typeof k==="string"&&/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<v.length)))throw new TypeError("Canonical JSON rejects arrays with extra properties.");out="["+v.map(walk).join(",")+"]";}
  else{const proto=Object.getPrototypeOf(v);if(proto!==Object.prototype&&proto!==null)throw new TypeError("Canonical JSON requires plain objects.");if(Object.getOwnPropertySymbols(v).length)throw new TypeError("Canonical JSON rejects symbol keys.");const keys=Object.keys(v).sort();for(const k of keys){validUnicode(k);const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.prototype.hasOwnProperty.call(d,"value")||typeof d.value==="undefined"||typeof d.value==="function"||typeof d.value==="symbol"||typeof d.value==="bigint")throw new TypeError("Canonical JSON rejects unsupported object values.");}out="{"+keys.map(k=>JSON.stringify(k)+":"+(walk(v[k]))).join(",")+"}";}
  seen.delete(v);return out;
 }return walk(value);
}
function utf8(text){if(typeof TextEncoder==="undefined")throw new Error("TextEncoder unavailable; canonical digest cannot be verified.");return new TextEncoder().encode(text);}
function concatBytes(a,b){const out=new Uint8Array(a.length+b.length);out.set(a,0);out.set(b,a.length);return out;}
function hex(bytes){return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");}
function validateDomain(domain){if(!DOMAINS.includes(domain))throw new TypeError("Unsupported digest domain.");return domain;}
async function sha256Bytes(bytes,cryptoProvider){const c=cryptoProvider||(typeof crypto!=="undefined"?crypto:null);if(!c||!c.subtle||typeof c.subtle.digest!=="function")throw new Error("Web Crypto SHA-256 unavailable; verification fails closed.");const input=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);const result=await c.subtle.digest("SHA-256",input);return "sha256:"+hex(new Uint8Array(result));}
async function digestCanonical(value,domain,cryptoProvider){validateDomain(domain);const canonical=utf8(canonicalize(value));const prefix=utf8(domain+"\0");return sha256Bytes(concatBytes(prefix,canonical),cryptoProvider);}
async function verifyDigest(value,expected,domain,cryptoProvider){if(typeof expected!=="string"||!/^sha256:[0-9a-f]{64}$/.test(expected))return false;return (await digestCanonical(value,domain,cryptoProvider))===expected;}
g.ProjectComebackExerciseGuideCrypto=Object.freeze({DOMAINS,canonicalize,sha256Bytes,digestCanonical,verifyDigest});
})(typeof window!=="undefined"?window:globalThis);