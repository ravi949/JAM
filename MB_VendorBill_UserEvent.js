/***
 * @NApiVersion 2.X
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
 define(['N/record','N/runtime','N/search','./lib/MBHelpers.js','./lib/MBCustomTranLineVB.js'],
    function(record ,runtime, search, mbhelp, mbcustomTran)  {

/**
 * Defines the function to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {string} scriptContext.type - Trigger type
 * @param {Form} scriptContext.form - Current form
 * @Since 2015.2
 */
function beforeLoad(scriptContext){
}

/**
 * Defines the function to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {Record} scriptContext.oldRecord - Old record
 * @param {string} scriptContext.type - Trigger type
 * @Since 2015.2
 */
function beforeSubmit(scriptContext) {
    var retVal = "";
    log.debug("context type,executionContext",scriptContext.type+", "+runtime.executionContext);
    // if(scriptContext.type === scriptContext.UserEventType.CREATE || scriptContext.type === scriptContext.UserEventType.EDIT){		
    //     retVal = mbcustomTran.buildCustomTran(scriptContext);
    //     log.debug({
    //         title: "buildCT",
    //         details: retVal
    //     })
    //     if(isNaN(retVal)) throw retVal;		
    // }    
}
/**
 * Defines the function to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {Record} scriptContext.oldRecord - Old record
 * @param {string} scriptContext.type - Trigger type
 * @Since 2015.2
 */
function afterSubmit(scriptContext){
    
    log.debug("context type,executionContext",scriptContext.type+", "+runtime.executionContext);
            
    try {
         
        log.debug("context type,executionContext",scriptContext.type+", "+runtime.executionContext);
        log.debug("run script",JSON.stringify(runtime.getCurrentScript()));
        var oResp;    
        if(scriptContext.type === scriptContext.UserEventType.CREATE || 
                scriptContext.type === scriptContext.UserEventType.EDIT ||
                scriptContext.type === scriptContext.UserEventType.XEDIT){    
                oResp = mbcustomTran.buildCustomTran(scriptContext);
                log.debug("oResp ",JSON.stringify(oResp)); 
                if(!oResp.success && !mbhelp.isEmpty(oResp.message)) throw oResp.message; 
        }
    
        if(scriptContext.type === scriptContext.UserEventType.DELETE){	
            oResp = mbcustomTran.deleteCustomTran(scriptContext);
            log.debug("oResp ",JSON.stringify(oResp)); 
            if(!oResp.success) throw oResp.message; 	
        }
            
        } catch (err) {
            log.error({title: "Create VB UE",details: err.message})
            if(scriptContext.type === scriptContext.UserEventType.DELETE)
                throw err; 
        }
    
    }

return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
};

});
