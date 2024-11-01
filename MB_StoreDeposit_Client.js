/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/error',
        	'N/record',
        	'N/ui/message',
        	'N/url',
        	'N/currentRecord',
        	'N/https',
        	'N/runtime'
        	],
/**
 * @param {error} error
 * @param {record} record
 * @param {message} message
 * @param {url} url
 */

function(error, record, message, url,currentRecord,https,runtime) {


        	function depositFunds(context){

        		try{
                    var rec = currentRecord.get();
                    var status =   rec.getValue({fieldId: 'custrecord_mb_store_status'});

            		if(status =='Success'){
            				var depositId = rec.id;
                        	var userId = runtime.getCurrentUser().id;
                    		var murl =  url.resolveScript({
                    			scriptId: 'customscript_mb_suitelet_deposit_builder',
                    			deploymentId: 'customdeploy_mb_suitelet_deposit_builder',
                    			returnExternalUrl: false,
                    			params: { 	custparam_mb_store_depositid : depositId,
    										custparam_mb_user: userId}
                    			});
                    		
                            murl = getNSDomain() + murl;
                            var response = https.get({
                            		url:murl
                            });
                            var respText = response.body;
                            if(respText){
                            	alert(respText);
                            	location.reload();
                            }
                            	/*
                                var options  = {
                            		title: "Create Store Deposit",
                            		message: respText,
                            		type: message.Type.CONFIRMATION
                                };
                            	if(respText != "Deposit was created") options.type = message.Type.ERROR;
                            	var msgBox = message.create(options);
                            	msgBox.show();
//                        		location.reload();
                            	setTimeout(location.reload(),30000);
                            	*/
            				
            		}
                    else
                    	alert('This batch cannot be processed due to its status.');
        		}
        		catch(err){
        			alert("Error "+err.message);
        		}
        	};
        	
        	function applyCash(context){
        		try{
        			message = " this is the real deal";
                    var rec = currentRecord.get();
                    var status =   rec.getValue({fieldId: 'custrecord_mb_store_status'});
                    if(status =="Deposit Created"){
                    	var userId = runtime.getCurrentUser().id;
                		var depositId = rec.getValue({ fieldId : 'custrecord_mb_deposit_link'} );
                		var murl =  url.resolveScript({
                			scriptId: 'customscript_mb_suitelet_cashreceipts',
                			deploymentId: 'customdeploy_mb_cash_receipts',
                			returnExternalUrl: false,
                			params: { 	custparam_mb_deposit : depositId,
                						custparam_mb_user: userId}
                			});
                        murl = getNSDomain() + murl;
                        
                        var response = https.get({
                        		url:murl
                        });
                        var respText = response.body;
                        if(respText){
                        	/*
                            var options  = {
                        		title: "Apply Cash",
                        		message: respText,
                        		type: message.Type.CONFIRMATION
                            };
                        	if(respText != "Cash has been applied") options.type = message.Type.ERROR;
                        	var msgBox = message.create(options);
                        	msgBox.show();
                        	//setTimeout(msgBox.hide, 15000); // will disappear after 15s
                        	setTimeout(location.reload(),30000);
                        	*/
                        	alert(respText);
                        	location.reload();
                        }
        			}
                    else
                    	alert('This batch cannot be processed due to its status.');
        		}
        		catch(err){
        			alert("Cash Apply Error "+ err.message);
        		}
        	}
                    	
        	function setBatchStatus(newBatchStatus){
                var rec = currentRecord.get();
				var depositId = rec.id;
				
				var msg = ""; var newResponse = "";
        		if(newBatchStatus == "Deposit Created"){
            		msg = "Before resetting you should set the invoice begin / end dates for the remaining invoice range." ;
            		newResponse = "Batch Reset by user";
            	}
        		else{
            		msg = "Closing a Batch is not reversible. Be sure all invoices have been completely keyed off";
            		newResponse = "Batch closed by user";
        		}
	            if(confirm(msg)){
	                if(depositId){
	                	var id = record.submitFields({
	                	    type: 'customrecord_mb_store_deposit',
	                	    id: depositId,
	                	    values: {
	                	    	custrecord_mb_store_status : newBatchStatus,
	                	    	custrecord_mb_store_response: newResponse
	                	    },
	                	    options: {enableSourcing: false,ignoreMandatoryFields : true}
	                	});
	                }
///	            	alert("would have set "+newBatchStatus);
	                location.reload();
	            }
            }

        	function pageInit(){
//        		debugger;
    			console.log("starting cs");
        	};

        	// Get proper url
        	function getNSDomain(){
        		var isSandbox = runtime.envType != "PRODUCTION";
//        		var nsDomain = 'https://system.na2.netsuite.com';
//        		if (isSandbox ) {
//        			nsDomain = 'https://system.netsuite.com';
//        		}
            	var nsDomain = "https://"+ url.resolveDomain({
            	    hostType: url.HostType.APPLICATION,
            	    accountId: runtime.accountId
            	});
        		
        		return (nsDomain);
        	}
        	
        	return {
        		applyCash 		: applyCash,
        		depositFunds	: depositFunds,
        		setBatchStatus	: setBatchStatus,
        		pageInit		: pageInit
            };
        	
});
