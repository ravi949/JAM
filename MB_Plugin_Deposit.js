/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       27 Mar 2018     rcm
 *
 *
 */
function customizeGlImpact(transactionRecord, standardLines, customLines, book){

	var entityId =  transactionRecord.getLineItemValue('other','entity', 1);
	nlapiLogExecution("DEBUG","Entity",entityId);

	
   	var storeDepositId = transactionRecord.getFieldValue("custbody_mb_store_deposit_link");
   	nlapiLogExecution("DEBUG","Store Deposit Id ",storeDepositId);

   	var batchId = "";
	var amountTotal = 0;

   	if(emptyIfNull(storeDepositId)!=""){
   		storeDepositData = nlapiLookupField("customrecord_mb_store_deposit",
						storeDepositId,
						["custrecord_mb_store_batch",
					 	"custrecord_mb_store_discount_cr",
//   						"custrecord_mb_store_discount_cash"] );
						"custrecord_mb_store_discount_db"] );

   		if(storeDepositData){
       		var channelDiscounts = getDiscounts(storeDepositData.custrecord_mb_store_batch);
    		if (channelDiscounts) {
    			channelDiscounts.forEachResult(function(searchResult){
    				var amount = parseFloatOrZero(searchResult.getValue("custrecord_mb_store_dtl_discount",null,"SUM"));
    			   	nlapiLogExecution("DEBUG","amount",amount);
    				if(amount<=0) return true;
       				addCustomLine(searchResult,
   							customLines,
   							entityId,
   							storeDepositData.custrecord_mb_store_discount_db,
   							storeDepositData.custrecord_mb_store_discount_cr);
       				amountTotal += parseFloatOrZero(searchResult.getValue("custrecord_mb_store_dtl_discount",null,"SUM"));
    				return true; // return true to keep iterating
    			});
//
//    			if(amountTotal!=0){
//    				addDiscountOffset(amountTotal,
//    						entityId,
//    						customLines,
//    						storeDepositData.custrecord_mb_store_discount_db,
//    						storeDepositData.custrecord_mb_store_discount_cr);
//    			}
    		}
   		}
   	}
}

function addCustomLine(channelDiscounts,customLines,entityId,accountDb,accountCr){
	var channelId = channelDiscounts.getValue("custrecord_mb_store_detail_channel",null,"group");

	var amount = channelDiscounts.getValue("custrecord_mb_store_dtl_discount",null,"SUM");
	nlapiLogExecution("DEBUG","amount",amount);
	if(parseFloat(amount) == 0) return;
	var memo = "Discount Applied";
	
	nlapiLogExecution("DEBUG","memo",memo);
	
	// add new line
	if(emptyIfNull(accountDb)!=""){
		var newLine = customLines.addNewLine();
		newLine.setEntityId(parseInt(entityId));
//		newLine.setDebitAmount(amount);
		newLine.setCreditAmount(amount);
		newLine.setAccountId(parseInt(accountDb));
//		newLine.setClassId(parseInt(channelId));
		newLine.setMemo(memo);
	}
	nlapiLogExecution("DEBUG","set Debit");

	if(emptyIfNull(accountCr)!=""){
		var newLine = customLines.addNewLine();
		newLine.setEntityId(parseInt(entityId));
//		newLine.setCreditAmount(amount);
		newLine.setClassId(parseInt(channelId));
		newLine.setDebitAmount(amount);
		newLine.setAccountId(parseInt(accountCr));
		newLine.setMemo(memo);
	}
	nlapiLogExecution("DEBUG","set Credit");
}

/// credit the discount account to reverse the entry created by cash application so the net result is a posting to the discount account by channel
function addDiscountOffset(amount,entityId,customLines,accountDb,accountCr){

	var memo = "Discount Offset";
	
	nlapiLogExecution("DEBUG","memo",memo);
	
	// add new line
	if(emptyIfNull(accountDb)!=""){
		var newLine = customLines.addNewLine();
		newLine.setEntityId(parseInt(entityId));
//		newLine.setDebitAmount(amount);				// this is a reversing entry
		newLine.setCreditAmount(amount);
		newLine.setAccountId(parseInt(accountDb));
		newLine.setMemo(memo);
	}
	nlapiLogExecution("DEBUG","set Debit");

	if(emptyIfNull(accountCr)!=""){
		var newLine = customLines.addNewLine();
		newLine.setEntityId(parseInt(entityId));
		//newLine.setCreditAmount(amount);				// this is a reversing entry
		newLine.setDebitAmount(amount);
		newLine.setAccountId(parseInt(accountCr));
		newLine.setMemo(memo);
	}
	nlapiLogExecution("DEBUG","set Credit");
}


function getDiscounts(batchId){
    nlapiLogExecution("DEBUG", "getting discounts for batch ", batchId);

	var search = nlapiLoadSearch( "customrecord_mb_store_detail","customsearch_mb_store_detail_discounts");
    var filters = [new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId)];
	search.addFilters(filters);
	
	return search.runSearch();
}

function emptyIfNull(val) { return val == null ? "" : val; }

function parseFloatOrZero(val) {
	    return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}
