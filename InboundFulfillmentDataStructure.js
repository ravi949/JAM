/**
 * @NApiVersion 2.x
 * @NScriptType restlet
 * @NModuleScope SameAccount
 * 
 * Created By	      - Bhargavi A
 * Created Date       - 08-12-2021
 * script name        - TSS RST Inbound Fulfillment.
 * Script Type        - RESTLET Script
 * Script Description - This Script is used to generate item fulfillment for the requested salesorders through JSON.
 */
define(['N/error', 'N/record', 'N/runtime', 'N/search', 'N/format'],
    function (error, record, runtime, search, format) {

        const MINIMUM_USAGE = 300;
        const BNC_SUB = 32;
        const INV_SEARCHID = '14195';
        const SB_INV_SEARCHID = '14510';
        var startDateTime = new Date();


        function doPost(requestBody) {

            // executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
            executionThreshold = 55;
            var receivedJson = requestBody;
            // log.debug('received Data: ',JSON.stringify(receivedJson));
            var orders = receivedJson; var nsResponse;
            try {
                var results = new Array();

                for (var index = 0; index < orders.length; index++) {
                    var order = orders[index];
                    nsResponse = validJSON(order);
                    log.debug("nsResponse for index " + index.toString(), JSON.stringify(nsResponse));
                    results.push(nsResponse);

                    // if(testMode && index>=4) throw error.create({name: 'TEST_ERROR',message: "TESTING Integration stopped to avoid a script timeout"});

                    if (executionTimesUp()) {
                        throw error.create({ name: 'TIME_LIMIT_CHECK', message: "Integration stopped to avoid a script timeout" });
                    }

                    var scriptObj = runtime.getCurrentScript();
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
                log.audit("response", response)
                results.push(response);
            }
            return results;
        }

        function TESTvalidJSON(receivedJson) {
            if (receivedJson != null && receivedJson != '') {
                var msg = 'GOOD Test json ' + receivedJson.orderInternalId;
                return returnresponse(msg, receivedJson.orderInternalId);
            }
        }

        function validJSON(receivedJson) {
            if (receivedJson != null && receivedJson != '') {
                 log.debug("recvd JSON",JSON.stringify(receivedJson));
                var salesorderId = receivedJson.orderInternalId || '';
                if (salesorderId != '' && salesorderId != null && salesorderId != undefined) {
                    log.debug('salesorderId', salesorderId);
                    var fulfillmentDateValue = receivedJson.fulfillmentDate || '';
                    log.debug('fulfillmentDateValue ', fulfillmentDateValue);
                    if (fulfillmentDateValue != '' && fulfillmentDateValue != null && fulfillmentDateValue != undefined) {
                        var itemsJson = receivedJson.items || '';
                        log.debug('52 itemsJson', itemsJson);
                        if (itemsJson && itemsJson.length > 0) {
                            var responseObj = processFulfillment(receivedJson, itemsJson);
                            return responseObj;
                        } else {
                            log.debug('Items JSON missing');
                            var msg = 'Item JSON required. Order Internal id ' + salesorderId;
                            return returnresponse(msg);
                        }

                    } else {
                        log.debug('Date is missing');
                        var msg = 'Item fulfillment date is required. Order Internal id ' + salesorderId;
                        return returnresponse(msg);
                    }
                } else {
                    log.debug('Sales order id is missing');
                    var msg = 'Internal ID of sales order is required. Order Internal id ' + salesorderId;
                    return returnresponse(msg)
                }
            } else {
                log.debug('Input JSON is empty');
                var msg = 'Required details are missing. Order Internal id ' + salesorderId;
                return returnresponse(msg);
            }

        }

        function processFulfillment(receivedJson, itemsJson) {
            try {
                var salesorderId = receivedJson.orderInternalId || '';
                var fulfillmentDateValue = receivedJson.fulfillmentDate || '';
                var trackNumber = receivedJson.trackingNumber || '';
                var packageDes = receivedJson.packageDescription || '';
                var shippingRecName = receivedJson.shippingCode || '';
                var sscidCode = receivedJson.SCCIdCode || '';
                var cartonId = receivedJson.cartonId || '';
                var reservedPckgFld1 = receivedJson.reservedPackageFld1 || '';
                var actualShipCode = receivedJson.actualShipCode || '';
                var requestShipDate = (receivedJson.requestShipDate != '') ? getDateValue(receivedJson.requestShipDate) :  '';
                var shipCost = receivedJson.shipCost || '';

                var objRecordIf = record.transform({ fromType: record.Type.SALES_ORDER, fromId: salesorderId, toType: record.Type.ITEM_FULFILLMENT });

                objRecordIf.setValue({ fieldId: 'shipstatus', value: 'C' });
                var recDate = getDateValue(fulfillmentDateValue);
                if (recDate) {
                    objRecordIf.setValue({ fieldId: 'trandate', value: recDate });
                }
                if (sscidCode) {
                    objRecordIf.setValue({ fieldId: 'custbody_mb_sscid_code', value: sscidCode });
                }
                if (cartonId) {
                    objRecordIf.setValue({ fieldId: 'custbody_mb_carton_id', value: cartonId });

                };
              	if (actualShipCode){
                  objRecordIf.setValue({fieldId : 'custbody28',value: actualShipCode})
                }
              	if (shipCost){
                  objRecordIf.setValue({fieldId : 'custbody_actiual_ship_cost',value : shipCost})
                }
                if (reservedPckgFld1) {
                    objRecordIf.setValue({ fieldId: 'custbody_mb_reserved_package_1', value: reservedPckgFld1 });
                }
                // yes actual is spelled actiual  E.S.L.            
                if(shipCost) objRecordIf.setValue({ fieldId: 'custbody_actiual_ship_cost', value: shipCost });
                if(requestShipDate) objRecordIf.setValue({ fieldId: 'custbody_mb_requested_ship_date', value: requestShipDate });               
                
                var if_item_lines = objRecordIf.getLineCount({ sublistId: 'item' });
                log.debug('if_item_lines', if_item_lines);
                if (if_item_lines > 0) {
                    for (var b = 0; b < if_item_lines; b++) {

                        var line = objRecordIf.getSublistValue({ sublistId: 'item', fieldId: 'custcol_mb_merchant_line_item_number', line: b });
                        log.debug("line" + b.toString(), line);
                        objRecordIf.setSublistValue({ sublistId: "item", fieldId: "itemreceive", value: false, line: b });
                    }
                }
                var tripped = false ; 
                for (var k = 0; k < itemsJson.length; k++) {
                    var itemid = itemsJson[k].itemInternalId
                    log.debug('itemid', itemid);

                    if (itemsJson[k].hasOwnProperty("merchantLineItemNumber")) {
                        if (itemsJson[k].merchantLineItemNumber != "0") {
                            var lineNumber = objRecordIf.findSublistLineWithValue({ sublistId: 'item', fieldId: 'custcol_mb_merchant_line_item_number', value: itemsJson[k].merchantLineItemNumber });
                            if (lineNumber == -1){
                                var lineNumber = objRecordIf.findSublistLineWithValue({ sublistId: 'item', fieldId: 'item', value: itemsJson[k].itemInternalId });
                                
                                
                            }
                            if(itemsJson[k].location == '95' && lineNumber !=-1){
                                log.audit('iteminternalId pre new logic',itemsJson[k].itemInternalId);
                                itemsJson[k].itemInternalId = objRecordIf.getSublistValue({sublistId:'item',fieldId:'item',line:lineNumber});
                                itemid = itemsJson[k].itemInternalId
                                log.audit('iteminternalId post new logic',itemsJson[k].itemInternalId);
                            }
                        } else {
                            var lineNumber = objRecordIf.findSublistLineWithValue({ sublistId: 'item', fieldId: 'item', value: itemsJson[k].itemInternalId });
                        }
                    } else {
                        var lineNumber = objRecordIf.findSublistLineWithValue({ sublistId: 'item', fieldId: 'item', value: itemsJson[k].itemInternalId });
                    };

                    log.debug('lineNumber', lineNumber);
                    if (lineNumber != -1) {
                        var isDropship = objRecordIf.getSublistValue({ sublistId: 'item', fieldId: 'isdropshipline', line: lineNumber })
                        log.audit('isDropshipLine', isDropship)
                        if ((isDropship == false || isDropship == 'F' || isDropship == 'false') &&
                            itemsJson[k].location != '' && itemsJson[k].location != null && itemsJson[k].location != 0) {
                            //var binJson = itemsJson[k].binNumber;
                            var binCheck = checkBins(itemsJson[k].itemInternalId, itemsJson[k].location, itemsJson[k].quantityFulfilled);
                            log.audit('binCheck', binCheck);
                            objRecordIf.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: false, line: lineNumber });
                            if (binCheck.markPd != null) {
                                var soId = record.submitFields({
                                    type: record.Type.SALES_ORDER,
                                    id: salesorderId,
                                    values: { 'custbody_mb_needs_ff_review': binCheck.markPd }
                                });
                                break; 
                            } else
                                if (binCheck.error != null) {
                                    throw error.create({ name: 'BIN_VALIDATION', message: binCheck.error });
                                } else {
                                    tripped = true; 
                                    objRecordIf.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true, line: lineNumber });

                                    // added by lucas 9-30 for AMZ dropship logic. 
                                    if (itemsJson[k].location != 0) {
                                        objRecordIf.setSublistValue({ sublistId: 'item', fieldId: 'location', value: itemsJson[k].location, line: lineNumber });
                                    };
                                    objRecordIf.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: itemsJson[k].quantityFulfilled, line: lineNumber });

                                    var objSubRecord = objRecordIf.getSublistSubrecord({ sublistId: 'item', fieldId: 'inventorydetail', line: lineNumber });
                                    var binJson = binCheck.locationData//itemsJson[k].binNumber;
                                    log.audit('binJson', binJson);
                                    // add logic for kits here 
                                    for (var s = 0; s < binJson.length; s++) {
                                        // added by lucas to handle AMZ dropship logic on 9-30-2022
                                        if (binJson[s].binOnHandAvail != 0) {
                                            objSubRecord.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'binnumber', line: s, value: binJson[s].binInternalId });
                                            objSubRecord.setSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', line: s, value: binJson[s].binOnHandAvail });
                                        }
                                    }
                                    // added for stock supplied process 10-27-23;
                                    var isStockSupplied = objRecordIf.getSublistValue({sublistId : 'item',fieldId: 'custcol_mb_stock_supplied', line : lineNumber});
                                    if(isStockSupplied == true || isStockSupplied == 'T'){
                                        for (var c = 0; c < if_item_lines; c++) {
                                            if(c!=lineNumber){
                                                var dsLineItem = objRecordIf.getSublistValue({ sublistId: 'item', fieldId: 'custcol_mb_item_link', line: c });
                                                log.debug('dsLineItem : '+ b, dsLineItem); 
            
                                                if (dsLineItem == itemid){
                                                    objRecordIf.setSublistValue({ sublistId: "item", fieldId: "itemreceive", value: true, line: c });
                                                }
                                                log.debug("received line" + c.toString(), line);
                                            } else {
                                                continue;
                                            }
                                        }
                                    }
                                }
                        } else {
                            tripped = true;                             
                            objRecordIf.setSublistValue({ sublistId: 'item', fieldId: 'itemreceive', value: true, line: lineNumber });
                            if (itemid=='0'){
                                itemid = objRecordIf.getSublistValue({ sublistId: 'item', fieldId: 'item', value: true, line: lineNumber });
                            }
                            // objRecordIf.setSublistValue({ sublistId: 'item', fieldId: 'quantity', value: itemsJson[k].quantityfulfilled, line: lineNumber });
                            // if (if_item_lines > 0) {
                            for (var c = 0; c < if_item_lines; c++) {
                                if(c!=lineNumber){
                                    var dsLineItem = objRecordIf.getSublistValue({ sublistId: 'item', fieldId: 'custcol_mb_item_link', line: c });
                                    log.debug('dsLineItem : '+ b, dsLineItem); 

                                    if (dsLineItem == itemid){
                                        objRecordIf.setSublistValue({ sublistId: "item", fieldId: "itemreceive", value: true, line: c });
                                    }
                                    log.debug("received line" + c.toString(), line);
                                } else {
                                    continue;
                                }
                            }
                            // }
                        }
                    }
                }
                if(!tripped){ 
                    var msg = "Salesorder internal id "+salesorderId + " No inventory found to ship. Check allocations."
                    return returnPartialFailResponse(msg, salesorderId)
                }
                
                try {
                    if (shippingRecName != null && shippingRecName != '') {
                        var ship_method = getShipMethod(objRecordIf,shippingRecName);
                        log.debug('ship_method', ship_method); 
                        if (ship_method != null && ship_method != '') {
                            objRecordIf.setValue({ fieldId: 'shipcarrier', value: 'nonups' });
                            objRecordIf.setValue({ fieldId: 'shipmethod', value: ship_method });
                        }
                    }
                    // added by MIBAR on 4/13/22
                    objRecordIf.setValue({ fieldId: 'custbody_tss_shipping_confirmation_box', value: false });
                    var recId = objRecordIf.save();
                    log.debug('Record created successfully', recId);


                    if (recId != null & recId != '') {
                        if (trackNumber != null && trackNumber != '') {
                            var fulfillRecord = record.load({ type: 'itemfulfillment', id: recId });
                            fulfillRecord.setSublistValue({ sublistId: 'package', fieldId: 'packagedescr', line: 0, value: packageDes });
                            fulfillRecord.setSublistValue({ sublistId: 'package', fieldId: 'packagetrackingnumber', line: 0, value: trackNumber });
                            var fulfillId = fulfillRecord.save();
                            log.debug('Tracking Details updated successfully', fulfillId);
                        }
                        if (fulfillId != '' && fulfillId != '') {
                            var msg = "Salesorder internal id "+salesorderId + ' The item fulfillment record has been created.';
                            return returnresponse(msg, fulfillId);
                        } else {
                            var msg = "Salesorder internal id "+salesorderId + ' Item fulfillment has been created. But, failed to update Package details'
                            return returnPartialFailResponse(msg, recId);
                        }
                    }

                } catch (e) {
                    log.error('Failed to create Record', JSON.stringify(e));
                    var msg = "Salesorder internal id "+salesorderId +" " +  e.message; 
                    return returnresponse(msg,null);
                }

            } catch (e) {
                const ERROR_BADSO = "INVALID_INITIALIZE_REF"; 
                log.debug('Error in processFulfillment is :', JSON.stringify(e));                
                if(e.name != ERROR_BADSO){
                    var msg = "Salesorder internal id "+salesorderId + " " + e.message;                 
                    return returnresponse(msg,null,true);
                }
                // name = ERROR_BADSO
                var msg = "Ignoring invalid / reposted SO:  "+ e.message;
                return returnPartialFailResponse(msg, salesorderId);                
            }

        }

        function returnresponse(msg, recordId,isException) {
            var response;
            var exStatus = "fail"; 
            if(isException !=undefined && isException)  exStatus = "exception"; 

            response = {
                "Status": exStatus,
                "Message": msg,
            };
            if (recordId != '' && recordId != null && recordId != undefined) {
                response.RecordId = recordId
                response.Status = "success";
            }

            log.audit("response 277", response)
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

        function getShipMethod(objRecordIf, shippingRecName) {

            var isBNC = 'F'; var ship_method = null; 
            if (objRecordIf.getValue({ fieldId: 'subsidiary' }) == BNC_SUB) {
                shippingRecName = 'BNC_' + shippingRecName;
                isBNC = 'T';
            }
            var filters = [["name", "is", shippingRecName], "AND", ["isinactive", "is", "F"], "AND", ["custrecord_mb_is_bnc", 'is', isBNC]];

            var mb_shipping_codesSearchObj = search.create({
                type: "customrecord_mb_shipping_codes",
                filters: filters,
                columns: [search.createColumn({ name: "name", sort: search.Sort.ASC }), search.createColumn({ name: "custrecord_mb_shipping_method" })]
            });

            var searchResultCount = mb_shipping_codesSearchObj.run().getRange({ start: 0, end: 10 });
            log.debug("customrecord_mb_shipping_codesSearchObj result count", searchResultCount);

            if (searchResultCount != '' && searchResultCount != null && searchResultCount != undefined) {
                ship_method = searchResultCount[0].getValue('custrecord_mb_shipping_method');
                log.debug('ship_method', ship_method);
            }
            return ship_method;
        }

        function executionTimesUp() {
            var timeElapsed = Math.abs((new Date()).getTime() - startDateTime.getTime());
            var minutesRunning = Math.floor((timeElapsed / 1000) / 60);
            return (minutesRunning > executionThreshold);

        }
        function checkBins(itemId, location, quantity) {
            try {
                var binSrch = search.load({
                    id: INV_SEARCHID,
                    type: 'inventorybalance'
                });
                binSrch.filters.push(search.createFilter({
                    name: 'internalid',
                    join: 'item',
                    operator: search.Operator.ANYOF,
                    values: itemId
                }));
                binSrch.filters.push(search.createFilter({
                    name: 'location',
                    operator: search.Operator.ANYOF,
                    values: location
                }));

                binSrch.filters.push(search.createFilter({
                    name : 'locationquantityonhand',
                    join : 'item',
                    operator : search.Operator.GREATERTHANOREQUALTO,
                    values : quantity
                }))


                var itemBinData = searchGetResultObjects(binSrch);

                log.audit('itemBinData', JSON.stringify(itemBinData));
                log.audit('itemBinData length', itemBinData.length);
                var binSuccess = false;
                var locationArray = new Array();
                if (itemBinData.length > 0) {
                    if (parseInt(itemBinData[0].binOnHandAvail) >= parseInt(quantity)) {
                        itemBinData[0].binOnHandAvail = quantity;
                        locationArray.push(itemBinData[0]);
                        binSuccess = true;
                    } else {
                        var binQty = 0;
                        for (var m = 0; m < itemBinData.length; m++) {
                            if (binQty < parseInt(quantity)) {
                                var qtyToSet = (binQty + parseInt(itemBinData[m].binOnHandAvail)) > parseInt(quantity) ? parseInt(quantity) - binQty : itemBinData[m].binOnHandAvail;
                                itemBinData[m].binOnHandAvail = qtyToSet;
                                locationArray.push(itemBinData[m]);
                                binQty = binQty + itemBinData[m].binOnHandAvail;
                            } else {
                                binSuccess = true;
                                break;
                            }
                        }
                        if (binQty < parseInt(quantity)) {
                            return {
                                locationData: null,
                                markPd: 'Insufficient Quantity in NS - Needs Review',
                                error: null
                            };
                        };
                    }
                } else {
                    return {
                        locationData: null,
                        markPd: 'Insufficient Quantity in NS - Needs Review',
                        error: null
                    };
                }
                // if (binSuccess) {
                //     return { locationData: locationArray, markPd: null, error: null };
                // }
                return { locationData: locationArray, markPd: null, error: null };

            } catch (err) {
                log.error('ERROR IN CHECKING BINS', JSON.stringify(err));
                return { locationData: null, markPd: null, error: JSON.stringify(err) };
            }
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

        return {
            post: doPost
        };

    });