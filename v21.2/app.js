(function(){
"use strict";
const $=id=>document.getElementById(id);
const localNow=new Date();
const today=[localNow.getFullYear(),String(localNow.getMonth()+1).padStart(2,"0"),String(localNow.getDate()).padStart(2,"0")].join("-");
let safetySnapshotSaved=false,restorePayload=null,identitySafetyBackup=null,activeGymWorkout=null,gymWorkoutRefreshToken=0,gymStopwatchRenderInterval=null,gymRestRenderInterval=null,gymRestAlertedEndAt=null,gymCelebrationTimer=null,exerciseGuideTrigger=null,exerciseGuideHoldTimer=null,exerciseGuidePointer=null,exerciseGuideManifestPromise=null;
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const makeId=prefix=>prefix+"-"+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
function notice(message,error){const el=$("notice");el.textContent=message;el.hidden=false;el.classList.toggle("error",!!error);window.scrollTo({top:0,behavior:"smooth"});}
function hideNotice(){$("notice").hidden=true;}
function setBusy(button,busy,label){button.disabled=busy;if(busy)button.dataset.label=button.textContent;button.textContent=busy?"Working…":(label||button.dataset.label||button.textContent);}
function showView(name){document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!=="view-"+name);document.querySelectorAll(".tab").forEach(b=>{const active=b.dataset.view===name;b.classList.toggle("active",active);if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});hideNotice();if(name==="gym")refreshGymWorkout().catch(error=>notice(error.message,true));}
function item(title,meta,tag){return '<div class="record-item"><div><strong>'+esc(title)+'</strong><small>'+esc(meta)+'</small></div><small>'+esc(tag||"")+'</small></div>';}

let gymProgressionPlan={weeks:4,daysPerWeek:2};
async function refreshGymProgressionControls(requestToken){
 const progression=ProjectComebackGymProgression;
 const plan=await progression.getPlan();
 if(requestToken!==undefined&&requestToken!==gymWorkoutRefreshToken)return false;
 gymProgressionPlan=plan;
 const weekSelect=$("gym-workout-week"),daySelect=$("gym-workout-day");
 const oldWeek=Number(weekSelect.value)||1,oldDay=Number(daySelect.value)||1;
 weekSelect.innerHTML=Array.from({length:plan.weeks},(_,i)=>'<option value="'+(i+1)+'">Week '+(i+1)+'</option>').join("");
 weekSelect.value=String(Math.min(oldWeek,plan.weeks));
 $("gym-programme-weeks").value=String(plan.weeks);
 $("gym-days-per-week").value=String(plan.daysPerWeek);
 daySelect.value=String(oldDay);
 Array.from(daySelect.options).forEach(option=>{option.disabled=Number(option.value)>plan.daysPerWeek;});
 if(daySelect.selectedOptions[0]?.disabled)daySelect.value="1";
 const week=Number(weekSelect.value),day=Number(daySelect.value);
 const unlocked=await progression.isUnlocked(week,day,plan);
 const overrides=await progression.getManualUnlocks();
 const manual=overrides.some(item=>item.week===week&&item.day===day);
 let messageText;
 if(unlocked&&!manual){
  const next=await progression.nextWorkout(week,day,plan);
  messageText=next?("Available in sequence. Complete every set and save to unlock Week "+next.week+", Day "+next.day+"."):"Final workout of the programme is available.";
 }else if(manual){
  messageText="Manual beta unlock is active for this workout. You can relock it at any time.";
 }else{
  messageText=day>1?("Complete Week "+week+", Day "+(day-1)+" to unlock this workout, or manually unlock for testing."):(week>1?("Complete Week "+(week-1)+", Day "+plan.daysPerWeek+" to unlock this week, or manually unlock for testing."):"Week 1, Day 1 starts your programme.");
 }
 const selectedDate=$("gym-workout-date").value||today;
 const resumable=await ProjectComebackGymWorkout.findInProgress(day,selectedDate,week);
 if(requestToken!==undefined&&requestToken!==gymWorkoutRefreshToken)return unlocked;
 const title=$("gym-progression-title"),message=$("gym-progression-message"),button=$("gym-progression-override");
 title.textContent=(unlocked?"Unlocked":"Locked")+" · Week "+week+" / Day "+day;
 message.textContent=messageText;
 button.textContent=manual?"Relock selected workout":unlocked?"Unlocked by sequence":"Manually unlock selected workout";
 button.disabled=unlocked&&!manual;
 const startButton=$("gym-workout-start");
 startButton.disabled=!unlocked&&!resumable;
 startButton.textContent=resumable?"Resume workout":"Start / resume workout";
 button.onclick=async()=>{
  if(Number(weekSelect.value)!==week||Number(daySelect.value)!==day)return;
  try{await progression.setManualUnlock(week,day,!manual);await refreshGymProgressionControls();notice(manual?"Manual unlock removed.":"Selected workout manually unlocked for testing.");}
  catch(error){notice(error.message,true);}
 };
 return unlocked;
}
async function refreshGymWorkout(){
 const requestToken=++gymWorkoutRefreshToken;
 const week=Number($("gym-workout-week").value)||1,day=Number($("gym-workout-day").value),date=$("gym-workout-date").value||today;
 activeGymWorkout=null;
 $("gym-workout-active").hidden=true;
 const workout=await ProjectComebackGymWorkout.findInProgress(day,date,week);
 if(requestToken!==gymWorkoutRefreshToken)return;
 activeGymWorkout=workout;
 if(workout){renderGymWorkout();$("gym-workout-status").textContent="An in-progress session for this programme week, day and date is ready to resume.";}
 else{$("gym-workout-active").hidden=true;$("gym-workout-status").textContent="No in-progress session for this week, day and date. Start a new workout when ready.";}
 await refreshGymProgressionControls(requestToken);
}
function formatStopwatchElapsed(set){
 const base=Math.max(0,Number(set.stopwatchElapsedMs)||0);
 const started=Number(set.stopwatchStartedAt);
 const ms=base+(Number.isFinite(started)&&started>0?Math.max(0,Date.now()-started):0);
 const total=Math.floor(ms/1000),minutes=Math.floor(total/60),seconds=total%60;
 return String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
}
function updateGymStopwatchDisplays(){
 document.querySelectorAll("[data-stopwatch-display]").forEach(display=>{
  const base=Number(display.dataset.stopwatchElapsedMs)||0,started=Number(display.dataset.stopwatchStartedAt);
  const ms=base+(Number.isFinite(started)&&started>0?Math.max(0,Date.now()-started):0);
  const total=Math.floor(ms/1000),minutes=Math.floor(total/60),seconds=total%60;
  display.textContent=String(minutes).padStart(2,"0")+":"+String(seconds).padStart(2,"0");
 });
}
function gymRestAlert(){const mode=localStorage.getItem("gym-comeback-rest-alert")||"both";if((mode==="both"||mode==="vibrate")&&"vibrate"in navigator){try{navigator.vibrate([250,100,250,100,500]);}catch(_){}}if(mode==="both"||mode==="sound"){try{const AudioContext=window.AudioContext||window.webkitAudioContext;if(AudioContext){const ctx=new AudioContext();[0,.22,.44].forEach((delay,index)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="square";osc.frequency.value=index===2?880:660;gain.gain.setValueAtTime(.0001,ctx.currentTime+delay);gain.gain.exponentialRampToValueAtTime(.15,ctx.currentTime+delay+.02);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+delay+.18);osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+.2);});setTimeout(()=>ctx.close().catch(()=>{}),1200);}}catch(_){}}}
function gymRestRemainingMs(){return activeGymWorkout&&activeGymWorkout.session.restEndAt?Math.max(0,Number(activeGymWorkout.session.restEndAt)-Date.now()):0;}
function updateGymRestDisplay(){const session=activeGymWorkout&&activeGymWorkout.session,box=$("gym-rest-timer");if(!box)return;if(!session||!session.restEndAt){box.hidden=true;return;}box.hidden=false;const remaining=gymRestRemainingMs(),seconds=Math.ceil(remaining/1000),minutes=Math.floor(seconds/60),remainder=seconds%60;$("gym-rest-countdown").textContent=String(minutes).padStart(2,"0")+":"+String(remainder).padStart(2,"0");const duration=Math.max(1,Number(session.restDurationSeconds)||90);$("gym-rest-progress-bar").style.width=Math.max(0,Math.min(100,remaining/(duration*1000)*100))+"%";const exercise=activeGymWorkout.exerciseRecords.find(item=>item.id===session.restExerciseId);$("gym-rest-label").textContent=(exercise?(exercise.performedExerciseName||exercise.name)+" · after set "+session.restSetNumber:"Rest period")+" — "+(remaining?"Take your rest.":"Rest complete — ready for your next set.");if(!remaining&&gymRestAlertedEndAt!==session.restEndAt){gymRestAlertedEndAt=session.restEndAt;gymRestAlert();notice("Rest complete — ready for your next set.");}}
function renderGymWorkout(){
 const workout=activeGymWorkout;
 if(!workout){$("gym-workout-active").hidden=true;return;}
 $("gym-workout-active").hidden=false;
 $("gym-workout-title").textContent=workout.session.title;
 const allSets=workout.exerciseRecords.flatMap(exercise=>exercise.sets||[]);
 const completed=allSets.filter(set=>set.status==="completed").length;
 $("gym-workout-progress").textContent=completed+" of "+allSets.length+" sets completed · Changes save automatically on each field edit.";
 $("gym-workout-finish").disabled=!allSets.length||completed!==allSets.length;
 const alertMode=$("gym-rest-alert-mode");if(alertMode)alertMode.value=localStorage.getItem("gym-comeback-rest-alert")||"both";
 updateGymRestDisplay();
 $("gym-workout-exercises").innerHTML=workout.exerciseRecords.map(exercise=>{
  const exerciseDisplayName=exercise.performedExerciseName||exercise.name;
  const sets=exercise.sets.map(set=>{
   const locked=set.status==="locked",done=set.status==="completed";
   const repField=exercise.recordingMode==="reps"||exercise.recordingMode==="timed-reps"
    ?'<label>Reps<input type="number" min="0" step="1" value="'+esc(set.reps)+'" data-gym-field="reps" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'" aria-label="'+esc(exerciseDisplayName)+' set '+set.setNumber+' repetitions" '+(locked?'disabled':'')+'></label>':"";
   const timed=exercise.recordingMode==="timed-hold"||exercise.recordingMode==="timed-reps";
   const durationField=timed
    ?'<label>Actual seconds<input type="number" min="0" step="1" value="'+esc(set.duration)+'" data-gym-field="duration" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'" aria-label="'+esc(exerciseDisplayName)+' set '+set.setNumber+' actual duration in seconds" '+(locked||Number.isFinite(Number(set.stopwatchStartedAt))?'disabled':'')+'></label><label>Target seconds<input type="number" min="0" step="1" value="'+esc(set.targetDuration)+'" data-gym-field="targetDuration" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'" aria-label="'+esc(exerciseDisplayName)+' set '+set.setNumber+' target duration in seconds" '+(locked?'disabled':'')+'></label><div class="gym-stopwatch"><strong data-stopwatch-display data-stopwatch-started-at="'+(Number.isFinite(Number(set.stopwatchStartedAt))?Number(set.stopwatchStartedAt):'')+'" data-stopwatch-elapsed-ms="'+(Math.max(0,Number(set.stopwatchElapsedMs)||0))+'">'+formatStopwatchElapsed(set)+'</strong><div class="gym-stopwatch-actions">'+(Number.isFinite(Number(set.stopwatchStartedAt))?'<button class="secondary" type="button" data-gym-action="timer-stop" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'">Stop</button>':'<button class="secondary" type="button" data-gym-action="timer-start" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'" '+(locked||done?'disabled':'')+'>Start timer</button>')+'<button class="secondary" type="button" data-gym-action="timer-reset" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'" '+(locked?'disabled':'')+'>Reset</button></div></div>':"";
   const weightField='<label>Weight (kg)<input type="number" min="0" step="0.1" value="'+esc(set.weight)+'" data-gym-field="weight" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'" aria-label="'+esc(exerciseDisplayName)+' set '+set.setNumber+' weight in kilograms" '+(locked?'disabled':'')+'></label>';
   const action=locked?'<span class="gym-set-state">Locked — complete the previous set</span>':
    done?'<button class="secondary" type="button" data-gym-action="undo" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'">Undo completion</button>':
    set.status==="in-progress"?'<button class="primary" type="button" data-gym-action="complete" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'">Set completed</button>':
    '<button class="secondary" type="button" data-gym-action="start" data-exercise-id="'+esc(exercise.id)+'" data-set-number="'+set.setNumber+'">Start set</button>';
   return '<div class="gym-set-row"><div class="gym-set-heading"><strong>Set '+set.setNumber+'</strong><span class="gym-set-state">'+esc(set.status.replace("-"," "))+'</span></div><div class="gym-set-fields">'+weightField+repField+durationField+'</div><div class="gym-set-action">'+action+'</div></div>';
  }).join("");
  const restOptions=ProjectComebackGymWorkout.restPresets.map(seconds=>'<option value="'+seconds+'"'+(Number(exercise.restSeconds||90)===seconds?' selected':'')+'>'+seconds+' sec</option>').join("");
  const swapDisabled=exercise.status!=="not-started"||exercise.sets.some(set=>set.status==="in-progress"||set.status==="completed"||set.startedAt||set.completedAt||[set.weight,set.reps,set.duration,set.targetDuration].some(value=>value!==undefined&&value!==null&&String(value).trim()!==""));
  const swapPanel='<div class="gym-exercise-swap"><p class="subtle">Programme exercise: '+esc(exercise.sourceExerciseLabel||exercise.name)+'</p><p class="subtle">Manual swaps do not change sets or targets. Confirm the replacement is suitable before starting; details are not catalogue-verified.</p><label>Manual exercise change<input type="text" maxlength="120" value="'+esc(exercise.performedExerciseName||exercise.sourceExerciseLabel||exercise.name)+'" data-gym-swap-name data-exercise-id="'+esc(exercise.id)+'" '+(swapDisabled?'disabled':'')+'></label><label>Equipment status<select data-gym-swap-equipment data-exercise-id="'+esc(exercise.id)+'" '+(swapDisabled?'disabled':'')+'><option value="unknown"'+((exercise.substitution&&exercise.substitution.equipmentStatus==="unknown")||!exercise.substitution?' selected':'')+'>Not checked</option><option value="available"'+(exercise.substitution&&exercise.substitution.equipmentStatus==="available"?' selected':'')+'>Available</option><option value="unavailable"'+(exercise.substitution&&exercise.substitution.equipmentStatus==="unavailable"?' selected':'')+'>Unavailable</option></select></label><button class="secondary" type="button" data-gym-action="swap-save" data-exercise-id="'+esc(exercise.id)+'" '+(swapDisabled?'disabled':'')+'>Save exercise change</button>'+(exercise.substitution?'<button class="secondary" type="button" data-gym-action="swap-restore" data-exercise-id="'+esc(exercise.id)+'" '+(swapDisabled?'disabled':'')+'>Restore programme exercise</button>':'')+'</div>';
  return '<article class="gym-exercise-card"><div class="gym-exercise-heading"><div><h3 class="gym-guide-heading" tabindex="0" role="button" aria-haspopup="dialog" aria-controls="gym-exercise-guide-dialog" data-guide-heading data-exercise-id="'+esc(exercise.id)+'">'+esc(exerciseDisplayName)+'</h3><p>'+esc(exercise.substitution?"Manual substitution — exercise details are not verified.":(exercise.description||""))+'</p><button class="secondary gym-guide-open" type="button" data-guide-open data-exercise-id="'+esc(exercise.id)+'">Exercise guide</button></div><div class="gym-exercise-settings"><label>Rest period<select data-gym-field="restSeconds" data-exercise-id="'+esc(exercise.id)+'">'+restOptions+'</select></label><span class="subtle">'+esc(exercise.status.replace("-"," "))+'</span></div></div>'+swapPanel+sets+'</article>';
 }).join("");
 if(gymStopwatchRenderInterval)clearInterval(gymStopwatchRenderInterval);
 if(gymRestRenderInterval)clearInterval(gymRestRenderInterval);
 gymStopwatchRenderInterval=null;
 if(workout.exerciseRecords.some(exercise=>(exercise.sets||[]).some(set=>Number.isFinite(Number(set.stopwatchStartedAt))&&Number(set.stopwatchStartedAt)>0))){
  gymStopwatchRenderInterval=setInterval(updateGymStopwatchDisplays,250);
 }
 updateGymStopwatchDisplays();
 gymRestRenderInterval=setInterval(updateGymRestDisplay,250);
}

const EXERCISE_GUIDE_RECORDS=Object.freeze({});
function cancelExerciseGuideHold(){if(exerciseGuideHoldTimer!==null){clearTimeout(exerciseGuideHoldTimer);exerciseGuideHoldTimer=null;}exerciseGuidePointer=null;}
function guideAssetManifest(){if(!exerciseGuideManifestPromise)exerciseGuideManifestPromise=fetch("./assets/guides/manifest.v1.json",{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("Guide asset manifest is unavailable.");return response.json();}).catch(error=>{exerciseGuideManifestPromise=null;throw error;});return exerciseGuideManifestPromise;}
function guideAddText(parent,tag,text,className){const node=document.createElement(tag);if(className)node.className=className;node.textContent=String(text??"");parent.appendChild(node);return node;}
function renderExerciseGuideContent(exercise,record,state,manifest){
 const content=$("gym-exercise-guide-content");content.replaceChildren();
 const status=guideAddText(content,"p",state.status==="incomplete"?"Guide being prepared":"Guide unavailable","gym-exercise-guide-status");status.setAttribute("role","status");
 if(state.status!=="complete"){
  guideAddText(content,"p",state.status==="incomplete"?"This guide is not ready for use. Required content or artwork is still being reviewed. Draft instructions are not displayed.":"There is no reviewed guide available for this programme exercise yet. Draft instructions are not displayed.","muted");
  if(exercise.substitution)guideAddText(content,"p","This is the programme exercise guide status. Your manual substitution (“"+(exercise.performedExerciseName||exercise.name)+"”) has not been verified against this guide.","gym-exercise-guide-note");
  return;
 }
 guideAddText(content,"h3",record.title);guideAddText(content,"h4","Setup");guideAddText(content,"p",record.setup);
 guideAddText(content,"h4","Movement");const steps=document.createElement("ol");record.steps.forEach(step=>guideAddText(steps,"li",step));content.appendChild(steps);
 const cues=document.createElement("section");guideAddText(cues,"h4","Coaching cues");record.cues.forEach(cue=>guideAddText(cues,"p",cue));content.appendChild(cues);
 const safety=document.createElement("section");guideAddText(safety,"h4","Safety notes");record.safetyNotes.forEach(note=>guideAddText(safety,"p",note));content.appendChild(safety);
 const assets=document.createElement("div");assets.className="gym-exercise-guide-assets";
 record.assetIds.forEach(assetId=>{const asset=manifest.assets.find(item=>item.assetId===assetId);if(!asset)return;const figure=document.createElement("figure"),img=document.createElement("img");img.src=asset.path;img.alt=record.assetAlt&&record.assetAlt[assetId]||assetId.replace(/[._-]/g," ");img.loading="lazy";img.addEventListener("error",()=>{img.hidden=true;guideAddText(figure,"p","Illustration unavailable. Guide text remains available.","gym-exercise-guide-image-fallback");},{once:true});figure.appendChild(img);guideAddText(figure,"figcaption","Illustrative reference","muted");assets.appendChild(figure);});content.appendChild(assets);
}
async function openExerciseGuide(exerciseId,trigger){
 if(!activeGymWorkout)return;
 const exercise=activeGymWorkout.exerciseRecords.find(item=>item.id===exerciseId);if(!exercise)return;
 cancelExerciseGuideHold();exerciseGuideTrigger=trigger||document.querySelector('[data-guide-heading][data-exercise-id="'+CSS.escape(exerciseId)+'"]');
 const title=$("gym-exercise-guide-title"),dialog=$("gym-exercise-guide-dialog");const sourceName=exercise.sourceExerciseLabel||exercise.name||"Exercise";title.textContent=sourceName+" guide";
 const record=EXERCISE_GUIDE_RECORDS[exercise.programmeSlotId]||null;let state=ProjectComebackExerciseGuide.resolveGuideState(record,new Set());let manifest=null;
 if(record){try{manifest=await guideAssetManifest();state=ProjectComebackExerciseGuide.resolveGuideState(record,new Set(manifest.assets.map(asset=>asset.assetId)));}catch(_){state={status:"incomplete",reason:"Guide assets could not be verified."};}}
 renderExerciseGuideContent(exercise,record,state,manifest);
 $("gym-exercise-guide-subtitle").textContent=exercise.substitution?"Programme exercise: "+sourceName+". Manual substitution: "+(exercise.performedExerciseName||exercise.name)+". This guide is not a verified guide for the substituted movement.":"Guide reference for the original programme exercise. Opening this guide does not change your workout.";
 if(!dialog.open)dialog.showModal();$("gym-exercise-guide-close").focus({preventScroll:true});
}
function closeExerciseGuide(){const dialog=$("gym-exercise-guide-dialog");if(dialog.open)dialog.close();}
function handleExerciseGuideDialogClose(){cancelExerciseGuideHold();const trigger=exerciseGuideTrigger;exerciseGuideTrigger=null;if(trigger&&trigger.isConnected)trigger.focus({preventScroll:true});}
function guideFocusTrap(event){if(event.key!=="Tab")return;const dialog=$("gym-exercise-guide-dialog"),items=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(item=>!item.hidden);if(!items.length){event.preventDefault();$("gym-exercise-guide-close").focus();return;}const first=items[0],last=items[items.length-1;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
function bindExerciseGuideInteractions(){
 const container=$("gym-workout-exercises");
 container.addEventListener("click",event=>{const button=event.target.closest("[data-guide-open]");if(button)openExerciseGuide(button.dataset.exerciseId,button);});
 container.addEventListener("keydown",event=>{const heading=event.target.closest("[data-guide-heading]");if(!heading)return;if(event.key==="Enter"||event.key===" "){event.preventDefault();openExerciseGuide(heading.dataset.exerciseId,heading);}});
 container.addEventListener("pointerdown",event=>{const heading=event.target.closest("[data-guide-heading]");if(!heading||event.button!==0)return;cancelExerciseGuideHold();exerciseGuidePointer={id:event.pointerId,x:event.clientX,y:event.clientY,heading};exerciseGuideHoldTimer=window.setTimeout(()=>{if(exerciseGuidePointer&&exerciseGuidePointer.id===event.pointerId)openExerciseGuide(heading.dataset.exerciseId,heading);},450);});
 container.addEventListener("pointermove",event=>{if(!exerciseGuidePointer||exerciseGuidePointer.id!==event.pointerId)return;if(Math.hypot(event.clientX-exerciseGuidePointer.x,event.clientY-exerciseGuidePointer.y)>10)cancelExerciseGuideHold();});
 container.addEventListener("pointerout",event=>{if(!exerciseGuidePointer||exerciseGuidePointer.id!==event.pointerId)return;const heading=event.target.closest("[data-guide-heading]");if(heading&&event.relatedTarget&&!heading.contains(event.relatedTarget))cancelExerciseGuideHold();});
 ["pointerup","pointerleave","pointercancel","lostpointercapture"].forEach(type=>container.addEventListener(type,event=>{if(exerciseGuidePointer&&(event.pointerId===undefined||exerciseGuidePointer.id===event.pointerId))cancelExerciseGuideHold();}));window.addEventListener("blur",cancelExerciseGuideHold);
 const dialog=$("gym-exercise-guide-dialog");$("gym-exercise-guide-close").addEventListener("click",closeExerciseGuide);dialog.addEventListener("close",handleExerciseGuideDialogClose);dialog.addEventListener("keydown",guideFocusTrap);dialog.addEventListener("click",event=>{if(event.target===dialog)closeExerciseGuide();});
}
async function startGymWorkout(){
 const button=$("gym-workout-start"),week=Number($("gym-workout-week").value)||1,day=Number($("gym-workout-day").value),date=$("gym-workout-date").value;
 try{
  setBusy(button,true);
  const existing=await ProjectComebackGymWorkout.findInProgress(day,date,week);
  if(!existing&&!await ProjectComebackGymProgression.isUnlocked(week,day,gymProgressionPlan)){
   await refreshGymProgressionControls();
   throw new Error("This workout is locked by the programme sequence. Complete the previous planned workout or use the manual beta unlock.");
  }
  const result=await ProjectComebackGymWorkout.startSession(day,date,{week});
  activeGymWorkout=result.workout;
  renderGymWorkout();
  $("gym-workout-status").textContent=result.resumed?"Resumed your saved Week "+week+" Day "+day+" workout.":"Week "+week+" Day "+day+" started. Your session and sets are saved.";
  await refresh();
 }catch(error){notice(error.message,true);}
 finally{setBusy(button,false,"Start / resume workout");}
}
async function handleGymWorkoutAction(event){
 const button=event.target.closest("[data-gym-action]");
 if(!button||!activeGymWorkout)return;
 const action=button.dataset.gymAction,exerciseId=button.dataset.exerciseId,setNumber=Number(button.dataset.setNumber);
 try{
  button.disabled=true;
  if(action==="start")await ProjectComebackGymWorkout.startSet(activeGymWorkout,exerciseId,setNumber);
  else if(action==="complete")await ProjectComebackGymWorkout.completeSet(activeGymWorkout,exerciseId,setNumber);
  else if(action==="undo")await ProjectComebackGymWorkout.undoSet(activeGymWorkout,exerciseId,setNumber);
  else if(action==="timer-start")await ProjectComebackGymWorkout.startStopwatch(activeGymWorkout,exerciseId,setNumber);
  else if(action==="timer-stop")await ProjectComebackGymWorkout.stopStopwatch(activeGymWorkout,exerciseId,setNumber);
  else if(action==="timer-reset")await ProjectComebackGymWorkout.resetStopwatch(activeGymWorkout,exerciseId,setNumber);
  else if(action==="rest-add")await ProjectComebackGymWorkout.adjustRest(activeGymWorkout,15);
  else if(action==="rest-skip")await ProjectComebackGymWorkout.skipRest(activeGymWorkout);
  else if(action==="rest-cancel")await ProjectComebackGymWorkout.cancelRest(activeGymWorkout);
  else if(action==="swap-save"){
   const card=button.closest(".gym-exercise-card");
   const name=card.querySelector("[data-gym-swap-name]").value;
   const equipment=card.querySelector("[data-gym-swap-equipment]").value;
   await ProjectComebackGymWorkout.setExerciseSubstitution(activeGymWorkout,exerciseId,name,equipment);
  }
  else if(action==="swap-restore"){
   const exercise=activeGymWorkout.exerciseRecords.find(item=>item.id===exerciseId);
   await ProjectComebackGymWorkout.setExerciseSubstitution(activeGymWorkout,exerciseId,exercise.sourceExerciseLabel,"unknown");
  }
  renderGymWorkout();
 }catch(error){notice(error.message,true);renderGymWorkout();}
}
async function handleGymWorkoutField(event){
 const input=event.target.closest("[data-gym-field]");
 if(!input||!activeGymWorkout)return;
 try{
  input.disabled=true;
  if(input.dataset.gymField==="restSeconds")await ProjectComebackGymWorkout.setExerciseRest(activeGymWorkout,input.dataset.exerciseId,Number(input.value));
  else await ProjectComebackGymWorkout.updateSetValues(activeGymWorkout,input.dataset.exerciseId,Number(input.dataset.setNumber),{[input.dataset.gymField]:input.value});
  $("gym-workout-status").textContent="Saved locally.";
 }catch(error){notice(error.message,true);}
 finally{input.disabled=false;}
}
function closeGymCelebration(){
 const dialog=$("gym-celebration-dialog");
 if(gymCelebrationTimer!==null){clearTimeout(gymCelebrationTimer);gymCelebrationTimer=null;}
 if(dialog.open)dialog.close();
}
async function showGymCelebration(session){
 const dialog=$("gym-celebration-dialog"),image=$("gym-celebration-image");
 let gender="male";
 try{
  const profile=await ProjectComebackDB.get("profile","gym-profile");
  if(String(profile&&profile.value&&profile.value.gender||"").toLowerCase()==="female")gender="female";
 }catch(error){
  // Match the legacy default when no usable saved hero preference is available.
 }
 const day=Number(session.day)||1;
 const asset=gender==="female"?"female-celebration.gif":(day===1?"celebration-day1.gif":"celebration-day2.gif");
 image.src="./assets/celebrations/v1/"+asset;
 image.alt=gender==="female"
  ?"Female Gym Comeback hero celebrating a saved workout."
  :"Gym Comeback hero celebrating a saved workout.";
 image.hidden=false;
 $("gym-celebration-session").textContent="Day "+day+" workout saved to your Gym history.";
 if(gymCelebrationTimer!==null)clearTimeout(gymCelebrationTimer);
 dialog.showModal();
 gymCelebrationTimer=window.setTimeout(()=>{
  gymCelebrationTimer=null;
  if(dialog.open)dialog.close();
 },6000);
}
async function finishGymWorkout(){
 const button=$("gym-workout-finish");
 if(!activeGymWorkout)return;
 try{
  setBusy(button,true);
  // The engine resolves only after the completed session has been committed to IndexedDB.
  const completedSession=await ProjectComebackGymWorkout.finishSession(activeGymWorkout);
  activeGymWorkout=null;
  $("gym-workout-active").hidden=true;
  $("gym-workout-status").textContent="Workout completed and saved.";
  try{await refresh();}
  catch(error){notice("Workout saved. Some history panels could not refresh: "+error.message,true);}
  try{await showGymCelebration(completedSession);}
  catch(error){notice("Workout saved. The celebration could not be displayed: "+error.message,true);}
 }catch(error){notice(error.message,true);}
 finally{setBusy(button,false,"Finish workout");}
}

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
 const [gym,hikes,schedule,modules,gymExercises,gymSets]=await Promise.all([db.getAllByIndex("sessions","by_module","gym"),db.getAllByIndex("hikingRecords","by_module","hiking"),db.getAll("schedules"),ProjectComebackModules.list(),db.getAllByIndex("exerciseRecords","by_module","gym"),db.getAllByIndex("setRecords","by_module","gym")]);
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
 renderGymHistory(gym,gymExercises,gymSets);
 $("hiking-records").innerHTML=hikes.length?hikes.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>item(x.title,x.date,(x.distanceKm!==undefined?x.distanceKm+" km":"Distance not recorded"))).join(""):'<div class="empty-state">No hikes recorded yet.</div>';
 renderHikingJourney(hikes);
 renderGymJourney(gym,gymExercises,gymSets);
 $("schedule-records").innerHTML=schedule.length?schedule.sort((a,b)=>a.date.localeCompare(b.date)).map(x=>item(x.title,x.date,(x.moduleId==="gym"?"Gym":"Hiking")+" · "+x.status)).join(""):'<div class="empty-state">Nothing scheduled yet.</div>';
 await refreshTrainingOverview();
 await refreshScheduleOutlook();
}



function renderGymHistory(sessions,exercises,sets){
 const target=$("gym-records");
 if(!sessions.length){target.innerHTML='<div class="empty-state">No Gym sessions recorded yet. Start your first workout to build history.</div>';return;}
 const rows=sessions.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||Number(b.week||1)-Number(a.week||1)||Number(b.day||0)-Number(a.day||0)).map(session=>{
  const week=Number(session.week)||1,day=Number(session.day)||0,date=session.date?formatDate(session.date):"Date not recorded";
  const sessionExercises=exercises.filter(item=>item.sessionId===session.id).sort((a,b)=>Number(a.position)-Number(b.position));
  const sessionSets=sets.filter(item=>item.sessionId===session.id);
  const completed=sessionSets.filter(item=>item.status==="completed").length;
  const status=session.status==="completed"?"Completed":"In progress";
  const detail=sessionExercises.map(exercise=>{
   const exSets=sessionSets.filter(item=>item.exerciseRecordId===exercise.id).sort((a,b)=>Number(a.setNumber)-Number(b.setNumber));
   const setDetail=exSets.map(set=>{
    const parts=[];
    if(String(set.weight??"").trim()!=="")parts.push(set.weight+" kg");
    if(String(set.reps??"").trim()!=="")parts.push(set.reps+" reps");
    if(String(set.duration??"").trim()!=="")parts.push(set.duration+" sec");
    return "Set "+set.setNumber+(parts.length?": "+parts.join(" · "):": no values recorded");
   }).join("; ");
   return "<li><strong>"+esc(exercise.performedExerciseName||exercise.name||"Exercise")+"</strong><small>"+esc(setDetail||"No sets recorded")+"</small></li>";
  }).join("");
  const resume=session.status==="in-progress"?'<button class="secondary" type="button" data-history-resume data-week="'+week+'" data-day="'+day+'" data-date="'+esc(session.date||today)+'">Resume this workout</button>':"";
  const progress=session.status==="completed"?(Number(session.durationMinutes)>=0?session.durationMinutes+" min recorded":"Duration not recorded"):(completed+" of "+sessionSets.length+" sets completed");
  return '<article class="gym-history-entry"><div class="gym-history-heading"><div><strong>Week '+week+' · Day '+day+' — '+esc(session.title||"Gym workout")+'</strong><small>'+esc(date)+'</small></div><span class="gym-history-status '+(session.status==="completed"?"completed":"progress")+'">'+status+'</span></div><p class="gym-history-summary">'+esc(progress)+" · "+sessionExercises.length+" exercises</p>"+resume+'<details><summary>Workout details</summary><ol class="gym-history-exercises">'+detail+'</ol></details></article>';
 }).join("");
 target.innerHTML=rows;
}

function renderGymJourney(sessions,exercises,sets){
 const target=$("gym-journey");
 const completed=sessions.filter(record=>record.status==="completed");
 const summary=ProjectComebackGymProgression.summariseExerciseHistory(sessions,exercises,sets);
 const completedIds=new Set(completed.map(record=>record.id));
 const exerciseRows=exercises.filter(record=>completedIds.has(record.sessionId));
 const setRows=sets.filter(record=>completedIds.has(record.sessionId));
 const numericRepSets=setRows.filter(record=>typeof record.reps==="string"&&/^\d+$/.test(record.reps.trim())&&Number(record.reps)>0);
 const totalReps=numericRepSets.reduce((sum,record)=>sum+Number(record.reps),0);
 const metric=(label,value,detail)=>'<div class="gym-journey-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>';
 if(!completed.length){target.innerHTML='<p class="empty-state">Your completed Gym sessions will appear here as you save training. Only completed sessions and their linked set records are included.</p>';return;}
 const history=summary.groups.map(group=>{
  const sourceEntries=group.sourceEntries.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const rows=sourceEntries.map(entry=>{
   const date=entry.date?new Date(entry.date+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):"Date not recorded";
   const setText=entry.sets.length?entry.sets.map(set=>{
    const fields=[];
    fields.push(String(set.weight??"").trim()!==""?"Weight entry "+String(set.weight)+" kg":"Weight not recorded");
    fields.push(String(set.reps??"").trim()!==""?String(set.reps)+" reps":"Reps not recorded");
    if(String(set.duration??"").trim()!=="")fields.push(String(set.duration)+" sec");
    return '<li>'+esc("Set "+String(set.setNumber)+": "+fields.join(" · "))+'</li>';
   }).join(""):'<li>No set details recorded</li>';
   return '<li><strong>'+esc(date)+'</strong><ul>'+setText+'</ul></li>';
  }).join("");
  const substitutions=group.substitutions.map(entry=>{
   const date=entry.date?new Date(entry.date+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):"Date not recorded";
   const details=entry.sets.map(set=>{
    const fields=[];
    if(String(set.weight??"").trim()!=="")fields.push(String(set.weight)+" kg");
    if(String(set.reps??"").trim()!=="")fields.push(String(set.reps)+" reps");
    if(String(set.duration??"").trim()!=="")fields.push(String(set.duration)+" sec");
    return "Set "+String(set.setNumber)+(fields.length?": "+fields.join(" · "):": no values recorded");
   }).join("; ");
   return '<li><strong>'+esc(date)+' — performed: '+esc(entry.performedExerciseName)+'</strong><small>'+esc(details||"No set values recorded")+'</small></li>';
  }).join("");
  const trend=group.sourceEntries.length?'<p class="gym-load-trend">'+esc(group.loadTrend)+'</p>':'<p class="gym-load-trend">No original-exercise progression data: all recorded entries for this source exercise were manual substitutions.</p>';
  return '<section class="gym-exercise-history"><h4>'+esc(group.sourceLabel)+'</h4><p>'+group.sourceSessionCount+' original-exercise session'+(group.sourceSessionCount===1?"":"s")+' · '+group.sourceSetCount+' sets · '+group.recordedReps+' recorded reps'+(group.recordedDurationSetCount?' · '+group.durationSeconds+' sec recorded duration':'')+'</p>'+trend+(rows?'<ol>'+rows+'</ol>':'<p>No original exercise entries recorded.</p>')+(substitutions?'<div class="gym-substitution-history"><strong>Manual substitutions — excluded from this exercise trend</strong><ul>'+substitutions+'</ul></div>':'')+'</section>';
 }).join("");
 target.innerHTML='<div class="gym-journey-grid">'+[
  metric("Completed sessions",String(summary.completedSessionCount),"Saved completed Gym sessions"),
  metric("Exercises recorded",String(summary.exerciseRecordCount),"Exercises linked to completed sessions"),
  metric("Sets recorded",String(summary.setRecordCount),"Sets linked to completed sessions"),
  metric("Recorded repetitions",String(totalReps),numericRepSets.length+" of "+setRows.length+" sets include a numeric repetition count")
 ].join("")+'</div><p class="journey-data-note">Manual substitutions are displayed with the performed exercise and recorded values, but are excluded from the original programme exercise progression trend. Trends are descriptive recorded loads, not proof of improvement. Repetitions include only positive whole-number counts; no unit or improvement is inferred.</p><div class="gym-exercise-history-list"><h4>Recorded exercise history</h4>'+(history||'<p class="empty-state">No completed exercise records yet.</p>')+'</div>';
}
function renderHikingJourney(records){
 const target=$("hiking-journey");
 const hikes=records.filter(record=>record.status==="completed");
 const measured=key=>hikes.filter(record=>record[key]!==""&&record[key]!==null&&record[key]!==undefined&&Number.isFinite(Number(record[key])));
 const distance=measured("distanceKm"),elevation=measured("elevationGainM"),duration=measured("durationMinutes");
 const totalDistance=distance.reduce((sum,record)=>sum+Number(record.distanceKm),0);
 const totalElevation=elevation.reduce((sum,record)=>sum+Number(record.elevationGainM),0);
 const longest=distance.reduce((best,record)=>!best||Number(record.distanceKm)>Number(best.distanceKm)?record:best,null);
 const longestDuration=duration.reduce((best,record)=>!best||Number(record.durationMinutes)>Number(best.durationMinutes)?record:best,null);
 const dateLabel=record=>record.date?new Date(record.date+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"}):"Date not recorded";
 const metric=(label,value,detail)=>'<div class="hiking-journey-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></div>';
 if(!hikes.length){target.innerHTML='<p class="empty-state">Your completed hikes will appear here as you record them. Only saved hiking details are included.</p>';return;}
 const stats=[
  metric("Completed hikes",String(hikes.length),"Saved completed hiking records"),
  metric("Recorded distance",distance.length?totalDistance.toFixed(2)+" km":"Not recorded",distance.length+" of "+hikes.length+" hikes include distance"),
  metric("Elevation gained",elevation.length?totalElevation.toFixed(0)+" m":"Not recorded",elevation.length+" of "+hikes.length+" hikes include elevation gain"),
  metric("Longest walk",longest?Number(longest.distanceKm).toFixed(2)+" km":"Not recorded",longest?String(longest.title||"Untitled hike")+" · "+dateLabel(longest):"No recorded distance"),
  metric("Longest recorded duration",longestDuration?Number(longestDuration.durationMinutes)+" min":"Not recorded",longestDuration?String(longestDuration.title||"Untitled hike")+" · "+dateLabel(longestDuration):"No recorded duration")
 ].join("");
 target.innerHTML='<div class="hiking-journey-grid">'+stats+'</div><p class="journey-data-note">Distance, elevation and duration totals use only hikes where that measurement was saved. No missing values are estimated.</p>';
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
function renderAssessmentJourney(history){
 const target=$("assessment-journey");
 const baseline=history.find(item=>item.id===ProjectComebackAssessments.baselineId);
 if(!baseline){
  target.innerHTML='<p class="empty-state">Complete your original baseline assessment to start your progress journey. Open Assessments to record it.</p>';
  return;
 }
 const rows=history.map(record=>{
  const isBaseline=record.id===baseline.id;
  const comparison=isBaseline?null:ProjectComebackAssessments.compare(baseline,record);
  const measures=Object.entries(ProjectComebackAssessments.metrics).map(([key,definition])=>{
   const hasValue=Object.prototype.hasOwnProperty.call(record.measures||{},key);
   const value=hasValue?String(record.measures[key])+" "+definition.unit:"Not recorded";
   let change=isBaseline?"Original starting measure":"Not comparable to baseline";
   if(comparison&&comparison.measures[key].difference!==null){
    const difference=comparison.measures[key].difference;
    change="Change from baseline: "+(difference>0?"+":"")+String(Number(difference.toFixed(2)))+" "+definition.unit;
   }
   return '<div class="journey-measure"><span>'+esc(definition.label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(change)+'</small></div>';
  }).join("");
  const dateLabel=new Date(record.date+"T12:00:00").toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
  return '<article class="journey-milestone"><span class="journey-marker" aria-hidden="true"></span><div class="journey-card"><div class="journey-card-heading"><div><span class="journey-kind">'+(isBaseline?"ORIGINAL BASELINE":"FOLLOW-UP ASSESSMENT")+'</span><h3>'+esc(dateLabel)+'</h3></div><span class="journey-measure-count">'+Object.keys(record.measures||{}).length+' of 3 measures recorded</span></div><div class="journey-measures">'+measures+'</div></div></article>';
 }).join("");
 target.innerHTML=rows+(history.length===1?'<p class="journey-next-step">Your starting point is saved. Add a follow-up assessment when you are ready to capture a change.</p>':"");
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
 renderAssessmentJourney(history);
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

async function refreshIdentityUpgradePanel(){
 const version=await ProjectComebackDB.getVersion();
 const status=$("identity-upgrade-status"),backupButton=$("identity-upgrade-backup");
 const confirmWrap=$("identity-upgrade-confirm-wrap"),confirm=$("identity-upgrade-confirm"),run=$("identity-upgrade-run");
 if(version<6){
  status.textContent="Current database schema v"+version+". Download and save a verified V1 safety backup before enabling the additive identity schema upgrade.";
  backupButton.hidden=false;confirmWrap.hidden=false;run.hidden=false;run.textContent="Upgrade identity foundation";
  confirm.disabled=!identitySafetyBackup;run.disabled=!(identitySafetyBackup&&confirm.checked);
  return;
 }
 backupButton.hidden=true;confirmWrap.hidden=true;
 const snapshot=await ProjectComebackDB.get("metadata","identity-upgrade-v6-safety-snapshot");
 if(snapshot&&snapshot.verificationStatus!=="complete"){
  status.textContent="Schema v6 is in place. The pre-upgrade safety snapshot is retained. The V2 backup/restore round-trip verification is still pending.";
  run.hidden=false;run.disabled=false;run.textContent="Complete backup & restore verification";
 }else{
  status.textContent=snapshot
   ?"Schema v6 enabled. The pre-upgrade safety snapshot is retained and the V2 backup/restore round trip is verified."
   :"Schema v6 enabled. This database did not require a v5 migration.";
  run.hidden=true;
 }
}
async function inspectMigration(){
 const info=await ProjectComebackMigration.inspect();
 $("migration-status").textContent=info.legacyKeyCount+" legacy Gym data keys found. Migration status: "+info.status+". Original browser storage will not be deleted.";
}
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.view)));
$("gym-workout-start").addEventListener("click",startGymWorkout);
$("gym-workout-active").addEventListener("click",handleGymWorkoutAction);
$("gym-rest-alert-mode").addEventListener("change",event=>{localStorage.setItem("gym-comeback-rest-alert",event.target.value);notice("Rest alert preference saved on this device.");});
$("gym-workout-exercises").addEventListener("change",handleGymWorkoutField);\nbindExerciseGuideInteractions();
$("gym-workout-finish").addEventListener("click",finishGymWorkout);
$("gym-celebration-skip").addEventListener("click",closeGymCelebration);
$("gym-celebration-dismiss").addEventListener("click",closeGymCelebration);
$("gym-celebration-dialog").addEventListener("close",()=>{
 if(gymCelebrationTimer!==null){clearTimeout(gymCelebrationTimer);gymCelebrationTimer=null;}
 const returnFocus=$("gym-workout-start");
 if(returnFocus)returnFocus.focus({preventScroll:true});
});
$("gym-workout-week").addEventListener("change",()=>refreshGymWorkout().catch(error=>notice(error.message,true)));
$("gym-workout-day").addEventListener("change",()=>refreshGymWorkout().catch(error=>notice(error.message,true)));
$("gym-workout-date").addEventListener("change",()=>refreshGymWorkout().catch(error=>notice(error.message,true)));
$("gym-programme-weeks").addEventListener("change",async event=>{try{await ProjectComebackGymProgression.savePlan({weeks:Number(event.target.value),daysPerWeek:Number($("gym-days-per-week").value)});await refreshGymProgressionControls();await refreshGymWorkout();notice("Programme length saved. Existing workout history remains unchanged.");}catch(error){notice(error.message,true);}});
$("gym-days-per-week").addEventListener("change",async event=>{try{await ProjectComebackGymProgression.savePlan({weeks:Number($("gym-programme-weeks").value),daysPerWeek:Number(event.target.value)});await refreshGymProgressionControls();await refreshGymWorkout();notice("Planned training frequency saved. Days beyond this frequency are unavailable.");}catch(error){notice(error.message,true);}});
$("gym-records").addEventListener("click",event=>{const button=event.target.closest("[data-history-resume]");if(!button)return;$("gym-workout-week").value=button.dataset.week;$("gym-workout-day").value=button.dataset.day;$("gym-workout-date").value=button.dataset.date;showView("gym");startGymWorkout().catch(error=>notice(error.message,true));});
 $("module-cards").addEventListener("click",async event=>{const button=event.target.closest("[data-module-id]");if(!button)return;const id=button.dataset.moduleId;try{button.disabled=true;const current=await ProjectComebackModules.get(id);await ProjectComebackModules.setEnabled(id,!current.enabled);await refresh();notice(current.enabled?"Module paused. Existing records have been kept.":"Module enabled. You can add and schedule activities again.");}catch(error){notice(error.message,true);}finally{button.disabled=false;}});
$("today-date").textContent=new Date().toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});
$("hiking-form").elements.date.value=today;$("schedule-form").elements.date.value=today;$("gym-workout-date").value=today;
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
$("identity-upgrade-backup").addEventListener("click",async event=>{
 const b=event.currentTarget;
 try{
  setBusy(b,true);
  identitySafetyBackup=await ProjectComebackBackup.createLegacySafetyBackup();
  const validation=ProjectComebackBackup.validateBackup(identitySafetyBackup);
  if(!validation.valid||validation.formatVersion!==1)throw new Error("The pre-upgrade V1 safety backup did not pass validation.");
  await ProjectComebackBackup.downloadEnvelope(identitySafetyBackup,"ProjectComeback-Pre-Identity-Upgrade-v1.json");
  $("identity-upgrade-confirm").disabled=false;
  $("identity-upgrade-status").textContent="V1 safety backup validated and download requested. Save the file, then confirm below before upgrading.";
  $("identity-upgrade-run").disabled=!$("identity-upgrade-confirm").checked;
  notice("Verified V1 safety backup downloaded. Keep it safe before continuing.");
 }catch(error){notice(error.message,true);}
 finally{setBusy(b,false,"Download verified V1 safety backup");}
});
$("identity-upgrade-confirm").addEventListener("change",event=>{
 $("identity-upgrade-run").disabled=!(event.target.checked&&identitySafetyBackup);
});
$("identity-upgrade-run").addEventListener("click",async event=>{
 const b=event.currentTarget;
 try{
  setBusy(b,true);
  if(await ProjectComebackDB.getVersion()<6){
   if(!identitySafetyBackup||!$("identity-upgrade-confirm").checked)throw new Error("Download the verified V1 safety backup and confirm that it has been saved first.");
   const upgraded=await ProjectComebackDB.upgradeToV6(identitySafetyBackup);
   if(upgraded.status!=="upgraded"&&upgraded.status!=="already-upgraded")throw new Error("The identity schema upgrade did not complete.");
  }
  const verification=await ProjectComebackBackup.verifyIdentityUpgradeRoundTrip();
  if(!["verified","already-verified","not-required"].includes(verification.status))throw new Error("Post-upgrade backup/restore verification is incomplete.");
  await refreshIdentityUpgradePanel();
  notice(verification.status==="not-required"?"Identity foundation is ready.":"Identity foundation upgraded and the V2 backup/restore round trip is verified.");
 }catch(error){
  $("identity-upgrade-status").textContent="Upgrade/verification needs attention: "+error.message+" Keep your downloaded safety backup.";
  notice(error.message,true);
  try{await refreshIdentityUpgradePanel();}catch(ignored){}
 }finally{setBusy(b,false,"Upgrade identity foundation");}
});

$("legacy-snapshot").addEventListener("click",async event=>{const b=event.currentTarget;try{setBusy(b,true);await ProjectComebackMigration.downloadSafetySnapshot();safetySnapshotSaved=true;$("migration-confirm").disabled=false;notice("Legacy safety snapshot download requested. Save that file before confirming migration.");}catch(error){notice(error.message,true);}finally{setBusy(b,false,"Download legacy safety snapshot");}});
$("migration-confirm").addEventListener("change",event=>{$("migration-run").disabled=!(event.target.checked&&safetySnapshotSaved);});
$("migration-run").addEventListener("click",async event=>{
 const b=event.currentTarget;if(!safetySnapshotSaved||!$("migration-confirm").checked)return;
 try{setBusy(b,true);const result=await ProjectComebackMigration.migrateAndVerify();const verified=await ProjectComebackMigration.inspect();if(verified.status!=="complete")throw new Error("Migration returned without a verified completion marker.");$("migration-result").hidden=false;$("migration-result").textContent="Migration status: "+result.status+"\nSource keys: "+result.sourceKeyCount+"\nWarnings: "+result.warnings.length+"\n"+result.warnings.map(w=>w.key+": "+w.reason).join("\n");await refresh();await inspectMigration();notice("Migration completed and the typed completion marker is verified.");}catch(error){$("migration-result").hidden=false;$("migration-result").textContent="Migration did not complete: "+error.message;notice(error.message,true);}finally{setBusy(b,false,"Run migration");}
});
$("restore-file").addEventListener("change",async event=>{
 restorePayload=null;$("restore-confirm").checked=false;$("restore-apply").disabled=true;$("restore-confirm-wrap").hidden=true;
 const file=event.target.files&&event.target.files[0];if(!file)return;
  try{const text=await file.text();const preview=await ProjectComebackBackup.previewRestore(text);restorePayload=text;$("restore-preview").hidden=false;$("restore-preview").textContent="Valid backup · "+preview.totalIncomingRecords+" incoming records\nExported: "+(preview.exportedAt||"unknown")+"\n\nRESTORE ACTIONS BY STORE\n"+Object.entries(preview.stores).map(([name,v])=>name+" ["+v.behavior+"]\n  "+v.action+"\n  "+v.description+"\n  Current: "+v.current+" · Incoming: "+v.incoming+" · Added: "+v.added+" · Changed: "+v.changed+" · Unchanged: "+v.unchanged+" · Removed: "+v.removed+" · Conflicts: "+v.conflicts+" · Idempotent skips: "+v.idempotencySkipped+" · Projected: "+v.projected).join("\n\n")+(preview.preservedStores.length?"\n\nPRESERVED — UNTOUCHED\n"+preview.preservedStoreDetails.map(v=>v.name+": "+v.current+" current records; incoming backup does not contain this store").join("\n"):"")+"\n\nCROSS-STORE INTEGRITY DIAGNOSTICS\n"+(preview.integrityDiagnostics?["Incoming backup: "+preview.integrityDiagnostics.incoming.status.toUpperCase()+" ("+preview.integrityDiagnostics.incoming.summary.errors+" errors, "+preview.integrityDiagnostics.incoming.summary.warnings+" warnings)", "Current database: "+preview.integrityDiagnostics.live.status.toUpperCase()+" ("+preview.integrityDiagnostics.live.summary.errors+" errors, "+preview.integrityDiagnostics.live.summary.warnings+" warnings)", ...preview.integrityDiagnostics.incoming.findings.map(f=>"[INCOMING "+f.severity.toUpperCase()+"] "+f.code+" — "+f.store+" / "+f.recordId+": "+f.message), ...preview.integrityDiagnostics.live.findings.map(f=>"[CURRENT "+f.severity.toUpperCase()+"] "+f.code+" — "+f.store+" / "+f.recordId+": "+f.message)].join("\n"):"Diagnostics unavailable") +"\n\nRestore safety snapshot retention: "+preview.restoreSafetySnapshotRetention+" newest snapshots.\n"+preview.warning;$("restore-confirm-wrap").hidden=false;notice("Backup validated. Review the restore preview carefully.");}catch(error){$("restore-preview").hidden=false;$("restore-preview").textContent=error.message;notice(error.message,true);}
});
$("restore-confirm").addEventListener("change",event=>{$("restore-apply").disabled=!(event.target.checked&&restorePayload);});
$("restore-apply").addEventListener("click",async event=>{
 if(!restorePayload||!$("restore-confirm").checked)return;const b=event.currentTarget;
 try{setBusy(b,true);const result=await ProjectComebackBackup.restoreBackup(restorePayload,{confirmed:true});restorePayload=null;$("restore-preview").hidden=true;$("restore-confirm-wrap").hidden=true;$("restore-file").value="";$("restore-confirm").checked=false;await refresh();await refreshAssessments();notice("Restore completed. A pre-restore safety snapshot was saved in the database.");}catch(error){notice(error.message,true);}finally{setBusy(b,false,"Confirm restore");b.disabled=true;}
});
async function start(){
 try{const initialConnection=await ProjectComebackDB.open();initialConnection.close();await refreshIdentityUpgradePanel();const result=await ProjectComebackModules.initialise();await refreshGymProgressionControls();await refresh();await refreshAssessments();await inspectMigration();$("connection-state").textContent="Local database ready";$("connection-state").classList.add("online");if(result.created.length)notice("V21.2 local data space initialised. Your existing V21.1 data has not been changed.");}
 catch(error){$("connection-state").textContent="Storage unavailable";notice("Could not initialise local storage: "+error.message,true);}
}
start();
})();