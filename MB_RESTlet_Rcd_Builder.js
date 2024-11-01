/**
 *@NApiVersion 2.x
 *@NScriptType Restlet
 */
define(['N/record',
        'N/error',
        'N/task',
        'N/search'],
    function(record, error,task,search) {
        function doValidation(args, argNames, methodName) {
            for (var i = 0; i < args.length; i++)
                if (!args[i] && args[i] !== 0)
                    throw error.create({
                        name: 'MISSING_REQ_ARG',
                        message: 'Missing a required argument: [' + argNames[i] + '] for method: ' + methodName
                    });
        }

        // Get a standard NetSuite record
        function _get(context) {
            doValidation([context.recordtype, context.id], ['recordtype', 'id'], 'GET');
            if(context.recordtype == "mrtask"){
        		var oLog = 	{title: "batchid ",details: context.id};
    			log.error(oLog);
                //var mrScript = {mapReduceScriptId : 'customscript_mb_mr_invoice_fees',
                //    			deploymentId : 'customdeploy_mb_mr_invoice_fees'
                //}
                // blank dep to let system decide which dep to run
                var mrScript = {mapReduceScriptId : 'customscript_mb_mr_invoice_fees',
            			deploymentId : ''
                }

                var oResult = createAndSubmitMapReduceJob(mrScript);
                return oResult;
    		}
            
            if(context.recordtype == "customrecord_mb_store_deposit"){
        		var oLog = 	{title: "38. batchid ",details: context.id};
    			log.error(oLog);
            	var oResult = removeBatch(context.id);
                return oResult;
    		}

            if(context.recordtype == "testrecord_mb_store_deposit"){
        		var oLog = 	{title: "45. batchid ",details: context.id};
    			log.error(oLog);
            	///var oResult = removeBatch(context.id);
                var oResult = {id : "9999999"};
                return oResult;
    		}
            
            return JSON.stringify(record.load({
                type: context.recordtype,
                id: context.id
            }));
            
        }

        // Delete a standard NetSuite record
        function _delete(context) {
            log.debug("record ",JSON.stringify(context));
            doValidation([context.recordtype, context.id], ['recordtype', 'id'], 'DELETE');
            var result = record.delete({
                type: context.recordtype,
                id: context.id
            });
            var oResult = {id: result};
            return oResult;
        }

        // Create a NetSuite record from request params
        function post(context) {
        	try{
        		var oResult; var results = new Array();
                doValidation([context[0].recordtype], ['recordtype'], 'POST');
                if(Array.isArray(context)){
                    for (var index = 0; index < context.length; index++) {
                    	var rcd = context[index];
                    	oResult = createRecord(rcd);
                    	results.push(oResult);
                    }
                }
                else {
                	oResult = createRecord(context);
                	results.push(oResult);
                }
              //  log.debug("Results",JSON.stringify(results));
                return results;
        	}
        	catch (ex) {
                var oLog = 	{title: "Post Error",details: JSON.stringify(ex)};
        		log.error(oLog);
        		var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;
        		return [errObject(errMsg)];
        	}
        }
        function createRecord(rcdToCreate){

            //log.debug("record ",JSON.stringify(rcdToCreate));
            if(rcdToCreate.recordtype == "customrecord_mb_store_deposit"){
                if (rcdToCreate.hasOwnProperty("custrecord_mb_store_batch")){
                	batchId = rcdToCreate["custrecord_mb_store_batch"];
                    var storeDepositId = getStoreDepositId(batchId);
                	if(storeDepositId){
                    	var oResult = {id: "900",error:'Batch already existed. Skipping store batch [~1].'.replace("~1",batchId)};
                    	return oResult;
                	}
                }
            }
        	
            var rec = record.create({
                type: rcdToCreate.recordtype
            });

            for (var fldName in rcdToCreate){
                if (rcdToCreate.hasOwnProperty(fldName))
                    if (fldName !== 'recordtype')
                        rec.setValue(fldName, rcdToCreate[fldName]);
            }
            var recordId = rec.save();

            var seq = ""; var batchId = "";
            var oResult = {id: recordId,error:''};
            if(rcdToCreate.recordtype == "customrecord_mb_store_deposit"){
                if (rcdToCreate.hasOwnProperty("custrecord_mb_store_seq")){
                	seq = rcdToCreate["custrecord_mb_store_seq"]
                }
                if (rcdToCreate.hasOwnProperty("custrecord_mb_store_batch")){
                	batchId = rcdToCreate["custrecord_mb_store_batch"]
                }
                //log.debug("batch",batchId); log.debug("seq ",seq);
            	var cols = {seq:seq , batchid: batchId};
                var oResult = {id: recordId, columns: cols ,error:''};
            }

            if(rcdToCreate.recordtype == "customrecord_mb_store_detail"){
                if (rcdToCreate.hasOwnProperty("custrecord_mb_store_detail_seq")){
                	seq = rcdToCreate["custrecord_mb_store_detail_seq"]
                }
                var cols = {seq : seq};
                var oResult = {id: recordId,columns: cols,error:''};
            }

            if(rcdToCreate.recordtype == "customrecord_mb_store_fees"){
                if (rcdToCreate.hasOwnProperty("custrecord_mb_store_fees_seq")){
            		seq = rcdToCreate["custrecord_mb_store_fees_seq"]
                }
            	var cols = {seq : seq};
            	var oResult = {id: recordId,columns: cols,error:''};
            }
            return oResult;
        }
      //return an error object for consumption be an external source.
        function errObject(_e) {

        	var err = new Object();
        	err.id = -999;
        	err.error = _e;
            err.columns = {seq : "0"};
        	return (err);
        }

        // Upsert a NetSuite record from request param
        function put(context) {
        	try{
                doValidation([context.recordtype, context.id], ['recordtype', 'id'], 'PUT');
                var rec = record.load({
                    type: context.recordtype,
                    id: context.id
                });
                if(context.recordtype != "mrtask"){
                    for (var fldName in context)
                        if (context.hasOwnProperty(fldName))
                            if (fldName !== 'recordtype' && fldName !== 'id')
                                rec.setValue(fldName, context[fldName]);
                    var recordId = rec.save();
                    var oResult = {id: recordId};
                }
                else {
            		var oLog = 	{title: "batchid ",details: context.id};
        			log.error(oLog);
                    var mrScript = {mapReduceScriptId : 'customscript_mb_mr_invoice_fees',
                			deploymentId : 'customdeploy_mb_mr_invoice_fees'
                    }
                    var oResult = createAndSubmitMapReduceJob(mrScript);
        		}
                return oResult;
        	}
        	catch (ex) {
        		var oLog = 	{title: "Put Error",details: JSON.stringify(ex)};
        		log.error(oLog);
        		var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;
        		return errObject(errMsg);
        	}

        }

        function createAndSubmitMapReduceJob(mrScript) {
            try{
                log.audit('mapreduce id: ', mrScript.mapReduceScriptId);
                if(mrScript.hasOwnProperty('params')){
                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: mrScript.mapReduceScriptId,
                        params: mrScript.mrParams,
//                        deploymentId : mrScript.deploymentId
                    });
                }
                else
                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: mrScript.mapReduceScriptId,
  //                      deploymentId : mrScript.deploymentId
                    });
                    	
                var mrTaskId = mrTask.submit();

                /*

                var taskStatus = task.checkStatus(mrTaskId);
                if (taskStatus.status === 'FAILED') {
                    var authorId = -5;
                    var recipientEmail = 'jampaper2@mibar.net';
                    email.send({
                        author: authorId,
                        recipients: recipientEmail,
                        subject: 'Failure executing map/reduce job!',
                        body: 'Map reduce task: ' + mapReduceScriptId + ' has failed.'
                    });
                }
                */
                var oResult = {id: mrTaskId};
                return oResult;
            }
        	catch (ex) {
        		var oLog = 	{title: "create task error",details: JSON.stringify(ex)};
        		log.error(oLog);
        		var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;
        		return errObject(errMsg);
        	}
        }
        
        function removeBatch(batchId){
    		try{
// MAP REDUCE should get started by the delete UE of store deposit.
//                var mrScript = {mapReduceScriptId : 'customscript_mb_mr_store_detail_delete',
//                    	deploymentId : 'customdeploy_mb_mr_store_detail_delete',
//                    	mrParams : {custscript_mb_store_detail_batch: batchId} }
//
//          	    createAndSubmitMapReduceJob(mrScript);
//
//                var mrScript = {mapReduceScriptId : 'customscript_mb_mr_invoice_fees_delete',
//                    	deploymentId : 'customdeploy_mb_mr_invoice_fees_delete',
//                    	mrParams : {custscript_mb_invoice_fees_batch: batchId} }
//
//          	    createAndSubmitMapReduceJob(mrScript);
//
//                var mrScript = {mapReduceScriptId : 'customscript_mb_mr_store_fees_delete',
//                    	deploymentId : 'customdeploy_mb_mr_store_fees_delete',
//                    	mrParams : {custscript_mb_store_fees_batch: batchId} }
//
//          	    createAndSubmitMapReduceJob(mrScript);
                
    			log.debug("remove batch batchID",batchId);
                var storeDepositId = getStoreDepositId(batchId);
                
    			log.debug("remove store id",storeDepositId);
                if(storeDepositId){
                    var result = record.delete({
                        type: "customrecord_mb_store_deposit",
                        id: storeDepositId
                    });
                }
                
                var oResult = {id : batchId};
          		return oResult;
    		}
      		catch(ex){
          		log.error(ex);
        		var errMsg = "SuiteScript Error:" + " "+ex.name+"  "+ex.message;
                return errObject(errMsg);
      		}
        }
        function getStoreDepositId(batchId){
            var storeDepositId = null;
            
            var oSearch = search.create({
                type: "customrecord_mb_store_deposit",
                filters: [{name: 'custrecord_mb_store_batch', operator: "is", values: batchId}],
                columns: []
            });
            oSearch.run().each(function(result) {
                storeDepositId = result.id;
                return true;
            });
			return storeDepositId;
        }
///////////////////////////////////////////////////
       return {
            get: _get,
            delete: _delete,
            post: post,
            put: put
        };
    });

