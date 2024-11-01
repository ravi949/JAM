/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       24 Jan 2018     rcm
 *
 */

/**
 * @param {nlobjRequest} request Request object
 * @param {nlobjResponse} response Response object
 * @returns {Void} Any output is written via response object
 */

const MINIMUM_USAGE = 100;
function suitelet(request, response){
		var success = false;
		var storeDepositId = request.getParameter('custparam_mb_store_depositid');
		var userId = request.getParameter('custparam_mb_user');
		
		if(storeDepositId){
			var depositRcd = nlapiLoadRecord( 'customrecord_mb_store_deposit',storeDepositId);
			if(depositRcd){
				if((depositRcd.getFieldValue('custrecord_mb_store_status') != "Deposit Created") &&
						(!shouldDepositBeScheduled(depositRcd))){
						success = buildDepositRcd(depositRcd);
				}
				else {
					success = false;
					var status = scheduleDeposit(storeDepositId,userId)}
			}
		}
		if (success)
			response.write("Deposit was created");
		else
			response.write("Deposit could not be created. There were too many invoices. The Deposit Creation has been scheduled.");
}
function shouldDepositBeScheduled(depositRcd){
		var scheduleBatch = false;
        var feeCnt = parseIntOrZero(depositRcd.getFieldValue('custrecord_mb_store_non_inv_fee_cnt'));
        	feeCnt += parseIntOrZero(depositRcd.getFieldValue('custrecord_mb_store_inv_fee_cnt'));
        var invCnt  = parseIntOrZero(depositRcd.getFieldValue('custrecord_mb_store_total_inv_cnt'));
        var scheduleThreshold =  parseIntOrZero(nlapiGetContext().getSetting('SCRIPT', 'custscript_mb_record_threshold'));
    
        nlapiLogExecution("debug","feenvcnt",invCnt);
        nlapiLogExecution("debug","invcnt",invCnt);
        nlapiLogExecution("debug","threshold",scheduleThreshold );
    
        if(invCnt > scheduleThreshold || feeCnt > scheduleThreshold){
        	scheduleBatch = true;
        };
        var status = depositRcd.getFieldValue('custrecord_mb_store_response');
        if((status) &&
          (status.indexOf("Script Usage Limit")>=0)){
        	scheduleBatch = true;
    	};
    
    return scheduleBatch;
}
function scheduleDeposit(storeDepositId,userId){
    	var params  ={ 	custscript_mb_store_depositid : storeDepositId,
    					custscript_mb_user_id: userId};
    	nlapiLogExecution('DEBUG', 'Params', JSON.stringify(params));
    	var status = nlapiScheduleScript('customscript_mb_scheduled_deposit_bldr',null , params);
	return status;
	
}
function parseIntOrZero(val){

 	return isNaN(parseInt(val)) ? 0 : parseInt(val);
 }
