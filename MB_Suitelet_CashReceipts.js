/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
	define(['N/search',
	        'N/record',
	        'N/email',
	        'N/runtime',
	        'N/error',
	        'N/task',
	        'N/redirect',
	        './lib/MBFormatFunctions.js',
	        './lib/MBErrorHandler.js',
	        './lib/MBHelpers.js'],

    function(search, record, email, runtime, error, task,redirect,mbformat,mberror,mbHelp)
    {

    /**
     * Definition of the Suitelet script trigger point.
     *
     * @param {Object} context
     * @param {ServerRequest} context.request - Encapsulation of the incoming request
     * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
     * @Since 2015.2
     */
    function onRequest(context) {
    	//var depositId = runtime.getCurrentScript().getParameter({name: 'custscript_mb_deposit'});
    	var depositId = context.request.parameters.custparam_mb_deposit;
    	log.debug('User', context.request.parameters.custparam_mb_user);
    	var userId = context.request.parameters.custparam_mb_user;
    	log.debug('Script parameter : ' + depositId);

    	var buildData  = buildCashRcd(depositId,userId);
    	if(buildData.success){
    		suiteletResp = 'Cash has been applied. '+ '\n' + buildData.response;
    	}
    	else{ suiteletResp = 'Cash could not be applied. ' + '\n' + buildData.response;}
    	
    	context.response.writeLine(suiteletResp);

    }

    return {
        onRequest: onRequest
    };
    
	function applyCashBIG(depositId,storeDepositId,userId){

            var taskScript = {scriptId : 'customscript_mb_scheduled_cash_receipts',
                	deploymentId : 'customdeploy_mb_scheduled_cash_receipts',
                	mrParams : { custscript_mb_deposit: depositId,
                				 custscript_mb_user: userId
                				}
        	};
            
            var mrTask = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: taskScript.scriptId,
                params: taskScript.mrParams,
                deploymentId : taskScript.deploymentId
            });
            log.debug("tsk ",JSON.stringify(mrTask));                  
            var mrTaskId = mrTask.submit();
            
            //log.debug("tsk id",mrTaskId);
        	if(depositId){
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
	}
	function scheduleReapply(depositId,storeDepositId,userId){

        var taskScript = {scriptId : 'customscript_mb_mr_cash_reapply',
            	deploymentId : 'customdeploy_mb_mr_cash_reapply',
            	mrParams : { custscript_mb_deposit_ra: depositId,
            				 custscript_mb_user_id_ra: userId
            	}
    	};
        
        var mrTask = task.create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: taskScript.scriptId,
            params: taskScript.mrParams,
            deploymentId : taskScript.deploymentId
        });
        var mrTaskId = mrTask.submit();
        
        log.debug("tsk id",mrTaskId);

        if(depositId){
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
                
                var storeInfo = getBatchId(depositRcd);
                var batchId = storeInfo[0];
                var scheduleBatch = storeInfo[1];
                if(batchId && !scheduleBatch){
    	   
                    // create a new one
                    // var custPayment = record.transform({
                    //      fromType: record.Type.CUSTOMER,
                    //      fromId: customerInfo.entity,
                    //      toType: record.Type.CUSTOMER_PAYMENT,
                    //      isDynamic: true
                    //  });
                    var invoiceData = getInvoices(batchId);
                    var custPayment = record.create({
                        type: 'customerpayment',
                        isDynamic: true,
                        defaultValues : {'entity':customerInfo.entity, 'invoices': invoiceData.invoices }
                    });
                    
                    custPayment.setValue(mbHelp.sfv('trandate', depositRcd.getValue(mbHelp.gfv('trandate')), false));
            		log.debug("trandate",custPayment.getValue((mbHelp.gfv('trandate'))));
                    custPayment.setValue(mbHelp.sfv('aracct', customerInfo.account, true));
                    log.debug("subsidiary",subsidiaryId); 
                    custPayment.setValue(mbHelp.sfv('subsidiary', subsidiaryId, false));
                    ///custPayment.setValue(mbHelp.sfv('undepfunds',true,true));
                    
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
                	// put amount on account where there nothing to apply.
                	//if(!applyInvoices(storeDepositId, custPayment, batchId,depositId)) prettyError('No invoices to apply');
                	var applyData = applyInvoices(storeDepositId, custPayment, invoiceData.invoiceSearch,depositId);

                	var payAmount = mbformat.parseFloatOrZero(custPayment.getValue(mbHelp.gfv('payment')));
            		log.debug("Payment ",payAmount);
            		
            		// technically this should never happen.
            		if(payAmount > 0 ){
            			prettyError('Insufficient funds to pay off these invoices.');
            		}
                               	
                	var status = "Integrated"; var resp = '';
                	if(applyData.success){
                		var custPaymentId = custPayment.save();
                		if(applyData.hasOwnProperty("missingInvoices") && applyData.missingInvoices){
                 			status = "In Process";
                 			resp =  "This cash batch has been scheduled for reapplication due to excessive (10K) open invoices.";
             				scheduleReapply(depositId,storeDepositId,userId);
                		}
                	}
                	else{
             			status = null;
             			resp =  "This cash batch cound not be applied becuase no invoices could be found. Check date range";
                	}
                	
                	if(storeDepositId) updateStoreDeposit(storeDepositId, status,resp);
               	
                	return 	{success : applyData.success,response: resp};
                }
                if(scheduleBatch){
                    applyCashBIG(depositId,storeDepositId,userId);
                	return 	{success : false,
            				response: 'There were too many invoices. The Cash application has been scheduled.'
            		 		}
            	};
            	return 	{success : false,
    					response: 'No Batch found'
    		 			}
           }
    	}
    	catch(ex){
        	if(storeDepositId) updateStoreDeposit(storeDepositId,null,ex.message);
    		mberror.log(ex);
    		return 	{success : false,
					response: ex.message
	 				}
    	}
    
    }
    
    // get invoices for this batch and find they in apply list to key off.
    function applyInvoices(storeDepositId,custPayment,invoiceSearch,depositId){
    	try{
			var resultId=null;
			missingInvoices = false;
            var subList =  'apply';                        
           	invoiceSearch.run().each(function(result) {
                var invoiceId = result.getValue({name: 'custrecord_mb_store_detail_invoice'});
                log.debug("invoice",invoiceId);

                // search apply list for invoice
                var lineNumber = custPayment.findSublistLineWithValue({sublistId: subList,fieldId: 'doc',value: invoiceId});
                log.debug("lineNumber",lineNumber);
                if(lineNumber>=0){
               		resultId = result.id;
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
                    
                    var scriptObj = runtime.getCurrentScript();
                    log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());
                    if(scriptObj.getRemainingUsage() <100){
                    	mesg = "Script usage limit has been exceeded. Use bulk process to process this payment.";
                    	prettyError(mesg);
                    }
                    
                }
   				else{
   					missingInvoices = true;
 				}
       		    return true;
           	});
    		var applyData = {success: false};

            if(resultId){
            	log.debug("Missing Invoices",missingInvoices);
           		applyData.success = true;
                applyData.missingInvoices = missingInvoices;
            }
            return applyData;
    	}
    	catch(err){
    		var ex = JSON.parse(err);
    		updateResp(resultId,ex.message);
    		throw err;
    	}
    }
    
    // get batch id from store deposit rcd.
    function getBatchId(depositRcd){
        var storeDepositId = depositRcd.getValue(mbHelp.gfv('custbody_mb_store_deposit_link'));
        var batchId = null;
        var scheduleBatch = false;
        log.debug("store deposit id",storeDepositId);
        if(storeDepositId){
            var fieldLookUp = search.lookupFields({
                type: 'customrecord_mb_store_deposit',
                id: storeDepositId,
                columns: ['custrecord_mb_store_batch',
                          'custrecord_mb_store_status',
                          'custrecord_mb_store_non_inv_fee_cnt',
                          'custrecord_mb_store_inv_fee_cnt',
                          'custrecord_mb_store_total_inv_cnt',
                          'custrecord_mb_store_response'
                          ]
            });
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_batch')) batchId = fieldLookUp.custrecord_mb_store_batch;
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_status')){
            	var status = fieldLookUp.custrecord_mb_store_status;
            	log.debug("deposit status",status);
            };
            if(status != "Deposit Created") {
            	batchId = null;
            	prettyError('This deposit has been integrated already');
            };
            var feeCnt = 0,invCnt=0 ;
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_non_inv_fee_cnt')){
            	feeCnt = mbformat.parseIntOrZero(fieldLookUp.custrecord_mb_store_non_inv_fee_cnt);
            	log.debug("deposit status",status);
            };
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_inv_fee_cnt')){
            	feeCnt += mbformat.parseIntOrZero(fieldLookUp.custrecord_mb_store_inv_fee_cnt);
            	log.debug("feeCnt",feeCnt);
            };
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_total_inv_cnt')){
            	invCnt = mbformat.parseIntOrZero(fieldLookUp.custrecord_mb_store_total_inv_cnt);
            	log.debug("invCnt",invCnt);
            };
    		var scheduleThreshold =  mbformat.parseIntOrZero(runtime.getCurrentScript().getParameter({name: 'custscript_mb_record_threshold'}));

    		log.debug("invcnt",invCnt);
            log.debug("threshold",scheduleThreshold );
            
            if(invCnt > scheduleThreshold || feeCnt > scheduleThreshold){
            	scheduleBatch = true;
            };
            var status ="";
            if(fieldLookUp.hasOwnProperty('custrecord_mb_store_response')) status = fieldLookUp.custrecord_mb_store_response;
            log.debug("status ",status );

            if(status.indexOf("Script usage limit has been exceeded.")>=0){
            	scheduleBatch = true;
        	};
            
        }
        return ([batchId,scheduleBatch]);
    }

    function getInvoices(batchId)
    {
    	oSearch = new Object();
    	oSearch.type = 'customrecord_mb_store_detail';
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
        var invoiceSearch = search.create(oSearch);
        var invoices ="";
        // log.debug("invoiceSearch",JSON.stringify(invoiceSearch));            
    
        invoiceSearch.run().each(function(result) {
            invoices += result.getValue({name: 'custrecord_mb_store_detail_invoice'}) + ",";
            return true;
        });

        invoices = invoices.substring(0,invoices.length - 1); 
        return {'invoiceSearch' : invoiceSearch, 'invoices' : invoices}; 
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
        
    function prettyError(errorMessage){
    	var errorObj = error.create({
    	    name: 'Invoice Validation',
    	    message: errorMessage,
    	    notifyOff: false
    	});
    	throw errorObj;
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
    	var thisDate = mbformat.getNSCurrentDate();
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
