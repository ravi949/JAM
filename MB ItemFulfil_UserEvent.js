/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([ 'N/record','N/task' ],
/**
 * @param {record}
 *            record
 */
function(record,task) {
  
  		function afterSubmit(scriptContext) {
			var eventType = scriptContext.type;
			try 
			{	
				 if (!(eventType === scriptContext.UserEventType.CREATE)) // || eventType === scriptContext.UserEventType.EDIT))
					{
						return;
					}
				var newRecId = scriptContext.newRecord.id;
				var newRecStatus = scriptContext.newRecord.getValue({
					fieldId : 'shipstatus'
				});
				var soID = scriptContext.newRecord.getValue({
					fieldId : 'createdfrom'
				});
				var tranDate  = scriptContext.newRecord.getValue({
					fieldId : 'trandate'
				});
					log.debug('trandate',tranDate);
				log.debug('newRecId and status and soID is ', newRecId + '##'+newRecStatus + '##'+soID);
				
				if (soID != '' && newRecStatus ==  'C')  // C means Shipped
				{//check if Pending Approval as script would throw an error when creating a new SO
					// moved to scheduled script below on 7-22
					var scriptId = '2401';
					var parameters = {'custscript_mb_object_so':{'object':JSON.stringify({'soId' : soID,'ffId':newRecId,'ffTranDate':tranDate})}};
					var taskId = scheduleScript(scriptId,parameters);	
					
				}
				else ////email if SOID is blank or different status
				{
					log.debug('Billing rec not created for Fulfilment ', newRecId + '##'+newRecStatus + '##'+soID);				
				}
			}
			catch(err){
				log.error('Error in afterSubmit',JSON.stringify(err));
			}		
		}
		
		function scheduleScript(script,params){
	    	try{
	    		var scriptTask = task.create({
	    			taskType : task.TaskType.SCHEDULED_SCRIPT
	    		});
	    		scriptTask.scriptId = script;
	    		scriptTask.params = params;
	    		var taskID = scriptTask.submit();
	    		log.debug('taskID for script: '+script,taskID);
	    		return taskID;
	    	}catch(err){
	    		//errorHandler(err,'scheduleScript','MB_Sched_fulfillable_orders_csv',null,null);
              log.error('error in scheduleScript',JSON.stringify(err));
	    		return null;
	    	}
	    }

     function parseFloatOrZero(val){

     	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
     }

	function CheckTranId(invTranId,poNumber,storeID,entity)
	{
		if (invTranId.toLowerCase().indexOf('-he') < 0)
			return "";

		if (poNumber == "")
			return "";
		
		//storeID = getStoreID(entity);
		storeID = storeID.replace(/\D/g,''); // remove all except numbers
  	    log.debug(" storeID will be ", storeID);
		
		return 		storeID + "_"+poNumber;
	}
	
	// original function - commented by Lucas on 7-23-2022
	/*function afterSubmit(scriptContext) {
		var eventType = scriptContext.type;
		try 
		{	
			 if (!(eventType === scriptContext.UserEventType.CREATE)) // || eventType === scriptContext.UserEventType.EDIT))
				{
					return;
				}
			var newRecId = scriptContext.newRecord.id;
			var newRecStatus = scriptContext.newRecord.getValue({
				fieldId : 'shipstatus'
			});
			var soID = scriptContext.newRecord.getValue({
				fieldId : 'createdfrom'
			});
			var itemFulFil_TranDate  = scriptContext.newRecord.getValue({
				fieldId : 'trandate'
			});
			log.debug('newRecId and status and soID is ', newRecId + '##'+newRecStatus + '##'+soID);
			
			if (soID != '' && newRecStatus ==  'C')  // C means Shipped
			{//check if Pending Approval as script would throw an error when creating a new SO

				var recordObj = record.transform({
					fromType : record.Type.SALES_ORDER,
					fromId : soID,
					toType : record.Type.INVOICE
				});

				recordObj.setValue({fieldId : "custbody_mb_linked_fulfil_id", value: newRecId});
				recordObj.setValue({fieldId : "trandate", value: itemFulFil_TranDate});

				//Note : Pending task
				//If the qty on itemFulfilment line is modified or if the item is removed, then we need to loop through invoice lines and update them.
				// example : if SO has 2 items and fulfilment has one item, then invoice should have only that item.
				// add by Lucas on 4/13/22
				
				recordObj.setValue({fieldId : 'custbody_tss_shipping_confirmation_box',value: false});
								
				//
				var taxTotal = parseFloatOrZero(recordObj.getValue({fieldId: "taxtotal"}));
				//log.debug("tax total",taxTotal);
				var invoice_Final_Total = recordObj.getValue({fieldId: "total"});
				var invoice_entity= recordObj.getValue({fieldId: "entity"});
				//log.debug("invoice_entity",invoice_entity);
				var storeId= recordObj.getText({fieldId: "entity"});
				//log.debug("storeId ",storeId);
				var invoice_TranId= recordObj.getValue({fieldId: "tranid"});
				//log.debug("invoice_TranId",invoice_TranId);
				//var otherrefnum = recordObj.getValue({fieldId: "otherrefnum"});
              	var otherrefnum = '';//invoiceRcd.getValue({fieldId: "otherrefnum"});
//  	   		log.debug("otherrefnum",otherrefnum);
				// added by lucas 7-21 as per Anna's request;
                if (invoice_entity == '60' || invoice_entity ==60){
                    var authNum = recordObj.getValue({fieldId:'custbody_mb_authorization_number'})
                    var otherrefnum = authNum.substring(5,authNum.length);
                    log.debug('otherrefnum for OD', otherrefnum);
            	} else if(invoice_entity == '61' || invoice_entity == 61 || invoice_entity == '67'  || invoice_entity ==67 || invoice_entity == '63' || invoice_entity==63) {
                    var merchantOrderId= recordObj.getValue({fieldId : 'custbody_mb_merchant_order_id'});
                    var otherrefnum = merchantOrderId
                    log.debug('otherrefnum for WB',otherrefnum);
                } else {
                    var otherrefnum = recordObj.getValue({fieldId: "otherrefnum"});
                    log.debug("otherrefnum",otherrefnum);
                }
				log.debug("otherrefnum(PO#)",otherrefnum);

				var import_batch = recordObj.getValue({fieldId: "custbody_mb_import_batch"});
				
				log.debug(" otherrefnum, invoice_TranId, storeId, invoice_entity,import_batch ", otherrefnum+'##'+invoice_TranId+'##'+ invoice_entity+'##'+import_batch);
				var newTranId = CheckTranId(invoice_TranId,otherrefnum,storeId,invoice_entity);
				if (newTranId != "")
				{
					log.debug(" TranId will be updated ", newTranId);
					recordObj.setValue('tranid', newTranId);
				}

				if (import_batch.toLowerCase().indexOf('csv') >= 0) // (invoice_entity == '2277') // Lowes (add others here if required)
				{
					log.debug(" SourceTotal and SoureTax will be updated as import batch is  ", import_batch);
					recordObj.setValue('custbody_mb_source_invoice_total', invoice_Final_Total);
					recordObj.setValue('custbody_mb_source_inv_tax_amount', taxTotal);	
				}
				// Pramod Added May 2022  (END)
				
				//
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
		}		}*/
  
	return {
		afterSubmit : afterSubmit
	};
});