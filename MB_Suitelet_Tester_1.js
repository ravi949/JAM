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
const hdLineFormat = "~invoice,~channel,~amount\n";
const FOLDERID = "432";

function suitelet(request, response){
	var batchId = '44758BD3-4516-4CB0-BADC-B55F258DD03D';
   	var depositId = "2975543";
//    nlapiLogExecution("DEBUG","line 20  ",typeof JSON);
//   	var batchId = '30D4B74C-C1F4-4417-B832-6CAEDB9EF547';
//   	var depositId = "905039";

   	
	var invoices = new Array();
	var filter = new Array();
	filter.push(new nlobjSearchFilter("custrecord_mb_store_dtl_batch", null, "is", batchId));
//	filter.push(new nlobjSearchFilter("applyingtransaction","custrecord_mb_store_detail_invoice","anyof",depositId));
		
//	var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoices' , 'Accruals Invoice Search (CODE LINKED SEARCH)' , filter , 'T' )[0];
	var searchResults = generateSavedSearchResults( 'customsearch_mb_search_accrual_invoice_2' , 'Accruals Invoice Search TESTER' , filter , 'T' )[0];
	nlapiLogExecution( 'AUDIT', 'getinvoices Search Results length is ', searchResults.length );
    if (searchResults) {
//     	var lastInvoice = "";
//        for (var j = 0; j < searchResults.length; j++) {
//     		if(lastInvoice != searchResults[j].getValue("custrecord_mb_store_detail_invoice")){
//     			lastInvoice = searchResults[j].getValue("custrecord_mb_store_detail_invoice")
//     			invoices.push(parseInt(lastInvoice));
//     		}
//        }
    	var notInvoices = new Array();
    	var invoices = searchResults.map(
        		function (searchResult){

        			if(searchResult.getValue("applyingtransaction","custrecord_mb_store_detail_invoice") == depositId){
        				 return searchResult.getValue("custrecord_mb_store_detail_invoice");
        			}
        			else{
        				notInvoices.push(searchResult.getValue("custrecord_mb_store_detail_invoice"));
        			}
        		}
        );

    	nlapiLogExecution("DEBUG","invoices", JSON.stringify(invoices));
        nlapiLogExecution("DEBUG", "Invoices array count", invoices.length);
        
        nlapiLogExecution("DEBUG", "not Invoices array count", notInvoices.length);

//    	var invoices = new Array();
//    	invoices  = searchResultsNew.map(
//      		function (searchResult){
//      			return searchResult.getValue("custrecord_mb_store_detail_invoice");
//      		}
//      );
                
    	var paidInvoices = invoices.filter(function(item, index){
    			return invoices.indexOf(item) >= index;
    	});
    	
    	bigLog("paidInvoices", JSON.stringify(paidInvoices));
    	nlapiLogExecution("DEBUG","paidInvoices  length", paidInvoices.length);
    	
//    	var invoices = new Array();
//        invoices  = searchResultsNew.map(
//        		function (searchResult){
//        			return searchResult.getValue("custrecord_mb_store_detail_invoice");
//        		}
//        );
//    	var d1 = ["123","3454","123","780","780","443","3454"];
//    	var d2 = d1.filter(function(item, index){
//    		nlapiLogExecution("DEBUG","d1.indexOf(item)", d1.indexOf(item));
//    		nlapiLogExecution("DEBUG","index", index);
//    		return d1.indexOf(item) >= index;
//    	});
//        nlapiLogExecution("DEBUG","d2", JSON.stringify(d2));
//        nlapiLogExecution("DEBUG","d2 length", d2.length);

//        var invoices = new Array();
//        invoices  = searchResultsNew.map(
//        		function (searchResult){
//        				if(invoices.indexOf(searchResult.getValue("internalid") < 0))
//        					return searchResult.getValue("internalid");
//        		}
//        );
                
//    	var invoices = invoicesB4.filter(
//            	function (value, index, self) {
//            		return self.indexOf(value) === index;
//            	}
//    	);
//        bigLog("invoice array  ",JSON.stringify(searchResults));
//        nlapiLogExecution("DEBUG", "invoice array count", searchResults.length);
//		bigLog("invoice array 1 ", JSON.stringify(invNew1));
//        nlapiLogExecution("DEBUG", "b4 invoice array count", invoicesB4.length);
    }
    
//    var id = 0; var paidInvoices =new Array();
//    var searchId = 'customsearch_mb_paid_invoices';
//   	var searchName = 'Paid Invoice Search ADD (CODE LINKED)';
//	var newinvoices = new Array();
//
//    var getout = false;
//    do{
//    	newinvoices = invoices.slice(id,id+1000);
//    	id	+= 1000;
//    	nlapiLogExecution("debug", "new invoice count", newinvoices.length);
//        var filter = new Array();
//    	filter.push(new nlobjSearchFilter("internalid", null, "anyof", newinvoices));
//    	filter.push(new nlobjSearchFilter("applyingtransaction", null, "anyof", depositId));
//
//
//    	var str = JSON.stringify(newinvoices);
//    	bigLog("invoice str",str);
//
//    	var paidInvoicesSlice = generateSavedSearchResults( searchId,searchName , filter , 'T' )[0];
////		if(paidInvoicesSlice[2] == 1 ){
////			nlapiLogExecution( 'AUDIT', 'getout tripped in estimated fee Search ');
////			getOut = true; break;
////		}
//    	paidInvoices = paidInvoices.concat(paidInvoicesSlice);
//    	nlapiLogExecution( 'AUDIT', 'paidInvoices Search Results length is ', paidInvoices.length );
//
//    } while (newinvoices.length >= 1000);
//    if(getout) throw "usage error";
    
    var id = 0; var estimatedFees =new Array();
    var searchId = 'customsearch_mb_search_estimated_fees';
//    var searchId = 'customsearch_mb_search_estimated_fees_3';		//detail search
   	var searchName = 'Estimated Fees - Accrual (CODE LINKED SEARCH) ';
	var newinvoices = new Array();

    var getout = false;
    do{
    	newinvoices = paidInvoices.slice(id,id+1000);
    	id	+= 1000;
    	nlapiLogExecution("debug", "new invoice count", newinvoices.length);

    	var filter = new Array();
     	filter.push(new nlobjSearchFilter("custrecord_mb_invoice_id", null, "anyof", newinvoices, null));
    	    	
    	var estimatedFeesSlice = generateSavedSearchResults( searchId,searchName , filter , 'T' )[0];
//		if(estimatedFeesSlice[2] == 1 ){
//			nlapiLogExecution( 'AUDIT', 'getout tripped in estimated fee Search ');
//			getOut = true; break;
//		}
		estimatedFees = estimatedFees.concat(estimatedFeesSlice);
    	
    } while (newinvoices.length >= 1000);

    nlapiLogExecution( 'AUDIT', 'est fee Search Results length is ', estimatedFees.length );
	nlapiLogExecution( 'DEBUG', 'est fee Search ', JSON.stringify(estimatedFees));
    
    if(getout) throw "usage error";

//	var searchResultsNew = estimatedFees.filter(
//    	function (searchResult){
//
//    		if(searchResult.getValue("custrecord_mb_reversible_fee","CUSTRECORD_MB_FEE_ID","group") == "T"){
//    			nlapiLogExecution( 'DEBUG', 'wokred dummy ',"")
//    			return searchResult;
//    		}
//    	}
//	);
 
    
//	nlapiLogExecution( 'AUDIT', 'est fee Search Results length is ', searchResultsNew.length );
//	bigLog("estimated fees arrry",JSON.stringify(searchResultsNew));
//	var outputStr = "";
//	if(estimatedFees !=null && estimatedFees.length > 0){
//	    for (var k = 0; k < estimatedFees.length; k++) {
//    	    var hdLine = hdLineFormat
//    	    	.replace("~invoice",estimatedFees[k].getText("custrecord_mb_invoice_id"))
//    	    	.replace("~channel",estimatedFees[k].getText("class","CUSTRECORD_MB_INVOICE_ID"))
//    	    	.replace("~amount",parseFloatOrZero(estimatedFees[k].getValue("custrecord_mb_fee_amount")))
//    	    response.write(hdLine);
//            nlapiLogExecution('debug','HDLINE',hdLine);
//            outputStr+= hdLine;
//	    }
//	}
//    if(outputStr!="") outputFile(outputStr);
}

function parseFloatOrZero(val) {
	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
}


function roundVal(val) {
    var dec = 2;
    var result = Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
    return result;
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
//			var filters = recordSearch.getFilters();
//			for(var i=0 ;i<= filters.length ; i++){
//				var filter = filters[i];
//				if(filter) nlapiLogExecution("debug", "genss values "+ i , JSON.stringify(filter.values));
//			}
			
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
			}
			searchColumns = recordSearch.getColumns();
			return [generatedResults , searchColumns ];
		}catch(ERR_SavedSearch){
			nlapiLogExecution('ERROR','Error in SavedSearch('+savedSearchName+':'+savedSearchId+')',ERR_SavedSearch);
			return [generatedResults , searchColumns ];
		}
	}
	return [generatedResults , searchColumns ];
}
/*************** End Processing Saved Search *********/
function bigLog(logTitle, logDetails)
{
	var nMaxCharsPerLog = 3950;
	var sMsg = '' + logDetails;
	var sRemainingMessage = sMsg;
	var bOneLogWritten = false;
	var iCount = 0;
	while (sRemainingMessage.length > 0 || !bOneLogWritten)
	{
		var sLoggingPart = sRemainingMessage.substr(0, nMaxCharsPerLog);
		sRemainingMessage = sRemainingMessage.substr(nMaxCharsPerLog);
		nlapiLogExecution('DEBUG', (iCount<=0?'':'(' + iCount + ') ') + logTitle, sLoggingPart);

		iCount++;
		bOneLogWritten = true;
	}
}
function emptyIfNull(val) { return val == null ? "" : val; }

Date.prototype.formatYYYYMMDD = function() {
    var formatDate = this.getFullYear().toString();
    formatDate += ((this.getMonth() + 1)<10 ? "0" : "") + (this.getMonth() + 1).toString();
    formatDate += (this.getDate() <10 ? "0" : "") + this.getDate().toString();
    return (formatDate);
};


Date.prototype.formatYYYYMMDDTT = function() {
    var formatDate = this.getFullYear().toString();
    formatDate += ((this.getMonth() + 1)<10 ? "0" : "") + (this.getMonth() + 1).toString();
    formatDate += (this.getDate() <10 ? "0" : "") + this.getDate().toString();
    formatDate += "_";
    formatDate += this.toTimeString().substring(0,8).replace(/:/g,"")
    return (formatDate);
};

function outputFile(contents){
    var ext = '.txt';
    var fileType = 'PLAINTEXT';
    var encoding = 'ISO-8859-1';
    
	try{
            // create file
            var acctName = "estimatedfees";
            var fileName = acctName + '_' + new Date().formatYYYYMMDDTT() + '_' + hash();
            var file = nlapiCreateFile(fileName + ext,fileType,contents);
            file.setFolder(FOLDERID);
    
            if (encoding) file.setEncoding(encoding);
            var fileId = nlapiSubmitFile(file);
	}
        catch(e){
        	nlapiLogExecution('error', 'There was a error while creating the file', e);
        }
}
function hash(){
	var hash = 'xxx-yxxx'.replace(/[xy]/g, function (c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8;
		return v.toString(16);
	});
	return hash;
}
