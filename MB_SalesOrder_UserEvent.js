/***
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([
    'N/https',        
    'N/record',        
    'N/runtime',
    'N/search',
    'N/url'      
    ],
/**
* @param {error} error
* @param {record} record
*/
function(https, record ,runtime, search, url) {

/**
 * Function definition to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {string} scriptContext.type - Trigger type
 * @param {Form} scriptContext.form - Current form
 * @Since 2015.2
 */
function beforeLoad(scriptContext) {
  try{
    var transactionRcd = scriptContext.newRecord; 
    log.debug("scriptContext.type"  ,scriptContext.type ); 
    if(scriptContext.type !== scriptContext.UserEventType.COPY) return;   
    var subList = "item";
    var lineCount = transactionRcd.getLineCount(subList);
    log.debug("linecount",lineCount);

    for (var j = 0; j < lineCount; j++){
        log.debug("j",j);            
        var accrualLink  = transactionRcd.getSublistValue({sublistId: subList, fieldId: 'custcol_mb_ct_link',line: j});
        if(accrualLink) transactionRcd.setSublistValue({sublistId: subList, fieldId: 'custcol_mb_ct_link',line: j,value: null});        
    }}catch(err){
    log.error('error in beforeLoad',err);
    }
}

/**
 * Function definition to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {Record} scriptContext.oldRecord - Old record
 * @param {string} scriptContext.type - Trigger type
 * @Since 2015.2
 */
function beforeSubmit(scriptContext) {
    log.debug("scriptContext.type"  ,scriptContext.type ); 
}

/**
 * Function definition to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {Record} scriptContext.oldRecord - Old record
 * @param {string} scriptContext.type - Trigger type
 * @Since 2015.2
 */
function afterSubmit(scriptContext) {

}		

return {
    beforeLoad: beforeLoad//,
//    beforeSubmit: beforeSubmit,
//    afterSubmit: afterSubmit
};

});

