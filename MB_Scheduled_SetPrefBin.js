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
//const searchToRun = "customsearch509";
const searchToRun = "customsearch_mb_items_wout_preferred_bin";
const MINIMUM_USAGE = 200;


function scheduled(type) {
    try {
        var count = 0 ; var errorCount = 0 ;
		var resultSet = generateSavedSearchResults( searchToRun , 'Preferred bin' , null, 'F' )[0];
	    if (resultSet) {
	        for (var j = 0; j < resultSet.length; j++) {
	        	if(errorCount >= 10) break;
	        	var searchResult = resultSet[j];
	        	var itemId = searchResult.getId();
	        	try{
	            	var rcdItem = nlapiLoadRecord('inventoryitem',itemId);
	            	if(rcdItem){
	            		var manufacturer = rcdItem.getFieldValue("manufacturer");
	            		rcdItem.setFieldValue("manufacturer",manufacturer);
	            		// just done to fire ue
	                	nlapiSubmitRecord(rcdItem);
	                	count++;
//	                	if(count == 5) return false;
	            	}
	            	else{
	                	nlapiLogExecution("debug", "not changed",invoiceId)
	                	errorCount++;
	            	}
	        	}
	            catch(err){
	            		nlapiLogExecution("error","Error",JSON.stringify(err));
	                	errorCount++;
	            }
				if (nlapiGetContext().getRemainingUsage() <= MINIMUM_USAGE) {
				    nlapiLogExecution('AUDIT', 'Scheduled Script', 'Not enough usage left(' + nlapiGetContext().getRemainingUsage() + ') . Exiting and rescheduling script.');
//				    setRecoveryPoint();
//				    checkGovernance();
					var scriptId = nlapiGetContext().getScriptId();
					var status = nlapiScheduleScript(scriptId);
					nlapiLogExecution('AUDIT', 'Scheduled Script schedule status', status);
					break;
				}
	        }
	    }
		nlapiLogExecution("DEBUG","count",count);
		nlapiLogExecution("DEBUG","errorcount",count);
    }
    catch (e) {
    	var error = errText(e);
    	nlapiLogExecution("error", "suiteScript has encountered an error.", error);
    }
}

function parseFloatOrZero(val) {
    	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}
function setRecoveryPoint() {
	try{ throw "ignoreme"; }catch(noop){};   // per SA 226112
    var state = nlapiSetRecoveryPoint();
    if (state.status == 'SUCCESS') 	return;
    if (state.status == 'RESUME') {
    	nlapiLogExecution("ERROR", "Resuming script because of " + state.reason + ".  Size = " + state.size);
    	return;
    }
    else
	if (state.status == 'FAILURE') {
	    nlapiLogExecution("ERROR", "Failed to create recovery point. Reason = " + state.reason + " / Size = " + state.size);
	}
}

function checkGovernance() {
    var context = nlapiGetContext();
    if (context.getRemainingUsage() < MINIMUM_USAGE) {
    	var state = nlapiYieldScript();
    	if (state.status == 'FAILURE') {
    		nlapiLogExecution("ERROR", "Failed to yield script, exiting: Reason = " + state.reason + " / Size = " + state.size);
    		throw "Failed to yield script";
    	}
    }
}

function errText(_e) {
    _internalId = nlapiGetRecordId();
    if (!(typeof _internalId === "number" && (_internalId % 1) === 0)) {
	_internalId = 0;
    }
    var txt = "";
    if (_e instanceof nlobjError) {
	// this is netsuite specific error
	txt = "NLAPI Error: Record ID :: " + _internalId + " :: " + _e.getCode() + " :: " + _e.getDetails() + " :: " + _e.getStackTrace().join(", ");
    }
    else {
	// this is generic javascript error
	txt = "JavaScript/Other Error: Record ID :: " + _internalId + " :: " + _e.toString() + " : " + _e.stack;
    }
    return txt;
}

function emptyIfNull(val) {
    return val == null ? "" : val;
}
/*************** Start Processing Saved Search *********/
//Processing the saved search
function generateSavedSearchResults( savedSearchId , savedSearchName , addFilters , enableAddFilters ) {
	var generatedResults = new Array();
	var searchColumns    = new Array();
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
			nlapiLogExecution("debug", "sr length", resultSet.length);
			
			for(var i=0 ; resultslice.length >= 1000 || i ==0 ; i++){
				if (nlapiGetContext().getRemainingUsage() <= MINIMUM_USAGE) {
				    nlapiLogExecution('AUDIT', 'Scheduled Script', 'Not enough usage left(' + nlapiGetContext().getRemainingUsage() + ') . Exiting and rescheduling script.');
				    setRecoveryPoint();
				    checkGovernance();
				}

				resultslice = resultSet.getResults(id, id+1000 );
				if (resultslice != null && resultslice != ''){
					generatedResults = generatedResults.concat(resultslice);
					id += resultslice.length;
				}
				nlapiLogExecution("debug", "output length", generatedResults.length);
			}
			searchColumns = recordSearch.getColumns();
			return [generatedResults , searchColumns ];
		}catch(ERR_SavedSearch){
			nlapiLogExecution('ERROR','Error Occured in Processing SavedSearch('+savedSearchName+':'+savedSearchId+') Results Block ',ERR_SavedSearch);
			return [generatedResults , searchColumns ];
		}
	}
	return [generatedResults , searchColumns ];
}
/*************** End Processing Saved Search *********/

function sendErrorInfo(fromEmail,toEmail,emailSubject,emailBody) {
	try{
		if(emailBody && fromEmail && toEmail){
			
			nlapiSendEmail(fromEmail, toEmail, emailSubject, emailBody);
			
		}
	}catch(e){
		nlapiLogExecution('error', 'There was a error while sending a mail', e);
	}
	
}