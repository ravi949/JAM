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

    function(search, record, email, runtime, error, url,task,mbformat,mberror,mbHelp)
    {
		const MINIMUM_USAGE = 300;
		var startDateTime = new Date();
    	var executionThreshold;
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
    	
    	log.debug('Start Date time',startDateTime);
    	executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
    	log.debug('Start Date time',JSON.stringify(scriptContext));    	
    	var depositId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_deposit'});
    	log.debug('Script parameter : ' + depositId);
    	log.debug('User', runtime.getCurrentScript().getParameter({name: 'custscript_mb_user'}));
    	var userId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_user'});
    	var suiteletResp;
    	
    	var buildData  = buildCashRcd(depositId,userId);
    	if(buildData.success){
    		suiteletResp = 'Cash has been applied. '+ '<BR>' + buildData.response;
    	}
    	else{ suiteletResp = 'Cash could not be applied. ' + '<BR>' + buildData.response;}

    	if(buildData.hasOwnProperty("missingInvoices") && buildData.missingInvoices){
    		if(buildData.success){
    			scheduleReapply(depositId,buildData.storeDepositId,userId);
    		}
			else{
				suiteletResp = buildData.response;
    		}
    	}
    	
    	sendNotification(depositId,userId,suiteletResp);
    	
    	//context.response.writeLine(suiteletResp);

    }

    return {
        execute: execute
    };

    function sendNotification(depositId,userId,suiteletResp){
        var author = -5;
        var recipients = userId;
        var subject = 'Scheduled Cash Application ' + runtime.getCurrentScript().id + ' completed! ';
        var body = suiteletResp+'<BR>' +
        			'<a href="~1">Deposit Record</a>'.replace("~1",resolveRecordUrl(depositId));
        email.send({
            author: author,
            recipients: recipients,
            subject: subject,
            cc : ['netsuite@mibar.net'],
            body: body
        });

    }
	function scheduleReapply(depositId,storeDepositId,userId){

        var taskScript = {scriptId : 'customscript_mb_scheduled_cash_receipts',
            	deploymentId : 'customdeploy_mb_scheduled_cash_receipts',
            	mrParams : { custscript_mb_deposit: depositId,
            				 custscript_mb_user: userId
            				}
    	};

        var mrTask = task.create({
            taskType: task.TaskType.SCHEDULED_SCRIPT,
            scriptId: taskScript.scriptId,
            params: taskScript.mrParams
        });
        var mrTaskId = mrTask.submit();

        if(storeDepositId){
        	var id = record.submitFields({
        	    type: 'customrecord_mb_store_deposit',
        	    id: storeDepositId,
        	    values: {custrecord_mb_store_taskid :  mrTaskId},
        	    options: {
        	        enableSourcing: false,
        	        ignoreMandatoryFields : true
        	    }
        	});
    	};
        
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
    
    function executionTimesUp(){
    	var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
    	var minutesRunning = Math.floor((timeElapsed/1000)/60);
    	return (minutesRunning >executionThreshold);
    	
    }
    function buildCashRcd(depositId,userId){
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
                var subsidiaryId = depositRcd.getValue(mbHelp.gfv('subsidiary'));                
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
                    log.debug("subsidiary",subsidiaryId); 
                    custPayment.setValue(mbHelp.sfv('subsidiary', subsidiaryId, false));

                    
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

                    var checkAmount = custPayment.getValue(mbHelp.gfv('unapplied'));
                    log.debug("checkAmount",checkAmount);
                    var applyData = applyInvoices(storeDepositId, custPayment, batchId,depositId);
                               	
                	if(applyData.success){
                    	var payAmount = mbformat.parseFloatOrZero(custPayment.getValue(mbHelp.gfv('payment')));
                		log.debug("amount remaining ",mbformat.parseFloatOrZero(custPayment.getValue(mbHelp.gfv('unapplied'))));
                		log.debug("Payment ",payAmount);
                		
                		// technically this should never happen.
                		if(payAmount > 0 ){
                			prettyError('Insufficient funds to pay off these invoices.');
                		}
                		
                		var custPaymentId = custPayment.save();
                        var buildData = { success : true,
                    					storeDepositId: storeDepositId,
                    					response : ''
                        };
                    	var status = "Integrated";
                		
                		if(applyData.hasOwnProperty("missingInvoices") && applyData.missingInvoices){
                 			status = "In Process";
                 			buildData.response =  "This cash batch has been scheduled for reapplication due to excessive (10K) open invoices.";
             				buildData.missingInvoices = applyData.missingInvoices;
                		}
                	}
                	else{
                        var buildData = {
            					success  : false,
                        		response : 'Not all Invoices could be keyed off. This happens when invoices have been previously paid or are outside of the payment date range.',
            					storeDepositId: storeDepositId,
                        		missingInvoices : false
            			};
            			status = "Partially Integrated";
                    	if(applyData.hasOwnProperty("missingInvoices")){
                			buildData.missingInvoices = applyData.missingInvoices;
                    	}
                	}
                	
                	if(storeDepositId) updateStoreDeposit(storeDepositId, status,buildData.response);
                	
                	return buildData;
                }

               	return 	{success : false,response: 'No Batch found', storeDepositId: "",missingInvoices : false};
           }
    	}
    	catch(ex){
        	if(storeDepositId) updateStoreDeposit(storeDepositId,null,ex.message);
    		log.error("bldcash error:",JSON.stringify(ex));
    		return 	{success : false,
				storeDepositId: storeDepositId,
				response: ex.message
 				};
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
            if(status != "Deposit Created" && status != "In Process") {
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
    function applyInvoices(storeDepositId,custPayment,batchId,depositId){
    	try{
    			var resultId=null;var foundone = false;
    			missingInvoicesNew = false;var getOut = false;
    			log.debug("batchId",batchId);
                var subList =  'apply';
    			log.debug("apply list count ",custPayment.getLineCount(subList));
            	var invoiceSearch = getInvoices(batchId);
            	invoiceSearch.forEach(function callback(result) {
    				 resultId = result.id;
    				 var invoiceId = result.getValue({name: 'custrecord_mb_store_detail_invoice'});
///    				 if(!invoiceId || invoiceId =="") continue;
    				 log.debug("invoice/result.id",invoiceId+" / "+result.id);
    				 // search apply list for invoice

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
                        var debugout = "amountDue  :  "+ amountDue + '\t';
                        
                        var amountPaid = mbformat.parseFloatOrZero(result.getValue({name: 'custrecord_mb_store_dtl_payment'}));
                        debugout += "amountPaid  :  "+ amountPaid + '\t';
                        
                        var other  = mbformat.parseFloatOrZero(result.getValue({name: 'custrecord_mb_store_detail_total_other'}));
                        debugout += "other  :  "+ other + '\t';
                        
                        var totalPaid = mbformat.parseFloatOrZero((amountPaid +other).toFixed(2));
                        log.debug("detail fields",debugout);

                        var discountTaken  = mbformat.parseFloatOrZero(result.getValue({name: 'custrecord_mb_store_dtl_discount'}));
                        
                		log.debug("totalPaid/discTaken",totalPaid.toString()+' + ' + discountTaken.toString());
                		
                		if(mbformat.parseFloatOrZero((totalPaid+discountTaken).toFixed(2)) != amountDue){
                    		var mesg = 'Net Invoice (~1) is not zero.'
                        		.replace('~1',result.getText({name: 'custrecord_mb_store_detail_invoice'}));
                			prettyError(mesg);
                        }

                        //custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'amount',totalPaid));
                        custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'discamt',discountTaken));
                        custPayment.setCurrentSublistValue(mbHelp.scsfv(subList,'apply',true));

                        if(executionTimesUp()){
                         	log.audit("Time limit error ","apply has been rescheduled to avoid a script timeout");
                        	missingInvoicesNew = true; // trip flag to get rescheduled.
                        	getOut = true;
                        	throw ''; // nothing just to break loop
                        }
                        var scriptObj = runtime.getCurrentScript();
                        log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());

                        if(scriptObj.getRemainingUsage() < MINIMUM_USAGE){
                         	log.audit("Rescheduled","apply has been rescheduled to avoid a script usage error");
                        	missingInvoicesNew = true; // trip flag to get rescheduled.
                        	getOut = true;
                        	throw ''; // nothing just to break loop
                        }
    				 }
    				 else{
    					 missingInvoicesNew = true;
    				 }
                });
            	log.debug("Missing Invoices",missingInvoicesNew);
            	var applyData = {success: foundone , missingInvoices : missingInvoicesNew};
            	return applyData;
    	}
    	catch(err){
        	if(getOut){
                var applyData = {success: foundone};
            	if(missingInvoicesNew){
    				applyData.missingInvoices = missingInvoicesNew;
    			};
                return applyData;
        	};
        	log.debug("error",JSON.stringify(err));
    		updateResp(resultId,err.message);
    		throw err;
    	}
    }
    function getInvoices(batchId)
    {
    	oSearch = new Object();
    	oSearch.type = 'customrecord_mb_store_detail';
    	oSearch.isLimitedResult = false;
    	oSearch.filters = [
     	        	      ['custrecord_mb_store_dtl_batch', 'is', batchId],'and',
//    	        	      ['custrecord_mb_store_dtl_resp', search.Operator.ISEMPTY,null],'and',
    	        	      ["custrecord_mb_store_detail_invoice.status","anyof","CustInvc:A"],'and',
     	        	      ["custrecord_mb_store_detail_invoice","noneof","@NONE@"],'and',
     	        	      [["custrecord_mb_store_dtl_payment","notequalto","0.00"],"OR",["custrecord_mb_store_detail_total_other","notequalto","0.00"]]
     	];
    	
    	oSearch.columns = [
                   	      search.createColumn({name: 'custrecord_mb_store_detail_invoice',
                   	    	 sort: search.Sort.ASC}),
                 	      search.createColumn({name: 'custrecord_mb_store_dtl_payment'}),
                 	      search.createColumn({name: 'custrecord_mb_store_dtl_discount'}),
                 	      search.createColumn({name: 'custrecord_mb_store_detail_total_other'})
        ];
        return searchGetAllResult(oSearch)
    }

    function searchGetAllResult(option){
        var result = [];
        if(option.isLimitedResult == true){
            var rs = search.create(option).run();
            result = rs.getRange(0,1000);
            
            return result;
        }
        
        var rp = search.create(option).runPaged();
        rp.pageRanges.forEach(function(pageRange){
            var myPage = rp.fetch({index: pageRange.index});
            result = result.concat(myPage.data);
        });
        
        return result;
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
    			vals = {custrecord_mb_store_response : resp,
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
    
});
