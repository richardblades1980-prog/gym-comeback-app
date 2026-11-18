(function(global){
"use strict";
function resolveGuideState(record,availableAssetIds){
 if(!record)return {status:"unavailable",reason:"No guide record is assigned to this exercise slot."};
 if(record.status!=="complete"||record.reviewed!==true)return {status:"incomplete",reason:"This guide has not completed content review."};
 if(typeof record.title!=="string"||!record.title.trim()||typeof record.setup!=="string"||!record.setup.trim()||
    !Array.isArray(record.steps)||record.steps.length<1||record.steps.some(step=>typeof step!=="string"||!step.trim())||
    !Array.isArray(record.cues)||record.cues.length<1||record.cues.some(cue=>typeof cue!=="string"||!cue.trim())||
    !Array.isArray(record.safetyNotes)||record.safetyNotes.length<1||record.safetyNotes.some(note=>typeof note!=="string"||!note.trim())||
    !Array.isArray(record.assetIds)||record.assetIds.length<1||record.assetIds.some(id=>typeof id!=="string"||!id.trim()))
  return {status:"incomplete",reason:"Required reviewed guide content or local artwork references are missing."};
 if(!availableAssetIds||typeof availableAssetIds.has!=="function"||record.assetIds.some(id=>!availableAssetIds.has(id)))
  return {status:"incomplete",reason:"One or more required local guide assets are unavailable."};
 return {status:"complete",reason:"Guide content and referenced local assets are verified."};
}
global.ProjectComebackExerciseGuide=Object.freeze({resolveGuideState});
})(typeof window!=="undefined"?window:globalThis);
