/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search','./lib/mb_error_handler'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search,errHandler) {

    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(scriptContext) {
	try
	{

	}
	catch(e){
		errHandler.log(e);
	}

    }

    return {
        execute: execute
    };

});
