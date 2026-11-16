(function(){
"use strict";
const $=id=>document.getElementById(id);
const today=new Date().toISOString().slice(0,10);
let safetySnapshotSaved=false,restorePayload=null;
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const makeId=prefix=>prefix+"-"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
function notice(message,error){const el=$("notice");el.textContent=message;el.hidden=false;el.classList.toggle("error",!!error);window.scrollTo({top:0,behavior:"smooth"});}
function hideNotice(){$("notice").hidden=true;}
function setBusy(button,busy,label){button.disabled=busy;if(busy)button.dataset.label=button.textContent;button.textContent=busy?"Working…":(label||button.dataset.label||button.textContent);}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!=="view-"+name);document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));hideNotice();}
function item(title,meta,tag){return '<div class="record-item"><div><strong>'+esc(title)+'</strong><small>'+esc(meta)+'</small></div><small>'+esc(tag||"")+'</small></div>';}
async function refresh(){
 const db=ProjectComebackDB;
 const [gym,hikes,schedule,modules]=await Promise.all([db.getAllByIndex("sessions","by_module","gym"),db.getAllByIndex("hikingRecords","by_module","hiking"),db.getAll("schedules"),ProjectComebackModules.list()]);
 $("gym-count").textContent=gym.length;$("hiking-count").textContent=hikes.length;$("schedule-count").textContent=schedule.filter(x=>x.status==="planned"&&x.date>=today).length;
 $("module-cards").innerHTML=modules.map(m=>'<article class="module-card"><span class="module-tag">'+(m.enabled?"ACTIVE":"DISABLED")+'</span><h3>'+esc(m.name)+'</h3><p>'+(m.id==="gym"?"Your existing and future gym training records.":"Manual hike history and preparation.")+'</p></article>').join("");
 const recent=[...gym.map(x=>({...x,_kind:"Gym"})),...hikes.map(x=>({...x,_kind:"Hiking"}))].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,6);
 $("recent-records").innerHTML=recent.length?recent.map(x=>item(x.title||x.name||x.id,x.date||"Date not recorded",x._kind)).join(""):'<div class="empty-state">No records yet. Add a hike or bring across your existing Gym history.</div>';
 $("gym-records").innerHTML=gym.length?gym.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>item(x.title||("Week "+(x.week||"")+" · Day "+(x.day||"")),x.date||"Date not recorded",(x.status||"incomplete")+" · "+(x.durationMinutes??"—")+" min")).join(""):'<div class="empty-state">No migrated Gym sessions found. Use Data &amp; backup to inspect and safely migrate V21.1 data.</div>';
 $("hiking-records").innerHTML=hikes.length?hikes.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>item(x.title,x.date,(x.distanceKm!==undefined?x.distanceKm+" km":"Distance not recorded"))).join(""):'<div class="empty-state">No hikes recorded yet.</div>';
 $("schedule-records").innerHTML=schedule.length?schedule.sort((a,b)=>a.date.localeCompare(b.date)).map(x=>item(x.title,x.date,(x.moduleId==="gym"?"Gym":"Hiking")+" · "+x.status)).join(""):'<div class="empty-state">Nothing scheduled yet.</div>';
}
async function inspectMigration(){
 const info=await ProjectComebackMigration.inspect();
 $("migration-status").textContent=info.legacyKeyCount+" legacy Gym data keys found. Migration status: "+info.status+". Original browser storage will not be deleted.";
}
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.view)));
$("today-date").textContent=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
$("hiking-form").elements.date.value=today;$("schedule-form").elements.date.value=today;
$("hiking-form").addEventListener("submit",async event=>{
 event.preventDefault();const form=event.currentTarget,fd=new FormData(form),title=String(fd.get("title")||"").trim(),date=String(fd.get("date")||"");
 if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date){notice("Enter a valid hike name and date.",true);return;}
 const record={id:makeId("hike"),moduleId:"hiking",status:"completed",title,date};
 for(const field of ["distanceKm","durationMinutes","elevationGainM"]){const raw=fd.get(field);if(raw!==""){const n=Number(raw);const minimum=field==="elevationGainM"?0:Number.MIN_VALUE;if(!Number.isFinite(n)||n<minimum){notice(field+" must be "+(minimum===0?"a non-negative":"greater than zero")+" number.",true);return;}record[field]=n;}}
 for(const field of ["routeName","terrain","notes"]){const value=String(fd.get(field)||"").trim();if(value)record[field]=value;}
 try{await ProjectComebackModules.putOwnedRecord("hiking","hikingRecords",record);form.reset();form.elements.date.value=today;await refresh();notice("Hike saved.");}catch(error){notice(error.message,true);}
});
$("schedule-form").addEventListener("submit",async event=>{
 event.preventDefault();const form=event.currentTarget,fd=new FormData(form),title=String(fd.get("title")||"").trim(),date=String(fd.get("date")||""),duration=fd.get("durationMinutes");
 const entry={id:makeId("schedule"),moduleId:String(fd.get("moduleId")),title,date,status:"planned"};
 if(duration!=="")entry.durationMinutes=Number(duration);
 try{await ProjectComebackProgrammeManager.saveSchedule(entry);form.reset();form.elements.date.value=today;await refresh();notice("Activity added to your schedule.");}catch(error){notice(error.message,true);}
});
$("backup-download").addEventListener("click",async event=>{const b=event.currentTarget;try{setBusy(b,true);const result=await ProjectComebackBackup.downloadBackup();notice("Full backup downloaded ("+result.bytes.toLocaleString()+" characters). Keep it somewhere safe.");}catch(error){notice(error.message,true);}finally{setBusy(b,false,"Download full backup");}});
$("legacy-snapshot").addEventListener("click",async event=>{const b=event.currentTarget;try{setBusy(b,true);await ProjectComebackMigration.downloadSafetySnapshot();safetySnapshotSaved=true;$("migration-confirm").disabled=false;notice("Legacy safety snapshot download requested. Save that file before confirming migration.");}catch(error){notice(error.message,true);}finally{setBusy(b,false,"Download legacy safety snapshot");}});
$("migration-confirm").addEventListener("change",event=>{$("migration-run").disabled=!(event.target.checked&&safetySnapshotSaved);});
$("migration-run").addEventListener("click",async event=>{
 const b=event.currentTarget;if(!safetySnapshotSaved||!$("migration-confirm").checked)return;
 try{setBusy(b,true);const result=await ProjectComebackMigration.migrateAndVerify();const verified=await ProjectComebackMigration.inspect();if(verified.status!=="complete")throw new Error("Migration returned without a verified completion marker.");$("migration-result").hidden=false;$("migration-result").textContent="Migration status: "+result.status+"\nSource keys: "+result.sourceKeyCount+"\nWarnings: "+result.warnings.length+"\n"+result.warnings.map(w=>w.key+": "+w.reason).join("\n");await refresh();await inspectMigration();notice("Migration completed and the typed completion marker is verified.");}catch(error){$("migration-result").hidden=false;$("migration-result").textContent="Migration did not complete: "+error.message;notice(error.message,true);}finally{setBusy(b,false,"Run migration");}
});
$("restore-file").addEventListener("change",async event=>{
 restorePayload=null;$("restore-confirm").checked=false;$("restore-apply").disabled=true;$("restore-confirm-wrap").hidden=true;
 const file=event.target.files&&event.target.files[0];if(!file)return;
 try{const text=await file.text();const preview=await ProjectComebackBackup.previewRestore(text);restorePayload=text;$("restore-preview").hidden=false;$("restore-preview").textContent="Valid backup · "+preview.totalIncomingRecords+" incoming records\nExported: "+(preview.exportedAt||"unknown")+"\n\n"+Object.entries(preview.stores).filter(([,v])=>v.added||v.changed||v.removed).map(([name,v])=>name+": "+v.added+" added, "+v.changed+" changed, "+v.removed+" removed").join("\n")+"\n\n"+preview.warning;$("restore-confirm-wrap").hidden=false;notice("Backup validated. Review the restore preview carefully.");}catch(error){$("restore-preview").hidden=false;$("restore-preview").textContent=error.message;notice(error.message,true);}
});
$("restore-confirm").addEventListener("change",event=>{$("restore-apply").disabled=!(event.target.checked&&restorePayload);});
$("restore-apply").addEventListener("click",async event=>{
 if(!restorePayload||!$("restore-confirm").checked)return;const b=event.currentTarget;
 try{setBusy(b,true);const result=await ProjectComebackBackup.restoreBackup(restorePayload,{confirmed:true});restorePayload=null;$("restore-preview").hidden=true;$("restore-confirm-wrap").hidden=true;$("restore-file").value="";$("restore-confirm").checked=false;await refresh();notice("Restore completed. A pre-restore safety snapshot was saved in the database.");}catch(error){notice(error.message,true);}finally{setBusy(b,false,"Confirm restore");b.disabled=true;}
});
async function start(){
 try{await ProjectComebackDB.open();const result=await ProjectComebackModules.initialise();$("connection-state").textContent="Local database ready";$("connection-state").classList.add("online");await refresh();await inspectMigration();if(result.created.length)notice("V21.2 local data space initialised. Your existing V21.1 data has not been changed.");}
 catch(error){$("connection-state").textContent="Storage unavailable";notice("Could not initialise local storage: "+error.message,true);}
}
start();
})();