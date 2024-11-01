/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
var CLIENT_SCRIPT_ID =  84;

define(['N/error',
        	'N/record',
        	'N/runtime',
        	'N/search',
            'N/task',
        	'N/url',
            'N/ui/serverWidget',
	        './lib/MBErrorHandler.js',
	        './lib/MBFormatFunctions.js',
        	],
/**
 * @param {error} error
 * @param {record} record
 */
function(error, record,runtime,search,task,url,serverWidget,mberror,mbformat) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(context) {
    		log.debug("debug",runtime.executionContext);
    		
			if (runtime.executionContext === runtime.ContextType.USER_INTERFACE){
	    		log.debug("debug","forms");
        		var depositRcd = context.newRecord;
        		var status =   depositRcd.getValue({fieldId: 'custrecord_mb_store_status'});
	    		log.debug("status",status);
        		var feeCnt =   mbformat.parseIntOrZero(depositRcd.getValue({fieldId: 'custrecord_mb_store_non_inv_fee_cnt'}))+
        							 mbformat.parseIntOrZero(depositRcd.getValue({fieldId: 'custrecord_mb_store_inv_fee_cnt'}));
        		var invCnt =   mbformat.parseIntOrZero(depositRcd.getValue({fieldId: 'custrecord_mb_store_total_inv_cnt'}));
            	var scheduleThreshold =  mbformat.parseIntOrZero(runtime.getCurrentScript().getParameter({name: 'custscript_mb_record_threshold'}));
            	log.debug("invcnt",invCnt);
            	log.debug("threshold",scheduleThreshold );
        		var form = context.form;
//    			form.clientScriptFileId = CLIENT_SCRIPT_ID;
    			form.clientScriptModulePath = "SuiteScripts/JAM Paper/MB_StoreDeposit_Client.js"
        		
    //    		var oButton = {
    //    					id : 'custpage_depositFunds',
    //    					label : 'Deposit Funds',
    //    					functionName : 'depositFunds'
    //    		};
    //            if (context.type === context.UserEventType.VIEW) form.addButton(oButton);
        		var oButton = {
        				id : 'custformbutton_customscript_mb_cs_store_deposit_1',
        		};
        		var formButton = form.getButton(oButton);
        		if(formButton){
            		if(status !="Success")
            			formButton.isHidden = true;
            		else
            			if(invCnt > scheduleThreshold || feeCnt>scheduleThreshold){
            				log.debug("label",formButton.label);
            				formButton.label = "Schedule Deposit Creation";
            			}
				}
        		
        		oButton = {
        				id : 'custformbutton_customscript_mb_cs_store_deposit_2',
        		};
        		formButton = form.getButton(oButton);
        		if(formButton){
            		if(status !="Deposit Created"){
            			formButton.isHidden = true;
            		}
            		else
            			if(invCnt > scheduleThreshold || feeCnt>scheduleThreshold){
            				log.debug("label",formButton.label);
            				formButton.label = "Schedule Cash Application";
            			}
        		}
        		var scriptTaskId = depositRcd.getValue({fieldId: 'custrecord_mb_store_taskid'});
        		if(scriptTaskId){
        			try{
                		var res = task.checkStatus(scriptTaskId);
                		if(res){
                	    	var option = {
                	    		fieldId: 'custrecord_mb_store_task_status',
                	    		value:res.status,
                	    		ignoreFieldChange: false
                	    	};
                			depositRcd.setValue(option);
                		}
        			}
        			catch(e){}
            		//log.debug('Initial status: ' + res.status);
        		}
        		
        		log.debug("depositid",depositRcd.id);
        		var accrualData = getRevAccrualData(depositRcd.id);
        		log.debug("accrual data",JSON.stringify(accrualData));
        		if(accrualData.hasOwnProperty('internalId')){
            		if(accrualData.internalId && accrualData.internalId !=""){
                		var field = form.addField({
                		    id : 'custpage_mb_rev_accrual_link',
                		    type : serverWidget.FieldType.URL,
                		    label : 'Reverse Accrual Link'
                		});
                		field.linkText = accrualData.transactionId;
                		
                		var hlink = getNSDomain() + "/app/accounting/transactions/custom.nl?id=~~1&customtype=100".replace("~~1",accrualData.internalId);
                		field.defaultValue = hlink;
                		field.updateDisplayType({
                            displayType : serverWidget.FieldDisplayType.INLINE
                        });
                		
            		}
            		else{
                		var field = form.addField({
                		    id : 'custpage_mb_rev_accrual_chk',
                		    type : serverWidget.FieldType.CHECKBOX,
                		    label : 'No Reverse Accrual Required'
                		});
                		field.defaultValue = accrualData.batchChecked ? "T" : "F";
                		field.updateDisplayType({displayType : serverWidget.FieldDisplayType.INLINE});
            		}
        		};
    			
        		if(status == "Partially Integrated"){
                    var newStatus = 'setBatchStatus("Deposit Created");';
                    form.addButton({
                        id : 'custpage_reset',
                        label : 'Reset Batch Status',
                        functionName : newStatus
                    });
                    
                    var newStatus = 'setBatchStatus("Integrated (by User)");';
                    form.addButton({
                        id : 'custpage_close',
                        label : 'Close Batch',
                        functionName : newStatus
                    });
                    
        		}
        		
		}
    }
    function getRevAccrualData(storeDepositId){
    	var accrualData = {};
    	if(storeDepositId){
    		fieldLookUp = search.lookupFields({
                type: 'customrecord_mb_deposit_accruals',
                id: storeDepositId,
                columns: ['custrecord_mb_deposit_accrual_link']
            });
    		oSearch = new Object();
    		oSearch.type = "customrecord_mb_deposit_accruals";
//    		oSearch.filters = [
//        		         	      ["custrecord_mb_store_deposit_link","is",storeDepositId],
//        		        	      "AND",["custrecord_mb_batch_checked","is","F"]
//    		         	      ];
    		oSearch.filters = [
     		         	      ["custrecord_mb_store_deposit_link","is",storeDepositId]
 		         	      ];
    		
    		oSearch.columns = [
    		                   search.createColumn({name: "custrecord_mb_deposit_accrual_link"}),
    		                   search.createColumn({name: "custrecord_mb_batch_checked"})
    		                  ];
    		var searchResults = search.create(oSearch);
    		var resultSet = searchResults.run().getRange({start: 0,end: 1});
    		log.debug("RS",JSON.stringify(resultSet));
    		if(resultSet[0]){
        		log.debug("RS",resultSet[0].getValue({name: 'custrecord_mb_deposit_accrual_link'}));
        		accrualData.internalId = resultSet[0].getValue({name: 'custrecord_mb_deposit_accrual_link'});
        		accrualData.batchChecked =  resultSet[0].getValue({name: 'custrecord_mb_batch_checked'});
        		accrualData.transactionId = resultSet[0].getText({name: 'custrecord_mb_deposit_accrual_link'});
    		}
    	}
    	return accrualData;
    }
    
	// Get proper url
	function getNSDomain(){
		var isSandbox = runtime.envType != "PRODUCTION";
    	var nsDomain = "https://"+ url.resolveDomain({
    	    hostType: url.HostType.APPLICATION,
    	    accountId: runtime.accountId
    	});
		
		return (nsDomain);
	}
    
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} context
     * @param {Record} context.newRecord - New record
     * @param {Record} contextt.oldRecord - Old record
     * @param {string} contextt.type - Trigger type
     * @Since 2015.2
     */
        function beforeSubmit(context) {
        		try{
                      if (!(context.type === context.UserEventType.DELETE))
                      {
                        return;
                      }

                    var rec = context.newRecord;
        			if (runtime.executionContext === runtime.ContextType.RESTLET){
        				var rec = context.oldRecord;
        			}
              	    var depositId  = rec.getValue({fieldId: 'custrecord_mb_deposit_link'});
        			if(depositId){
                        var err =  error.create({
                            name: '  Delete Error',
                            message: "This store deposit cannot be deleted while a Deposit exists. Please remove the Deposit before deletion!"
                        });
                      throw err;

//                        var errorMsg = "<span style='font-size: 12px;font-weight: normal !important;color: #6f6f6f !important;text-transform: uppercase;'>~1</span>".
//                        		replace("~1",err.name + ': ' + err.message);
//                  	    log.debug("err",errorMsg);
//                        throw errorMsg;
              	    }
        			
              	    var batchId  = rec.getValue({fieldId: 'custrecord_mb_store_batch'});
                    log.debug("batchId",batchId);
                    
                    var mrScript = {mapReduceScriptId : 'customscript_mb_mr_store_detail_delete',
                        	deploymentId : 'customdeploy_mb_mr_store_detail_delete',
                        	mrParams : {custscript_mb_store_detail_batch: batchId} }

              	    createAndSubmitMapReduceJob(mrScript);

                    var mrScript = {mapReduceScriptId : 'customscript_mb_mr_invoice_fees_delete',
                        	deploymentId : 'customdeploy_mb_mr_invoice_fees_delete',
                        	mrParams : {custscript_mb_invoice_fees_batch: batchId} }

              	    createAndSubmitMapReduceJob(mrScript);
                    
                    var mrScript = {mapReduceScriptId : 'customscript_mb_mr_store_fees_delete',
                        	deploymentId : 'customdeploy_mb_mr_store_fees_delete',
                        	mrParams : {custscript_mb_store_fees_batch: batchId} }

              	    createAndSubmitMapReduceJob(mrScript);
        		}
        		catch(ex){
            		mberror.log(ex,true);
        		}
        }

    function createAndSubmitMapReduceJob(mrScript) {
        try{
            log.audit('mapreduce id: ', mrScript.mapReduceScriptId);
            var mrTask = task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: mrScript.mapReduceScriptId,
                params: mrScript.mrParams,
//                        deploymentId : mrScript.deploymentId			leave out deployment id to process multiple MRs
            });
            var mrTaskId = mrTask.submit();

            /*

            var taskStatus = task.checkStatus(mrTaskId);
            if (taskStatus.status === 'FAILED') {
                var authorId = -5;
                var recipientEmail = 'jampaper2@mibar.net';
                email.send({
                    author: authorId,
                    recipients: recipientEmail,
                    subject: 'Failure executing map/reduce job!',
                    body: 'Map reduce task: ' + mapReduceScriptId + ' has failed.'
                });
            }
            */
            var oResult = {id: mrTaskId};
            //return oResult;
        }
    	catch (ex) {
    		var oLog = 	{title: "create task error",details: JSON.stringify(ex)};
    		log.error(oLog);
    		var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;
    		//return errObject(errMsg);
    	}
    	return
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
    function afterSubmit(context) {
		
    }

    return {
        beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});
