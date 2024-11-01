/***
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
 define([
    'N/record',        
    'N/runtime',
    'N/search',
    './lib/MBFormatFunctions.js',
    './lib/MBCustomTranLine.js',
    '/SuiteBundles/Bundle 265097/com.taxjar.salestax/tj_leg_calculations_public'
    ],

function(record ,runtime, search, mbformat, mbcustomTran,taxjar) {

/**
 * Function definition to be triggered before record is loaded.
 *
 * @param {Object} scriptContext
 * @param {Record} scriptContext.newRecord - New record
 * @param {string} scriptContext.type - Trigger type
 * @param {Form} scriptContext.form - Current form
 * @Since 2015.2
 */
const  beforeLoad = (scriptContext) => {
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

const  beforeSubmit = (scriptContext) => {    
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
const  afterSubmit = (scriptContext) => {    
    
    log.debug("context type,executionContext",scriptContext.type+", "+runtime.executionContext);
    log.debug("run script",JSON.stringify(runtime.getCurrentScript()));
    // var retVal = ""; 	
    var retVal = 0;
    if(scriptContext.type === scriptContext.UserEventType.CREATE || 
        scriptContext.type === scriptContext.UserEventType.EDIT ||
        scriptContext.type === scriptContext.UserEventType.XEDIT){    
        retVal = updateCTs(scriptContext);
        log.debug({title: "updateCTs",details: retVal})
    }

    if(scriptContext.type === scriptContext.UserEventType.DELETE){	
        retVal = updateCTs(scriptContext);
        log.debug({title: "DELETE updateCTs",details: retVal})
    }
    
    // recalc taxjar
    // if(scriptContext.type === scriptContext.UserEventType.CREATE || 
    //     scriptContext.type === scriptContext.UserEventType.EDIT ||
    //      scriptContext.type === scriptContext.UserEventType.XEDIT){             // saved mass update runs to fix Invoice UE cause Inv gets created in another UE 
    //     log.debug("InvoiceId",scriptContext.newRecord.id)
    //     if(scriptContext.newRecord.getValue({fieldId: "istaxable" }) == true ){
    //         var invoiceRcd = record.load({ type: record.Type.INVOICE, id: scriptContext.newRecord.id });
    //         taxjar.calculateTax(invoiceRcd);
    //         taxjar.buildTaxDetails(invoiceRcd);
    //         invoiceRcd.save(); 
    //     }
    // }
     
}	

const updateCTs = (scriptContext) => {
    try{
        const COGS_STATUS_APPROVED = "A"; 
        const COGS_STATUS_NOT_APPROVED = "C"; 
        const entityNames = ["customtransaction_mb_cogs_accrual", "customtransaction_mb_ds_accrual"]; 

        var status = COGS_STATUS_APPROVED;
        var transactionRcd = scriptContext.newRecord;        
        if(scriptContext.type === scriptContext.UserEventType.DELETE){
            status = COGS_STATUS_NOT_APPROVED;
            transactionRcd = scriptContext.oldRecord;                    
        };
        var storedTrans = 0;
        var itemSublist = "item";
        var lineCount = transactionRcd.getLineCount(itemSublist);
        var updateFields = {
            'trandate'      : transactionRcd.getValue({ fieldId: "trandate" }),
            'transtatus'    : status
        }

        for (var i = 0; i < lineCount; i++) {
            var quantity = transactionRcd.getSublistValue({ sublistId: itemSublist, fieldId: 'quantity', line: i });
            if(quantity!=0){
                var customTransactionId = transactionRcd.getSublistValue({ sublistId: itemSublist, fieldId: 'custcol_mb_ct_link', line: i }); 
                if(customTransactionId){
                    storedTrans++;
					let entityName = isCOGSAccrual(customTransactionId) ? entityNames[0] : entityNames[1] ;
                    var customTransactionId = record.submitFields({type: entityName ,id: customTransactionId ,values: updateFields}); 
                }
            }
        }    
    }
    catch(err){ 
        log.error("UpdateCTs Error",err.message);
    }
    return (storedTrans);
}

const isCOGSAccrual = (internalId) => {
    if(!internalId) return false; 
    var fieldLookUp = search.lookupFields({
        type: "transaction",
        id: internalId,
        columns: "type"
    });
    if(fieldLookUp.hasOwnProperty('type') && fieldLookUp.type.length>0) {
        // console.log("fieldLookUp.type " + fieldLookUp.type[0].text);
        return (fieldLookUp.type[0].text == "COGS Accrual");
    }
    return false;         
}

return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
};

});
