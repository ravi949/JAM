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
    'N/url',        
    './lib/MBErrorHandler.js',    
    './lib/MBFormatFunctions.js',
    './lib/MBHelpers.js'
    ],
/**
* @param {error} error
* @param {record} record
*/
function(https, record ,runtime, search, url, mberror, mbformat,mbhelp, mbcustomTran) {

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
    try{
        if(scriptContext.type === scriptContext.UserEventType.CREATE || scriptContext.type === scriptContext.UserEventType.EDIT){
            log.debug("Execution Context",runtime.executionContext); 
            if (runtime.executionContext === runtime.ContextType.SUITELET) return; 
            var target = scriptContext.newRecord.getValue({fieldId: "createdfrom"}); 
            var murl = url.resolveScript({
                    scriptId: 'customscript_mb_suitelet_updatedsd',
                    deploymentId: 'customdeploy_mb_suitelet_updatedsd',
                    returnExternalUrl: true,
                    params: { custparam_mb_salesorder : target}
                });
            log.debug("created url ",murl); 
            var response = https.request({
                url:murl,
                method: https.Method.GET
            });
            if(response){
                oResp = JSON.parse(response.body); 
                if(!oResp.success) log.error("update error",oResp.response);
            }

        // var retVal = "";
        // if(scriptContext.type === scriptContext.UserEventType.CREATE || 
        //     scriptContext.type === scriptContext.UserEventType.EDIT) {
        //     // retVal = mbcustomTran.buildCustomTran(scriptContext);
        //     // log.debug({
        //     //     title: "buildCT",
        //     //     details: retVal
        //     // })
        //     // if(isNaN(retVal)) throw retVal;		
        // }
        }
    }catch(err){
        log.error("after submit error",JSON.stringify(err)); 
    }    
}		
return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
};

});

