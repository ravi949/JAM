/**
 * Module Description
 * 
 * Version Date Author Remarks 1.00 10 Mar 2018 rcm
 * 
 */
const DISCOUNT_REASON_CODE = nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_discount_reason');

function buildDepositRcd(oldRecord){
	try {
		// create a new one
		var newRecord = nlapiCreateRecord("deposit");
		newRecord.setFieldValue("account", oldRecord.getFieldValue('custrecord_mb_store_checking_account'));
		var tranDate = new Date(oldRecord.getFieldValue('custrecord_mb_store_trans_date'));
		newRecord.setFieldValue("trandate", tranDate);
		nlapiLogExecution("debug", 'other');
		if(emptyIfNull(oldRecord.getFieldValue('custrecord_mb_store_ar_account')) == ''){
			var errMsg = "No A/R account provided. Process will be terminated.";
			throw nlapiCreateError('Deposit Creation Failure', errMsg);
		}
		var channel = oldRecord.getFieldValue('custrecord_mb_store_channel');
		//newRecord.setFieldValue("class", channel);
		// if you set it here dont forget to set it on the customerpayment
		
		
		// add other deposits sublist
		var subList = "other";
		// if a zero shows up in deposit, it wont be picked up in the credit tab of customer payment.
		var amount = parseFloatOrZero(oldRecord.getFieldValue('custrecord_mb_store_ar_amount')) - parseFloatOrZero(oldRecord.getFieldValue('custrecord_mb_store_disctaken'));
		if(amount!=0){
    		newRecord.selectNewLineItem(subList);
    		newRecord.setCurrentLineItemValue(subList, 'entity', oldRecord.getFieldValue('custrecord_mb_store_customer'));
    		newRecord.setCurrentLineItemValue(subList, 'account', oldRecord.getFieldValue('custrecord_mb_store_ar_account'));
    	
    		newRecord.setCurrentLineItemValue(subList, 'amount', amount);
    		
    		newRecord.setCurrentLineItemValue(subList, 'class', channel);
    		newRecord.setCurrentLineItemValue(subList, 'paymentmethod', oldRecord.getFieldValue('custrecord_mb_store_payment_method'));
    		newRecord.setCurrentLineItemValue(subList, 'refnum', oldRecord.getFieldValue('custrecord_mb_store_payment_ref'));
    		newRecord.commitLineItem(subList);
		}
		var context = nlapiGetContext();
		var batchId = oldRecord.getFieldValue('custrecord_mb_store_batch');
		var entityId = oldRecord.getFieldValue('custrecord_mb_store_customer');
		var memo = '';
		var account = '';
		amount = 0;
		if (batchId) {
			var feeSearch = getFees(batchId);
			if (feeSearch) {
				feeSearch.forEachResult(function(searchResult){
					var cols = searchResult.getAllColumns();
					account = searchResult.getValue(cols[0]);
					channel = searchResult.getValue(cols[2]);
					nlapiLogExecution("debug", 'fee search account', account);
					
					amount = parseFloatOrZero(searchResult.getValue(cols[4]));
					nlapiLogExecution("debug", 'fee search amount', amount);
					memo = searchResult.getText(cols[3]);
					if(amount !=0){
    					if (account != oldRecord.getFieldValue('custrecord_mb_store_ar_account'))
    						storeCashBackLine(amount, account, memo, newRecord, channel)
    					else {
    						amount = -(amount);
    						newRecord.selectNewLineItem(subList);
    						newRecord.setCurrentLineItemValue(subList, 'entity', entityId);
    						newRecord.setCurrentLineItemValue(subList, 'account', oldRecord.getFieldValue('custrecord_mb_store_ar_account'));
    						newRecord.setCurrentLineItemValue(subList, 'amount', amount);
    						newRecord.setCurrentLineItemValue(subList, 'class', channel);
    						newRecord.setCurrentLineItemValue(subList, 'memo', memo);
    						newRecord.commitLineItem(subList);
    					}
					}
					var scriptId = context.getScriptId();
					if (context.getRemainingUsage() <= MINIMUM_USAGE) {
						nlapiLogExecution('AUDIT', scriptId, 'Not enough usage left(' + context.getRemainingUsage() + ') . Exiting and rescheduling script.');
						if (scriptId.toLowerCase().indexOf("scheduled") > 0) {
							setRecoveryPoint();
							checkGovernance();
						}
						else {
							var errMsg = "This script will has exceeded the usage limit. It will be terminated.";
							throw nlapiCreateError('Script Usage Limit Exceeded', errMsg);
						}
					}
					return true; // return true to keep iterating
				});
			}
		}
		nlapiLogExecution("debug", 'discount');
		// add discount account
/* discount amount is removed from ar amount
		amount = parseFloatOrZero(oldRecord.getFieldValue('custrecord_mb_store_disctaken'));
		if (amount != 0) {
			amount = -(amount);
			account = oldRecord.getFieldValue('custrecord_mb_store_discount_cash')
			memo = nlapiLookupField("customlist_mb_reason_codes", DISCOUNT_REASON_CODE, "name");

			newRecord.selectNewLineItem(subList);
			newRecord.setCurrentLineItemValue(subList, 'entity', entityId);
			newRecord.setCurrentLineItemValue(subList, 'account', account);
			newRecord.setCurrentLineItemValue(subList, 'amount', amount);
			newRecord.setCurrentLineItemValue(subList, 'class', channel);
			newRecord.setCurrentLineItemValue(subList, 'memo', memo);
			newRecord.commitLineItem(subList);

		}
	*/
		//str = JSON.stringify(newRecord);
		//nlapiLogExecution("debug", 'new record', str);
		newRecord.setFieldValue('custbody_mb_store_deposit_link', oldRecord.getId());
		var recordId = nlapiSubmitRecord(newRecord, true, true);
		
		// update old record
		fields = [ 'custrecord_mb_store_status', 'custrecord_mb_deposit_link' ];
		values = [ 'Deposit Created', recordId ];
		nlapiSubmitField('customrecord_mb_store_deposit', oldRecord.getId(), fields, values);
		nlapiLogExecution("debug", 'record Id ', recordId);
		var newRecord = nlapiLoadRecord("deposit", recordId);
		if (newRecord) {
			var subList = "other";
			var lineCount = newRecord.getLineItemCount(subList);
			for (var i = 1; i <= lineCount; ++i) {
				var changed = false;
				newRecord.selectLineItem(subList, i);
				nlapiLogExecution("debug", 'entity', newRecord.getCurrentLineItemValue(subList, 'entity'));
				if (emptyIfNull(newRecord.getCurrentLineItemValue(subList, 'entity')) == '') {
					newRecord.setCurrentLineItemValue(subList, 'entity', oldRecord.getFieldValue('custrecord_mb_store_customer'));
					newRecord.setCurrentLineItemValue(subList, 'paymentmethod', oldRecord.getFieldValue('custrecord_mb_store_payment_method'));
					changed = true;
				}
				if (changed)
					newRecord.commitLineItem(subList);
			}
			if (changed)
				var recordId = nlapiSubmitRecord(newRecord, true, true);
		}
		return true;
	}
	catch (ex) {
		nlapiSubmitField('customrecord_mb_store_deposit', oldRecord.getId(), 'custrecord_mb_store_response', errText(ex));
		nlapiLogExecution("error", "Error", JSON.stringify(ex));
		throw ex;
	}
	return false;
}
function storeCashBackLine(amount, account, memo, newRecord, channel){
	var stored = false;
	if (amount == 0)
		return;
	// add cashback
	var subList = "cashback";
	newRecord.selectNewLineItem(subList);
	newRecord.setCurrentLineItemValue(subList, 'account', account);
	newRecord.setCurrentLineItemValue(subList, 'amount', amount);
	newRecord.setCurrentLineItemValue(subList, 'class', channel);
	newRecord.setCurrentLineItemValue(subList, 'memo', memo);
	///newRecord.setCurrentLineItemValue(subList, 'entity', entityId);
	newRecord.commitLineItem(subList);
	return true;
}
//
// get aggregated fees for this batch to create deposit cash back
//
function getFees(batchId){
	var search = nlapiLoadSearch("customrecord_mb_store_fees", "customsearch_mb_store_deposit_fees");
	var filters = [ new nlobjSearchFilter("custrecord_mb_store_fees_batch", null, "is", batchId) ];
	search.addFilters(filters);
	return search.runSearch();
}
function errText(_e){
	var txt = "";
	if (_e instanceof nlobjError) {
		// this is netsuite specific error
		txt = "Netsuite Script Error: Record ID :: " + " :: " + _e.getCode() + " :: " + _e.getDetails() + " :: " + _e.stacktrace;
	}
	else {
		// this is generic javascript error
		txt = "JavaScript/Other Error: Record ID :: " + " :: " + _e.toString() + " : " + _e.stack;
	}
	return txt;
}
function emptyIfNull(val){
	return val == null ? "" : val;
}
function parseFloatOrZero(val){
	return isNaN(parseFloat(val)) ? 0 : parseFloat(val).toFixed(2);
}
