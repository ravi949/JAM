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
const searchMTD = "customsearch_mb_reclass_uas";
const MINIMUM_USAGE = 100;

function scheduled(type) {

	// get params ........................
	var storeDepositId = nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_store_depositid');
	var userId = nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_user_id');
    nlapiLogExecution('debug','deposit id ',storeDepositId);
    nlapiLogExecution('debug','user id ',userId);
    var resp = "Deposit could not be created";
    
	if(storeDepositId){
		var depositRcd = nlapiLoadRecord( 'customrecord_mb_store_deposit',storeDepositId);
		if(depositRcd){
			if(depositRcd.getFieldValue('custrecord_mb_store_status') != "Deposit Created"){
				buildDepositRcd(depositRcd);
				resp = "Deposit was created";
			}
		}
	}

	var fromEmail  = -5;
    var toEmail = userId;
    var subject = 'Scheduled Deposit Creation status! ~1'.replace('~1',resp);
    var body = "The Deposit record for this Store Deposit has been created." +'\n' +
    			'<a href="~1">Deposit Record</a>'.replace("~1",resolveRecordUrl(storeDepositId));
	sendErrorInfo(fromEmail,toEmail,subject,body)
}

function resolveRecordUrl(storeDepositId){
	return nlapiResolveURL("RECORD", "customrecord_mb_store_deposit", storeDepositId);
}

/*
function reclassUAS(period,monthEndDate) {
    	var emailBody = ''; // Used to store list of errors that are generated
        var emailSubject = 'List of errors generated in reclassing Unapplied splits. ';
        var fromEmail = '4737';
        var toEmail = 'yellowstone@mibar.net';
    
        try {
            nlapiLogExecution('debug','start search',period);
            var search = nlapiLoadSearch('transaction', searchMTD);
            var filters = [ new nlobjSearchFilter("formulatext", null, "is", "yes", null).setFormula("case when {postingperiod} = '"+period+ "' then 'yes' else 'no' end")
            			];
            search.addFilters(filters);
            var resultSet = search.runSearch();
            var sum = 0 ;
            resultSet.forEachResult(function(searchResult) {
            	var dbAmount = searchResult.getValue('debitamount',null,'sum');
        	return true; // return true to keep iterating
            });
        }
        catch (e) {
        	var error = errText(e);
        	nlapiLogExecution("error", "suiteScript has encountered an error.", error);
        	emailBody = emailBody + '\nThere was a netsuite error while reclassifying Unapplied Splits.\n\n\n' + error;
        }
        // Notifying errors by Emails
        if (emailBody != '') {
        	emailBody = 'Hi, \n Please find the list of errors that are encountered reclassing Unapplied splits: ' + emailBody;
        	sendErrorInfo(fromEmail, toEmail, emailSubject, emailBody);
        };
    
        // End of Notify Errors block
}
*/
function parseFloatOrZero(val) {
    	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}
function setRecoveryPoint() {
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

function sendErrorInfo(fromEmail,toEmail,emailSubject,emailBody) {
	try{
		if(emailBody && fromEmail && toEmail){
			
			nlapiSendEmail(fromEmail, toEmail, emailSubject, emailBody);
			
		}
	}catch(e){
		nlapiLogExecution('error', 'There was a error while sending a mail', e);
	}
	
}