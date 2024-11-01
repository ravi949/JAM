/**
 * 
 * 
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       01 Feb 2016     rcm
 *  depends on mbt_notify_error to send mails with errors.
 */

/**
 * @param {String}
 *                type Context Types: scheduled, ondemand, userinterface, aborted, skipped
 * @returns {Void}
 */
const searchDeposits = "customsearch_mb_reverse_accruals_2";
const MINIMUM_USAGE = 1000;

var startDateTime = new Date();
var executionThreshold;
var ccAddressList = ["ar@jampaper.com"];

function scheduled(type) {
	revAccruals();
}

function revAccruals() {
		nlapiLogExecution("debug", 'Start Date time',startDateTime);
		executionThreshold  = nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_minutes');
		
    	var emailBody = ''; // Used to store list of errors that are generated
        var emailSubject = 'List of errors generated in create reverse accrual transactions. ';
        var fromEmail = '-5';
        var toEmail = '1826';
        var retVal;
        try {
            var search = nlapiLoadSearch("customrecord_mb_deposit_accruals", searchDeposits);
            ///search.addFilters(filters);
            var resultSet = search.runSearch();
            var sum = 0 ;
            resultSet.forEachResult(function(searchResult) {
    		    nlapiLogExecution("debug", "SR", JSON.stringify(searchResult));
            	var depositId = searchResult.getValue("custrecord_mb_store_deposit_link",null,null);
               	if(emptyIfNull(depositId)!=""){
               		var flds = nlapiLookupField("customrecord_mb_store_deposit", depositId, ["custrecord_mb_store_batch","custrecord_mb_store_customer"] );
               		var batchId = flds.custrecord_mb_store_batch;
               		var entityId = flds.custrecord_mb_store_customer;
               	}

               	var bankDepositId = searchResult.getValue("custrecord_mb_deposit_id",null,null);

               	if(emptyIfNull(bankDepositId)!=""){
               		flds = nlapiLookupField("deposit", bankDepositId, ["subsidiary","class","trandate","currency","exchangerate"] );
               		var sub = flds.subsidiary;
               		var classId  = flds.class;
               		var tranDate  = flds.trandate;
               		var currency  = flds.currency;
               		var exchangeRate = parseFloatOrZero(flds.exchangerate);
               		exchangeRate = exchangeRate <=0 ? 1 : exchangeRate; 
               	}
               	
               	var oDepositInfo = new Object();
            	oDepositInfo.entityId =  entityId;
    		    oDepositInfo.sub = sub;
    		    oDepositInfo.channel= classId;
    		    oDepositInfo.trandate = tranDate;
    		    oDepositInfo.transId = bankDepositId;
    		    oDepositInfo.pointerId = searchResult.getId();
    		    oDepositInfo.batchId =  batchId;
    		    oDepositInfo.currency = currency;
    		    oDepositInfo.exchangeRate = exchangeRate;
    		    nlapiLogExecution("debug", "oDepositInfo", JSON.stringify(oDepositInfo));
            		    		
    		    retVal = buildCustomTran(oDepositInfo);
    		    if((typeof(retVal) == "string") && isNaN(retVal)){
    		    	emailBody += retVal +'\n';
    		    	nlapiLogExecution("debug", "Exit script retval", emailBody);
    		    }
    		    if(retVal == "999"){
    		    	emailBody = " Script was terminated because of governance (usage or time) or a runtime error (check logs).";
    		    	return false;
    		    }
    		    if(retVal == "888"){
    		    	emailBody += " A runtime error occurred (most likely a search timeout) on batch (~1) \n ".replace("~1",batchId);
    		    }
    		    
    			if (checkGovernance("77")) {
					retVal ="999";
					return false;
    			}
    		    
            	return true; // return true to keep iterating
            });
        }
        catch (e) {
        	var error = errText(e);
        	nlapiLogExecution("error", "suiteScript has encountered an error.", error);
        	emailBody += '\nThere was a netsuite error applying Month End Accruals.\n\n\n' + error;
        }
        if(retVal!="999"){
            // calling batch stamp script after execution
            var stampBatchStatus = nlapiScheduleScript('customscript_mb_sched_revaccruals_batch');
            nlapiLogExecution('audit','Scheduled Scheduled Stamp Invoice Fees Script','Script name is: MB_Sched_RevAccruals_StampBatch, status: '+stampBatchStatus);
        }
        // Notifying errors by Emails
        if (emailBody != '') {
        	emailBody = 'Please find the list of errors running the Reverse Accruals: \n' + emailBody;
		    sendErrorInfo(fromEmail, toEmail, emailSubject, emailBody);
        };
        
        // End of Notify Errors block
}
function sendErrorInfo(fromEmail,toEmail,emailSubject,emailBody) {
    
	try{
		if(emailBody && fromEmail && toEmail){
			nlapiSendEmail(fromEmail, toEmail, emailSubject, emailBody,ccAddressList);
		}
	}catch(e){
		nlapiLogExecution('error', 'There was a error while sending a mail', e);
	}
}
function parseFloatOrZero(val) {
    	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}
var customTran = null;
var oCustomTranPublic = {
        entityName : "customtransaction_mb_accruals",
        itemSubList : "line",
        getOut : false,
        searchError : false,
        tranRefField : "custbody_mb_tran_link",
        // create the custom transaction rcd, store the transaction reference and return the rcd.
        insertRecord : function(oDepositInfo) {
            try {
            	var customTran = nlapiCreateRecord(this.entityName,{recordmode: 'dynamic'});
            	customTran.setFieldValue("subsidiary", oDepositInfo.sub);
            	customTran.setFieldValue("currency",oDepositInfo.currency);
            }
            catch (e) {
            	nlapiLogExecution("error", "suiteScript has encountered an error.", errText(e));
            	customTran = "Insert failed - Error message is logged ";
            }
            return (customTran);
        },
        
        addLines : function(oDepositInfo) {
        	var addLineData = {};
        	addLineData.storedLines = false;
        	addLineData.error = null;
            var batchId  = oDepositInfo.batchId;
			nlapiLogExecution('DEBUG', 'Getout ',this.getOut);
			nlapiLogExecution('DEBUG', 'customtran ',JSON.stringify(this));
            try{
           		var actualFees = this.getActualFees(batchId);
           		if(!this.getOut){
               		if(actualFees !=null && actualFees.length > 0){
               		    for (var j = 0; j < actualFees.length; j++) {
                    		addLineData.storedLines = true;
                    		this.addCustomLine(actualFees[j],customTran,oDepositInfo,false);
                    		if (checkGovernance("151")) {
        						this.getOut = true ; break;
                    		}
               		    }
               		}
           		}
       		    if(this.getOut){
					nlapiLogExecution('AUDIT', 'Getout tripped after actual');
       		    	return(addLineData);
       		    }
                nlapiLogExecution("DEBUG", "start estimated fees", new Date());
           		// reverse estimated fees.
           		var invoices = this.getInvoices(batchId,oDepositInfo.transId);
           		if(!this.getOut){
               		if(invoices != null && invoices.length >0){
               			            			
                    	var estimatedFees = this.getEstimatedFees(invoices,
//                    			'customsearch_mb_search_estimated_fees' , 'Estimated Fees - Accrual (CODE LINKED SEARCH) ');
                    	'customsearch_mb_search_estimated_fees_4' ,'Estimated Fees - Accrual ALT (CODE LINKED SEARCH) ');
                        nlapiLogExecution("DEBUG", "length estimated fees", estimatedFees.length);
                    	if(estimatedFees !=null && estimatedFees.length > 0){
                   		    for (var k = 0; k < estimatedFees.length; k++) {
                        		addLineData.storedLines = true;
                        		this.addCustomLine(estimatedFees[k],customTran,oDepositInfo,true);
                        		if (checkGovernance("174")) {
            						this.getOut = true ; break;
                        		}
                   		    }
                   		}
               		}
           		}
                return (addLineData);
            }
            catch (e) {
        		var error = errText(e);
            	addLineData.error = errText;
        		nlapiLogExecution("error","suiteScript has encountered an error.",error);
        		return addLineData;
        	}

        },
        addCustomLine: function (fee,customTran,oDepositInfo,estimated){
			var cols = fee.getAllColumns();
        	var accountDebit = fee.getValue(cols[0]);
        	var accountCredit = fee.getValue(cols[1]);
			if(emptyIfNull(accountDebit) =="" || emptyIfNull(accountCredit) =="") return
			
        	var amount = parseFloat(fee.getValue(cols[2]));			
        	if(estimated){
            	accountDebit = fee.getValue(cols[1]);
            	accountCredit = fee.getValue(cols[0]);
        		nlapiLogExecution("debug","fee.getValue(cols[2]) ",fee.getValue(cols[2]) + '@@@@@@exchangeRate ' +oDepositInfo.exchangeRate + '###'+accountDebit + '###'+accountCredit);

				if (oDepositInfo.exchangeRate > 1)
				{
					var amount = roundVal(parseFloat(fee.getValue(cols[2])) / oDepositInfo.exchangeRate);
				}
				else
				{
					var amount = roundVal(parseFloat(fee.getValue(cols[2])));// * oDepositInfo.exchangeRate);            	
				}

        	}       	

        	if(amount<0) {
        		amount = Math.abs(amount);
            	accountDebit = fee.getValue(cols[1]);
            	accountCredit = fee.getValue(cols[0]);            	               	
        	}
        	if(!estimated && fee.getValue(cols[4]) == 1){
            	accountDebit = fee.getValue(cols[0]);
            	accountCredit = fee.getValue(cols[1]);
        	}
        	oDepositInfo.channel = fee.getValue(cols[3])
  
        	var memo= "";
    		// add new line
        	if(emptyIfNull(accountDebit)!=""){
        		this.addLine(customTran, accountDebit, amount, oDepositInfo, "D", memo,estimated)
        	}

        	if(emptyIfNull(accountCredit)!=""){
        		this.addLine(customTran, accountCredit, amount, oDepositInfo, "C", memo,estimated)
        	}
        },
        
        // add line function used to update the lines sublist
        addLine : function(rcdType, account, amount, oDepositInfo , type, memo,estimated) {
            var entityId = oDepositInfo.entityId;
//            nlapiLogExecution("debug", "custom line entity", entityId);
            var channel = oDepositInfo.channel;
//            nlapiLogExecution("debug", "custom line channel", channel);
//            nlapiLogExecution("debug", "amount", amount);
//            nlapiLogExecution("debug", "account", account);
            try{
                if (emptyIfNull(amount) != "" && !isNaN(amount)) {
                	rcdType.selectNewLineItem(this.itemSubList);
                	rcdType.setCurrentLineItemValue(this.itemSubList, "account", account);
                	rcdType.setCurrentLineItemValue(this.itemSubList, "amount", amount);
                	var typeField = (type == "D" ? "debit" : "credit");
                	rcdType.setCurrentLineItemValue(this.itemSubList, typeField, amount);
                	rcdType.setCurrentLineItemValue(this.itemSubList, "memo", memo);
                	rcdType.setCurrentLineItemValue(this.itemSubList, "entity", entityId);
                	rcdType.setCurrentLineItemValue(this.itemSubList, "class", channel);
                	rcdType.setCurrentLineItemValue(this.itemSubList, "custcol_mb_estimated", estimated ? "T": "F");
                	rcdType.commitLineItem(this.itemSubList);
                }
            // nlapiLogExecution("DEBUG",account);
            }
            catch(e){
            	var error = errText(e);
            	nlapiLogExecution("error","suiteScript has encountered an error.",error);
            }
        },
        
        // remove all lines from custom transaction
        removeLines : function(customTran) {
            // Remove line items
            var lines = customTran.getLineItemCount(this.itemSubList);
            for (var i = lines; i >= 1; i--) {
            	customTran.removeLineItem(this.itemSubList, i);
            }
        },
        
        getActualFees : function (batchId){
			var filter = new Array();
			filter.push(new nlobjSearchFilter("custrecord_mb_store_fees_batch", null, "is", batchId));
			
			var searchResults = generateSavedSearchResults( 'customsearch_mb_search_actual_fees' , 'Actual Fees Search (CODE LINKED SEARCH)' , filter , 'T' );
			if(searchResults[2] == 1){
				this.getOut = true;
				nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search becuase of governance');
			}
			if(searchResults[2] == 2){
				this.getOut = true; this.searchError = true;
				nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search because of a runtime error ');
			}
			
			nlapiLogExecution( 'AUDIT', 'actual fee Search Results length is ', searchResults[0].length );
            return (searchResults[0])
        },
        getEstimatedFees: function (invoices,searchId,searchName){
        	
            var id = 0;var estimatedFees =new Array();
            do{
            	var newinvoices = invoices.slice(id,id+1000);
            	id	+= 1000;
            	nlapiLogExecution("debug", "new invoice count", newinvoices.length);
                var filter = new Array();
            	////////filter.push(new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", newinvoices));
             	filter.push(new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", newinvoices));
            	
//            	str = JSON.stringify(newinvoices);
//            	nlapiLogExecution("debug", "JSON "+str.length, str.substr(0,3999));
//            	nlapiLogExecution("debug", "JSON+1", str.substr(3999,3999));
            	
            	var estimatedFeesSlice = generateSavedSearchResults( searchId,searchName , filter , 'T' );
    			if(estimatedFeesSlice[2] == 1 ){
    				nlapiLogExecution( 'AUDIT', 'getout tripped in estimated fee Search governance');
    				this.getOut = true; break;
    			}
    			if(estimatedFeesSlice[2] == 2 ){
    				nlapiLogExecution( 'AUDIT', 'getout tripped in estimated fee Search runtime');
    				this.getOut = true; this.searchError = true; break;
    			}
    			
    			estimatedFees = estimatedFees.concat(estimatedFeesSlice[0]);
            	nlapiLogExecution( 'AUDIT', 'est fee Search Results length is ', estimatedFees.length );
            	
            } while (newinvoices.length >= 1000);

            var searchResultsNew = estimatedFees.filter(
            	function (searchResult){
            		if(searchResult.getValue("custrecord_mb_reversible_fee","CUSTRECORD_MB_FEE_ID","group") == "T"){
//            			nlapiLogExecution( 'DEBUG', 'worked dummy ',"")
            			return searchResult;
            		}
            	}
            );
        	nlapiLogExecution( 'AUDIT', 'cooked Search Results length is ', searchResultsNew.length );
            return (searchResultsNew)

        },
        //
        // return an array of invoices paid off in this batch, new code filters here cause NS cant filter it w/o a timeout
        //
        getInvoices :  function (batchId,depositId){

         	var invoices = new Array();
			var filter = new Array();
			filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
        	
			var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoice_2' , 'Accruals Invoice Search ALT (CODE LINKED SEARCH)' , filter , 'T' );
			if(searchResults[2] == 1){
				this.getOut = true;
				nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search governance');
				return null;
			}
			if(searchResults[2] == 2){
				this.getOut = true;this.searchError = true;
				nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search runtime error');
				return null;
			}
             if (searchResults[0]) {
     			nlapiLogExecution( 'AUDIT', 'getinvoices Search Results length is ', searchResults[0].length );
     			var searchResults = searchResults[0];
     	    	invoices = searchResults.map(
     	        		function (searchResult){

     	        			if(searchResult.getValue("applyingtransaction","custrecord_mb_store_detail_invoice") == depositId){
     	        				 return searchResult.getValue("custrecord_mb_store_detail_invoice");
     	        			}
     	        		}
     	        );
     	        nlapiLogExecution("DEBUG", "Invoices array count", invoices.length);
     	                
     	    	var paidInvoices = invoices.filter(function(item, index){
     	    			return invoices.indexOf(item) >= index;
     	    	});
     	    	
     	    	nlapiLogExecution("DEBUG","paidInvoices  length", paidInvoices.length);
     	    	
             }
             return paidInvoices;
        },
//        //
//        // return an array of invoices paid off in this batch
//        //
//        getInvoicesOLD :  function (batchId,depositId){
//
//         	var invoices = new Array();
//			var filter = new Array();
//			filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
//        	filter.push(new nlobjSearchFilter("applyingtransaction","custrecord_mb_store_detail_invoice","anyof",depositId));
//
//			var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoices' , 'Accruals Invoice Search (CODE LINKED SEARCH)' , filter , 'T' );
//			if(searchResults[2] == 1){
//				this.getOut = true;
//				nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search governance');
//				return null;
//			}
//			if(searchResults[2] == 2){
//				this.getOut = true;this.searchError = true;
//				nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search runtime error');
//				return null;
//			}
//             if (searchResults[0]) {
//     			nlapiLogExecution( 'AUDIT', 'getinvoices Search Results length is ', searchResults[0].length );
//             	var lastInvoice = "";
//                 for (var j = 0; j < searchResults[0].length; j++) {
//             		if(lastInvoice != searchResults[0][j].getValue("custrecord_mb_store_detail_invoice")){
//             			lastInvoice = searchResults[0][j].getValue("custrecord_mb_store_detail_invoice")
//             			invoices.push(lastInvoice);
//             		}
//                 }
//             }
//             return invoices;
//        },

        // delete the record when an referenced transaction gets changed.
        getRecord : function(recordId) {
            // var recordId = this.getRcdId(customerId, itemId);
            var customTran = null;
            try {
            	if (recordId) {
            	    customTran = nlapiLoadRecord(this.entityName, recordId);
            	}
            }
            catch (e) {
            	nlapiLogExecution("error", "suiteScript has encountered an error.", errText(e));
            	customTran = "Find failed - Error message is logged ";
            }
            return customTran;
        },
        
        // delete the record when an referenced transaction gets changed.
        deleteRecord : function(recordId) {
            try {
            	if (recordId) {
//            	    var customTran = nlapiLoadRecord(this.entityName, recordId);
//            	    if (customTran) {
            	    	nlapiDeleteRecord(this.entityName, recordId);
            	    	return 0;
//            	    }
            	}
            }
            catch (e) {
            	nlapiLogExecution("error", "suiteScript has encountered an error.", errText(e));
            	return "Delete failed - Error message is logged ";
            }
        },
        // create the custom transaction rcd, store the transaction reference and return the rcd.
        updateRecord : function(customTran, oDepositInfo) {
            try {

            	//date = nlapiDateToString(oDepositInfo.trandate, 'date');
            	customTran.setFieldValue("custbody_mb_linked_customer", oDepositInfo.entityId);
            	customTran.setFieldValue(this.tranRefField, oDepositInfo.transId);
            	nlapiLogExecution("debug","trandate",oDepositInfo.trandate);
            	customTran.setFieldValue("trandate", oDepositInfo.trandate);
            	customTran.setFieldValue("transtatus", "A");
    //        	customTran.setFieldText("postingperiod", oDepositInfo.period);
//            	customTran.setFieldValue("subsidiary", oDepositInfo.sub);
//            	nlapiLogExecution("debug","rec",JSON.stringify(customTran));
            	var rTranId = nlapiSubmitRecord(customTran);

				if(emptyIfNull(oDepositInfo.pointerId)!=""){
				    rcdDeposit = nlapiLoadRecord("customrecord_mb_deposit_accruals",oDepositInfo.pointerId);
				    rcdDeposit.setFieldValue("custrecord_mb_deposit_accrual_link",rTranId,false);
				    nlapiSubmitRecord(rcdDeposit);
				    //nlapiSubmitField('invoice',transId,this.tranRefField,rTranId,false);
				}
            	
            }
            catch (e) {
            	var error = errText(e);
            	nlapiLogExecution("error", "suiteScript has encountered an error.", error);
            	return error;
            }
            return (rTranId);
} };
function buildCustomTran(oDepositInfo) {
    var retVal = "0"; // just in case something goes wrong it wont thow an empty exception
    var oCustomTran = oCustomTranPublic;
    try {

///		if(rTransId) retVal = oCustomTran.deleteRecord(rTransId);
    	customTran = null;
    	customTran = oCustomTran.insertRecord(oDepositInfo);
    	oCustomTran.searchError = false;
    	oCustomTran.getOut = false;
    	nlapiLogExecution("debug", "after");
    	if (!(typeof customTran == "string")) {
    		var addLineData = oCustomTran.addLines(oDepositInfo);
    		if(!oCustomTran.getOut){
        			
        	    if (addLineData.storedLines)
        	    	retVal = oCustomTran.updateRecord(customTran, oDepositInfo);
        	    else{
        	    	// set the check flag so deposit records dont keep getting scanned when they dont have any lines to post. i.e. No custom tran needs to be created.
        	    	// only when its not false because it threw.
        	    	if(addLineData.error == null){
        				if(emptyIfNull(oDepositInfo.pointerId)!=""){
        				    rcdDeposit = nlapiLoadRecord("customrecord_mb_deposit_accruals",oDepositInfo.pointerId);
        				    rcdDeposit.setFieldValue("custrecord_mb_batch_checked","T");
        				    nlapiSubmitRecord(rcdDeposit);
            	    	}
        	    	}
        	    	else {
        	    		retVal = "Error:" + addLineData.error;
        	    	}
        	    }
    	    }
    		else{
    			retVal = "999";			// 999 = Governance error stop
    			if(oCustomTran.searchError) retVal = "888";  		// 888 search error keep going.
    		}
    	}
    	else
    	    retVal = "Error:" + customTran;
    }
    catch (e) {
    	var error = errText(e);
    	nlapiLogExecution("error", "suiteScript has encountered an error.", error);
    	return error;
    }
    return retVal;
}
/*************** Start Processing Saved Search *********/
//Processing the saved search
function generateSavedSearchResults( savedSearchId , savedSearchName , addFilters , enableAddFilters ) {
	var generatedResults = new Array();
	var searchColumns    = new Array();
	var getout = 0;
	if( (addFilters != '' && addFilters != null) || enableAddFilters != 'T' ){
		try{
			//Executing a Saved search with received savedSearchId
			var recordSearch=nlapiLoadSearch('', savedSearchId );
			if( addFilters != '' && addFilters != null && enableAddFilters == 'T' ){
				recordSearch.addFilters( addFilters );
			}
			var resultSet=recordSearch.runSearch();
			var resultslice = '';
			var id=0;
//			nlapiLogExecution("debug", "sr length", resultSet.length);
			
			for(var i=0 ; resultslice.length >= 1000 || i ==0 ; i++){
				if (checkGovernance("455")) {
					getout = 1; break;
				}

				resultslice = resultSet.getResults(id, id+1000 );
				if (resultslice != null && resultslice != ''){
					generatedResults = generatedResults.concat(resultslice);
					id += resultslice.length;
				}
//				nlapiLogExecution("debug", "output length", generatedResults.length);
			}
			if(getout == 1){
				nlapiLogExecution("audit", "getout tripped in genss");
				return [generatedResults , searchColumns,getout];
			}
			searchColumns = recordSearch.getColumns();
			return [generatedResults , searchColumns,getout];
		}catch(ERR_SavedSearch){
			nlapiLogExecution('ERROR','Error in SavedSearch '+savedSearchName+' : ',JSON.stringify(ERR_SavedSearch));
			getout = 2;
			return [generatedResults , searchColumns,getout];
		}
	}
	return [generatedResults , searchColumns,getout ];
}
/*************** End Processing Saved Search *********/

function setRecoveryPoint() {
    var state = nlapiSetRecoveryPoint();
    if (state.status == 'SUCCESS')	return;
    if (state.status == 'RESUME') {
    	nlapiLogExecution("ERROR", "Resuming script because of " + state.reason + ".  Size = " + state.size);
    	return;
    }
    else
    	if (state.status == 'FAILURE') {
    	    nlapiLogExecution("ERROR", "Failed to create recovery point. Reason = " + state.reason + " / Size = " + state.size);
    	}
}

function checkGovernance(lineNo) {
    var context = nlapiGetContext();
    if (context.getRemainingUsage() < MINIMUM_USAGE) {
//    	var state = nlapiYieldScript();
//    	if (state.status == 'FAILURE') {
//    	    nlapiLogExecution("ERROR", "Failed to yield script, exiting: Reason = " + state.reason + " / Size = " + state.size);
//    	    throw "Failed to yield script";
//    	}
    	nlapiLogExecution('AUDIT', 'Scheduled Script', 'Not enough usage left(' + context.getRemainingUsage() + '). Exiting and rescheduling script. Line: ~1'.replace("~1",lineNo));
		var scriptId = context.getScriptId();
		var status = nlapiScheduleScript(scriptId);
		nlapiLogExecution('AUDIT', 'Scheduled Script schedule status', status);
    	return true;
    }
    
    if(executionTimesUp()){
     	nlapiLogExecution('AUDIT', 'Scheduled Script', 'Time limit exceeded. Script has been rescheduled to avoid a script timeout. Exiting and rescheduling script. Line: ~1'.replace("~1",lineNo));
		var scriptId = context.getScriptId();
		var status = nlapiScheduleScript(scriptId);
		nlapiLogExecution('AUDIT', 'Scheduled Script schedule status', status);
     	return true;
    }
    return false;
}

function executionTimesUp(){
	var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
	var minutesRunning = Math.floor((timeElapsed/1000)/60);
	return (minutesRunning >executionThreshold);
}

function errText(_e) {
    _internalId = nlapiGetRecordId();
    if (!(typeof _internalId === "number" && (_internalId % 1) === 0)) {
	_internalId = 0;
    }
    var txt = "";
    if (_e instanceof nlobjError) {
    	// this is netsuite specific error
    	txt = "SuiteScript Error: Record ID :: " + _internalId + " :: " + _e.getCode() + " :: " + _e.getDetails() + " :: " + _e.getStackTrace().join(", ");
    }
    else {
    	// this is generic javascript error
    	txt = "JavaScript/Other Error: Record ID :: " + _internalId + " :: " + _e.toString() + " : " + _e.stack;
    }
    return txt;
}

function roundVal(val) {
    var dec = 2;
    var result = Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
    return result;
}
function emptyIfNull(val) {
    return val == null ? "" : val;
}
