/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(["N/record", "N/search","N/runtime"],

    (record, search,runtime) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {
                var spgFactor = runtime.getCurrentScript().getParameter({name:"custscript_mb_def_osc_wo_spoilage"});
                log.debug("spgFactor",spgFactor);
                var detailsSO   = JSON.parse(runtime.getCurrentScript().getParameter({name:"custscript_osc_parameters"}))
                log.audit("ddetailsSO",detailsSO);
                log.audit("detailsSO.len",detailsSO.length);
                for(var m=0;m<detailsSO.length;m++){
                    try{
                        log.audit('m',m);
                        log.debug("details[i]",detailsSO[m]);
                        var soId          = detailsSO[m]["SalesOrder"];
                        var oscVendorId   = detailsSO[m]["vendor"]
                        log.debug("soId",soId)
                    // var vendorLocation = 11

                        var salesOrderObj = record.load({
                            type: "salesorder",
                            id: soId,
                            isDynamic: true
                        });

                        var soChannel  = salesOrderObj.getValue({ fieldId: "class" });
                        log.debug("Sales Order Channel",soChannel);
                        var customer = salesOrderObj.getValue({ fieldId: "entity" });
                        var soTranId = salesOrderObj.getValue({fieldId:'tranid'});

                        salesOrderObj.selectLine({ sublistId: "item", line: 0 });
                        var itemMain         = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId: "item" });
                        var quantity         = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId: "quantity" });
                        var rate             = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId: "rate" });
                        var printVendor      = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_print_vendor" });
                        var amount           = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId:"amount"});
                        // update to check syracuse first then check other locations (185/179) for available inventory if SYR doesn't have stock;
                        var originalLocation = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId: "location" });
                        /* update for location checking
                            check for available inventory >= quantity needed at SYR, if none, then check for inventory available>= qty needed at 185/179;
                        */ 
                        var merchantLine     = salesOrderObj.getCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_merchant_line_item_number" });

                        log.debug("printVendor"      , printVendor);
                        log.debug("itemMain"         , itemMain)
                        log.debug("originalLocation" , originalLocation)
                        log.debug("merchantLine" , merchantLine)


                        /*var oscVendorId = 0;

                        if (printVendor.indexOf("taylor") != -1) {
                            oscVendorId = 31885
                        } else if (printVendor.indexOf("admore") != -1) {
                            oscVendorId = 30990
                        } else if (printVendor.indexOf("navitor") != -1) {
                            oscVendorId = 31885//30990
                        }else if (printVendor.indexOf("fineimpressions") != -1) {
                            oscVendorId = 228
                        }else if (printVendor.indexOf("dupli") != -1) {
                            oscVendorId = 31394
                        } */

                    /* var locationSearchObj = search.create({
                            type     : "location",
                            filters  : [ ["custrecord_mb_osc_loc_vendor", "anyof", oscVendorId] ],
                            columns  : [ search.createColumn({ name: "internalid", label: "Internal ID" }) ]
                        });
                        var searchResultCount = locationSearchObj.runPaged().count;
                        log.debug("locationSearchObj result count", searchResultCount); */

                        var entitySearchObj = search.create({
                            type: "entity",
                            filters:
                            [
                            ["internalid","anyof",oscVendorId]
                            ],
                            columns:
                            [
                            search.createColumn({name: "custentity_mb_outsource_location", label: "Outsourced Vendor Location"})
                            ]
                        });
                        var searchResultCount = entitySearchObj.runPaged().count;
                        log.debug("entitySearchObj result count",searchResultCount);
                        
                        var vendorLocation = null;
                        entitySearchObj.run().each(function (result) {
                            vendorLocation = result.getValue({ name: "custentity_mb_outsource_location" });
                            return true;
                        });
                        log.debug("vendorLocation",vendorLocation);


                        var fieldLookUp = search.lookupFields({
                            type    : "inventoryitem",
                            id      : itemMain,
                            columns : ['custitem_mb_inv_assoc_assembly']
                        });
                        log.debug("fieldLookUp", fieldLookUp);

                        var assemblyItem = fieldLookUp["custitem_mb_inv_assoc_assembly"][0]["value"];
                        log.debug("assemblyItem", assemblyItem);


                        var lineCount = salesOrderObj.getLineCount({ sublistId: "item" });
                        log.debug("lineCount", lineCount)

                        var soDetails = [];

                        for(var i =1 ; i < lineCount ; i++){
                            var item1           = salesOrderObj.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
                            var quantity1       = salesOrderObj.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i });
                            var rate1           = salesOrderObj.getSublistValue({ sublistId: "item", fieldId: "rate", line: i });
                            // var amount         = salesOrderObj.getSublistValue({sublistId: "item", fieldId : 'amount', line : i});
                            // added to resolve tax issue - 11-3-2023 LPB
                            var taxItem = salesOrderObj.getSublistValue({sublistId:'item',fieldId:'taxcode',line:i});
                            var object = { "item": item1, "quantity": quantity1, "rate": rate1};

                            soDetails.push(object);
                        }

                        log.debug("soDetails",soDetails);
                        salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "item"       ,value: assemblyItem });
                        salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity"   ,value: quantity });
                        salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "rate"       ,value: rate }); 
                        salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "amount"    ,value: amount});
                        // added to resolve tax issue - 11-3-2023 LPB
                        salesOrderObj.setCurrentSublistValue({sublistId:'item',fieldId:'taxcode',value:taxItem});
                        
                        for(var i=0;i<lineCount;i++){
                            salesOrderObj.selectLine({ sublistId: "item", line: i });
                            var poVendor = i==0 ? "" : oscVendorId
                            salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "povendor"   ,value: poVendor });
                            salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "location"   ,value: vendorLocation });
                            salesOrderObj.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_item_link"   ,value: assemblyItem });
                            salesOrderObj.commitLine({ sublistId: "item" });
                        }

                        var id = salesOrderObj.save();
                        log.debug("id", id)

                        

                        var costDetails = vendorCostCalculated(quantity,itemMain,oscVendorId)[2]
                        log.debug("costDetails", costDetails);

                        var vendorCostDetails = costDetails.filter(obj => {return obj.vendor == oscVendorId && obj.item == itemMain })
                        
                        if(vendorCostDetails.length>0){
                            log.debug("vendorCostDetails", vendorCostDetails);
                            var vendorCostQuant  = Number(vendorCostDetails[0]["cost"]) //Number(vendorCostDetails[0]["quantity"])* Number(vendorCostDetails[0]["cost"])
                            log.debug("vendorCostQuant", vendorCostQuant);
                        }


                        var customrecord_mb_adder_vendor_costsSearchObj = search.create({
                            type: "customrecord_mb_adder_vendor_costs",
                            filters:
                                [
                                    ["custrecord_mb_vendor", "anyof", oscVendorId],
                                    "AND",
                                    ["custrecord_mb_adder_item", "anyof", itemMain],
                                    "AND",
                                    [["custrecord_mb_adder_cost_type", "anyof", "2"],"OR",["custrecord_mb_vc_charge_item","noneof","@NONE@"]],
                                    "AND", 
                                    ["isinactive","is","F"],
                                  "AND",
                                    ["formulanumeric: case when "+quantity+" >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end","equalto","1"],
                                    "AND",
                                    ["custrecord_mb_stock_supplied_vc", "is","T"]
                                ],
                            columns:
                                [
                                    search.createColumn({ name: "custrecord_mb_adder_cost", label: "Cost" }),
                                    search.createColumn({ name: "custrecord_mb_adder_quantity_break_min",sort: search.Sort.DESC,label: "Quantity Break Min"}),
                                    search.createColumn({name:'custrecord_mb_vc_charge_item' })
                                ]
                        });
                        var searchResultCount = customrecord_mb_adder_vendor_costsSearchObj.runPaged().count;
                        log.debug("customrecord_mb_adder_vendor_costsSearchObj result count", searchResultCount);
                        var fixedVendorCost = new Array();
                        var chargeItems = new Array()
                        customrecord_mb_adder_vendor_costsSearchObj.run().each(function (result) {
                            if(chargeItems.indexOf(result.getValue({name:'custrecord_mb_vc_charge_item'})) == -1){
                                fixedVendorCost.push({"cost" : result.getValue({ name: "custrecord_mb_adder_cost" }),"chargeItem" : result.getValue({name:'custrecord_mb_vc_charge_item'})})
                                chargeItems.push(result.getValue({name:'custrecord_mb_vc_charge_item'}));
                            }
                            return true;
                        });
                        log.debug("fixedVendorCost",fixedVendorCost);


                        var params = {
                            soid            : soId,
                            soline          : 0,
                            specord         : 'T', 
                            assemblyitem    : assemblyItem 
                        };

                        var workOrder = record.create({
                            type: record.Type.WORK_ORDER,
                            isDynamic: true,
                            defaultValues: params
                        });

                        workOrder.setValue({
                            fieldId: 'quantity',
                            value: quantity
                        });
                        workOrder.setValue({
                            fieldId: 'class',
                            value: soChannel
                        });
                        workOrder.setValue({
                            fieldId: 'location',
                            value: vendorLocation
                        });
                        try{
                        workOrder.setValue({
                            fieldId : 'custbody_mb_build_linked_to_so',
                            value   :  soId
                        });
                        }catch(e){ log.error("Exception",e) }

                        {// Added by Sai.k for adders.

                            var soLineCount = salesOrderObj.getLineCount({ sublistId: "item" });
                            log.debug("soLineCount", soLineCount);
                            var spoilageFactor = spoilageFactorCal(quantity);
                            log.debug("spoilageFactor",spoilageFactor)

                            workOrder.selectLine({ sublistId: "item", line: 0 });
                            var woQuantity = workOrder.getCurrentSublistValue({ sublistId: "item", fieldId: "quantity" });
                            workOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: Number(quantity) + Number(spoilageFactor) });
                            workOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_mb_wo_inv_noncomponent',value:false})
                            workOrder.commitLine({ sublistId: "item" });

                            if(fixedVendorCost.length>0){
                                for(y=0;y<fixedVendorCost.length;y++){
                                    if(fixedVendorCost[y].chargeItem!='' && fixedVendorCost[y].chargeItem!=null){
                                        workOrder.selectNewLine({ sublistId: "item" });
                                        workOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: fixedVendorCost[y].chargeItem });
                                        /*var dividend = Number(1) / Number(vendorCost);
                                        var priceQuantity = Number(quantity) / Number(dividend) */
                                        workOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: fixedVendorCost[y].cost});
                                        workOrder.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_mb_wo_noninv_component',value:true})
                                        workOrder.commitLine({ sublistId: "item" });
                                    }
                                }

                           /* workOrder.selectNewLine({ sublistId: "item" });
                            workOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: 511544 });
                            workOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: Number(1) * Number(fixedVendorCost) });
                            workOrder.commitLine({ sublistId: "item" }); */
                            }

                            /*var itemType = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"itemtype",line:i});
                            log.debug("itemType",itemType);
                            if(itemType == "Service"){  
                                adderFlag = true;
                                var quantity = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"quantity",line:i});
                                var rate     = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"rate",line:i});
                                var des      = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"description",line:i});
                                var taxCode  = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"taxcode",line:i});
                                log.debug("quantity",quantity)

                                workOrder.selectNewLine({sublistId:"item"});
                                workOrder.setCurrentSublistValue({sublistId:"item",fieldId:"item",value:item});
                                workOrder.setCurrentSublistValue({sublistId:"item",fieldId:"quantity",value:quantity});
                                workOrder.commitLine({sublistId:"item"});

                            } */


                        }

                        var woId = workOrder.save();
                        log.debug("woId", woId)

                        

                        {
                            // Add the logic to linke the created worked order to the sales order .
                            // When creating a transfer order. Take the original location that was on the sales order before changing it to traffic works and use that and use that as the from location.
                            //Item for the trasnfer order should be the parent item. Quantity should be the work order quantity. Link the work order also.

                        }
                        var subsidiary = salesOrderObj.getValue({ fieldId: "subsidiary" });

                        var transferOrder = record.create({
                            type: record.Type.TRANSFER_ORDER,
                            isDynamic: true
                        });
                      /*  transferOrder.setValue({
                            fieldId: 'tranid',
                            value: 'TO-'+soTranId+"-"+merchantLine
                        }) */

                        transferOrder.setValue({
                            fieldId: 'subsidiary',
                            value: subsidiary
                        });
                        transferOrder.setValue({
                            fieldId: 'class',
                            value: soChannel
                        });

                        transferOrder.setValue({
                            fieldId: 'memo',
                            value: 'Created With Schedueld'
                        });

                        transferOrder.setValue({
                            fieldId: 'location',
                            value: originalLocation
                        });

                        transferOrder.setValue({
                            fieldId: 'transferlocation',
                            value: vendorLocation
                        });
                        transferOrder.setValue({
                            fieldId: 'custbody_mb_osc_related_record',
                            value: woId
                        });


                        transferOrder.selectNewLine({ sublistId: "item" });
                        transferOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "item",                           value: itemMain });
                        transferOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity",                       value: Number(quantity) + Number(spoilageFactor) });
                        transferOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_soline_linked_to_wo", value: woId });
                        transferOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_merchant_line_item_number", value:merchantLine});
                        transferOrder.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_stock_supplied", value:true});
                        transferOrder.commitLine({ sublistId: "item" });


                        var transferOrderId = transferOrder.save();
                        log.debug({ title: 'TO ID', details: transferOrderId });
                        if (transferOrderId) {

                            record.submitFields({
                                type    : "transferorder",
                                id      : transferOrderId,
                                values  : { "tranid":  'TO-'+soTranId+"-"+merchantLine }
                            }) 

                            record.submitFields({
                                type: "workorder",
                                id: woId,
                                values: { "custbody_mb_osc_related_record": transferOrderId }
                            })
                        }

                        if(woId){
                            var recordObj = record.load({type:"salesorder",id:soId,isDynamic:true});
                            
                            recordObj.selectLine({sublistId:"item",line:0});
                            recordObj.setCurrentSublistValue({sublistId:"item",fieldId:"custcol_mb_soline_linked_to_wo",value:woId});
                            recordObj.setCurrentSublistValue({sublistId:"item",fieldId:"custcol_mb_related_transfer",value:transferOrderId});
                            recordObj.setCurrentSublistValue({sublistId:"item",fieldId:"custcol_mb_stock_supplied",value:true});
                            recordObj.commitLine({sublistId:"item"});

                            var id = recordObj.save();
                            log.debug("Updated WO on SO ID of",id);

                        }

                        {
                            //After the transafer order is created we have to craete a drop ship po with the adder item, Handaling fee, print charge


                        }


                        var poParams = {
                            'recordmode': 'dynamic',
                            'soid': soId,
                            'shipgroup': 1,
                            'poentity': oscVendorId,
                            'dropship': 'T',
                            'custid': customer,
                            'entity': oscVendorId
                        };

                        var poRec = record.create({
                            type: record.Type.PURCHASE_ORDER,
                            isDynamic: true,
                            defaultValues: poParams
                        });

                        // Added by Lucas 2-8-2024
                        var daysToAdd = 10
                        var expectedReceiptDate =  new Date(new Date().getTime()+(daysToAdd*24*60*60*1000));

                        var lineNumber = poRec.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            value: assemblyItem
                        });

                        if(lineNumber != -1){
                            poRec.removeLine({ sublistId: 'item', line: lineNumber });
                        }

                        { // Added on 9/27/2023
                            var lineCount = poRec.getLineCount({sublistId:"item"});
                            log.debug("lineCount",lineCount);
                            for(var i=0;i<lineCount;i++){
                                var adderItem           = poRec.getSublistValue({sublistId:"item",fieldId:"item",line:i});
                                if(adderItem != '497200' && adderItem != '540102'){ // ignore variance & admin charge items; -- need to make dynamic; 
                                    var adderQuantity       = poRec.getSublistValue({sublistId:"item",fieldId:"quantity",line:i});
                                    log.debug("adderItem",adderItem);
                                    var details             = vendorCostCalculated(adderQuantity,adderItem,oscVendorId)[2]
                                    log.debug("details",details)
                                    var vendorCostDetails = details.filter(obj => {return obj.vendor == oscVendorId && obj.item == adderItem });
                                    log.debug("vendorCostDetails",vendorCostDetails);
                                    poRec.selectLine({sublistId:"item",line:i});
                                    poRec.setCurrentSublistValue({sublistId : 'item', fieldId:'expectedreceiptdate',value:expectedReceiptDate });
                                    if(vendorCostDetails.length>0){
                                        var vendorCostQuant  = Number(vendorCostDetails[0]["cost"])
                                        poRec.setCurrentSublistValue({sublistId:"item",fieldId:"rate",line:i,value:vendorCostQuant});
                                        poRec.setCurrentSublistValue({sublistId: 'item', fieldId: 'custcol_mb_trx_vc_reference', line:i, value:vendorCostDetails[0]['id']});
                                    } /* else {
                                        var soLine = salesOrderObj.findSublistLineWithValue({sublistId: 'item',fieldId: 'item', value: adderItem});
                                        var rateSO = salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: soLine });
                                        poRec.setCurrentSublistValue({sublistId: 'item',fieldId: 'rate',line:i, value: parseFloat(rateSO)*.6});
                                    }*/
                                    poRec.commitLine({sublistId:"item"});
                                } else {
                                    poRec.removeLine({sublistId:'item',line:i});
                                }
                            }
                        }

                        if(fixedVendorCost.length>0){
                           /* poRec.selectNewLine({ sublistId: "item" });
                            poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: 511544 });
                            poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: vendorCostQuant });
                            poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_soline_linked_to_wo", value: woId });
                            poRec.commitLine({ sublistId: "item" }); */
                            for (z=0;z<fixedVendorCost.length;z++){
                                if(fixedVendorCost[z].chargeItem!='' && fixedVendorCost[z].chargeItem!=null){
                                    poRec.selectNewLine({ sublistId: "item" });
                                    poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "item",      value: fixedVendorCost[z].chargeItem });
                                    poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity",  value: 1});
                                    poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "rate",      value: Number(fixedVendorCost[z].cost)});
                                    poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "custcol_mb_soline_linked_to_wo", value: woId });
                                    poRec.commitLine({ sublistId: "item" });
                                }
                            }
                        }

                        var poId = poRec.save();
                        log.debug("poId", poId)

                        //commented by Lucas on 2-8-2024 - Job ID is set after job is posted to vendor;
                        // if( false){
                        //     var lookUpFields = search.lookupFields({
                        //         type    : "transaction",
                        //         id      : poId,
                        //         columns : ["tranid"]
                        //     });
                        //     var tranId = lookUpFields["tranid"];
                        //     log.debug("tranId",tranId);
                        //     var toRecordObj = record.load({type:"transferorder",id:transferOrderId,isDynamic:true});
                        //     var lineCount   = toRecordObj.getLineCount({sublistId:"item"});

                        //     for(var i=0;i<lineCount;i++){
                        //         toRecordObj.selectLine({sublistId:"item",line:i});
                        //         toRecordObj.setCurrentSublistValue({sublistId:"item",fieldId:"custcol_job_id",value:tranId});
                        //         toRecordObj.commitLine({sublistId:"item"});
                        //     }
                        //     var toId = toRecordObj.save(true,true);
                        //     log.debug("toId",toId)

                        // }

                    } catch(e){
                        log.error('Error processing OSC TRX for: '+soId, e );
                        continue;
                    }
                }
            } catch (e) {
                log.error("Exception", e)
            }

        }


       /* function vendorCostCalculated(quantity, item, vendor) {
            try {

                var arrayFilters = [
                    ["custrecord_mb_adder_item", "anyof", item],
                    "AND",
                    ["formulanumeric: case when " + Number(quantity) + " >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end", "equalto", "1"]
                ]
                if (vendor) {
                    arrayFilters.push("AND");
                    arrayFilters.push(["custrecord_mb_vendor", "anyof", vendor]);
                }
                log.debug("arrayFilters", arrayFilters)
                var customrecord_mb_adder_vendor_costsSearchObj = search.create({
                    type: "customrecord_mb_adder_vendor_costs",
                    filters: arrayFilters,
                    columns:
                        [
                            search.createColumn({ name: "internalid", label: "InternalId" }),
                            search.createColumn({ name: "custrecord_mb_adder_item", label: "Vendor Cost Item" }),
                            search.createColumn({ name: "custrecord_mb_vendor", label: "Vendor" }),
                            search.createColumn({ name: "custrecord_mb_adder_quantity_break_min", sort: search.Sort.DESC, label: "Quantity Break Min" }),
                            search.createColumn({ name: "custrecord_mb_adder_quantity_break_max", label: "Quantity Break Max" }),
                            search.createColumn({ name: "custrecord_mb_adder_cost", sort: search.Sort.ASC, label: "Cost" }),
                            search.createColumn({ name: "custrecord_mb_vc_charge_item", label: "Charge Item" }),
                            search.createColumn({ name: "custrecord_mb_adder_cost_type", label: "Cost Type" }),
                            search.createColumn({ name: "custrecord_mb_discontinued", label: "Discontinued" })
                        ]
                });

                var vendorCostDetails = []
                customrecord_mb_adder_vendor_costsSearchObj.run().each(function (result) {
                    var costRecId = result.getValue({ name: "internalid" });
                    var item = result.getValue({ name: "custrecord_mb_adder_item" });
                    var vendor = result.getValue({ name: "custrecord_mb_vendor" });
                    var itemQuantity = result.getValue({ name: "custrecord_mb_adder_quantity_break_min" });
                    var cost = result.getValue({ name: "custrecord_mb_adder_cost" });
                    log.debug("item", item)
                    log.debug("itemQuantity", itemQuantity)
                    log.debug("quantity", quantity)
                    log.debug("itemQuantity >= quantity", itemQuantity >= quantity)

                    if (Number(itemQuantity) >= Number(quantity)) {
                        vendorCostDetails.push({ "item": item, "vendor": vendor, "quantity": quantity, "cost": cost, "id": costRecId });
                    }
                    return true;
                });
                log.debug("vendorCostDetails", vendorCostDetails)

                const groupBy = (array, key) => {
                    return array.reduce((result, currentValue) => {
                        (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
                        return result;
                    }, {});
                };

                // Group by color as key to the person array
                const personGroupedByColor = groupBy(vendorCostDetails, 'vendor');

                log.debug("personGroupedByColor", personGroupedByColor)

                var vendorAndTotalCost = []
                for (var vendor in personGroupedByColor) {
                    var costs = personGroupedByColor[vendor];

                    var totalCost = 0
                    for (var i = 0; i < costs.length; i++) {
                        totalCost += Number(costs[i]["quantity"]) * Number(costs[i]["cost"])
                    }
                    log.debug(vendor, totalCost)
                    var obj = {}
                    obj[vendor] = totalCost
                    vendorAndTotalCost.push(obj)
                }
                log.debug("vendorAndTotalCost", vendorAndTotalCost)

                vendorAndTotalCost.sort((a, b) => parseFloat(a[Object.keys(a)[0]]) - parseFloat(b[Object.keys(b)[0]]));
                log.debug("vendorAndTotalCost", vendorAndTotalCost)
                var vendor = Object.keys(vendorAndTotalCost[0])[0];
                var vendorCost = vendorAndTotalCost[0][vendor];
                if (vendorAndTotalCost.length > 1) {
                    var altVendor = Object.keys(vendorAndTotalCost[1])[0];
                    var altVendorCost = vendorAndTotalCost[1][altVendor];
                } else {
                    var altVendor = null//Object.keys(vendorAndTotalCost[1])[0];
                    var altVendorCost = null//vendorAndTotalCost[1][altVendor];
                }

                return [{ "Vendor": vendor, "Vendor Cost": vendorCost }, { "Alt Vendor": altVendor, "Alt Vendor Cost": altVendorCost }, vendorCostDetails]

            } catch (e) {
                log.error("Exception in Vendor Costs Calcualtion", e);
            }
        } */

        function vendorCostCalculated(quantity,item,vendor){
            try{



                var arrayFilters = [
                    ["custrecord_mb_adder_item", "anyof", item],
                    "AND",
                    ["formulanumeric: case when " + Number(quantity) + " >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end", "equalto", "1"],
                    "AND",
                    ["isinactive","is","F"],
                    "AND",
                    ["custrecord_mb_discontinued", "is", "F"]
                ]
                if (vendor) {
                    arrayFilters.push("AND");
                    arrayFilters.push(["custrecord_mb_vendor", "anyof", vendor]);
                }
                log.debug("arrayFilters",arrayFilters)
                var customrecord_mb_adder_vendor_costsSearchObj = search.create({
                    type: "customrecord_mb_adder_vendor_costs",
                    filters: arrayFilters,
                    columns:
                    [
                       search.createColumn({name: "internalid", label: "InternalId"}),
                       search.createColumn({name: "custrecord_mb_adder_item", label: "Vendor Cost Item"}),
                       search.createColumn({name: "custrecord_mb_vendor", label: "Vendor"}),
                       search.createColumn({name: "custrecord_mb_adder_quantity_break_min",sort: search.Sort.DESC,label: "Quantity Break Min"}),
                       search.createColumn({name: "custrecord_mb_adder_quantity_break_max", label: "Quantity Break Max"}),
                       search.createColumn({name: "custrecord_mb_adder_cost",sort: search.Sort.ASC,label: "Cost"}),
                       search.createColumn({name: "custrecord_mb_vc_charge_item", label: "Charge Item"}),
                       search.createColumn({name: "custrecord_mb_adder_cost_type", label: "Cost Type"}),
                       search.createColumn({name: "custrecord_mb_discontinued", label: "Discontinued"})
                    ]
                 });

                 var vendorCostDetails = []
                 customrecord_mb_adder_vendor_costsSearchObj.run().each(function(result){
                    var costRecId = result.getValue({name:"internalid"});
                    var item      = result.getValue({name:"custrecord_mb_adder_item"});
                    var vendor    = result.getValue({name:"custrecord_mb_vendor"});
                    var itemQuantity  = result.getValue({name:"custrecord_mb_adder_quantity_break_min"});
                    var cost      = result.getValue({name:"custrecord_mb_adder_cost"});
                    log.debug("item",item)
                    log.debug("itemQuantity",itemQuantity)
                    log.debug("quantity",quantity)
                    log.debug("itemQuantity >= quantity",itemQuantity >= quantity)

                    const checkUsername = obj => obj.item === item && obj.vendor === vendor ;

                    if(vendorCostDetails.length == 0 ){
                        vendorCostDetails.push({"item":item,"vendor":vendor,"quantity":quantity,"cost":cost,"id":costRecId});
                    }else{
                        if(!vendorCostDetails.some(checkUsername) ){
                            vendorCostDetails.push({"item":item,"vendor":vendor,"quantity":quantity,"cost":cost,"id":costRecId});
                        }
                    }
                    return true;
                 });
                 log.debug("vendorCostDetails",vendorCostDetails)

                 const groupBy = (array, key) => {
                    return array.reduce((result, currentValue) => {
                      (result[currentValue[key]] = result[currentValue[key]] || []).push( currentValue );
                      return result;
                    }, {}); 
                  };
                  
                  // Group by color as key to the person array
                  const personGroupedByColor = groupBy(vendorCostDetails, 'vendor');

                  log.debug("personGroupedByColor",personGroupedByColor)

                  var vendorAndTotalCost = []
                  for (var vendor in personGroupedByColor) {
                    var costs = personGroupedByColor[vendor];

                    var totalCost = 0
                    for(var i=0;i<costs.length;i++){
                        totalCost += Number(costs[i]["quantity"]) * Number(costs[i]["cost"])
                    }
                    log.debug(vendor,totalCost)
                    var obj = {}
                    obj[vendor]=totalCost
                    vendorAndTotalCost.push(obj)
                  }
                  log.debug("vendorAndTotalCost",vendorAndTotalCost)
                  
                  vendorAndTotalCost.sort((a, b) => parseFloat(a[Object.keys(a)[0]]) - parseFloat(b[Object.keys(b)[0]]));
                  log.debug("vendorAndTotalCost",vendorAndTotalCost);
                  log.debug("vendorAndTotalCost",vendorAndTotalCost.length);
                  if(vendorAndTotalCost.length>=1){
                      var vendor        = Object.keys(vendorAndTotalCost[0])[0];
                      var vendorCost    = vendorAndTotalCost[0][vendor];
                      log.debug("vendor",vendor);
                      log.debug("vendorCost",vendorCost);
                  }else{
                    var vendor        =vendor//Object.keys(vendorAndTotalCost[0])[0];
                    var vendorCost    =null
                  }
                  if(vendorAndTotalCost.length>1){
                    var altVendor     = Object.keys(vendorAndTotalCost[1])[0];
                    var altVendorCost = vendorAndTotalCost[1][altVendor];
                  }else{
                    var altVendor     = null//Object.keys(vendorAndTotalCost[1])[0];
                    var altVendorCost = null//vendorAndTotalCost[1][altVendor];
                  }

                  return [{"Vendor":vendor,"Vendor Cost":vendorCost},{"Alt Vendor":altVendor,"Alt Vendor Cost":altVendorCost},vendorCostDetails]

            }catch(e){
                log.error("Exception in Vendor Costs Calcualtion",e);
            }
         }

         function spoilageFactorCal(quantity){
            try{

                var customrecord_mb_stock_supplied_spoilageSearchObj = search.create({
                    type: "customrecord_mb_stock_supplied_spoilage",
                    filters:
                    [
                       ["formulanumeric: case when "+quantity+"<={custrecord_mb_sss_max_quantity} then 1 else 0 end","equalto","1"]
                    ],
                    columns:
                    [
                       search.createColumn({name: "scriptid", label: "Script ID"}),
                       search.createColumn({
                          name: "custrecord_mb_sss_max_quantity",
                          sort: search.Sort.ASC,
                          label: "Max Quantity"
                       }),
                       search.createColumn({name: "custrecord_mb_sss_spoilage_floor", label: "Spoilage Floor"})
                    ]
                 });

                 var searchResultCount = customrecord_mb_stock_supplied_spoilageSearchObj.runPaged().count;
                 log.debug("customrecord_mb_stock_supplied_spoilageSearchObj result count",searchResultCount);
                 var spoilageFloor = 0;
                 customrecord_mb_stock_supplied_spoilageSearchObj.run().each(function(result){

                    log.debug("result",result);
                     spoilageFloor = result.getValue({name:"custrecord_mb_sss_spoilage_floor"});
                    log.debug("spoilageFloor",spoilageFloor)
                 });

                 return spoilageFloor;
                 

            }catch(e){
                log.error("Exception in SPOILAGE FACTOR",e)
            }
         }

        return { execute }

    });