/**
 * Module Description
 * Version            - 1.0
 * Script Type        - ScheduleScript
 * Description        - Delete records
 * Author             - Mibar
 */
var SEARCHID = "customsearch_mb_bad_accruals2";
var MINIMUM_USAGE = 1000;

function scheduled(type){
        var context = nlapiGetContext();
        var searchResults=new Array();
        var searchObj=nlapiLoadSearch(null, SEARCHID);

        var resultset= searchObj.runSearch();

        if (resultset!= null){
        var searchid=0;
         do{
        	 try{
        		 var resultslice= resultset.getResults(searchid, searchid + 1000);
        		 if(resultslice != null && resultslice!= ''){
    			     nlapiLogExecution("debug", "rs ",resultslice.length);
        			 for(var rs in resultslice){
        				 searchResults.push(resultslice[rs])
        				 searchid++;

        			 }
        		 }
        	 }
        	 catch(e) {
        	        nlapiLogExecution('debug', 'Error has occured', e);
        	 }
          }
         while(resultslice.length >= 1000);
        }
        nlapiLogExecution("debug", "SR length",searchResults.length );
        
        for (var i = 0; i < searchResults.length; i++){
            if (nlapiGetContext().getRemainingUsage() <= MINIMUM_USAGE){
                nlapiLogExecution('AUDIT', 'Scheduled Script', 'Not enough usage left('+ nlapiGetContext().getRemainingUsage()+ ') . Exiting and rescheduling script.');
                setRecoveryPoint();
                checkGovernance();
            }
            try{
            	nlapiLogExecution("debug", searchResults[i].getRecordType(), searchResults[i].getValue("internalid"));
        	    nlapiDeleteRecord(searchResults[i].getRecordType(), searchResults[i].getValue("internalid"));
            }
            catch(e) {
	        nlapiLogExecution('debug', 'Error has occured', e);
	    }


        }
}

function setRecoveryPoint() {
    var state = nlapiSetRecoveryPoint();
    if (state.status == 'SUCCESS')        return;
    if (state.status == 'RESUME')    {
        nlapiLogExecution("ERROR", "Resuming script because of " + state.reason
				+ ".  Size = " + state.size);
        return;
    }
    else
	    if (state.status == 'FAILURE')    {
		    nlapiLogExecution("ERROR", "Failed to create recovery point. Reason = "+ state.reason + " / Size = " + state.size);
	    }
}

function checkGovernance() {
    var context = nlapiGetContext();
    if (context.getRemainingUsage() < MINIMUM_USAGE) {
        var state = nlapiYieldScript();
        if (state.status == 'FAILURE') {
            nlapiLogExecution("ERROR","Failed to yield script, exiting: Reason = " + state.reason+ " / Size = " + state.size);
            throw "Failed to yield script";
        }
    }
}
