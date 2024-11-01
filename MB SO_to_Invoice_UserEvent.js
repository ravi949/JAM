/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([ 'N/record' , 'N/config','N/format'],
/**
 * @param {record}
 *            record
 */
function(record,config,format) {
	function afterSubmit(scriptContext) {
		var eventType = scriptContext.type;
		try 
		{
			log.debug('SO AfterSubmit : eventType  is ', eventType);
			if (!(eventType === scriptContext.UserEventType.EDIT))
				{
					return;
				}

			var companyInfo = config.load({
					type: config.Type.COMPANY_INFORMATION
				});

			var companyTimezone = companyInfo.getValue({
				fieldId:'timezone'
			});

			//var itemFulFil_TranDate  = '05/01/2022'; //scriptContext.newRecord.getValue({
				
			//var myDate = new Date("May 1, 2022 12:01:00");
			//log.debug('myDate is  ', myDate);
			
			//var myDate = format.format({
			//		value:myDate,
			//		format: format.Type.DATETIMETZ,
			//		timezone: companyTimezone
			//	});
				
			var myDate = format.parse({
			   value: '05/01/2022',
			   type: format.Type.DATE
			});
				
			log.debug('myDate is done ', myDate);
	
			var newRecId = scriptContext.newRecord.id;

			//var newRecStatus = scriptContext.newRecord.getValue({
			//	fieldId : 'shipstatus'
			//});
			
			//var soID = scriptContext.newRecord.getValue({
			//	fieldId : 'createdfrom'
			//});
			
			log.debug('newRecId and status and soID is ', newRecId); // + '##'+newRecStatus + '##'+soID);
			
			if (newRecId != "") //soID != '' && newRecStatus ==  'C')  // C means Shipped
			{//check if Pending Approval as script would throw an error when creating a new SO

				log.debug('before Transform ', newRecId);
				var recordObj = record.transform({
					fromType : record.Type.SALES_ORDER,
					fromId : newRecId, //soID,
					toType : record.Type.INVOICE
				});

				//recordObj.setValue({fieldId : "custbody_mb_linked_fulfil_id", value: newRecId});

				recordObj.setValue({fieldId : "trandate", value: myDate });
				recordObj.setValue({fieldId : 'custbody_tss_shipping_confirmation_box',value: false});
				log.debug('before SAVE ', newRecId);
				var invoiceId = recordObj.save({
					enableSourcing : false,
					ignoreMandatoryFields : true
				});

				log.debug({
					title : 'Invoice ID',
					details : invoiceId
				});
			}
			else ////email if SOID is blank or different status
			{
				log.debug('Billing rec not created for Fulfilment ', newRecId + '##'+newRecStatus + '##'+soID);				
			}
		}
		catch(err){
			log.error('Error in afterSubmit',JSON.stringify(err));
		}		}
	return {
		afterSubmit : afterSubmit
	};
});