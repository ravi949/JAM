/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * *********************************************************************************************************
 * Functionalites Included :-
 * * AFTER SUBMIT :-
 * * * 1. Creating an asssembly build for a work order attached on the Transfer order after the transfer order is fulfilled and recevied. This is a part of OSC
 * * * transaction flow.
 */
define(['N/record','N/search'],
function(record,search) {
   
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
    	try {
            var recordObj       = scriptContext.newRecord;
            var orderType       = scriptContext.newRecord.getValue({fieldId:"ordertype"});
            log.debug("orderType",orderType);
            if(orderType != "TrnfrOrd")
                return;
            var createdFrom     = scriptContext.newRecord.getValue({fieldId:"createdfrom"});
            var fieldLookUp = search.lookupFields({
                type   : 'transferorder',
                id     : createdFrom,
                columns: ['custbody_mb_osc_related_record']
            });
            log.debug("fieldLookUp",fieldLookUp)
            var workOrderId = fieldLookUp["custbody_mb_osc_related_record"][0]["value"]
            log.debug("workOrderId",workOrderId);
            if(!workOrderId)
                return

            var workorderSearchObj = search.create({
                type: "workorder",
                filters:
                [
                   ["type","anyof","WorkOrd"], 
                   "AND", 
                   ["status","anyof","WorkOrd:B"], 
                   "AND", 
                   ["internalid","anyof",workOrderId]
                ],
                columns:
                [
                   search.createColumn({name: "internalid", label: "Internal ID"})
                ]
             });
             var searchResultCount = workorderSearchObj.runPaged().count;
             log.debug("workorderSearchObj result count",searchResultCount);
             if(searchResultCount > 0){
                var assemblyBuildRecObj = record.transform({
                    fromType  : "workorder",
                    fromId    : workOrderId,
                    toType    : "assemblybuild",
                    isDynamic : true
                });
                var createdFromText = assemblyBuildRecObj.getValue({fieldId:"createdfrom"});
                assemblyBuildRecObj.setValue({fieldId:"quantity",value:1});
                var toBeBuilt       = assemblyBuildRecObj.getValue({fieldId:"quantity"});
                var assemblyItem    = assemblyBuildRecObj.getValue({fieldId:"item"});
                var location        = assemblyBuildRecObj.getValue({fieldId:"location"});

                var itemSearchObj = search.create({
                    type: "item",
                    filters:
                    [
                       ["internalid","anyof",assemblyItem], 
                       "AND", 
                       ["binnumber.location","anyof",location]
                    ],
                    columns:
                    [
                       search.createColumn({name: "binnumber",join: "binNumber",label: "Bin Number"}),
                       search.createColumn({name: "internalid",join: "binNumber",label: "Internal ID"})
                    ]
                 });
                 var searchResultCount = itemSearchObj.runPaged().count;
                 if(searchResultCount == 0){
                    log.error("Work Order "+createdFromText ,"We can not build this work order due to no availability of bins.")
                 }
                 var binNumber = 0;
                 itemSearchObj.run().each(function(result){
                    binNumber         = result.getValue({name: "internalid",join: "binNumber",label: "Bin Number"});
                    var binNumberText = result.getValue({name: "binnumber",join: "binNumber",label: "Bin Number"});
                    log.debug("binNumberText",binNumberText);
                
                 });
                 log.debug("binNumber",binNumber)
                 var subrec = assemblyBuildRecObj.getSubrecord({fieldId: 'inventorydetail'});
                 subrec.selectNewLine({sublistId: 'inventoryassignment'});
                 subrec.setCurrentSublistValue({sublistId : 'inventoryassignment',fieldId   : 'binnumber',value : binNumber});
                 subrec.setCurrentSublistValue({sublistId : 'inventoryassignment',fieldId   : 'quantity',value : toBeBuilt});
                subrec.commitLine({
                    sublistId: 'inventoryassignment'
                });
                 
                var recordId = assemblyBuildRecObj.save();
                log.debug("Assembly Build",recordId);
             }
             

            

    	}catch(err){
    		log.error('Error in After Submit',JSON.stringify(err));
    	}
	}
 
    return {
//       beforeLoad: beforeLoad,
//       beforeSubmit: beforeSubmit,
         afterSubmit: afterSubmit
    };
    
});
