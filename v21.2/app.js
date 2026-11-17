(function(){
"use strict";
const $=id=>document.getElementById(id);
const localNow=new Date();
const today=[localNow.getFullYear(),String(localNow.getMonth()+1).padStart(2,"0"),String(localNow.getDate()).padStart(2,"0")].join("-");
let safetySnapshotSaved=false,restorePayload=null;
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const makeId=prefix=>prefix+"-"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
function notice(message,error){const el=$("notice");el.textContent=message;el.hidden=false;el.classList.toggle("error",!!error);window.scrollTo({top:0,behavior:"smooth"});}
function hideNotice(){$("notice").hidden=true;}
function setBusy(button,busy,label){button.disabled=busy;if(busy)button.dataset.label=button.textContent;button.textContent=busy?"Working…":(label||button.dataset.label||button.textContent);}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!=="view-"+name);document.querySelectorAll(".tab").forEach(b=>{const active=b.dataset.view===name;b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});hideNotice();}
function item(title,meta,tag){return '<div class="record-item"><div><strong>'+esc(title)+'</strong><small>'+esc(meta)+'</small></div><small>'+esc(tag||"")+'</small></div>';}
function shiftDate(date,days){const value=new Date(date+"T12:00:00");value.setDate(value.getDate()+days);return [value.getFullYear(),String(value.getMonth()+1).padStart(2,"0"),String(value.getDate()).padStart(2,"0")].join("-");}
function formatDate(date){return new Date(date+"T12:00:00").toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});}
function renderDuration(summary){return summary.durationRecordedCount?summary.durationMinutes+" min recorded":"Duration not recorded";}
async function refreshTrainingOverview(){
 const upcomingDays=await Promise.all(Array.from({length:7},(_,index)=>ProjectComebackProgrammeManager.dayOverview(shiftDate(today,index))));
 const activeDays=upcomingDays.filter(day=>day.totalScheduled);
 $("upcoming-overview").innerHTML=activeDays.length?activeDays.map(day=>{
   const entries=day.entries.map(entry=>item(entry.title, (entry.moduleId==="gym"?"Gym":"Hiking")+(entry.durationMinutes!==undefined?" · "+entry.durationMinutes+" min planned":""),entry.status||"planned")).join("");
   const notes=(day.readiness?'<p class="overview-note">Readiness entry recorded for this date.</p>':"")+
     day.flags.map(flag=>'<p class="overview-note">'+esc(flag)+'</p>').join("");
   return '<section class="overview-day"><h3>'+esc(formatDate(day.date))+'</h3>'+entries+notes+'</section>';
 }).join(""):'<div class="empty-state">Nothing planned for the next seven days. Add a Gym or Hiking activity in Schedule.</div>';
 const from=shiftDate(today,-29);
 const summary=await ProjectComebackWorkload.rangeOverview(from,today);
 const weeklyRows=data=>{
   const weeks=new Map();
   Object.entries(data.byDate||{}).forEach(([date,day])=>{
     const monday=new Date(date+"T12:00:00");
     monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
     const key=[monday.getFullYear(),String(monday.getMonth()+1).padStart(2,"0"),String(monday.getDate()).padStart(2,"0")].join("-");
     const row=weeks.get(key)||{sessions:0,durationMinutes:0,durationRecordedCount:0};
     row.sessions+=day.sessions;
     row.durationMinutes+=day.durationMinutes;
     row.durationRecordedCount+=day.durationRecordedCount;
     weeks.set(key,row);
   });
   if(!weeks.size)return '<p class="workload-empty">No completed records in this period.</p>';
   return '<div class="workload-weeks">'+[...weeks.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([week,row])=>{
     const missing=row.sessions-row.durationRecordedCount;
     const duration=row.durationRecordedCount?row.durationMinutes+' min recorded':'Duration not recorded';
     return '<div class="workload-week"><strong>Week of '+esc(formatDate(week))+'</strong><span>'+row.sessions+' completed · '+duration+'</span>'+(missing?'<small>'+missing+' record(s) without duration</small>':'')+'</div>';
   }).join("")+'</div>';
 };
 const moduleCard=(name,data)=>'<article class="module-card"><span class="module-tag">COMPLETED</span><h3>'+name+'</h3><p><strong>'+data.sessionCount+'</strong> records in the last 30 days</p><p>'+renderDuration(data)+'</p><small>'+data.durationMissingCount+' record(s) without a recorded duration</small>'+weeklyRows(data)+'</article>';
 $("completed-overview").innerHTML=moduleCard("Gym",summary.gym)+moduleCard("Hiking",summary.hiking);
}

async function refreshScheduleOutlook(){
 const to=shiftDate(today,29);
 const range=await ProjectComebackProgrammeManager.rangeOverview(today,to);
 const gymMinutes=range.days.reduce((sum,day)=>sum+day.entries.filter(entry=>entry.moduleId==="gym").reduce((n,entry)=>n+(Number(entry.durationMinutes)||0),0),0);
 const hikingMinutes=range.days.reduce((sum,day)=>sum+day.entries.filter(entry=>entry.moduleId==="hiking").reduce((n,entry)=>n+(Number(entry.durationMinutes)||0),0),0);
 $("schedule-range-summary").innerHTML=
   '<article class="module-card"><span class="module-tag">GYM</span><h3>'+range.totals.gymSessions+'</h3><p>Scheduled activities</p><small>'+gymMinutes+' min planned duration recorded</small></article>'+
   '<article class="module-card"><span class="module-tag">HIKING</span><h3>'+range.totals.hikingSessions+'</h3><p>Scheduled activities</p><small>'+hikingMinutes+' min planned duration recorded</small></article>';
 $("schedule-range-overview").innerHTML=range.days.length?range.days.map(day=>{
   const entries=day.entries.map(entry=>item(entry.title,(entry.moduleId==="gym"?"Gym":"Hiking")+(entry.durationMinutes!==undefined?" · "+entry.durationMinutes+" min planned":""),entry.status||"planned")).join("");
   const readiness=day.readiness?'<p class="overview-note">Readiness entry recorded for this date.</p>':"";
   return '<section class="overview-day"><h3>'+esc(formatDate(day.date))+'</h3>'+entries+readiness+'</section>';
 }).join(""):'<div class="empty-state">No scheduled activities in the next 30 days.</div>';
}

async function refresh(){
 const db=ProjectComebackDB;
 const [gym,hikes,schedule,modules]=await Promise.all([db.getAllByIndex("sessions","by_module","gym"),db.getAllByIndex("hikingRecords","by_module","hiking"),db.getAll("schedules"),ProjectComebackModules.list()]);
 $("gym-count").textContent=gym.length;$("hiking-count").textContent=hikes.length;$("schedule-count").textContent=schedule.filter(x=>x.status==="planned"&&x.date>=today).length;
 $("module-cards").innerHTML=modules.map(m=>'<article class="module-card"><span class="module-tag">'+(m.enabled?"ACTIVE":"PAUSED")+'</span><h3>'+esc(m.name)+'</h3><p>'+(m.id==="gym"?"Your existing and future gym training records.":"Manual hike history and preparation.")+'</p><button class="secondary module-toggle" type="button" data-module-id="'+esc(m.id)+'" aria-pressed="'+(!m.enabled)+'">'+(m.enabled?"Pause module":"Enable module")+'</button></article>').join("");
 const hikingEnabled=modules.some(m=>m.id==="hiking"&&m.enabled);
 $("hiking-form").querySelectorAll("input,textarea,button").forEach(control=>{control.disabled=!hikingEnabled;});
 $("hiking-form").setAttribute("aria-disabled",String(!hikingEnabled));
 const scheduleSelect=$("schedule-form").elements.moduleId;
 for(const option of scheduleSelect.options){const module=modules.find(m=>m.id===option.value);option.disabled=!module||!module.enabled;}
 const available=[...scheduleSelect.options].filter(option=>!option.disabled);
 if(scheduleSelect.selectedOptions[0]?.disabled&&available.length)scheduleSelect.value=available[0].value;
 scheduleSelect.disabled=available.length===0;
 $("schedule-form").querySelector('button[type="submit"]').disabled=available.length===0;
 const recent=[...gym.map(x=>({...x,_kind:"Gym"})),...hikes.map(x=>({...x,_kind:"Hiking"}))].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,6);
 $("recent-records").innerHTML=recent.length?recent.map(x=>item(x.title||x.name||x.id,x.date||"Date not recorded",x._kind)).join(""):'<div class="empty-state">No records yet. Add a hike or bring across your existing Gym history.</div>';
 $("gym-records").innerHTML=gym.length?gym.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>item(x.title||("Week "+(x.week||"")+" · Day "+(x.day||"")),x.date||"Date not recorded",(x.status||"incomplete")+" · "+(x.durationMinutes??"—")+" min")).join(""):'<div class="empty-state">No migrated Gym sessions found. Use Data &amp; backup to inspect and safely migrate V21.1 data.</div>';
 $("hiking-records").innerHTML=hikes.length?hikes.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>item(x.title,x.date,(x.distanceKm!==undefined?x.distanceKm+" km":"Distance not recorded"))).join(""):'<div class="empty-state">No hikes recorded yet.</div>';
 $("schedule-records").innerHTML=schedule.length?schedule.sort((a,b)=>a.date.localeCompare(b.date)).map(x=>item(x.title,x.date,(x.moduleId==="gym"?"Gym":"Hiking")+" · "+x.status)).join(""):'<div class="empty-state">Nothing scheduled yet.</div>';
 await refreshTrainingOverview();
 await refreshScheduleOutlook();
}

function assessmentMeasures(form){
 const measures={};
 for(const key of ["comfortableWalkMinutes","stepUpsReps","singleLegBalanceSeconds"]){
  const raw=form.elements[key].value;
  if(raw!=="")measures[key]=Number(raw);
 }
 return measures;
}
function assessmentLabel(record){
 return formatDate(record.date)+" · "+(record.kind==="baseline"?"Original baseline":"Follow-up");
}
function renderAssessmentComparison(){
 const history=window._assessmentHistory||[];
 const firstId=$("compare-first").value,secondId=$("compare-second").value;
 const first=history.find(item=>item.id===firstId),second=history.find(item=>item.id===secondId);
 if(history.length===0){
  $("assessment-comparison").innerHTML='<p class="empty-state">Save your original baseline, then add a follow-up assessment to start comparing your progress.</p>';
  return;
 }
 if(history.length===1){
  $("assessment-comparison").innerHTML='<p class="empty-state">Your original starting point is saved. Add a follow-up assessment to see how your progress is changing.</p>';
  return;
 }
 if(!first||!second){$("assessment-comparison").innerHTML='<p class="empty-state">Choose two saved assessments to compare your progress.</p>';return;}
 if(first.id===second.id){$("assessment-comparison").innerHTML='<p class="empty-state">Choose two different assessments to see a comparison.</p>';return;}
 const result=ProjectComebackAssessments.compare(first,second);
 $("assessment-comparison").innerHTML='<div class="comparison-heading"><strong>'+esc(assessmentLabel(first))+'</strong><span>→</span><strong>'+esc(assessmentLabel(second))+'</strong></div>'+
 Object.entries(result.measures).map(([key,m])=>{
  const value=v=>v===null?"Not recorded":String(v)+(m.unit==="repetitions"?"": " "+m.unit);
  const delta=m.difference===null?"Not comparable":(m.difference>0?"+":"")+String(Number(m.difference.toFixed(2)))+" "+m.unit;
  return '<div class="comparison-row"><div><strong>'+esc(m.label)+'</strong><small>'+esc(value(m.first))+' → '+esc(value(m.second))+'</small></div><span class="comparison-delta">'+esc(delta)+'</span></div>';
 }).join("");
}
async function refreshAssessments(){
 const history=await ProjectComebackAssessments.listHistory();
 window._assessmentHistory=history;
 const baseline=history.find(item=>item.id===ProjectComebackAssessments.baselineId);
 $("baseline-status").textContent=baseline?"Saved · "+formatDate(baseline.date):"Not recorded";
 $("baseline-form").querySelectorAll("input,textarea,button").forEach(control=>control.disabled=!!baseline);
 $("baseline-form").querySelector("button[type=submit]").textContent=baseline?"Original baseline saved":"Save original baseline";
 const followUpForm=$("followup-form");
 $("followup-status").textContent=baseline
  ?"Original baseline saved. Follow-up dates must be on or after "+formatDate(baseline.date)+"."
  :"Save your original baseline before adding follow-up assessments.";
 followUpForm.elements.date.min=baseline?baseline.date:"";
 if(baseline&&followUpForm.elements.date.value<baseline.date)followUpForm.elements.date.value=baseline.date;
 followUpForm.querySelectorAll("input,textarea,button").forEach(control=>control.disabled=!baseline);
 const previousFirst=$("compare-first").value,previousSecond=$("compare-second").value;
 const options=history.map(item=>'<option value="'+esc(item.id)+'">'+esc(assessmentLabel(item))+'</option>').join("");
 $("compare-first").innerHTML=options;
 $("compare-second").innerHTML=options;
 if(history.some(item=>item.id===previousFirst))$("compare-first").value=previousFirst;
 if(history.some(item=>item.id===previousSecond))$("compare-second").value=previousSecond;
 if(history.length>1){
  if(!$("compare-first").value)$("compare-first").value=history[0].id;
  if(!$("compare-second").value||$("compare-second").value===$("compare-first").value)$("compare-second").value=history[history.length-1].id;
 }
 $("compare-first").disabled=history.length<2;$("compare-second").disabled=history.length<2;
 $("assessment-history").innerHTML=history.length?history.slice().reverse().map(item=>{
  const measures=Object.entries(item.measures).map(([key,value])=>ProjectComebackAssessments.metrics[key].label+": "+value+" "+ProjectComebackAssessments.metrics[key].unit).join(" · ");
  return '<div class="record-item assessment-record"><div><strong>'+esc(assessmentLabel(item))+'</strong><small>'+esc(measures)+'</small>'+(item.notes?'<small>'+esc(item.notes)+'</small>':"")+'</div><small>'+Object.keys(item.measures).length+' measure(s)</small></div>';
 }).join(""):'<div class="empty-state">No assessments recorded yet. Your first assessment will establish your original baseline.</div>';
 renderAssessmentComparison();
}
$("baseline-form").elements.date.value=today;
$("followup-form").elements.date.value=today;
let baselineSubmissionPending=false;
let followUpSubmissionPending=false;
$("baseline-form").addEventListener("submit",async event=>{
 event.preventDefault();const form=event.currentTarget;
 if(baselineSubmissionPending)return;
 baselineSubmissionPending=true;
 const button=form.querySelector("button[type=submit]");
 button.disabled=true;
 try{
  await ProjectComebackAssessments.createBaseline({date:form.elements.date.value,measures:assessmentMeasures(form),notes:form.elements.notes.value});
  form.reset();await refreshAssessments();notice("Original baseline saved. It is now protected from being overwritten.");
 }catch(error){notice(error.message,true);}
 finally{
  baselineSubmissionPending=false;
  try{
   const saved=!!(await ProjectComebackAssessments.getBaseline());
   form.querySelectorAll("input,textarea,button").forEach(control=>control.disabled=saved);
  }catch(_){form.querySelectorAll("input,textarea,button").forEach(control=>control.disabled=true);}
 }
});
$("followup-form").addEventListener("submit",async event=>{
 event.preventDefault();const form=event.currentTarget;
 if(followUpSubmissionPending)return;
 followUpSubmissionPending=true;
 const button=form.querySelector("button[type=submit]");
 button.disabled=true;
 try{
  await ProjectComebackAssessments.addFollowUp({date:form.elements.date.value,measures:assessmentMeasures(form),notes:form.elements.notes.value});
  form.reset();
  const baseline=await ProjectComebackAssessments.getBaseline();
  form.elements.date.value=baseline&&today<baseline.date?baseline.date:today;
  await refreshAssessments();notice("Follow-up assessment saved to your history.");
 }catch(error){notice(error.message,true);}
 finally{
  followUpSubmissionPending=false;
  button.disabled=false;
 }
});
$("compare-first").addEventListener("change",renderAssessmentComparison);
$("compare-second").addEventListener("change",renderAssessmentComparison);

async function inspectMigration(){
 const info=await ProjectComebackMigration.inspect();
 $("migration-status").textContent=info.legacyKeyCount+" legacy Gym data keys found. Migration status: "+info.status+". Original browser storage will not be deleted.";
}
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.view)));
 $("module-cards").addEventListener("click",async event=>{const button=event.target.closest("[data-module-id]");if(!button)return;const id=button.dataset.moduleId;try{button.disabled=true;const current=await ProjectComebackModules.get(id);await ProjectComebackModules.setEnabled(id,!current.enabled);await refresh();notice(current.enabled?"Module paused. Existing records have been kept.":"Module enabled. You can add and schedule activities again.");}catch(error){notice(error.message,true);}finally{button.disabled=false;}});
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
 try{setBusy(b,true);const result=await ProjectComebackBackup.restoreBackup(restorePayload,{confirmed:true});restorePayload=null;$("restore-preview").hidden=true;$("restore-confirm-wrap").hidden=true;$("restore-file").value="";$("restore-confirm").checked=false;await refresh();await refreshAssessments();notice("Restore completed. A pre-restore safety snapshot was saved in the database.");}catch(error){notice(error.message,true);}finally{setBusy(b,false,"Confirm restore");b.disabled=true;}
});
async function start(){
 try{await ProjectComebackDB.open();const result=await ProjectComebackModules.initialise();$("connection-state").textContent="Local database ready";$("connection-state").classList.add("online");await refresh();await refreshAssessments();await inspectMigration();if(result.created.length)notice("V21.2 local data space initialised. Your existing V21.1 data has not been changed.");}
 catch(error){$("connection-state").textContent="Storage unavailable";notice("Could not initialise local storage: "+error.message,true);}
}
start();
})();