/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
	define(['N/search',
	        'N/record',
	        'N/email',
	        'N/runtime',
	        'N/error',
	        'N/url',
	        'N/task',
	        './lib/MBFormatFunctions.js',
	        './lib/MBErrorHandler.js',
	        './lib/MBHelpers.js'],

    function(search, record, email, runtime, error, url,task, mbformat,mberror,mbHelp)
    {
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
    	var depositId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_deposit_ra'});
    	log.debug('Script parameter : ' + depositId);
    	log.debug('User', runtime.getCurrentScript().getParameter({name: 'custscript_mb_user_id_ra'}));
    	
    	var userId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_user_id_ra'});
    	var invoices = runtime.getCurrentScript().getParameter({name: 'custscript_mb_missing_invoices'});
    	log.debug('invoices: ',invoices);

    	var suiteletResp;
    	var missingInvoices = JSON.parse(invoices);
    	var buildData  = buildCashRcd(depositId,missingInvoices);
    	if(buildData.success){
    		suiteletResp = 'Cash has been applied. '+ '<br>' + buildData.response;
    	}
    	else{
    		suiteletResp = 'Cash could not be applied. ' + '<br>' + buildData.response;
    	}
    	
    	
    	if(buildData.hasOwnProperty("missingInvoices") && buildData.missingInvoices.length >0){
			missingInvoices = buildData.missingInvoices;
			if(buildData.success){
	 			scheduleReapply(depositId,userId,missingInvoices);
			}
			else{
				suiteletResp = buildData.response;
            	suiteletResp += " " + renderMissingInvoices(missingInvoices);
    		}
    	}
    	
    	sendNotification(depositId,userId,suiteletResp);
    	
    	//context.response.writeLine(suiteletResp);

    }

    return {
        execute: execute
    };

    function sendNotification(depositId,userId,buildResponse){
        var author = -5;
        var recipients = userId;
        var subject = 'Scheduled Cash Application ' + runtime.getCurrentScript().id + ' completed! ';
        var body = buildResponse +'\n' +
        			'<a href="~1">Deposit Record</a>'.replace("~1",resolveRecordUrl(depositId));
        log.debug("email body",body);
        email.send({
            author: author,
            recipients: recipients,
            subject: subject,
            cc : ['rcm@mibar.net'],
            body: body
        });

    }
    
	function scheduleReapply(depositId,userId,missingInvoices){

        var taskScript = {scriptId : 'customscript_mb_scheduled_cash_reapply',
            	deploymentId : 'customdeploy_mb_scheduled_cash_reapply',
            	mrParams : { custscript_mb_deposit_ra: depositId,
            				 custscript_mb_user_id_ra: userId,
            				 custscript_mb_missing_invoices: JSON.stringify(missingInvoices)
            				}
    	};
        
        var mrTask = task.create({
            taskType: task.TaskType.SCHEDULED_SCRIPT,
            scriptId: taskScript.scriptId,
            params: taskScript.mrParams,
            deploymentId : taskScript.deploymentId
        });

        var mrTaskId = mrTask.submit();
        log.debug("tsk id",mrTaskId);
	}

    function resolveRecordUrl(recordId) {
        var scheme = 'https://';
        var host = url.resolveDomain({
            hostType: url.HostType.APPLICATION
        });
        var relativePath = url.resolveRecord({
            recordType: 'customrecord_mb_store_deposit' ,
            recordId: recordId,
            isEditMode: true
        });
        var output = scheme + host + relativePath;
        return output;
    }
    
    function buildCashRcd(depositId,missingInvoices){
      	try{
      		var storeDepositId;
      		log.debug('deposit id',depositId);

      		// load old record

      		var depositRcd = record.load({
                    type: record.Type.DEPOSIT,
                    id: depositId
            });
  			if(depositRcd){
                // qualify deposit ,throw error if it cant be done
                // total amount to apply not correct, check against the deposit rcd.
  				storeDepositId = depositRcd.getValue(mbHelp.gfv('custbody_mb_store_deposit_link'));
                var customerInfo = getCustomerInfo(depositRcd);
                if (customerInfo.entity == null) prettyError('bad customer error');
                
                var batchId = getBatchId(depositRcd);
                if(batchId){
    	   
                    // create a new one
                    var custPayment = record.transform({
                         fromType: record.Type.CUSTOMER,
                         fromId: customerInfo.entity,
                         toType: record.Type.CUSTOMER_PAYMENT,
                         isDynamic: true
                     });
                    custPayment.setValue(mbHelp.sfv('trandate', depositRcd.getValue(mbHelp.gfv('trandate')), false));
            		log.debug("trandate",custPayment.getValue((mbHelp.gfv('trandate'))));
                    custPayment.setValue(mbHelp.sfv('aracct', customerInfo.account, true));
                    
                    // add bank deposit as credit
                    var subList = 'credit';
                    var found = false;
                    var lineCount = custPayment.getLineCount(subList);
                    for (var j = 0; j < lineCount; j++)
                    {
                        custPayment.selectLine({sublistId: subList,line: j});
                        if(custPayment.getCurrentSublistValue(mbHelp.gcsfv(subList,'doc')) == depositId){
                        	custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'apply',true));
                        	found = true;
                        }
                    }
                    if(!found){
                    	prettyError('No credit record found error');
                    }
                    var status = "Integrated";
                    var checkAmount = custPayment.getValue(mbHelp.gfv('unapplied'));
                    log.debug("checkAmount",checkAmount);
                	applyData = reApplyInvoices(missingInvoices,storeDepositId,custPayment,batchId,depositId);
                	if(applyData.success){
                    	var payAmount = mbformat.parseFloatOrZero(custPayment.getValue(mbHelp.gfv('payment')));
                		log.debug("Payment ",payAmount);
                		
                		// technically this should never happen.
                		if(payAmount > 0 ){
                			prettyError('Insufficient funds to pay off these invoices.');
                		}
                	                                   	
                    	var custPaymentId = custPayment.save();
                        var buildData = { success : true,
                        			      response : ''
                        };
                        status = "Integrated";
                    	if(applyData.hasOwnProperty("missingInvoices")){
                    		if(applyData.missingInvoices.length >0){
                     			status = "In Process";
                     			buildData.response =  "This cash batch has been scheduled for reapplication due to excessive (10K) open invoices.";
                 				buildData.missingInvoices = applyData.missingInvoices;
                    		}
                    	}
                	}
                	else{
                        var buildData = {
            					success  : false,
                        		response : 'Even ater reapplication this cash batch could not be completely keyed off due excessive (>10K) open invoices.'
            			};
            			status = "Reapply failure";

                    	if(applyData.hasOwnProperty("missingInvoices")){
                    		if(applyData.missingInvoices.length >0){
                 				buildData.missingInvoices = applyData.missingInvoices;
                    		}
                    	}
                	}
                		                	
                	if(storeDepositId) updateStoreDeposit(storeDepositId, status,buildData.response);
                	
                	return buildData;
                }
            	return 	{success : false,
					response: 'No Batch found'
		 			};
                
           }
        	return 	{success : false,
				response: 'No Deposit found'
	 			};
  			
    	}
    	catch(ex){
        	if(storeDepositId) updateStoreDeposit(storeDepositId,null,ex.message);
    		mberror.log(ex);
    		return 	{success : false,
				response: ex.message
 				}
    	}
    }
    // return Account Info from first other line.
    function getCustomerInfo(depositRcd){
        var subList = 'other';
        return(
        		{
        			entity : depositRcd.getSublistValue(mbHelp.gsfv(subList,'entity',0)),
        			account : depositRcd.getSublistValue(mbHelp.gsfv(subList,'account',0))
        		}
        )
    }
    
    // get batch id from store deposit rcd.
    function getBatchId(depositRcd){
        var storeDepositId = depositRcd.getValue(mbHelp.gfv('custbody_mb_store_deposit_link'));
        var batchId = null;
        if(storeDepositId){
            var fieldLookUp = search.lookupFields({
                type: 'customrecord_mb_store_deposit',
                id: storeDepositId,
                columns: ['custrecord_mb_store_batch','custrecord_mb_store_status']
            });
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_batch')) batchId = fieldLookUp.custrecord_mb_store_batch;
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_status')){
            	var status = fieldLookUp.custrecord_mb_store_status;
            	log.debug("deposit status",status);
            }
            if(status != "Deposit Created" && status !="In Process") {
            	batchId = null;
            	prettyError('This deposit has been integrated already');
            }
        }
        return (batchId);
    }
    function prettyError(errorMessage){
    	var errorObj = error.create({
    	    name: 'Invoice Validation',
    	    message: errorMessage,
    	    notifyOff: false
    	});
    	throw errorObj;
    }

    // get invoices for this batch and find they in apply list to key off.
    function reApplyInvoices(missingInvoices,storeDepositId,custPayment,batchId,depositId){
        try{
        	missingInvoicesNew = new Array();
        	var resultId=null; var foundone = false;
        	missingInvoices.forEach(function callback(storeDetailId) {
        		resultId = storeDetailId;
          		var storeDetailRcd = record.load({
                    type: 'customrecord_mb_store_detail',
                    id: storeDetailId
          		});
          		
          		if(!storeDetailRcd){
                	mesg = "Store Detail Rcd not found in cash reapply.";
                	prettyError(mesg);
          		};
          		
                var invoiceId = storeDetailRcd.getValue({fieldId:'custrecord_mb_store_detail_invoice'});
                log.debug("invoice",invoiceId);
                
                // search apply list for invoice
                var subList =  'apply';
                var lineNumber = custPayment.findSublistLineWithValue({
                    sublistId: subList,
                    fieldId: 'doc',
                    value: invoiceId
                });
                
                log.debug("lineNumber",lineNumber);
                if(lineNumber>=0){
          			foundone = true;
                    custPayment.selectLine({sublistId: subList,line: lineNumber});
                    
                    var amountDue = mbformat.parseFloatOrZero(custPayment.getCurrentSublistValue(mbHelp.gcsfv(subList,'due')));
            		
                    var amountPaid = mbformat.parseFloatOrZero(storeDetailRcd.getValue({fieldId:'custrecord_mb_store_dtl_payment'}));
                    var debugout = "amountPaid  :  "+ amountPaid + '\n';
                    
                    var other  = mbformat.parseFloatOrZero(storeDetailRcd.getValue({fieldId:'custrecord_mb_store_detail_total_other'}));
                    debugout += "other  :  "+ other + '\n';
                    
                    var totalPaid = mbformat.parseFloatOrZero((amountPaid +other).toFixed(2));
                    log.debug("detail fields",debugout);

                    var discountTaken  = mbformat.parseFloatOrZero(storeDetailRcd.getValue({fieldId:'custrecord_mb_store_dtl_discount'}));
            		log.debug("totalPaid/discTaken",totalPaid.toString()+' + ' + discountTaken.toString());
            		
            		var mesg = 'Net Invoice (~1) is not zero.'
                    		.replace('~1',storeDetailRcd.getText({fieldId:'custrecord_mb_store_detail_invoice'}));
            		
            		
            		if(mbformat.parseFloatOrZero((totalPaid+discountTaken).toFixed(2)) != mbformat.parseFloatOrZero(amountDue)){
            			prettyError(mesg);
                    }

                    //custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'amount',totalPaid));
                    custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'discamt',discountTaken));
                    custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'apply',true));

                    updateResp(storeDetailId,"Success");
                    // removed for governance reasons and the deposit link can be retreived thru the batch id on the invoice fees table.
                    // updateFees(batchId,invoiceId,storeDepositId,depositId);
                    
                    var scriptObj = runtime.getCurrentScript();
                    log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());
                    if(scriptObj.getRemainingUsage() <100){
                    	mesg = "Script usage limit has been exceeded. Use bulk process to process this payment.";
                    	prettyError(mesg);
                    }
                }
    			else{
    				missingInvoicesNew.push(storeDetailId);
    			}
           	});
        	var applyData = {success: foundone};
            
        	if(missingInvoicesNew.length !=0){
    			log.debug("Missing Invoices",JSON.stringify(missingInvoicesNew));
				applyData.missingInvoices = missingInvoicesNew;
			};
            return applyData;
        
        }
        catch(err){
        	var ex = JSON.parse(err);
        	log.error("Error",err);
        	updateResp(resultId,ex.message);
        	throw err;
        }
    }
    
    // update status back to store dtl record so we can track error and success.
    function updateResp(internalId,resp){
    	if(internalId){
        	var id = record.submitFields({
        	    type: 'customrecord_mb_store_detail',
        	    id: internalId,
        	    values: {
        	        custrecord_mb_store_dtl_resp: resp
        	    },
        	    options: {
        	        enableSourcing: false,
        	        ignoreMandatoryFields : true
        	    }
        	});
    	}
    }
    // update status back to store deposit record so we can track error and success.
    function updateStoreDeposit(internalId,status,resp){
    	var thisDate =mbformat.getNSCurrentDate();
    	if(internalId){
    		var vals = {
        	        custrecord_mb_store_status :  status,
        	        custrecord_mb_store_process_date : thisDate ,
        	        custrecord_mb_store_response : resp
        	    };
    		if(!status)
    			vals =  {custrecord_mb_store_response : resp,
    					 custrecord_mb_store_process_date : thisDate ,
    					};
        	var id = record.submitFields({
        	    type: 'customrecord_mb_store_deposit',
        	    id: internalId,
        	    values: vals,
        	    options: {
        	        enableSourcing: false,
        	        ignoreMandatoryFields : true
        	    }
        	});
    	}
    }
    function renderMissingInvoices(missingInvoices){
    	var htmlMI = "<br>Invoices which could not be found<br><br>";
    	missingInvoices.forEach(function callback(storeDetailId) {
      		var storeDetailRcd = record.load({
                type: 'customrecord_mb_store_detail',
                id: storeDetailId
      		});
      		
      		if(storeDetailRcd){
                var invoiceId = storeDetailRcd.getValue({fieldId:'custrecord_mb_store_detail_invoice'});
                if(invoiceId){
                    var fieldLookUp = search.lookupFields({
                        type: 'invoice',
                        id: invoiceId,
                        columns: ['trandate','tranid']
                    });
                    if(fieldLookUp.hasOwnProperty('trandate') && fieldLookUp.hasOwnProperty('tranid')){
                    	htmlMI += fieldLookUp.tranid + " "+ fieldLookUp.trandate + "<br>";
                    }
                }
      		};
    	});
    	log.debug("htmlMI",htmlMI);
    	return htmlMI;
    }
});
