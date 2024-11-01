/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([   	'N/record',
        	'N/runtime',
        	'N/search',
        	],
/**
 * @param {error}
 *            error
 * @param {record}
 *            record
 */
function(record,runtime,search) {
   
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
  	    if (scriptContext.type == scriptContext.UserEventType.DELETE){
            var rec = scriptContext.oldRecord;
            if(!rec) return;
            
      	    var depositId = rec.getValue({fieldId : "custbody_mb_tran_link"});
      	    log.debug("depositId ",depositId);
      	    var fieldLookUp,daPointer;
            if(depositId){
            	daPointer = getDaPointer(depositId);
        		log.debug("dapointer ",daPointer);
        	                	
            	if(daPointer){
            		try{
                    	var id = record.submitFields({
                    	    type: 'customrecord_mb_deposit_accruals',
                    	    id: daPointer,
                    	    values: {custrecord_mb_setbatch : false,
                    	    	 custrecord_mb_batch_checked: false},
                    	    options: {enableSourcing: false,ignoreMandatoryFields : true}
                    	});
            		}
            		catch(err){
            			log.debug("delete error handled ",JSON.stringify(err));
            		}
            	}
            }
    	

  	    }
        	    	
    }
    
    function getDaPointer(depositId){
    	var daPointerId = null;var oSearch = null;
    	if(depositId){
    		oSearch = new Object();
    		oSearch.type = "customrecord_mb_deposit_accruals";
    		oSearch.filters = [
     		         	      ["custrecord_mb_deposit_id","anyof",depositId]
     		         	      ];
    		
    		oSearch.columns = [];
    		
    		var searchResults = search.create(oSearch);
    		if(searchResults){
        		log.debug("searchResults",JSON.stringify(searchResults));
        		var resultSet = searchResults.run().getRange({start: 0,end: 1});
        		log.debug("RS",JSON.stringify(resultSet));
        		if(resultSet.length>=1){
            		log.debug("RS id ",resultSet[0].id);
            		daPointerId = resultSet[0].id
        		}
    		}
    	}
    	return daPointerId;
    }
    
    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});
