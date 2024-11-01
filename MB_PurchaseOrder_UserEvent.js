/***
 * @NApiVersion 2.X
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
 define(['N/record','N/runtime','N/search','N/task','./lib/MBCustomTranLinePO.js'],
    function(record ,runtime, search, task, mbcustomTran) {

    //const CLIENT_SCRIPT_FILE_ID = 72017;
    const CLIENT_SCRIPT_FILE_ID = 156349;
    const SCHEDULED_SCRIPT_DEPLOYMENTID = "customdeploy_mb_ss_buildcatpo"; 
    const MAXLINES = 20; 

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
            if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) return;
                
            if (!(scriptContext.type === scriptContext.UserEventType.VIEW)) return; 
            if(showButton(scriptContext)){
                var form = scriptContext.form;            
                form.clientScriptFileId = CLIENT_SCRIPT_FILE_ID;
                var funcName = "cancelAccrual()";
                form.addButton({id : 'custpage_mb_closeaccrual',label: "Cancel PO Accrual",functionName:funcName});     
            }
            
        }
        function showButton(scriptContext){
            var showButton = false; 
            PORcd = scriptContext.newRecord;
            if(PORcd.getValue({fieldId: "createdfrom"})){
                if(CTsExist(PORcd.id))
                    showButton = true; 
            }
            return showButton; 
        }

        function CTsExist(transactionId){
            try{
                log.debug(" 55 transactionId",transactionId)
                var poSearchObj = search.create({
                type: "customtransaction_mb_cogs_accrual",
                filters:
                [
                    ["custbody_mb_ct_createdpo","is",transactionId], "AND",
                    ["status","anyof","Custom101:C"]
                ],
                columns: []
                });        
                var searchResultCount = poSearchObj.runPaged().count;
                log.debug("result count",searchResultCount);

                return (searchResultCount !=0)
            }
            catch(err){
                throw err; 
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
            log.debug({title: "type",details: scriptContext.type});
            // if its no too long then do it here , otherwise it gets scheduled. 
            if(!POisTooLong(scriptContext,false)){
                var oResp;
                if(scriptContext.type === scriptContext.UserEventType.CREATE || 
                    scriptContext.type === scriptContext.UserEventType.EDIT ||
                    scriptContext.type === scriptContext.UserEventType.XEDIT){    
                    oResp = mbcustomTran.buildCustomTran(scriptContext);
                    if(!oResp.success) throw new Error(oResp.message); 
                }    	
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
        function afterSubmit(scriptContext) {
            try {
                
                log.debug("context type,executionContext",scriptContext.type+", "+runtime.executionContext);
                log.debug("run script",JSON.stringify(runtime.getCurrentScript()));
                // if its no too long then do it here , otherwise it gets scheduled. 
                if(!POisTooLong(scriptContext,true)){
                    var oResp;    
                    if(scriptContext.type === scriptContext.UserEventType.CREATE || 
                            scriptContext.type === scriptContext.UserEventType.EDIT ||
                            scriptContext.type === scriptContext.UserEventType.XEDIT){    
                            oResp = mbcustomTran.updateCustomTran(scriptContext);
                            if(!oResp.success) throw oResp.message; 
                    }

                    if(scriptContext.type === scriptContext.UserEventType.DELETE){	
                        oResp = mbcustomTran.deleteCustomTran(scriptContext);
                        if(!oResp.success) throw oResp.message; 	
                    }
                }        
            } catch (error) {
                log.error({
                    title: "Create PO UE",
                    details: JSON.stringify(error)
                })
                if(scriptContext.type === scriptContext.UserEventType.CREATE || 
                    scriptContext.type === scriptContext.UserEventType.DELETE)
                    throw error; 
            }
        }		        
        /**
         * Checks if the scheduled script is currently running
         * @returns {Boolean}
         */
        function isScheduledScriptInProcess() {
            var isRunning = false;

            oSearch = new Object();
            oSearch.type = "scheduledscriptinstance";
            oSearch.filters = [
                            search.createFilter({
                                name : "scriptid",
                                join : "scriptdeployment",
                                operator: search.Operator.IS,
                                values: [SCHEDULED_SCRIPT_DEPLOYMENTID]
                            }),
                            search.createFilter({
                                name : "status",
                                operator: search.Operator.ANYOF,
                                values: ["PROCESSING", "PENDING", "IN QUEUE", "QUEUED"]
                            })
                            ];
            oSearch.columns = [
                            search.createColumn({name: "status", label: "status",summary: "group"})
                            ];

            var searchResult = search.create(oSearch);
            searchResult.run().each(function(result) {
                isRunning = true;
                return true;
                });
            
            return isRunning;
        }
        /** returns a list of CTs on the current PO 
         * @returns {Array} of strings
         * 
         */
        function loadPOLines(transactionRcd){
            const POLines = new Array(); var CTLineKey = ""; 
            var  lineCount = transactionRcd.getLineCount({sublistId: 'item'});            
            for (var i = 0; i < lineCount; i++) {
                CTLineKey = transactionRcd.getSublistValue({ sublistId: 'item', fieldId: 'custcol_mb_ct_link', line: i });
                if(CTLineKey!="" && CTLineKey !=null) POLines.push(CTLineKey); 
            }
            return POLines; 
        }
        /**
         *  Offload the CT creation to a SS when the number of lines exceeds MAXLINES
         * @param {object} scriptContext
         * @param {boolean} fromAfter determines if call is from afterSubmit
         * @returns {boolean} linecount exceeds the MAX 
         */
        function POisTooLong(scriptContext,fromAfter){
            // get out to stop it from calling itself. 
            //if(runtime.executionContext == runtime.ContextType.SCHEDULED  && isScheduledScriptInProcess()) return true; 
            if(isScheduledScriptInProcess()) {log.debug("skipping update fromAfter = ",fromAfter); return true;}
            
            var POLines = new Array(); 
            if(scriptContext.type === scriptContext.UserEventType.DELETE) POLines = loadPOLines(scriptContext.oldRecord); 
            
            transactionRcd = scriptContext.newRecord;             
            var lineCount = transactionRcd.getLineCount({sublistId: 'item'});

            // before submit shouldnt call the SS just not create the CT in the beforesubmit. SS does it all in one shot. 
            if(lineCount>=MAXLINES){ 
                if(fromAfter) offLoadIt(transactionRcd.id,scriptContext,POLines); 
                return true;
            }
            return false; 
        }
        /**
         *  creates a param object and schedules a task 
         * @param {string} transactionId 
         * @param {object} scriptContext 
         * @param {Array of strings} POLines 
         */
        function offLoadIt(transactionId,scriptContext,POLines){
            const transactionInfo = {'transactionId': transactionId, 'transactionType': scriptContext.type.toUpperCase(),'POLines' : JSON.stringify(POLines) };
            const paramObj = {'custscript_mb_transactioninfo': transactionInfo};
            var scheduledScriptTask = task.create({ 
                taskType        : task.TaskType.SCHEDULED_SCRIPT,
                scriptId        : SCHEDULED_SCRIPT_DEPLOYMENTID.replace("customdeploy","customscript"),
                deploymentId    : SCHEDULED_SCRIPT_DEPLOYMENTID,
                params          : paramObj
            });

            var ssTaskId = scheduledScriptTask.submit();            
            log.audit("taskid was scheduled",ssTaskId); 

        }    

return {
    beforeLoad: beforeLoad,
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
}

});

