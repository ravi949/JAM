/**
 * @NApiVersion 2.x
 * @NScriptType restlet
 * @NModuleScope SameAccount
 * 
 * Created By	      - Sai Krishna K
 * Created Date       - 06-12-2021
 * script name        - TSS RS Unbuild and Closing SO.js 
 * Script Type        - RESTLET SCRIPT
 * Script Description - A sales order ID and a cancellation reason is sent in the JSON. The sales order id sent if it has any assembly builds linked to it they are unbuilt
 * and then the sales order is closed and the cancellation reason is set on the memo field.
 * 
 */

 //var notValidSalesOrder  = ['fullyBilled','closed','pendingBilling','pendingBillingPartFulfilled'];
 var validSalesOrderStatus = ['pendingFulfillment','pendingBilling','partiallyFulfilled','pendingBillingPartFulfilled']   
 define(['N/record','N/search'], function (record,search) {

    function returnresponse(msg, InternalId,documentNumber) {
        var response;
        if (InternalId != '' && InternalId != null && InternalId != undefined) {
            response = {
                "Status": "Success",
                "Message": msg,
                "Document Number": documentNumber,
                "Internal ID" :InternalId
            }
            log.audit("response", response)
            return response;
        } else {
            var response;
            response = {
                "Status": "Fail",
                "Reason": msg,
            }
            log.audit("response", response)
            return response
        }
    }
    
    function validSalesOrder(salesOrderId){
        try{
            var salesorderSearchObj = search.create({
               type: "salesorder",
               filters:
               [
               ["type","anyof","SalesOrd"], 
               /*"AND", 
               ["status","anyof","SalesOrd:A","SalesOrd:B"], */
               "AND", 
               ["internalid","anyof",salesOrderId], 
               "AND", 
               ["mainline","is","T"]
               ],
               columns:
               [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({name: "tranid", label: "Document Number"}),
               search.createColumn({name: "statusref", label: "Status"})
               ]
           });
            var soDetails = [];
            salesorderSearchObj.run().each(function(result){
                log.debug("Sales Order details",result)
                soDetails.push(result.getValue({name: "internalid", label: "Internal ID"}));
                soDetails.push(result.getValue({name: "tranid", label: "Document Number"}));
                soDetails.push(result.getValue({name: "statusref", label: "Status"}));
                return true;
            });

            if(soDetails.length>0){
                log.debug("soDetails[3]",soDetails[2]);
                if(validSalesOrderStatus.indexOf(soDetails[2]) != -1){
                    return soDetails;
                }else{
                    return "The sales order must be either in Pending Fulfillment or Partially fulfilled or Pending billing or Pending Billing/ Partially Fulfilled to be closed. Please check your JSON and try again."
                }                
            }else{
                return "The provided sales order ID does not exist. Please check your JSON and try again."
            }
        }catch(e){
            log.error("Exception in Valid Sales Order",e);
            errMsg = e.body;
            return returnresponse(errMsg);
        }
    }
    return {
        post: function (restletBody) {
            try {
            	var assemblyFlag = false;
                log.debug("restletBody", restletBody);
                var salesOrderId        = restletBody.orderInternalId;
                var cancellationReason  = restletBody.cancellationReason;
                log.debug("salesOrderId", salesOrderId);
                log.debug("cancellationReason", cancellationReason);

                var errMsg = '';

                if (Object.keys(restletBody).length >0) {

                    if (salesOrderId) {

                        var salesOrderDetails = validSalesOrder(salesOrderId);

                        if((typeof salesOrderDetails)== "string"){
                            return returnresponse(salesOrderDetails);
                        }

                        var soRecordObj = record.load({
                            type      : record.Type.SALES_ORDER,
                            id        : salesOrderId,
                            isDynamic : false,
                        });

                        var lineCount = soRecordObj.getLineCount({
                            sublistId: 'item'
                        });
                        log.debug("lineCount", lineCount);

                        for (var i = 0; i < lineCount; i++) {
                            /*var linkedAssemblyBuildId = soRecordObj.getSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_mb_soline_linked_to_build',
                                line: i
                            });
                            log.debug("linkedAssemblyBuildId",linkedAssemblyBuildId);
                            if (linkedAssemblyBuildId) {
                                try{
                                	assemblyFlag = true;
                                    var objRecord = record.transform({
                                        fromType: record.Type.ASSEMBLY_BUILD,
                                        fromId: linkedAssemblyBuildId,
                                        toType: record.Type.ASSEMBLY_UNBUILD,
                                        isDynamic: true,
                                    });

                                  var unbuiltId = objRecord.save({
                                        enableSourcing: true,
                                        ignoreMandatoryFields: true
                                    });
                                   log.debug("unbuiltId",unbuiltId);
                                   
                                   soRecordObj.setSublistValue({
                                       sublistId: 'item',
                                       fieldId: 'custcol_mb_linked_assembly_unbuild',
                                       value: unbuiltId,
                                       line: i
                                   });
                                }catch(e){
                                    log.error("Exception in ASSEMBLY UNBUILD",e);
                                    errMsg = e.body;
                                    return returnresponse(errMsg);
                                }
                            }*/

                            soRecordObj.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'isclosed',
                                value: true,
                                line: i
                            });
                        }
                        
                        soRecordObj.setValue({
                            fieldId: 'custbody_mb_cancellation_reason',
                            value: cancellationReason
                        });

                        var recordId = soRecordObj.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: true
                        });
                        log.debug("Recordid", recordId);

                        if(recordId){
                        	var SuccessMsg = '';
                        	if(!assemblyFlag){
                                SuccessMsg = "The sales order is closed successfully."
                        	}else{
                        		SuccessMsg = "The linked Assembly builds have been unbuilt and the sales order is closed successfully."
                        	}
                            return returnresponse(SuccessMsg,recordId,salesOrderDetails[1]);
                        }

                    } else {	
                        errMsg = 'The request provided contains an empty sales order ID. Please check your JSON and try again.'
                        return returnresponse(errMsg);
                    }
                } else {
                    errMsg = 'The request provided contains an empty JSON. Please check your JSON and try again.'
                    return returnresponse(errMsg);
                }

            } catch (e) {
                log.error("Exception in POST", e);
                errMsg = e.body;
                return returnresponse(errMsg);
            }
        }
    }
});