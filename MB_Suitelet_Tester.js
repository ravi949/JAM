/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       18 Aug 2018     rcm
 *
 */

/**
 * @param {nlobjRequest} request Request object
 * @param {nlobjResponse} response Response object
 * @returns {Void} Any output is written via response object
 */
function suitelet(request, response){
	try{
    	rcdCT = nlapiLoadRecord('customtransaction_mb_accruals',975425);
    	var cnt = 0;
    	var dbAmount=0,crAmount= 0,total = 0;
    	var lines = rcdCT.getLineItemCount("line");
		nlapiLogExecution("debug","lines",lines);
		
//    	for(var i = lines; i >= 1; i--) {
		for (var i = 1; i <= lines; ++i) {
			
//			var crAmount  = parseFloatOrZero(roundVal(rcdCT.getLineItemValue("line", "credit", i)));
//			if(crAmount ==0) continue;
//
//			nlapiLogExecution("debug","cr amount",crAmount.toString());
//			total = roundVal(total - crAmount);
//			rcdCT.setLineItemValue("line", "credit", i,0);
//
//			var dbAmount  = parseFloatOrZero(roundVal(rcdCT.getLineItemValue("line", "debit", i)));
//			if(dbAmount ==0) continue;
//
//			nlapiLogExecution("debug","db amount",dbAmount.toString());
//			total = roundVal(total + dbAmount);
//			rcdCT.setLineItemValue("line", "debit", i,0);

		
    		rcdCT.removeLineItem("line",i);
//    		nlapiLogExecution("debug", "cnt/total", cnt.toString()+ " / "+total.toString());
    		nlapiLogExecution("debug", "cnt", cnt.toString());
    		++cnt;
//    		if(cnt== 4999) break;
//    		if(cnt>= 1002 && total == 0) break;
    		if(cnt == 200) break;
    	}
		
    	nlapiLogExecution("debug", "broke")
    	nlapiSubmitRecord(rcdCT);
    	nlapiLogExecution("debug", "completed")
	}
    catch(err){
    		nlapiLogExecution("error","Error",JSON.stringify(err));
    }
}
function parseFloatOrZero(val) {
	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}


function roundVal(val) {
    var dec = 2;
    var result = Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
    return result;
}

function oldsuitelet(request, response){
var iids = ['981536',
'981538',
'526334',
'981495',
'981497',
'526329',
'981496',
'981504',
'981510',
'981516',
'526330',
'981492',
'981493',
'981505',
'981506',
'981491',
'981507',
'526331',
'981508',
'981509',
'981511',
'981512',
'526328',
'981567',
'981513',
'981514',
'981527',
'981552',
'526332',
'567906',
'567907',
'981515',
'981522',
'981523',
'981518',
'981517',
'981521',
'981519',
'981520',
'981575',
'981494',
'981524',
'981525',
'981526',
'526333',
'981528',
'981529',
'567909',
'892477',
'981532',
'981533',
'981535',
'981560',
'981530',
'981550',
'892478',
'981537',
'981568',
'981569',
'892479',
'981553',
'981554',
'892480',
'981555',
'981570',
'981556',
'981557',
'892482',
'981558',
'892481',
'981498',
'981531',
'981534',
'981572',
'981563',
'981571',
'981564',
'981565',
'892800',
'981561',
'981562',
'981541',
'892799',
'981540',
'981548',
'899520',
'981539',
'981542',
'899521',
'981499',
'981500',
'981501',
'981502',
'981503',
'981549',
'981573',
'981574',
'981588',
'981589',
'981543',
'981590',
'981591',
'981576',
'981577',
'981713',
'981592',
'981691',
'981544',
'981692',
'981551',
'981693',
'981694',
'981714',
'981545',
'981695',
'981546',
'981578',
'981579',
'981696',
'981697',
'981698',
'981699',
'981700',
'981547',
'981580',
'981715',
'981701',
'981702',
'981581',
'981703',
'981704',
'981705',
'981559',
'981706',
'981707',
'981708',
'981716',
'981709',
'981566',
'981582',
'981583',
'981710',
'981711',
'981717',
'981712',
'981584',
'981585',
'981586',
'981587']
	for (var int = 0; int < iids.length; int++) {

	    try{
	    	var internalId = iids[int];
	    	nlapiDeleteRecord("customtransaction_mb_accruals", internalId);
	    	nlapiLogExecution("debug","iid",internalId);
	    }
	    catch(err){
	    	nlapiLogExecution("debug", "err", err.message);
	    }
    }
	
}
function testsuitelet(request, response){
	var batchId = 'B62B3317-A671-4385-95F2-209666A96BD1';
////	var batchId = '89B10F5D-4030-4F31-B022-0FA031F805C6';
	var invoices = new Array();
	var filter = new Array();
	filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
		
	var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoices' , 'Accruals Invoice Search (CODE LINKED SEARCH)' , filter , 'T' )[0];
	nlapiLogExecution( 'AUDIT', 'getinvoices Search Results length is ', searchResults.length );
    if (searchResults) {
     	var lastInvoice = "";
        for (var j = 0; j < searchResults.length; j++) {
     		if(lastInvoice != searchResults[j].getValue("custrecord_mb_store_detail_invoice")){
     			lastInvoice = searchResults[j].getValue("custrecord_mb_store_detail_invoice")
     			invoices.push(lastInvoice);
     		}
        }
        nlapiLogExecution("DEBUG", "invoice array ", JSON.stringify(invoices));
        nlapiLogExecution("DEBUG", "invoice array count", invoices.length);
    }
    var id = 0;var estimatedFees =new Array();
    do{
    	var newinvoices = invoices.slice(id,id+1000);
    	id	+= 1000;
    	nlapiLogExecution("debug", "id", id);
    	nlapiLogExecution("debug", "new invoice count", newinvoices.length);
        var filter = new Array();
    	filter.push(new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", newinvoices));

    	var estimatedFeesSlice = generateSavedSearchResults( 'customsearch_mb_search_estimated_fees' , 'Estimated Fees - Accrual (CODE LINKED SEARCH) ' , filter , 'T' )[0];
    	estimatedFees = estimatedFees.concat(estimatedFeesSlice);
    	nlapiLogExecution( 'AUDIT', 'est fee Search Results length is ', estimatedFees.length );
    	
    } while (newinvoices.length >= 1000)
    	
	nlapiLogExecution( 'AUDIT', 'est fee Search Results length is ', estimatedFees.length );
	if(estimatedFees !=null && estimatedFees.length > 0){
	    for (var k = 0; k < estimatedFees.length; k++) {
    		nlapiLogExecution("debug","fee id",estimatedFees[k].getText("class","CUSTRECORD_MB_INVOICE_ID"));
	    }
	}

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
			
			for(var i=0 ; resultslice.length >= 1000 || i ==0 ; i++){
				resultslice = resultSet.getResults(id, id+1000 );
				if (resultslice != null && resultslice != ''){
					nlapiLogExecution("debug", "rs output length", resultslice.length);
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

