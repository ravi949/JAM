/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 * 
 */

var EMAIL_FROM_DEFAULT = 1423;
const INVENTORY_SEARCH = "15401";
const ITEM_SEARCH = "15443";
const ADJUSTMENT_ACCOUNT = "1614";

define(
    [
        'N/email',
        'N/error',
        'N/record',
        'N/runtime',
        'N/search',
        './lib/MBHelpers.js',
        './lib/MBErrorHandler.js',
        './lib/MBFormatFunctions.js'
    ],
    function (email, error, record, runtime, search, mbhelp, mberror, mbformat) {


        /**
         * Definition of the Scheduled script trigger point.
         * 
         * @param {Object}
         *            scriptContext
         * @param {string}
         *            scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
         * @Since 2015.2
         */

        function execute(scriptContext) {
            try {
                var checkInv = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_check_inv' });                
                var runStats = doLoop(checkInv);

                var goodCount = runStats.goodCount
                var badCount = runStats.badCount

                var respText = " Inventory Adjustments have been created ";
                respText += '<br>There were ~1  processed.'.replace('~1', goodCount.toString());
                if (badCount != 0)
                    respText += "<br>Please note: ~2 could not be processed due to errors. ".replace('~2', badCount.toString());
                //    		    	sendNotification(respText);
            }
            catch (err) {
                log.error("Error", JSON.stringify(err));
                throw err;
            }
        }

        function doLoop(checkInv) {
            var goodCount = 0; var badCount = 0;
            var invReqLines = getSearchData();
            if (invReqLines.length > 0) {
                var locationDate = itemsByLocationDate(invReqLines);
                var inventoryData = itemsByLocation(invReqLines);
                prepLines(locationDate, inventoryData,checkInv);
            }

            goodCount++
            badCount++;

            var runStats = {
                goodCount: goodCount,
                badCount: badCount
            }

            return runStats;
        }

        function itemsByLocationDate(invReqLines) {
            // get Locations for each date
            var locationDates = invReqLines.map(function (element, index) {
                return element.locationId + "~" + element.dateRequired
            });
            // log.debug("locationDates",locationDates.join(","));

            // unique ones only 
            var locationDate = locationDates.filter(function (element, index) {
                return (locationDates.indexOf(element) === index)
            });
            //log.debug("locationDate",locationDate.join(","));

            // get the items for each key, 
            var invAdj = new Array();
            for (var index = 0; index < locationDate.length; index++) {
                var LDkey = locationDate[index];
                var itemLocation = invReqLines.filter(function (element, index) {
                    var key = element.locationId + "~" + element.dateRequired;
                    return (key == LDkey)
                });
                invAdj.push({ key: LDkey, items: itemLocation });
                log.debug("invAdj " + LDkey, itemLocation.length);
            }
            return invAdj;
        }

        // return an array of locations with items and inventory and costs 
        function itemsByLocation(invReqLines) {
            var locations = invReqLines.map(function (element, index) {
                return element.locationId;
            });
            // log.debug("locations", locations.join(","));

            // unique ones only 
            var location = locations.filter(function (element, index) {
                return (locations.indexOf(element) === index)
            });
            log.debug("uniq location", location.join(","));

            var locationItemsNew = new Array();
            for (var index = 0; index < location.length; index++) {

                var locationId = location[index];
                log.debug("location id ", locationId);
                var invReqLinesThisLocation = invReqLines.filter(function (element, index) {
                    return (element.locationId === locationId)
                });
                log.debug("invReqLinesThisLocation ", invReqLinesThisLocation.length);
                var itemsALL = invReqLinesThisLocation.map(function (element, index) {
                    return element.itemId;
                });
                var items = itemsALL.filter(function (element, index) {
                    return (itemsALL.indexOf(element) === index)
                })
                log.debug("items ", items.length);
                var inventoryData = getInventory(locationId, items);
                locationItemsNew.push({ locationId: locationId, items: items, invItems: inventoryData });
                // log.debug("locationItemsNew ", locationId + " " + JSON.stringify(items));
                //log.debug("inventoryData",JSON.stringify(inventoryData)); 

            }
            return locationItemsNew
        }

        // returns an array by location item with sum qtys 

        // function qtysByLocationItem(invReqLines) {
        //     var locationItems = invReqLines.map(function (element, index) {
        //         return element.locationId + "~" + element.itemId;
        //     });
        //     log.debug("locationitems", locationItems.join(","));

        //     // unique ones only 
        //     var locationItem = locationItems.filter(function (element, index) {
        //         return (locationItems.indexOf(element) === index)
        //     });
        //     // log.debug("location", locationItem.join(","));
        //     // log.debug("location length ", locationItem.length);

        //     // get the items for each key, 
        //     var invAdj = new Array();
        //     for (var index = 0; index < locationItem.length; index++) {
        //         var LIkey = locationItem[index];
        //         var items = invReqLines.filter(function (element, index) {
        //             var key = element.locationId + "~" + element.itemId;
        //             return (key == LIkey)
        //         });
        //         var qtys = items.map(function (element, index) {
        //             return element.quantity;
        //         })
        //         var sumQty = qtys.reduce(function (accumulator, currentValue) {
        //             return parseInt(accumulator) + parseInt(currentValue)
        //         }, 0);

        //         invAdj.push({ key: LIkey, items: items, sumQty: sumQty });
        //         // log.debug("sumQty ", sumQty);
        //         // log.debug("invAdj ", LIkey + " " + JSON.stringify(items));
        //     }
        //     // log.debug("invAdj",JSON.stringify(invAdj));
        //     return invAdj
        // }

        // create IAs for each location date rcd
        // check inventorydata 
        // flag the locationDate array if theres inv for this item+ location and dont add it to IA 
        // no (or insufficient inv) add it ,

        function prepLines(locationDate, inventoryData,checkInv) {
            var lastLocation =""; var defaultBin; 
            locationDate.forEach(function (LDRcd) {
                var kvp = LDRcd.key.split("~");
                var locationId = kvp[0]; 
                if(lastLocation != locationId){ 
                    lastLocation = locationId;
                    defaultBin = getBin(lastLocation); 
                }
                var dateRequired = kvp[1];
                log.debug("now on location / dateRequired", locationId + " ##" + dateRequired);
                var locationItems = LDRcd.items;
                var itemsToAdjust = new Array();
                locationItems.forEach(function (invReqRcd) {
                    var itemId = invReqRcd.itemId;
                    var quantity = parseInt(invReqRcd.quantity);
                    var adjQuantity = 0;
                    // log.debug("location item", locationId + " ##" + itemId);

                    // get the inventory data for this location                   
                    var locationItemIndex = inventoryData.map(function (el) { return el.locationId; }).indexOf(locationId);
                    if (locationItemIndex >= 0) {
                        var inventoryItemRcd = inventoryData[locationItemIndex];

                        // find the inventory item for this invReq item 
                        var invItems = inventoryItemRcd.invItems;
                        var itemIndex = invItems.map(function (el) { return el.id; }).indexOf(itemId);
                        if (itemIndex >= 0) {
                            var itemRcd = invItems[itemIndex];
                            log.debug("itemRcd av + cost + quantity ", 
                                itemRcd.available.toString() + "####" + itemRcd.averagecost.toString() 
                                + "####" + quantity.toString());
                            // check inventory data here. 
                            var available = parseInt(itemRcd.available);
                            // its in stock flag the record and ignore it                            
                            if(checkInv){
                                if (available >= quantity) { 
                                    log.debug("record flagged because inventory exists ", invReqRcd.id+ "  ##  "+itemId);                                           
                                    update1InvReq(invReqRcd.id);                                    //	trip custrecord_mb_inv_req_not_reqd 
                                } else {
                                    log.debug("Adding this record cause we need inventory ", invReqRcd.id+ "  ##  "+itemId);
                                    adjQuantity = quantity - available;
                                    invReqRcd.adjQuantity = adjQuantity;
                                    
                                    if(adjQuantity>available) adjQuantity=available; 
                                    available = available - adjQuantity;
                                    inventoryData[locationItemIndex].invItems[itemIndex].available = available;  
                                    invReqRcd.cost = itemRcd.averagecost;
                                    invReqRcd.bin = defaultBin; 
                                    itemsToAdjust.push(invReqRcd);
                                }
                            } else {
                                log.debug("Adding this record just with no inv check ", invReqRcd.id+ "  ##  "+itemId);
                                log.debug("invReqRcd ", JSON.stringify(invReqRcd));
                        
                                invReqRcd.adjQuantity = quantity;
                                invReqRcd.cost = itemRcd.averagecost;
                                invReqRcd.bin = defaultBin; 
                                itemsToAdjust.push(invReqRcd);
                            }


                        } else {
                            log.debug("No inventory rcd found for record ## item ", invReqRcd.id+ "  ##  "+itemId);
                            update1InvReq(invReqRcd.id);                                    //	trip custrecord_mb_inv_req_not_reqd                             
                        }
                    } else {
                        log.debug("looking for location failed ", locationId);
                    }
                });
                // buildIA record here with completed itemsToAdjust
                if(itemsToAdjust.length>0)
                    var adjustmentId = createAdjustment(LDRcd, itemsToAdjust);
                    if(adjustmentId == 0) log.debug("no adjustment created!!!",""); 
                else{
                    log.audit("No items found to adjust",locationItems.length.toString()+" ## "+itemsToAdjust.length.toString());
                }
                    log.debug("adjustment created",adjustmentId);
            });
        }

        function createAdjustment(LDRcd, itemsToAdjust) {
            try {
                var kvp = LDRcd.key.split("~");
                var locationId = kvp[0]; var dateRequired = kvp[1];
                var locationInfo = getLocationInfo(locationId);
                if (!locationInfo) 
                    throw new Error("no subsidiary found. Check location record and audit log"); 

                log.debug(' items ', JSON.stringify(itemsToAdjust));

                var invAdjustment = newInvAdjRec.insertRecord(locationId,locationInfo,dateRequired);
                var invLineInsert;                 
                if (invAdjustment != null) {
                    for (var w = 0; w < itemsToAdjust.length; w++) {
                        var line = itemsToAdjust[w]; 
                        log.audit('subData in build Adjustment', JSON.stringify(line));
                        invLineInsert = newInvAdjRec.addInvLines(invAdjustment, line,locationInfo);
                        if (!invLineInsert) break; 
                    };
                    if(!invLineInsert) return 0; 
                    var adjustmentId = invAdjustment.save();

                    var dayBefore = mbformat.parseDateString(dateRequired);
                    dayBefore.setDate(dayBefore.getDate() - 1); 
                    var tranId = locationInfo.className.replace(/[^a-z0-9]/gi, '') 
                                + "_InvSupport_" + 
                                (dayBefore.toISOString().split('T')[0]).replace(/-/g,"");
                    if(adjustmentId){
                        adjustmentId = record.submitFields({type: record.Type.INVENTORY_ADJUSTMENT,id: adjustmentId ,values: {'tranid' : tranId}}); 
                    }                
                    // update the invReq with the new adjustment id 
                    updateInvReq(itemsToAdjust,adjustmentId); 
                    return adjustmentId;
                } else { return 0 };
            } catch (err) {
                log.error('error in buildAdjustment', JSON.stringify(err));
                return 0;
            }
        }
        var newInvAdjRec = {
            sublist: 'inventory',
            insertRecord: function (locationId,locationInfo,dateRequired) {
                try {
                    var dayBefore = mbformat.parseDateString(dateRequired);
                    dayBefore.setDate(dayBefore.getDate() - 1); 
                
                    log.debug("locationId,subsidiaryId,dateRequired,dayBefore ",locationId+" #  "+locationInfo.subsidiaryId+" #  "+dateRequired+" #  "+mbformat.parseDateString(dayBefore)); 
                    var invAdj = record.create({ type: record.Type.INVENTORY_ADJUSTMENT, isDynamic: true });

                    invAdj.setValue({ fieldId: 'trandate',    value: mbformat.parseDateString(dayBefore) }); // tran date
                    invAdj.setValue({ fieldId: 'subsidiary',  value: locationInfo.subsidiaryId });
                    invAdj.setValue({ fieldId: 'class',       value: locationInfo.classId });                    
                    invAdj.setValue({ fieldId: 'account',     value: ADJUSTMENT_ACCOUNT });
                    invAdj.setValue({ fieldId: 'adjlocation', value: locationId });                     
                    invAdj.setValue({ fieldId: 'memo',        value: "Prior day adjustment for FBA failed invoices on " + dateRequired});

                } catch (e) {
                    log.error("Insert Inv Adj Record Error", JSON.stringify(e));
                }
                return (invAdj);
            },

            addInvLines: function (invAdj,itemRcd,locationInfo) {

                try {
                    // add positive line;
                    invAdj.selectNewLine({ sublistId: this.sublist });
                    invAdj.setCurrentSublistValue({ sublistId: this.sublist, fieldId: 'item', value: itemRcd.itemId});
                    invAdj.setCurrentSublistValue({ sublistId: this.sublist, fieldId: 'location', value: itemRcd.locationId });
                    invAdj.setCurrentSublistValue({ sublistId: this.sublist, fieldId: 'adjustqtyby', value: parseFloat(itemRcd.adjQuantity)});
                    invAdj.setCurrentSublistValue({ sublistId: this.sublist, fieldId: 'class',value:locationInfo.classId });
                    invAdj.setCurrentSublistValue({ sublistId: this.sublist, fieldId: 'memo', value:"IA Script batch: "+itemRcd.batchid });
                    invAdj.setCurrentSublistValue({ sublistId: this.sublist, fieldId: 'unitcost', value: parseFloat(itemRcd.cost)});

                    var subrecord = invAdj.getCurrentSublistSubrecord({ sublistId: this.sublist, fieldId: 'inventorydetail' });
                    // log.debug('subrecord', JSON.stringify(subrecord));

                    subrecord.selectLine({ sublistId: 'inventoryassignment', line: 0 });
                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', 
                        fieldId: 'binnumber', value: itemRcd.bin });
                    subrecord.setCurrentSublistValue({ sublistId: 'inventoryassignment', fieldId: 'quantity', value: parseFloat(itemRcd.adjQuantity)});
                    subrecord.commitLine({ sublistId: 'inventoryassignment' });

                    invAdj.commitLine(this.sublist);
                    return true
                } catch (err) {
                    log.error('Error in creating new inv adj rec line', JSON.stringify(err));
                    return false
                }
            }
        }

        function updateInvReq(itemsToAdjust,adjustmentId) {
            if(mbhelp.isEmpty(adjustmentId)) return null;             
            try {
                for (var w = 0; w < itemsToAdjust.length; w++) {
                    var line = itemsToAdjust[w]; 
                    //log.debug('318 line ', JSON.stringify(line));
                    if(line.id)
                        record.submitFields({
                            type : "customrecord_mb_inv_req",
                            id : line.id,
                            values : {'custrecord_mb_inv_req_ia_tran':adjustmentId}
                        });
                };
            } catch (err) {
                log.error('error in  updateInvReq', JSON.stringify(err));
                return null;
            }
        }

        function update1InvReq(invReqId) {
            if(mbhelp.isEmpty(invReqId)) return null; 
            try {
                record.submitFields({
                    type : "customrecord_mb_inv_req",
                    id : invReqId,
                    values : {'custrecord_mb_inv_req_not_reqd':true}
                });
            } catch (err) {
                log.error('error in  update1InvReq', JSON.stringify(err));
                return null;
            }
        }


        function getSearchData() {

            var searchId = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_inv_req_search' });
            if (!searchId) {
                mberror.prettyError(' Scheduled Script Error',
                    "The search (~1) does not exist".replace("~1", searchId));
            }
            var searchObj = search.load({                        // Load Search by scriptId.
                id: searchId,
            });

            // log.debug("search", JSON.stringify(searchObj));
            var searchResults = searchObj.run();                    // Execute Search.
            var srchIdx = 0;
            var invReqLines = new Array();

            if (searchResults) {
                do {
                    var resultSlc = searchResults.getRange({
                        start: srchIdx,
                        end: srchIdx + 1000
                    });        // Retrieve results in 1000-row slices.                        
                    for (var i in resultSlc) {                                // Step through the result rows.
                        var invReq = {
                            id: resultSlc[i].id,
                            recordType: resultSlc[i].recordType,
                            locationId: resultSlc[i].getValue({ name: "custrecord_mb_inv_req_location" }),
                            dateRequired: resultSlc[i].getValue({ name: "custrecord_mb_inv_req_date_required" }),
                            itemId: resultSlc[i].getValue({ name: "custrecord_mb_inv_req_item" }),
                            quantity: resultSlc[i].getValue({ name: "custrecord_mb_inv_req_qty" }),
                            batchid : resultSlc[i].getValue({ name: "custrecord_mb_inv_req_batchid" }),
                            adjQuantity: 0,
                            cost: 0
                        }
                        invReqLines.push(invReq);
                        srchIdx++;
                    }
                } while (resultSlc.length >= 1000);
            }
            return invReqLines;
        }


        function getInventory(locationId, items) {

            var searchId = INVENTORY_SEARCH;
            var searchObj = search.load({ id: searchId });
            var filter;
            if (locationId) {
                log.debug("locationId", locationId);
                filter = search.createFilter({
                    name: 'inventorylocation',
                    operator: search.Operator.IS,
                    values: locationId
                });
                searchObj.filters.push(filter);
            };

            if (items.length > 0) {
                log.debug("items length", items.length);
                filter = search.createFilter({ name: 'internalid', operator: search.Operator.ANYOF, values: items });
                searchObj.filters.push(filter);
            };

            // log.debug("search", JSON.stringify(searchObj));
            var searchResults = searchObj.run();                    // Execute Search.
            var srchIdx = 0;
            var inventoryItems = new Array();

            if (searchResults) {
                do {
                    var resultSlc = searchResults.getRange({
                        start: srchIdx,
                        end: srchIdx + 1000
                    });        // Retrieve results in 1000-row slices.                        
                    for (var i in resultSlc) {                                // Step through the result rows.
                        var cols = resultSlc[i].columns; 
                        var averagecost = mbformat.parseFloatOrZero(resultSlc[i].getValue({ name: "locationaveragecost" }));
                        var item_average_cost = resultSlc[i].getValue({ name: "averagecost" });
                        var purchasePrice = mbformat.parseFloatOrZero(resultSlc[i].getValue({ name: "cost" }));                        
                        var parent_average_cost = mbformat.parseFloatOrZero(resultSlc[i].getValue({ name: "formulanumeric" }));
///////////////// 9/13/2023
                        averagecost = purchasePrice != 0 ? purchasePrice : 
                                    (averagecost != 0 ? averagecost : 
                                    (item_average_cost != 0 ? item_average_cost : parent_average_cost)) ;
/////////////////
                        var itemLine = {
                            id: resultSlc[i].id,
                            recordType: resultSlc[i].recordType,
                            available: mbhelp.isEmpty(resultSlc[i].getValue(cols[cols.length-1])) ? "0" : resultSlc[i].getValue(cols[cols.length-1]),
                            averagecost: averagecost
                        }
                        inventoryItems.push(itemLine);
                        // as you fine each item remove it from original list for next search,
                        var originalItemIndex = items.indexOf(itemLine.id);
                        if(originalItemIndex>=0) items.splice(originalItemIndex,1); 
                        srchIdx++;
                    }
                } while (resultSlc.length >= 1000);
            }
            log.debug("before inventoryItems.length", inventoryItems.length);
            inventoryItems = inventoryItems.concat(getItems(items)); 

            return inventoryItems;
        }

        // add in the items so during the lookup you can still create the IA line. 

        function getItems(items) {

            var searchObj = search.load({ id: ITEM_SEARCH });
            var filter;
            var inventoryItems = new Array();
            if (items.length > 0) {
                log.debug("items length", items.length);
                filter = search.createFilter({ name: 'internalid', operator: search.Operator.ANYOF, values: items });
                searchObj.filters.push(filter);
            }else{return inventoryItems}

            // log.debug("search", JSON.stringify(searchObj));
            var searchResults = searchObj.run();                    // Execute Search.
            var srchIdx = 0;


            if (searchResults) {
                do {
                    var resultSlc = searchResults.getRange({
                        start: srchIdx,
                        end: srchIdx + 1000
                    });        // Retrieve results in 1000-row slices.                        
                    for (var i in resultSlc) {                                // Step through the result rows.
                        var item_average_cost = resultSlc[i].getValue({ name: "averagecost" });
                        var parent_average_cost = resultSlc[i].getValue({ name: "formulanumeric" });
                        averagecost = item_average_cost != 0 ? item_average_cost : parent_average_cost;
                        var itemLine = {
                            id: resultSlc[i].id,
                            recordType: resultSlc[i].recordType,
                            available: "0",
                            averagecost: averagecost
                        }
                        inventoryItems.push(itemLine);
                        srchIdx++;
                    }
                } while (resultSlc.length >= 1000);
            }
            log.debug("missing items.length", inventoryItems.length);
            return inventoryItems;
        }


        function getLocationInfo(locationId) {
            try {
                
                log.debug("538 locationId  ",locationId);
                if (!locationId) return null;
                var locationInfo = {subsidiaryId: null, classId: null , className: null};                 
                var fieldLookUp = search.lookupFields({
                    type: record.Type.LOCATION,
                    id: locationId,
                    columns: ["custrecord_mb_subs_id_in_location", "subsidiary","custrecord_mb_location_channel"]
                });

                if (fieldLookUp.hasOwnProperty('custrecord_mb_subs_id_in_location') && fieldLookUp.custrecord_mb_subs_id_in_location.length > 0) {
                    log.debug('subsidiary id ',fieldLookUp.custrecord_mb_subs_id_in_location[0].value);
                    locationInfo.subsidiaryId = fieldLookUp.custrecord_mb_subs_id_in_location[0].value;
                }
                // if the 2nd loc field wasnt set, throw an error so they know. 
                if (!locationInfo.subsidiaryId && fieldLookUp.hasOwnProperty('subsidiary')) {
                    log.audit("LOCATION TABLE ERROR", "the 2nd subsidiary id is not set. "+ fieldLookUp.subsidary[0].value);
                    return null; 
                }

                if (fieldLookUp.hasOwnProperty('custrecord_mb_location_channel') && fieldLookUp.custrecord_mb_location_channel.length > 0) {
                    log.debug('channel ',fieldLookUp.custrecord_mb_location_channel[0].value);
                    locationInfo.className = fieldLookUp.custrecord_mb_location_channel[0].text;
                    locationInfo.className= mbhelp.isEmpty(locationInfo.className) ? " Not on file" : locationInfo.className; 
                    locationInfo.classId  = fieldLookUp.custrecord_mb_location_channel[0].value;
                }
                log.debug("locationInfo",locationInfo);
            } catch (err) {
                log.error("Error getLocationInfo",JSON.stringify(err));
            }
            return locationInfo;
        }


        function getBin(locationId){
            var filters = [["location","is",locationId]];
    
            var binSearch = search.create({type: "bin",
                    filters:filters, 
                    columns:[search.createColumn({name: "binnumber"})]
            });
            var searchResult = binSearch.run().getRange({start: 0,end: 10});
            log.debug("bin Search result count",JSON.stringify(searchResult)); 
    
            if(searchResult){                
                log.debug('sub',searchResult[0].id);
            }
            return searchResult[0].id
        }
        function sendNotification(respText) {
            var author = EMAIL_FROM_DEFAULT;
            var userId = runtime.getCurrentScript().getParameter({ name: 'custscript_mb_invreq_user' });
            var author = userId;
            log.debug("userId", userId);
            var recipients = userId;
            var subject = "Inventory Requirements Created ";
            var body = respText;

            email.send({
                author: author,
                recipients: recipients,
                subject: subject,
                cc: ['netsuite@mibar.net'],
                body: body
            });
            log.debug("mail sent", userId);
        }

        return {
            execute: execute
        };

    });