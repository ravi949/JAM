/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       12 Dec 2017     rcm
 *

var depositSearch = nlapiSearchRecord("deposit",null,
[
   ["type","anyof","Deposit"]
],
[
   new nlobjSearchColumn("account",null,null),
   new nlobjSearchColumn("trandate",null,null).setSort(false),
   new nlobjSearchColumn("amount",null,null),
   new nlobjSearchColumn("tranid","paidTransaction",null),
   new nlobjSearchColumn("paidtransaction",null,null),
   new nlobjSearchColumn("amount","paidTransaction",null),
   new nlobjSearchColumn("trandate","paidTransaction",null)
]
);
*/
try{
var account =  262;
var tranDate = "12/12/2017";
var entity = 60;
var arAccount = 121;
var arAmount = 4000;
var invoiceTotal = 2000;
var nonInvoiceTotal = 500;

var paymentMethod = 2;
var channel = 7;

var invoiceAccount = 265;
var nonInvoiceAccount = 559;
// create deposit record
/*
var rcdDeposit = nlapiCreateRecord("deposit");

rcdDeposit.setFieldValue("account",account);
rcdDeposit.setFieldValue("trandate",tranDate);

// add other deposits sublist
var subList = "other";
rcdDeposit.selectNewLineItem(subList);
rcdDeposit.setCurrentLineItemValue(subList, "entity",entity);
rcdDeposit.setCurrentLineItemValue(subList, "account",arAccount);
rcdDeposit.setCurrentLineItemValue(subList, "amount",arAmount);
rcdDeposit.setCurrentLineItemValue(subList, "class",channel);
rcdDeposit.setCurrentLineItemValue(subList, "paymentmethod",paymentMethod);
rcdDeposit.commitLineItem(subList);


// add cashback
var subList = "cashback";
rcdDeposit.selectNewLineItem(subList);
rcdDeposit.setCurrentLineItemValue(subList, "account",invoiceAccount);
rcdDeposit.setCurrentLineItemValue(subList, "amount",invoiceTotal);
rcdDeposit.setCurrentLineItemValue(subList, "class",channel);
rcdDeposit.setCurrentLineItemValue(subList, "memo","Invoice specific");
rcdDeposit.commitLineItem(subList);

rcdDeposit.selectNewLineItem(subList);
rcdDeposit.setCurrentLineItemValue(subList, "account",nonInvoiceAccount);
rcdDeposit.setCurrentLineItemValue(subList, "amount",nonInvoiceTotal);
rcdDeposit.setCurrentLineItemValue(subList, "class",channel);
rcdDeposit.setCurrentLineItemValue(subList, "memo","Non Invoice specific");
rcdDeposit.commitLineItem(subList);

var depositId = nlapiSubmitRecord(rcdDeposit, true, true);
*/
var depositId = 29707

//create customer payment
var applyDate = "12/13/2017";
var subList = "apply";
var invoiceId = 24355;
var invoiceAmount = 1.95;


var rcdPayment = nlapiCreateRecord("customerpayment", {recordmode: 'dynamic'});
rcdPayment.setFieldValue("customer",entity);
rcdPayment.setFieldValue("trandate",tranDate);
rcdPayment.setFieldValue("aracct",arAccount)

// add bank deposit as credt

// add cashback
var subList = "credit";
console.log(rcdPayment.getLineItemCount(subList));
rcdPayment.selectNewLineItem(subList);
rcdPayment.setCurrentLineItemValue(subList, "applydate",applyDate);
rcdPayment.setCurrentLineItemValue(subList, "apply","T");
rcdPayment.setCurrentLineItemValue(subList, "internalid",depositId);
rcdPayment.setCurrentLineItemValue(subList, "amount",arAmount);
rcdPayment.commitLineItem(subList);

// add apply
rcdPayment.selectNewLineItem(subList);
rcdPayment.setCurrentLineItemValue(subList, "applydate",applyDate);
rcdPayment.setCurrentLineItemValue(subList, "apply","T");
rcdPayment.setCurrentLineItemValue(subList, "internalid",invoiceId);
rcdPayment.setCurrentLineItemValue(subList, "amount",invoiceAmount);
rcdPayment.commitLineItem(subList);


nlapiSubmitRecord(rcdPayment, true, true);
}
catch(err){
//	alert(err.getDetails())
throw err;
}

return search.create({
    type: "customrecord_mb_store_fees",
//    filters: [['custrecord_mb_store_fees_batch', search.Operator.ANYOF, batchId],'and',['custrecord_mb_fees_invoice',search.Operator.NONEOF,'@NONE@']],
    filters: [['custrecord_mb_store_fees_batch', 'IS', batchId]],
    columns: ['custrecord_mb_fees_invoice'],
    title: 'Fees Search'
});
}

var filters = [ new nlobjSearchFilter("custrecord_mb_store_fees_batch", null, "is", "AA09E14B-5181-498F-89DE-0BF431DAD9C3")];
var columns = [new nlobjSearchColumn("'custrecord_mb_fees_invoice'",null,null)];
var result = nlapiSearchRecord("customrecord_mb_store_fees", null, filters, columns);


var depositId = "62090";
var url = nlapiResolveURL("SUITELET","customscript_mb_suitelet_cashreceipts","customdeploy_mb_cash_receipts");
var oParams = { custparam_mb_deposit : depositId};
var response = nlapiRequestURL(url,oParams);
var respText = response.getBody();
console.log(respText);



var batchId = 'EA626337-F357-4712-BF0F-10ABF9683BE0';
var filters = [ new nlobjSearchFilter('custrecord_mb_fees_status',null, 'is',"Success"),
            	new nlobjSearchFilter('custrecord_mb_store_fees_batch',  null, 'is', batchId)
				];
var columns = [
           new nlobjSearchColumn("custrecord_mb_debit_account",null,"GROUP"),
           new nlobjSearchColumn("custrecord_mb_invoice_specific",null,"GROUP"),
           new nlobjSearchColumn("custrecord_mb_amount",null,"SUM")
       	    		];


var feeSearch = nlapiSearchRecord('customrecord_mb_store_fees', null, filters, columns);
if(feeSearch){
		var cols  = feeSearch[0].getAllColumns();
        for (var j = 0; j < feeSearch.length; j++) {
                account = feeSearch[j].getValue(cols[0]);
                amount = parseFloatOrZero(feeSearch[j].getValue(cols[2]));
                memo = feeSearch[j].getValue(cols[1]) == "T" ? "Invoice Fees" : "Non Invoice Fees";
                console.log(account);
                console.log(amount);
                console.log(feeSearch[j].getValue(cols[1]));
        }
   	}



var depositId = "5502";
var url = nlapiResolveURL("SUITELET","customscript_mb_suitelet_deposit_builder","customdeploy_mb_suitelet_deposit_builder");
var oParams = { custparam_mb_store_depositid : depositId};
var response = nlapiRequestURL(url,oParams);
var respText = response.getBody();
console.log(respText);

var batchId = "B0339CCC-6FDE-4AAF-9E5D-7B63735F6863"
var filters = [new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId),
               new nlobjSearchFilter("custrecord_mb_store_detail_invoice",null,"noneof","@NONE@")
              ];

var columns = [
               new nlobjSearchColumn("custrecord_mb_store_detail_invoice", null, null)
              ];

nlapiLogExecution("DEBUG", "getting invoices for batch ", batchId);

searchResults = nlapiSearchRecord("customrecord_mb_store_detail", null, filters, columns);


var batchId = "A55503BE-3A19-4BCC-AC1F-3961339A1253";
var search = nlapiLoadSearch("customrecord_mb_store_fees", "customsearch_mb_store_deposit_fees");
var filters = [ new nlobjSearchFilter("custrecord_mb_store_fees_batch", null, "is", batchId)
			];
search.addFilters(filters);

var resultSet = search.runSearch();
resultSet.forEachResult(
		function(searchResult) {
    		var cols  = searchResult.getAllColumns();
//    		var account = searchResult.getValue('custrecord_mb_store_fees_cash_account',null,'group');
///        	var dbAmount = searchResult.getValue('custrecord_mb_amoun',null,'sum');
//        	console.log(account + " " + dbAmount);
            account = searchResult.getValue(cols[0]);
            amount = parseFloatOrZero(searchResult.getValue(cols[4]));
            channel = searchResult.getValue(cols[2]);
            memo = searchResult.getText(cols[3]);
        	console.log(account + " " + amount + " " + memo+ " "+channel );
        	return true; // return true to keep iterating
		});



var searchDeposits = "customsearch_mb_reverse_accruals_2";
var search = nlapiLoadSearch('customrecord_mb_deposit_accruals', searchDeposits);
var resultSet = search.runSearch();
resultSet.forEachResult(function(searchResult) {
	var depositId = searchResult.getValue("custrecord_mb_store_deposit_link",null,null);
   	var bankDepositId = searchResult.getValue("custrecord_mb_deposit_id,",null,null);
   	console.log(depositId);
   	console.log(bankDepositId);
	return true; // return true to keep iterating
});

var batchId = '5B41633E-A914-45C9-A58E-66C9EA24DCDC';
var batchId = '89B10F5D-4030-4F31-B022-0FA031F805C6';
	var invoices = new Array();
	var filter = new Array();
	filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
	
	var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoices' , 'Accruals Invoice Search (CODE LINKED SEARCH)' , filter , 'T' )[0];
	nlapiLogExecution( 'AUDIT', 'getinvoices Search Results length is ', searchResults.length );
     if (searchResults) {
//     	var lastInvoice = "";
//         for (var j = 0; j < searchResults.length; j++) {
//     		if(lastInvoice != searchResults[j].getValue("custrecord_mb_store_detail_invoice")){
//     			lastInvoice = searchResults[j].getValue("custrecord_mb_store_detail_invoice")
//     			invoices.push(lastInvoice);
//     		}
//         }
         for (var i = 0; i < searchResults.length; i++)
            if (searchResults[i].getValue("custrecord_mb_store_detail_invoice") not in invoices)
            	invoices.push(searchResults[i].getValue("custrecord_mb_store_detail_invoice"))
               
         nlapiLogExecution("DEBUG", "invoice array count", invoices.length);
     }

     var id = 0;var estimatedFees =new Array();
     do{
     	var newinvoices = invoices.slice(id,id+1000);
     	id	+= 1000;
     	nlapiLogExecution("debug", "new invoice count", newinvoices.length);
         var filter = new Array();
     	filter.push(new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", newinvoices));
     	filter.push(new nlobjSearchFilter("applyingtransaction","custrecord_mb_invoice_id","anyof",depositId));
     	
     	
//     	str = JSON.stringify(newinvoices);
//     	nlapiLogExecution("debug", "JSON "+str.length, str.substr(0,3999));
//     	nlapiLogExecution("debug", "JSON+1", str.substr(3999,3999));
     	
     	var estimatedFeesSlice = generateSavedSearchResults( searchId,searchName , filter , 'T' )[0];;
		if(estimatedFeesSlice[2] == 1 ){
			nlapiLogExecution( 'AUDIT', 'getout tripped in estimated fee Search ');
			getOut = true; break;
		}
		estimatedFees = estimatedFees.concat(estimatedFeesSlice);
     	nlapiLogExecution( 'AUDIT', 'est fee Search Results length is ', estimatedFees.length );
     	
     } while (newinvoices.length >= 1000);
    
     estimatedFeesSlice.forEach(function callback(fee) {
     	var cols = fee.getAllColumns();
     	var amount = parseFloat(fee.getValue(cols[2]));
     	       
     	var accountDebit = fee.getText(cols[0]);
     	
     	var accountCredit = fee.getText(cols[1]);
     	var invoice = fee.getText(cols[4]);
     	var line = accountDebit + "\t"+ accountCredit + "\t"+ amount.toString()  + "\t"+ invoice ;
        	console.log(line);
     });

///// actual tester
     
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
    				for(var i=0 ; resultslice.length >= 1000 || i ==0 ; i++){
//    	    		    checkGovernance();
    					resultslice = resultSet.getResults(id, id+1000 );
    					if (resultslice != null && resultslice != ''){
    						generatedResults = generatedResults.concat(resultslice);
    						id += resultslice.length;
    					}
    				}
    				searchColumns = recordSearch.getColumns();
    				return [generatedResults , searchColumns ];
    			}catch(ERR_SavedSearch){
    				console.log('Error Occured in Processing SavedSearch('+savedSearchName+':'+savedSearchId+') Results Block ',ERR_SavedSearch);
    				return [generatedResults , searchColumns ];
    			}
    		}
    		return [generatedResults , searchColumns ];
    	}
     
     array.map(item => item.age)
     .filter((value, index, self) => self.indexOf(value) === index)
