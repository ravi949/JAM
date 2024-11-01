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
const searchDeposits = "customsearch_mb_reverse_accruals_2_2";

const MINIMUM_USAGE = 100;

var getOut = false;
var searchError = false;

var startDateTime = new Date();
var executionThreshold;


function scheduled(type) {
	nlapiLogExecution("debug", 'Start Date time',startDateTime);
	executionThreshold  = nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_minutes');
	revAccruals();
}

function revAccruals() {
    	var emailBody = ''; // Used to store list of errors that are generated
        var emailSubject = 'List of errors generated in batch stamping ';
        var fromEmail = '-5';
        var toEmail = '1826';
    
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
               		flds = nlapiLookupField("deposit", bankDepositId, ["subsidiary","class","trandate"] );
               		var sub = flds.subsidiary;
               		var classId  = flds.class;
               		var tranDate  = flds.trandate;
               	}
               	
               	var oDepositInfo = new Object();
            	oDepositInfo.entityId =  entityId;
    		    oDepositInfo.sub = sub;
    		    oDepositInfo.channel= classId;
    		    oDepositInfo.trandate = tranDate;
    		    oDepositInfo.transId = bankDepositId;
    		    oDepositInfo.pointerId = searchResult.getId();
    		    oDepositInfo.batchId =  batchId;
    		    
    		    nlapiLogExecution("debug", "oDepositInfo", JSON.stringify(oDepositInfo));
            		    		
    		    //var retVal = buildCustomTran(oDepositInfo);
//    		    if((typeof(retVal) == "string") && isNaN(retVal)){
//    		    	emailBody += retVal +'\n';
//    		    	nlapiLogExecution("debug", "email", emailBody);
//    		    }
    		    
    		    var check = stampBatch(oDepositInfo);
    		    
    		    if (typeof check == 'boolean'){
    		    	if(check == true){
    		    		nlapiSubmitField('customrecord_mb_deposit_accruals',searchResult.getId(),"custrecord_mb_setbatch",'T',false);
    		    	}
    		    	// getOut was tripped. if its not a search err then its a governance error.
    		    	// if searcherr is true it will go to then next anyway.
    		    	else{
    		    		if(searchError){
    		    			emailBody += " A runtime error occurred (most likely a search timeout) on batch (~1) \n ".replace("~1",batchId);
    		    			searchError = false;
    		    		}
    		    		else return false; // stampBatch return a false get out for govern error
    		    	}
    		    }
    		    if (typeof check == 'string'){
    		    	emailBody + '\nThere was a netsuite error stamping estimated fees with the batch id.\n\n\n' + check;
    		    	return false;
    		    }
    			if (checkGovernance("99")) {
					return false;
    			}
    		    
            	return true; // return true to keep iterating
            });
        }
        catch (e) {
        	var error = errText(e);
        	nlapiLogExecution("error", "suiteScript has encountered an error.", error);
        	emailBody = emailBody + '\nThere was a netsuite error applying stamping estimated fees with the batch id.\n\n\n' + error;
        }
        // Notifying errors by Emails
        if (emailBody != '') {
        	emailBody = 'Please find the list of errors running Month End Accrual stamp batch: \n ' + emailBody;
		    sendErrorInfo(fromEmail, toEmail, emailSubject, emailBody);
        };
    
        // End of Notify Errors block
}
function sendErrorInfo(fromEmail,toEmail,emailSubject,emailBody) {
    
	try{
		if(emailBody && fromEmail && toEmail){
			nlapiSendEmail(fromEmail, toEmail, emailSubject, emailBody);
		}
	}catch(e){
		nlapiLogExecution('error', 'There was a error while sending a mail', e);
	}
}
	
function parseFloatOrZero(val) {
    	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}

function stampBatch(oDepositInfo){

	
    var batchId  = oDepositInfo.batchId;
    
    try{
    	
		var invoices = getInvoices(batchId,oDepositInfo.transId);
		if(getOut) return false;
		
		//UNCommented out by Lucas 12/10/2018 /////////////////////////////////////////////
		// set new saved search tomorrow.
    	var estimatedFees = getEstimatedFees(invoices,
    			'customsearch_mb_search_est_fees_no_batch' , 'Estimated Fees - Accrual Details - no batch id (CODE LINKED SEARCH)',
    			oDepositInfo.batchId);
		if(getOut) return false;
		
        nlapiLogExecution("Audit", "length estimated fees", estimatedFees.length);
       // var changed = false;
	    	if(estimatedFees !=null && estimatedFees.length > 0){
	    		
				//return 'true';
				
	   		    for (var k = 0; k < estimatedFees.length; k++) {
	   		    	
	   		    	if(k%1000==0) nlapiLogExecution('AUDIT', 'b4 Scheduled Script '+k.toString(), nlapiGetContext().getRemainingUsage());

	   		    	nlapiSubmitField('customrecord_mb_invoice_fees',estimatedFees[k].getId(),'custrecord_mb_batch',oDepositInfo.batchId,false);
	   		    	//changed=true;
	   		    	
	   		    	nlapiLogExecution('debug','updated invoice fee rec: '+estimatedFees[k].getId());
	   		    	
	   		    	if(k%1000==0) nlapiLogExecution('AUDIT', 'af Scheduled Script', nlapiGetContext().getRemainingUsage());
	
            		if (checkGovernance("174")) {
					    return false;
					}
	    	}
	        return true;
	    }
	    return true;
    }
    catch (e) {
		var error = errText(e);
		nlapiLogExecution("error","suiteScript has encountered an error.",error);
		return error;
	}

}

function getEstimatedFees(invoices,searchId,searchName,batchId){
	
    var id = 0;
    var estimatedFees =new Array();
    
    do{
    	var newinvoices = invoices.slice(id,id+1000);
    	id	+= 1000;
    	nlapiLogExecution("debug", "new invoice count", newinvoices.length);
        var filter = new Array();
    	filter.push(new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", newinvoices));
    	
    	// if the batch is already set dont try to set it again.
    	// script was never completing cause it kept trying to restamp all fees when it restarted due to a usage errorr
    	filter.push(new nlobjSearchFilter("custrecord_mb_batch", null, "isnot", batchId));
    	
    	var searchExec = generateSavedSearchResults( searchId,searchName , filter , 'T' );
		if(searchExec[2] == 1 ){
			nlapiLogExecution( 'AUDIT', 'getout tripped in estimated est fee Search governance');
			getOut = true; searchError = false; break;
			return null;
		}
		if(searchExec[2] == 2 ){
			nlapiLogExecution( 'AUDIT', 'getout tripped in estimated est fee Search runtime');
			getOut = true; searchError = true; break;
			return null;
		}
    	if(searchExec[0]){
    		var estimatedFeesSlice = searchExec[0];
        	estimatedFees = estimatedFees.concat(estimatedFeesSlice);
        	nlapiLogExecution('debug', 'est fee Search Results length is ', estimatedFees.length );
    	}
    	
    } while (newinvoices.length >= 1000);

    return (estimatedFees)

}

//function getInvoicesOLD(batchId,depositId){
//
// 	var invoices = new Array();
//	var filter = new Array();
//	filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
//	filter.push(new nlobjSearchFilter("applyingtransaction","custrecord_mb_store_detail_invoice","anyof",depositId));
//
//	var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoices' , 'Accruals Invoice Search (CODE LINKED SEARCH)' , filter , 'T' )[0];
//	nlapiLogExecution( 'debug', 'getinvoices Search Results length is ', searchResults.length );
//     if (searchResults) {
//     	var lastInvoice = "";
//         for (var j = 0; j < searchResults.length; j++) {
//     		if(lastInvoice != searchResults[j].getValue("custrecord_mb_store_detail_invoice")){
//     			lastInvoice = searchResults[j].getValue("custrecord_mb_store_detail_invoice")
//     			invoices.push(lastInvoice);
//     		}
//         }
//     }
//     return invoices;
//}

    //
    // return an array of invoices paid off in this batch, new code filters here cause NS cant filter it w/o a timeout
    //
function getInvoices(batchId,depositId){
    
     	var invoices = new Array();
    	var filter = new Array();
    	filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
    	
    	var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoice_2' , 'Accruals Invoice Search ALT (CODE LINKED SEARCH)' , filter , 'T' );
    	if(searchResults[2] == 1){
			getOut = true; searchError = false;
    		nlapiLogExecution( 'AUDIT', 'getout tripped in actual fee Search governance');
    		return null;
    	}
    	if(searchResults[2] == 2){
			getOut = true; searchError = true;
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
    }


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
//function generateSavedSearchResultsOLD( savedSearchId , savedSearchName , addFilters , enableAddFilters ) {
//	var generatedResults = new Array();
//	var searchColumns    = new Array();
//	if( (addFilters != '' && addFilters != null) || enableAddFilters != 'T' ){
//		try{
//			//Executing a Saved search with received savedSearchId
//			var recordSearch=nlapiLoadSearch('', savedSearchId );
//			if( addFilters != '' && addFilters != null && enableAddFilters == 'T' ){
//				recordSearch.addFilters( addFilters );
//			}
//			var resultSet=recordSearch.runSearch();
//			var resultslice = '';
//			var id=0;
////			nlapiLogExecution("debug", "sr length", resultSet.length);
//
//			for(var i=0 ; resultslice.length >= 1000 || i ==0 ; i++){
//
//				if (nlapiGetContext().getRemainingUsage() <= MINIMUM_USAGE) {
//				    nlapiLogExecution('AUDIT', 'Scheduled Script', 'Not enough usage left(' + nlapiGetContext().getRemainingUsage() + ') . Exiting and rescheduling script.');
//					var scriptId = nlapiGetContext().getScriptId();
//					var status = nlapiScheduleScript(scriptId);
//					nlapiLogExecution('AUDIT', 'Scheduled Script schedule status', status);
//				}
//
//				resultslice = resultSet.getResults(id, id+1000 );
//				if (resultslice != null && resultslice != ''){
//					generatedResults = generatedResults.concat(resultslice);
//					id += resultslice.length;
//				}
////				nlapiLogExecution("debug", "output length", generatedResults.length);
//			}
//			searchColumns = recordSearch.getColumns();
//			return [generatedResults , searchColumns ];
//		}catch(ERR_SavedSearch){
//			nlapiLogExecution('ERROR','Error Occured in Processing SavedSearch('+savedSearchName+':'+savedSearchId+') Results Block ',ERR_SavedSearch);
//			return [generatedResults , searchColumns ];
//		}
//	}
//	return [generatedResults , searchColumns ];
//}

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

