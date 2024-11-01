/**
 * @NApiVersion 2.x
 * @NScriptType restlet
 * @NModuleScope SameAccount
 * 
 */
define(['N/error', 
        'N/format',
        'N/record',
        'N/runtime', 
        'N/search',
        'N/task'],
    function (error, format, record, runtime, search, task) {
        const SCHEDULED_SCRIPT_ID = "customscript_mb_sched_create_ia";
        const MINIMUM_USAGE = 300;
        var startDateTime = new Date();


        function doPost(requestBody) {
            // log.debug('received Data: ',JSON.stringify(requestBody));
            if(Array.isArray(requestBody) && requestBody[0].hasOwnProperty("itemId")) return doPostItems(requestBody); 
            // executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
            var scriptObj = runtime.getCurrentScript();            
            executionThreshold = 55;
            
            var lastStoreId; var customerId ;
            var ordersSW = requestBody; var nsResponse;

            try {
                var results = new Array();

                for (var index = 0; index < ordersSW.length; index++) {
                    var orderSW = ordersSW[index];
                    if (orderSW != null && orderSW != '') {
        
                        if(lastStoreId != orderSW.storeId){ 
                            customerId = getCustomerId(orderSW.storeId);
                            lastStoreId = orderSW.storeId;
                        }

                        if(!customerId){
                            var msg = 'CustomerId missing for Store ' + orderSW.storeId;
                            log.debug('CustomerId is missing for store on transaction id  '+ orderSW.orderId,msg);                    
                            results.push(returnresponse(msg)); 
                            continue;
                        }
                        
                        nsResponse = validJSON(orderSW,customerId);
                        log.debug("nsResponse for index " + index.toString(), JSON.stringify(nsResponse));
                        results.push(nsResponse);
                    } else {
                        var msg = 'Required details are missing. counter' + index;
                        log.debug('Input JSON is empty',msg);                        
                        results.push(returnresponse(msg)); 
                    }

                    // if(testMode && index>=4) throw error.create({name: 'TEST_ERROR',message: "TESTING Integration stopped to avoid a script timeout"});

                    if (executionTimesUp()) {
                        throw error.create({ name: 'TIME_LIMIT_CHECK', message: "Integration stopped to avoid a script timeout" });
                    }

                    log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());

                    if (scriptObj.getRemainingUsage() < MINIMUM_USAGE) {
                        throw error.create({ name: 'USAGE_CHECK', message: "Integration stopped to avoid a script usage error" });
                    }
                }
                log.debug('52 results : ',JSON.stringify(results));
            } catch (err) {
                var msg = err.name + " " + err.message;
                var exStatus = "TEST_ERROR,TIME_LIMIT_CHECK,USAGE_CHECK".indexOf(err.name) >= 0 ? "usage" : "exception";
                var response = {
                    "Status": exStatus,
                    "Message": msg,
                };
                log.debug("response", JSON.stringify(err))
                results.push(response);
            }
            return results;
        }

        function doPostItems(requestBody) {
            var scriptObj = runtime.getCurrentScript();            
            executionThreshold = 55;
            
            //log.debug('received Data: ',JSON.stringify(receivedJson));
            var lastStoreId; var locationId; 
            var itemsSW = requestBody; var nsResponse;
            try {
                var results = new Array();

                for (var index = 0; index < itemsSW.length; index++) {
                    var itemSW = itemsSW[index];
                    if (itemSW != null && itemSW != '') {
                        log.debug("itemSW",JSON.stringify(itemSW)); 
                        if(lastStoreId != itemSW.storeId){ 
                            locationId = getLocationId(itemSW.storeId);
                            lastStoreId = itemSW.storeId;
                        }

                        if(!locationId){
                            var msg = 'locationId missing for Store ' + itemSW.storeId;
                            log.debug('locationId is missing for store on transaction id  '+ itemSW.storeId,msg);                    
                            results.push(returnresponse(msg)); 
                            continue;
                        }
                        var recordId = 0; 
                        // removed to create another record if necessary to satisfy inventory requirements. 
                        // recordId = isItemThere(itemSW,locationId); 
                        // if(recordId!=0){
                        //     var msg = 'item already on file (itemId ## locationId)' + itemSW.itemId +" ## "+locationId;
                        //     log.debug('returned result  '+ msg);
                        //     results.push(returnPartialFailResponse(msg,recordId));                    
                        //     continue;
                        // } 

                        var qtyAvail = getQuantityAvailable(itemSW.itemId,locationId);
                        var invReqRcd = record.create({
                            type: "customrecord_mb_inv_req",                            
                            isDynamic: true
                        });
                        invReqRcd.setValue({fieldId: "name",                                value: itemSW.sku});
                        invReqRcd.setValue({fieldId: "custrecord_mb_inv_req_item",          value: itemSW.itemId});
                        invReqRcd.setValue({fieldId: "custrecord_mb_inv_req_qty",           value: itemSW.quantity});
                        invReqRcd.setValue({fieldId: "custrecord_mb_inv_req_date_required", value: getDateValue(itemSW.dateRequired)});
                        invReqRcd.setValue({fieldId: "custrecord_mb_inv_req_available",     value: qtyAvail});
                        invReqRcd.setValue({fieldId: "custrecord_mb_inv_req_location",      value: locationId});
                        invReqRcd.setValue({fieldId: "custrecord_mb_inv_req_batchid",       value: itemSW.batchId});                        
                        recordId = invReqRcd.save();
                        var oResult = returnresponse('',recordId); 
                        log.debug("oResult for index " + index.toString(), JSON.stringify(oResult));
                        results.push(oResult);
                    } else {
                        var msg = 'Required details are missing. counter' + index;
                        log.debug('Input JSON is empty',msg);                        
                        results.push(returnresponse(msg)); 
                    }

                    // if(testMode && index>=4) throw error.create({name: 'TEST_ERROR',message: "TESTING Integration stopped to avoid a script timeout"});

                    if (executionTimesUp()) {
                        throw error.create({ name: 'TIME_LIMIT_CHECK', message: "Integration stopped to avoid a script timeout" });
                    }

                    log.audit("Remaining governance units: " + scriptObj.getRemainingUsage());

                    if (scriptObj.getRemainingUsage() < MINIMUM_USAGE) {
                        throw error.create({ name: 'USAGE_CHECK', message: "Integration stopped to avoid a script usage error" });
                    }
                }
                log.debug('52 results : ',JSON.stringify(results));
            } catch (err) {
                var msg = err.name + " " + err.message;
                var exStatus = "TEST_ERROR,TIME_LIMIT_CHECK,USAGE_CHECK".indexOf(err.name) >= 0 ? "usage" : "exception";
                var response = {
                    "Status": exStatus,
                    "Message": msg,
                };
                log.debug("response", JSON.stringify(err))
                results.push(response);
            }
            createAndSubmitTask(); 
            return results;
        }

        function TESTvalidJSON(receivedJson) {
            if (receivedJson != null && receivedJson != '') {
                var msg = 'GOOD Test json ' + receivedJson.orderId;
                return returnresponse(msg, receivedJson.orderId);
            }
        }

        function validJSON(orderSW,customerId) {
            // log.debug("recvd JSON",JSON.stringify(receivedJson));
            var transactionId = customerId + "_"+ orderSW.orderNumber || '';
            if (transactionId != '' && transactionId != null && transactionId != undefined) {
                if (isItThere(transactionId))
                    return returnresponse('',orderSW.orderId,false);
                else 
                    var msg = 'No invoice on file for transaction id  ' + transactionId + 'and order id '+orderSW.orderId ;                    
                    return returnPartialFailResponse(msg,orderSW.orderId)                    
            } else {
                var msg = 'No invoice on file for transaction id  ' + transactionId + 'and order id '+orderSW.orderId ;
                log.debug('Invoice is missing '+ transactionId,msg);                        
                return returnPartialFailResponse(msg,orderSW.orderId)
            }

        }

        function returnresponse(msg, recordId,isException) {
            var response;
            var exStatus = "fail"; 
            
            if(isException !=undefined && isException)  exStatus = "exception"; 
            
            response = {"Status": exStatus,"Message": msg};

            if (recordId != '' && recordId != null && recordId != undefined) {
                response.RecordId = recordId
                response.Status = "success";
            }
            log.debug("response 277", response)
            return response;
        }


        function returnPartialFailResponse(msg, recordId) {
            var response;
            if (recordId != '' && recordId != null && recordId != undefined) {
                response = {
                    "Status": "pfail",
                    "Message": msg,
                    "RecordId": recordId,
                }
                log.audit("response", response)
                return response;
            }
            else {
                var response;
                response = {
                    "Status": "fail",
                    "Message": msg,
                }
                log.audit("response", response)
                return response;
            }
        }

        function isItThere(transactionId) {
            var foundIt = false; 
            var filters = [["tranid", "is", transactionId],"AND",[ 'mainline', search.Operator.IS, "T"]];

            var invoiceSearchObj = search.create({
                type: "invoice",
                filters: filters,
                columns: [search.createColumn({ name: "externalid" }),search.createColumn({ name: "tranid" })]
            });

            var searchResult = invoiceSearchObj.run().getRange({ start: 0, end: 10 });
            log.debug("invoiceSearchObj result count", searchResult.length);

            if (searchResult.length>0) {
                log.debug('internal id ', searchResult[0].id);
                foundIt = true; 
            }
            return foundIt;
        }

        function isItemThere(itemSW,locationId) {
            try{
                var recordId = 0; 
                var filters = [ ["custrecord_mb_inv_req_item", "is", itemSW.itemId],"AND",
                                [ 'custrecord_mb_inv_req_location', search.Operator.IS, locationId],"AND",
                                [ 'custrecord_mb_inv_req_date_required', search.Operator.ON, itemSW.dateRequired]
                            ];
                log.debug("filters",JSON.stringify(filters)); 
                var invReqObj = search.create({
                    type: "customrecord_mb_inv_req",
                    filters: filters,
                    columns: []
                });

                var searchResult = invReqObj.run().getRange({ start: 0, end: 10 });
                log.debug("invReqObj result count ", searchResult.length);

                if (searchResult.length>0) {
                    log.debug('internal id ', searchResult[0].id);
                    recordId =  searchResult[0].id;
                    // record.submitFields({
                    //     type : "customrecord_mb_inv_req",
                    //     id : recordId,
                    //     values : {'custrecord_mb_inv_req_ia_tran':null,'custrecord_mb_inv_req_not_reqd': false }
                    // });

                }
            }catch(err){
                log.error("Error ", err.message); 
            }
            return recordId;
        }

        function getCustomerId(storeId){
             var customerId = null; 
             var filters = [["custrecord_mb_shipworks_store_id","is",storeId]];
 
             var mapHeaderSearchObj = search.create({
                 type: "customrecord_mb_map_header",
                 filters: filters,
                 columns: [search.createColumn({name: "entityid",join: "CUSTRECORD_MB_CUSTOMER"})]
             });
 
             var searchResult = mapHeaderSearchObj.run().getRange({ start: 0, end: 10 });
             log.debug("mapHeaderSearchObj result count", searchResult);
 
             if (searchResult.length>0) {
                 customerId = searchResult[0].getValue({name: 'entityid',join: 'CUSTRECORD_MB_CUSTOMER'});
                 log.debug('customerId', customerId);
             }
             return customerId;            
        }

        function getLocationId(storeId){
            var locationId = null; 
            var filters = [["custrecord_mb_shipworks_store_id","is",storeId]];

            var mapHeaderSearchObj = search.create({
                type: "customrecord_mb_map_header",
                filters: filters,
                columns: [search.createColumn({name: "custrecord_mb_map_header_location"})]
            });

            var searchResult = mapHeaderSearchObj.run().getRange({ start: 0, end: 10 });
            log.debug("mapHeaderSearchObj result count", searchResult);

            if (searchResult.length>0) {
                locationId = searchResult[0].getValue({name: 'custrecord_mb_map_header_location'});
                log.debug('locationId', locationId);
            }
            return locationId;
       }        

        function executionTimesUp() {
            var timeElapsed = Math.abs((new Date()).getTime() - startDateTime.getTime());
            var minutesRunning = Math.floor((timeElapsed / 1000) / 60);
            return (minutesRunning > executionThreshold);

        }

        function searchGetResultObjects(search, _start, _end) {
            try {
                var results;
                if (_start != null && _end != null) {
                    results = search.run()//.getRange({
                    results = results.getRange({
                        start: _start,
                        end: _end
                    })

                    //});
                } else {
                    results = searchGetAllResult(search);
                };
                //          	log.debug('results',JSON.stringify(results));

                var columns = search.columns;
                //          	log.debug('columns',JSON.stringify(columns));

                var arrResults = new Array();

                //          	log.debug('results.length',results.length);

                for (var k = 0; k < results.length; k++) {

                    var tempObj = new Object();
                    var _result = results[k];
                    for (i = 0; i < columns.length; i++) {

                        if (columns[i].hasOwnProperty('join') == false) {
                            columns[i].join = null;
                        };
                        if (columns[i].hasOwnProperty('summary') == false) {
                            columns[i].summary = null;
                        }

                        var propName = columns[i].label.replace(/ /g, "_");

                        tempObj[propName] = _result.getValue(columns[i]);

                        var textName = propName + '_text';

                        tempObj[textName] = _result.getText({
                            name: columns[i].name,
                            join: columns[i].join,
                            summary: columns[i].summary
                        });
                    };

                    //    				tempArray.push(tempObj);
                    arrResults.push(tempObj);
                };
                return arrResults;
            } catch (err) {
                log.error('error is searchgetresultobjects', JSON.stringify(err))
            }

        }

        function searchGetAllResult(option) {
            var result = [];
            if (option.isLimitedResult == true) {
                var rs = option.run();
                result = rs.getRange(0, 1000);

                return result;
            }

            var rp = option.runPaged();
            rp.pageRanges.forEach(function (pageRange) {
                var myPage = rp.fetch({ index: pageRange.index });
                result = result.concat(myPage.data);
            });

            return result;
        };
        function getQuantityAvailable(itemId,locationId){
            try{                
                var qtyAvailable = 0;
                if (!itemId) return qtyAvailable;
                if(!locationId) return qtyAvailable;
                
                oSearch = new Object();
                oSearch.type = "item";
                oSearch.filters = [["internalid","is",itemId],
                        "AND",
                        ["inventorylocation","anyof",locationId]];
                oSearch.columns = [search.createColumn({ name: "locationquantityavailable" })];
                                    
                var itemSearch = search.create(oSearch);
                itemSearch.run().each(
                    function(result) {
                        qtyAvailable = result.getValue({name: "locationquantityavailable"});
                        return true;
                });                
            }
            catch(e){
                log.debug("Error during export",e.message);

            }
            
            return(zeroIfEmptyOrNull(qtyAvailable));
        }

        function zeroIfEmptyOrNull(val){
            var zero = 0
            zero = zero.toFixed(0)
            if(val===null || val===''){
                return zero;
            } else {
                return val;
            }
        }
        function getDateValue(dateAsString) {
            try {
                var trandate = format.parse({
                    value: dateAsString,
                    type: format.Type.DATE
                });
            } catch (e) {
                log.error('IR RecordHandler', 'Parse date error: ' + e.message);
            }
            return trandate;
        }

        function createAndSubmitTask() {
            try{
                var ssParams = {};
                var ssTask = task.create({
                    taskType: task.TaskType.SCHEDULED_SCRIPT,
                    scriptId: SCHEDULED_SCRIPT_ID,
                    params: ssParams
                });
                var ssTaskId = ssTask.submit();
    
                log.audit("taskid",ssTaskId); 
            }
            catch (ex) {
                var oLog = 	{title: "create task error",details: JSON.stringify(ex)};
                log.error(oLog);
            }
            return
        }
    
        return {
            post: doPost
        };

    });