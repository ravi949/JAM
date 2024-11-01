/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/runtime','N/record','N/search','N/task'],

function(runtime,record,search,task) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
    	try{
    		var ids 				= runtime.getCurrentScript().getParameter('custscript_mb_so_ids_for_sw');
    		var idArray = ids.split(',');
    		log.debug('idArray',idArray);
    		
    		return search.create({
 			   type: "transaction",
 			   filters:
 			   [  ["mainline","is","T"], 
 			      "AND", 
 			      ["internalid","anyof",idArray]
 			   ],
 			   columns:
 			   [
 			      search.createColumn({name: "internalid", label: "Internal ID"}),
				  search.createColumn({name : 'formulatext',label : 'trxType', formula : "case when {type} = 'Transfer Order' then (case when nvl({tosubsidiary},'0') <> '0' then 'Intercompany Transfer Order' else 'Transfer Order' end) else 'Sales Order' end"}),
 			      search.createColumn({name: "custbody_mb_trx_allow_partial_ff", label: "Allow Partial Fulfillment"})
 			   ]
 			});
    	}catch(e){
    		log.error("Exception in Get Input Data",e);
    	}
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
    	try{	
    			log.debug("context",context);
    		 	var searchResult 			= JSON.parse(context.value);
    		 	log.debug("searchResult",searchResult);
    		 	var saleOrderId  			= searchResult.id;
 				var allowPartialFulfilement = searchResult.values.custbody_mb_trx_allow_partial_ff;
				var typeEnum = '';
				switch(searchResult.values.formulatext){
					case 'Sales Order':
						typeEnum = record.Type.SALES_ORDER
						log.debug('SO', searchResult.values.formulatext)
						break;
					case 'Transfer Order' : 
						typeEnum = record.Type.TRANSFER_ORDER
						log.debug('TO', searchResult.values.formulatext)

						break;
					case 'Intercompany Transfer Order' : 
						typeEnum = record.Type.INTER_COMPANY_TRANSFER_ORDER
						log.debug('ITO', searchResult.values.formulatext)

						break;
					default:
						throw 'No Type Enum Found'
						//break;
				};

 				log.debug("saleOrderId",saleOrderId);
 				log.debug("allowPartialFulfilement",allowPartialFulfilement);
 				
 				var valuesObj = {};
 				if(allowPartialFulfilement == true || allowPartialFulfilement == "T"){
 					valuesObj["custbody_mb_trx_allow_partial_ff"]   = false;
 					valuesObj["custbody_mb_partially_pushed"]   	= true;
 					valuesObj["custbody_mb_date_time_pushed_to_sw"] = new Date();
 				}else{
 					valuesObj["custbody_mb_pushed_to_shipworks"]	= true;
 					valuesObj["custbody_mb_date_time_pushed_to_sw"]	= new Date();
 				}
 				log.debug("valuesObj",valuesObj);
 				try{
 					var recordId = record.submitFields({
 						type   : typeEnum,
 						id 	   : saleOrderId,
 						values : valuesObj,
 					});
 					log.debug("recordId",recordId)
 				}catch(e){
 					log.error("Exception in creating SO",e)
 				}
    	}catch(e){
    		log.error("Exception in Map",e)
    	}
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {

    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
    	try{
    		var confirmFileScriptId = 548;
    		var taskId = scheduleScript(confirmFileScriptId,{"custscript_mb_test_folder":967});
    		if(taskId!=null){
    			log.debug('Submitted confirm file script');
    		}
    	}catch(e){
    		log.error("Exception in Summary",e);
    	}

    }
    
    function scheduleScript(script,params){
    	try{
    		var scriptTask = task.create({
    			taskType : task.TaskType.SCHEDULED_SCRIPT
    		});
    		scriptTask.scriptId = script;
    		scriptTask.params = params;
    		var taskID = scriptTask.submit();
    		log.debug('taskID',taskID);
    		return taskID;
    	}catch(err){
    		errorHandler(err,'scheduleScript','MB_Sched_fulfillable_orders_csv',null,null);
    		return null;
    	}
    }

    return {
        getInputData: getInputData,
        map: map,
        //reduce: reduce,
        summarize: summarize
    };
    
});