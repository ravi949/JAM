/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
 define(['N/https', 'N/search', 'N/record', './Mibar/lib/MB_Taylor_API.js', './Mibar/lib/MB_Dupli_API.js','N/file', 'N/xml'], (https, search, record, taylorAPI, dupliAPI,file, xml) => {

    /**
     * Defines the Suitelet script trigger point.
     * @param {Object} scriptContext
     * @param {ServerRequest} scriptContext.request - Incoming request
     * @param {ServerResponse} scriptContext.response - Suitelet response
     * @since 2015.2
     */
    const onRequest = (scriptContext) => {
        try {
            var response    = taylorAPI.submitOrder(25633075,"taylor_navitor"); // Dropship PO Id
            //var response    = dupliAPI.submitOrder(22220156); // Dropship PO Id
            //var response      = fineImpressionAPI.submitOrder(18075732); // Dropship PO Id
           // return;

              // decisionTreeLogic(24445648);
          //  return;

        } catch (e) {
            log.error("Exception in ON REQUEST", e);
        }
        scriptContext.response.write("Trrigered");
    }


    const decisionTreeLogic = (soId) =>{
            try{
    
    
                var printVendorMapping = {
                    "taylor_navitor" : "31885" ,
                    "dupli"          : "31394"
                }
    
              
    
                var salesOrderId        = soId//18306754
                var soRecordObj         = record.load({type:"salesorder",id:salesOrderId});
    
                var printVendors        = soRecordObj.getSublistValue({sublistId:"item",fieldId:"custcol_mb_print_vendor",line:0});
                var printItem           = soRecordObj.getSublistValue({sublistId:"item",fieldId:"item"                   ,line:0});
                var printQuantity       = soRecordObj.getSublistValue({sublistId:"item",fieldId:"quantity"               ,line:0});
                var printRate           = soRecordObj.getSublistValue({sublistId:"item",fieldId:"rate"                   ,line:0});
                var printLineNum        = soRecordObj.getSublistValue({sublistId:"item",fieldId:"lineuniquekey"          ,line:0});
    
                var doNotSendJamStockPrint    = false; 
                var doNotSendJamStockVendor   = false; 
                var useJamStockOverride       = false;


                log.debug("printVendors",printVendors);


                
    
                if(printVendors.indexOf(",") != -1){
                    var printVendorArray = printVendors.split(",")
                    log.debug("printVendorArray",printVendorArray);
                }else{
                    var printVendorArray = [printVendors];
                    log.debug("printVendorArray",printVendorArray);
                }
                var printVendorIds = Array.from(printVendorArray, function(x){ return printVendorMapping[x]});
                log.debug("printVendorIds",printVendorIds);
    
                    var vendorSearchObj = search.create({
                        type: "vendor",
                        filters:
                        [
                           ["internalid","anyof",printVendorIds]
                        ],
                        columns:
                        [
                           search.createColumn({name: "internalid", label: "Internal ID"}),
                           search.createColumn({name: "custentity_mb_prioritize_vendor", label: "Prioritize Vendor"}),
                           search.createColumn({name: "custentity_mb_discontinue_vendor", label: "Discontinue Vendor"})
                        ]
                     });
                     var vendorDetails = [];
                     vendorSearchObj.run().each(function(result){
    
                        var internalId   = result.getValue({name:"internalid"});
                        var prioritized  = result.getValue({name:"custentity_mb_prioritize_vendor"});
                        var disContinued = result.getValue({name:"custentity_mb_discontinue_vendor"});
                        var object       = {"internalid":internalId,"prioritized":prioritized,"disContinued":disContinued}
                        vendorDetails.push(object)
                        return true;
                     });
                     log.debug("vendorDetails",vendorDetails);
    
                     var discontinuedVendors = vendorDetails.filter(function(obj){ 
                        if(obj["disContinued"] == true && obj["prioritized"] == false){
                            return obj["internalid"]
                        }
                     });
                     discontinuedVendors = discontinuedVendors.map(a => a["internalid"])
                     log.debug("discontinuedVendors",discontinuedVendors);
                     
                     var nonDiscontinuedVendors = vendorDetails.filter(function(obj){ 
                        if(obj["disContinued"] == false && obj["prioritized"] == false){
                            return obj["internalid"]
                        }
                     });
                     nonDiscontinuedVendors = nonDiscontinuedVendors.map(a => a["internalid"])
                     log.debug("nonDiscontinuedVendors",nonDiscontinuedVendors);
    
                     var prioritizedVendors = vendorDetails.filter(function(obj){ 
                        if(obj["disContinued"] == false && obj["prioritized"] == true){
                            return obj["internalid"]
                        }
                     });
                     prioritizedVendors =  prioritizedVendors.map(a => a["internalid"]);
                     log.debug("prioritizedVendors",prioritizedVendors);
                     if(prioritizedVendors.length>0){
    
                        callDropshipVsStockSupplied(soRecordObj,prioritizedVendors,salesOrderId,printItem,printQuantity,printRate,printLineNum)
                        return;
    
                     }
    
                     if(nonDiscontinuedVendors.length>0){
    
                        callDropshipVsStockSupplied(soRecordObj,nonDiscontinuedVendors,salesOrderId,printItem,printQuantity,printRate,printLineNum)
                        return;
                     }
    
                     if(discontinuedVendors.length>0){
    
                        callDropshipVsStockSupplied(soRecordObj,discontinuedVendors,salesOrderId,printItem,printQuantity,printRate,printLineNum)
                        return;
                     }
                    
    
                     
    
            }catch(e){
                log.debug("Exception in Decision tree logic.",e)
            }
        }
    
    
        function vendorCostCalculated(quantity, item, vendor,i) {
            try {
                
                var printVendorMapping = {
                    "taylor_navitor" : "31885" ,
                    "dupli"          : "31394"
                }

    
                log.debug("quantity",quantity);
                var arrayFilters = [
                    ["custrecord_mb_adder_item", "anyof", item],
                    "AND",
                   // [["formulanumeric: case when " + Number(quantity) + "  >= NVL({custrecord_mb_adder_quantity_break_min},0)  then 1 else 0 end","equalto","1"],"OR",["custrecord_mb_vc_wholesale_item","is","T"]], 
                   //[[["formulanumeric: case when "+Number(quantity)+" >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end","equalto","1"]],"OR",[["custrecord_mb_vc_wholesale_item","is","T"],"AND",["formulanumeric: case when "+Number(quantity)+" >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end","equalto","1"]]],
                   [[["formulanumeric: case when "+Number(quantity)+" >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end","equalto","1"]],"OR",[["custrecord_mb_vc_wholesale_item","is","T"],"AND",["formulanumeric: case when "+Number(quantity)+" >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end","equalto","1"]],"OR",[["custrecord_mb_adder_cost_type","anyof","101"]]],
                   "AND", 
                    ["isinactive","is","F"]
                ]
                if (vendor) {
                    arrayFilters.push("AND");
                    arrayFilters.push(["custrecord_mb_vendor", "anyof", vendor]);
                }
                log.debug("arrayFilters", arrayFilters)
                var customrecord_mb_adder_vendor_costsSearchObj = search.create({
                    type: "customrecord_mb_adder_vendor_costs",
                    filters: arrayFilters,
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "InternalId"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_adder_item",
                            label: "Vendor Cost Item"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_vendor",
                            label: "Vendor"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_adder_quantity_break_min",
                            sort: search.Sort.DESC,
                            label: "Quantity Break Min"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_adder_quantity_break_max",
                            label: "Quantity Break Max"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_adder_cost",
                            sort: search.Sort.ASC,
                            label: "Cost"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_vc_charge_item",
                            label: "Charge Item"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_adder_cost_type",
                            label: "Cost Type"
                        }),
                        search.createColumn({
                            name: "custrecord_mb_discontinued",
                            label: "Discontinued"
                        }),
                        search.createColumn({
                            name: "formulanumeric",
                            formula: "case when nvl(   {custrecord_mb_adder_cost_type},    'Unit' ) = 'Stock-Supplied' then {custrecord_mb_adder_item.averagecost}+ nvl({custrecord_mb_adder_cost},0) +  nvl(     {custrecord_mb_vc_estimated_freight},      0   ) else (   case when nvl(     {custrecord_mb_vc_wholesale_item},      'F'   ) = 'T' then nvl(     {custrecord_mb_adder_item.averagecost},      0   ) + nvl(     {custrecord_mb_vc_estimated_freight},      0   ) else {custrecord_mb_adder_cost} end ) end",
                            label: "Wholesale Cost"
                         }),
                        search.createColumn({
                            name: "formulanumeric",
                            formula: "(case when nvl(  {custrecord_mb_adder_cost_type},   'Unit') = 'Stock-Supplied' then {custrecord_mb_adder_item.averagecost} + nvl({custrecord_mb_adder_cost}, 0) + nvl(  {custrecord_mb_vc_estimated_freight},   0) else (  case when nvl(    {custrecord_mb_vc_wholesale_item},     'F'  ) = 'T' then nvl(    {custrecord_mb_adder_item.averagecost},     0  ) + nvl(    {custrecord_mb_vc_estimated_freight},     0  ) else {custrecord_mb_adder_cost} end) end) * (1-nvl({custrecord_mb_vendor.custentity_mb_vend_cost_factor},0))",
                            label: "Wholesale Cost"
                         })
                    ]
                });
    
                var vendorCostDetails = {};
                customrecord_mb_adder_vendor_costsSearchObj.run().each(function(result) {
                    log.debug("result",result)
                    var costRecId = result.getValue({
                        name: "internalid"
                    });
                    log.debug("costRecId",costRecId)
                    var item = result.getValue({
                        name: "custrecord_mb_adder_item"
                    });
                    var vendor = result.getValue({
                        name: "custrecord_mb_vendor"
                    });
                    var itemQuantity = result.getValue({
                        name: "custrecord_mb_adder_quantity_break_min"
                    });
                    /*var cost = result.getValue({
                        name: "custrecord_mb_adder_cost"
                    }); */
                    /*var cost = result.getValue({
                        name: "formulanumeric",
                        formula: "case when nvl(   {custrecord_mb_adder_cost_type},'Unit' ) = 'Stock-Supplied' then {custrecord_mb_adder_item.averagecost}+ nvl({custrecord_mb_adder_cost},0) +  nvl(     {custrecord_mb_vc_estimated_freight},      0   ) else (   case when nvl(     {custrecord_mb_vc_wholesale_item},      'F'   ) = 'T' then nvl(     {custrecord_mb_adder_item.averagecost},      0   ) + nvl(     {custrecord_mb_vc_estimated_freight},      0   ) else {custrecord_mb_adder_cost} end ) end",
                        label: "Wholesale Cost"
                    });*/
                    var cost = result.getValue({
                            name: "formulanumeric",
                            formula: "(case when nvl(  {custrecord_mb_adder_cost_type},   'Unit') = 'Stock-Supplied' then {custrecord_mb_adder_item.averagecost} + nvl({custrecord_mb_adder_cost}, 0) + nvl(  {custrecord_mb_vc_estimated_freight},   0) else (  case when nvl(    {custrecord_mb_vc_wholesale_item},     'F'  ) = 'T' then nvl(    {custrecord_mb_adder_item.averagecost},     0  ) + nvl(    {custrecord_mb_vc_estimated_freight},     0  ) else {custrecord_mb_adder_cost} end) end) * (1-nvl({custrecord_mb_vendor.custentity_mb_vend_cost_factor},0))",
                            label: "Wholesale Cost"
                    });
                    cost = Number(cost)*Number(quantity)
                    var costType = result.getValue({
                        name: "custrecord_mb_adder_cost_type",
                        label: "Cost Type"
                    });
                    var chargeItem = result.getValue({
                        name: "custrecord_mb_vc_charge_item",
                    });
                    
                    log.debug("item == itemQuantity == quantity || itemQuantity >= quantity == chargeItem", item +" == "+ itemQuantity + " == "+quantity +" || "+(itemQuantity >= quantity) + " == "+chargeItem);
    
                    const checkUsername = obj => obj.item === item && obj.vendor === vendor;
    
                    var object = {
                        "item"          : item,
                        "vendor"        : vendor,
                        "quantity"      : quantity,
                        "cost"          : cost,
                        "id"            : costRecId,
                        "costType"      : costType,
                        "chargeItem"    : chargeItem
                    }
                    log.emergency("object",object)
    
                    const checkExisting = obj => obj.item === item && obj.vendor === vendor 
                    const chargeCheck   = obj => {return obj.item === item && obj.vendor === vendor && obj.chargeItem == 511544 }
    
                    if( i ==0 ){
    
                    if(vendorCostDetails.hasOwnProperty(vendor) == true){
                        
                        if(object["costType"] == 101 && vendorCostDetails[vendor] && !vendorCostDetails[vendor]["StockSupplied"].some(checkExisting)){
                            (vendorCostDetails[vendor]["StockSupplied"]).push(object)
                        }else if((object["costType"] == 1 || object["costType"] == "") && vendorCostDetails[vendor] && !vendorCostDetails[vendor]["DropShip"].some(checkExisting)){
                            (vendorCostDetails[vendor]["DropShip"]).push(object)
                        }else if(chargeItem == "511544" && !vendorCostDetails[vendor]["DropShip"].some(chargeCheck) &&  vendorCostDetails[vendor] && vendorCostDetails[vendor]["DropShip"]){
                            (vendorCostDetails[vendor]["DropShip"]).push(object)
                        }else if(chargeItem != null && chargeItem != undefined && chargeItem != "" && chargeItem != "511544"  &&  vendorCostDetails[vendor] && vendorCostDetails[vendor]["StockSupplied"]){
                            (vendorCostDetails[vendor]["StockSupplied"]).push(object)
                        }
    
                    }else{
                        
                        vendorCostDetails[vendor] = {};
                        if(object["costType"] == 101){
                            vendorCostDetails[vendor]["StockSupplied"] = [object];
                            vendorCostDetails[vendor]["DropShip"] = [];
                        }else if(object["costType"] == 1 || object["costType"] == ""){
                            vendorCostDetails[vendor]["StockSupplied"] = [];
                            vendorCostDetails[vendor]["DropShip"]      = [object];
                        }else if(chargeItem == "511544"){
                            vendorCostDetails[vendor]["DropShip"]      = [object]; 
                            vendorCostDetails[vendor]["StockSupplied"] = [];
                        }else if(chargeItem != null && chargeItem != undefined && chargeItem != "" && chargeItem != "511544"){
                            vendorCostDetails[vendor]["DropShip"] = [];
                            vendorCostDetails[vendor]["StockSupplied"] = [object];
                        }
    
                    }
                }else{
    
                    if(vendorCostDetails.hasOwnProperty(vendor) == true){
                        
                        if(!vendorCostDetails[vendor]["DropShip"].some(checkExisting) && !vendorCostDetails[vendor]["StockSupplied"].some(checkExisting)){
                            (vendorCostDetails[vendor]["StockSupplied"]).push(object)
                            (vendorCostDetails[vendor]["DropShip"]).push(object)
                        }
                    }else{
                        vendorCostDetails[vendor] = {};
                            vendorCostDetails[vendor]["StockSupplied"] = [object];
                            vendorCostDetails[vendor]["DropShip"]      = [object];
                    }
    
                }
                log.emergency("vendorCostDetails", vendorCostDetails)
                    return true;
                });
                log.debug("vendorCostDetails", vendorCostDetails)
               
                return vendorCostDetails;
    
            } catch (e) {
                log.error("Exception in Vendor Costs Calcualtion", e);
            }
        }
    
        function callDropshipVsStockSupplied(soRecordObj,vendorId,salesOrderId,printItem,printQuantity,printRate,printLineNum,adderVendor){
            try{
    
                var printVendorMapping = {
                    "taylor_navitor" : "31885" ,
                    "dupli"          : "31394"
                }

                var printVendorOptionsMapping = {
                    "Admore" : "30990",
                    "Dupli"  : "31394",
                    "Taylor" : "31885",
                    "TrafficWorks" : "386"
                }


                var lineCount       = soRecordObj.getLineCount({sublistId:"item"});
                log.debug("lineCount",lineCount);
    
                var totalVendorCosts = {}
    
                     for(var i=0;i<lineCount;i++){
                        var baseItem  = soRecordObj.getSublistValue({sublistId:"item",fieldId:"item",line:i});
                        var baseQuant = soRecordObj.getSublistValue({sublistId:"item",fieldId:"quantity",line:i});
                        log.debug("baseItem and baseQuant",baseItem+" and "+baseQuant);
                        if(vendorId != null){
                            var details = vendorCostCalculated(baseQuant,baseItem,vendorId,i);
                        }else{
                            var details = vendorCostCalculated(baseQuant,baseItem,null,i);
                        }
                        for(var vendor in details){
                            log.debug("vendor",vendor)
                            if(totalVendorCosts.hasOwnProperty(vendor) == false){
                                log.debug("vendor present","false")
                                totalVendorCosts[vendor] = {};
                            }
                            if(details[vendor]["StockSupplied"].length>0){
                                var totalCost = details[vendor]["StockSupplied"].reduce(function(total, currentValue){return total+Number(currentValue["cost"])}, 0)
                                log.debug("Stocksupplied Total Cost",totalCost)
                                if(totalVendorCosts[vendor].hasOwnProperty("StockSupplied") == false){
                                    totalVendorCosts[vendor]["StockSupplied"] = 0;
                                }
                                if( i==0 || (i != 0 && totalVendorCosts[vendor]["StockSupplied"] > 0)){
                                    totalVendorCosts[vendor]["StockSupplied"]+=Number(totalCost)
                                }
                            }
    
                            if(details[vendor]["DropShip"].length>0){
                                var totalCost = details[vendor]["DropShip"].reduce(function(total, currentValue){return total+Number(currentValue["cost"])}, 0)
                                log.debug("Dropship Total Cost",totalCost)
                                if(totalVendorCosts[vendor].hasOwnProperty("DropShip") == false){
                                    totalVendorCosts[vendor]["DropShip"] = 0;
                                }
                                if( i==0 || (i != 0 && totalVendorCosts[vendor]["DropShip"] > 0)){
                                    totalVendorCosts[vendor]["DropShip"]+=Number(totalCost);
                                }
                                
                            }
                        }
                     }
    
                     log.debug("totalVendorCosts",totalVendorCosts)
    
                     for(var test in totalVendorCosts){
                        var obj = totalVendorCosts[test];
                        log.debug("obj",obj);
                        for(var inObj in obj){
                             if(obj[inObj] == 0){
                                obj[inObj] = 99999999;
    
                             }
                        }
                        totalVendorCosts[test] = obj;
                     }
                     //var totalVendorCosts  = JSON.parse(JSON.stringify(totalVendorCosts).replace(/0/g,9999999));
                     log.debug("totalVendorCosts",totalVendorCosts)
                     // Among all the vendor to get the least Stock Supplied Cost
                     const resultStock       =   Object.keys(totalVendorCosts).reduce((acc, curr) => acc["StockSupplied"] ? (totalVendorCosts[curr]["StockSupplied"] < acc["StockSupplied"] ? totalVendorCosts[curr] : acc) : totalVendorCosts[curr], {});
                     log.debug("resultStock",resultStock)
    
                     var stockVendor         =   Object.keys(totalVendorCosts).find(key => totalVendorCosts[key] === resultStock);
                     var stockVendorCost     =   Number(resultStock["StockSupplied"])
                     log.debug("Stock Details", `<b>Vendor</b> ${stockVendor} <br/> <b>Vendor Cost</b> ${stockVendorCost}`)
    
                     // Among all the vendor to get the least Dropship Cost
                     const resultDropship    =   Object.keys(totalVendorCosts).reduce((acc, curr) => acc["DropShip"] ? (totalVendorCosts[curr]["DropShip"] < acc["DropShip"] ? totalVendorCosts[curr] : acc) : totalVendorCosts[curr], {});
                     log.debug("resultDropship",resultDropship)
    
                     var dropShipVendor      = Object.keys(totalVendorCosts).find(key => totalVendorCosts[key] === resultDropship);
                     var dropShipVendorCost  = resultDropship["DropShip"];
                     log.debug("Dropship Details", `<b>Vendor</b> ${dropShipVendor} <br/> <b>Vendor Cost</b> ${dropShipVendorCost}`)


                     var allVendorCostDetails = {
                        "Decision" : null,
                        "Options"  : totalVendorCosts
                     }

                     var itemLookupFields    = search.lookupFields({
                        type    : "item"    ,
                        id      : printItem ,
                        columns : ["custitem_mb_print_vendor_pref","custitem_mb_print_options"]
                    });
                    log.debug("itemLookupFields",itemLookupFields);

                    log.debug("stockVendor AND stockVendorCost", stockVendor+" AND "+stockVendorCost)
                    log.debug("dropShipVendor AND dropShipVendorCost", dropShipVendor+" AND "+dropShipVendorCost)

                    var vendor = "";
                    var option = "";
                    if(itemLookupFields["custitem_mb_print_vendor_pref"].length>0 && itemLookupFields["custitem_mb_print_options"].length>0){

                        var vendor = printVendorOptionsMapping[itemLookupFields["custitem_mb_print_vendor_pref"][0]["text"]];
                        var option = itemLookupFields["custitem_mb_print_options"][0]["text"];
                        log.debug("vendor",vendor);
                        log.debug("option",option);

                        if(option == "Stock Supplied"){
                            stockVendor      = vendor;
                            stockVendorCost  = totalVendorCosts[vendor]["StockSupplied"]
                        }else{
                            dropShipVendor      = vendor;
                            dropShipVendorCost  = totalVendorCosts[vendor]["DropShip"]
                            
                        }

                    }

                    log.debug("stockVendor AND stockVendorCost", stockVendor+" AND "+stockVendorCost)
                    log.debug("dropShipVendor AND dropShipVendorCost", dropShipVendor+" AND "+dropShipVendorCost)

    
                     
                     if((stockVendorCost < dropShipVendorCost && stockVendorCost != 0 &&  dropShipVendorCost != 0 &&  option == "") || option == "Stock Supplied"){
                         log.debug("Result","Stock Supplied FLow");
                        allVendorCostDetails["Decision"] = stockVendor+"-"+"StockSupplied"+"-"+stockVendorCost
                       /*var taskObj = task.create({
                            taskType        : task.TaskType.SCHEDULED_SCRIPT,
                            scriptId        : "customscript_mb_sc_osc_transaction_flow",
                            //deploymentId    : "customdeploy_mb_sc_osc_transaction_flow",
                            params          : {
                                "custscript_osc_parameters" : {"vendor":stockVendor,"cost":stockVendorCost,"SalesOrder":salesOrderId}
                            }    
                        });
                        
                        var mrTaskId = taskObj.submit();
                        log.debug("mrTaskId",mrTaskId) */
    
                     }else{
    
                        
                      var adderVendor   = Object.keys(printVendorMapping).find(key => printVendorMapping[key] === dropShipVendor);
                        log.debug("adderVendor",adderVendor)
                        allVendorCostDetails["Decision"] = dropShipVendor+"-"+"DropShip"+"-"+dropShipVendorCost
                        /* var taskObj = task.create({
                            taskType        : task.TaskType.SCHEDULED_SCRIPT,
                            scriptId        : "customscript_mb_sc_drpshp_creation_print",
                            //deploymentId    : "customdeploy_mb_sc_drpshp_creation_print",
                            params          : {
                                "custscript_dropship_parameters" : [{"vendor":dropShipVendor,"soId":salesOrderId,"item":printItem,"qtyNeeded":printQuantity,"rate":printRate,"lineSeqNum":printLineNum,"adderVendor":adderVendor}]
                            }    
                        });
                        
                        var mrTaskId = taskObj.submit();
                        log.debug("mrTaskId",mrTaskId) */
    
                         log.debug("Resultt","Dropship FLow"); 
                     }

                     log.debug("allVendorCostDetails",allVendorCostDetails);

                     var stringDetails = JSON.stringify(allVendorCostDetails)
                     stringDetails     = stringDetails.replace(/31394/g,"Dupli")
                     stringDetails     = stringDetails.replace(/31885/g,"Navitor")
                     stringDetails     = stringDetails.replace(/99999999/g,0)

                      log.debug("stringDetails",stringDetails)
              


                    /* var id = record.submitFields({
                        type: record.Type.SALES_ORDER,
                        id: salesOrderId,
                        values: {
                            custbody_mb_trx_order_dec_breakdown: stringDetails//JSON.stringify(allVendorCostDetails)
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields : true
                        }
                    });
                    log.debug("ID",id) */
    
                    
                
    
            }catch(e){
                log.error("Exception in Call Dropship VS Stock Supplied",e)
            }
        }


        const ordersToBeReposted = () =>{
            try{

                var printVendorMapping = {
                    "taylor_navitor" : "31885" ,
                    "dupli"          : "31394"
                }

                var decisionMapping    ={
                    "Navitor" :  31885   ,
                    "Dupli"   :  31394,
                    "Taylor"  : 31885
                }

                var searchObject = search.load({id :"customsearch_mb_trx_env_print_pending__2"});

                var resultsToBeProcesssed = {"Dropship":[],"StockSupplied":[]}

                searchObject.run().each(function(result){
                    var internalId              = result.getValue({name:"internalid"});
                    log.debug("internalId",internalId)
                    var breakDown               = JSON.parse(result.getValue({name:"custbody_mb_trx_order_dec_breakdown"}))
                    log.debug("breakDown",breakDown)
                    log.debug("breakDown",typeof breakDown)
                    log.debug("breakDown",Object.keys(breakDown))

                  /*var decisionObject          = breakDown["Decision"]
                    log.debug("decisionObject",decisionObject)
                    var decisionVendor          = decisionMapping[decisionObject.split("-")[0]];
                    var decisionFlow            = decisionObject.split("-")[1];
                    var decisionCost            = decisionObject.split("-")[2]; */

                    var overrideDecission       = result.getText({name:"custbody_mb_decision_override"});
                    log.debug("overrideDecission",overrideDecission)

                    if(overrideDecission.length>0){
                        var decisionObject          = overrideDecission.split("-");
                        var decisionVendor          = decisionMapping[decisionObject[0].trim()]
                        var decisionFlow            = decisionObject[1].trim();
                        var decisionCost            = 0;
                    }else{
                        var decisionObject          = breakDown["Decision"]
                        log.debug("decisionObject",decisionObject)
                        var decisionVendor          = decisionMapping[decisionObject.split("-")[0]];
                        var decisionFlow            = decisionObject.split("-")[1];
                        var decisionCost            = decisionObject.split("-")[2];
                    }


                    log.debug("decisionVendor",decisionVendor);
                    log.debug("decisionFlow",decisionFlow);
                    log.debug("decisionCost",decisionCost);

                    if( decisionFlow == "DropShip" || decisionFlow == "Dropship"){

                        var adderVendor   = Object.keys(printVendorMapping).find(key => printVendorMapping[key] == decisionVendor);
                        log.debug("adderVendor",adderVendor)

                        var salesOrderObj = record.load({type:"salesorder",id:internalId});
                        log.debug("salesOrderObj",salesOrderObj);

                        var printItem       = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"item",line:0});
                        var printQuantity   = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"quantity",line:0});
                        var printRate       = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"rate",line:0});
                        var printLineNum    = salesOrderObj.getSublistValue({sublistId:"item",fieldId:"lineuniquekey",line:0});

                        log.debug("printItem == printQuantity == printRate == printLineNum",printItem +" == "+ printQuantity +" == "+ printRate +" == "+ printLineNum)

                        resultsToBeProcesssed["Dropship"].push({"vendor":decisionVendor,"soId":internalId,"item":printItem,"qtyNeeded":printQuantity,"rate":printRate,"lineSeqNum":printLineNum,"adderVendor":adderVendor})

                    }else if(decisionFlow == "StockSupplied"){

                        resultsToBeProcesssed["StockSupplied"].push({"vendor":decisionVendor,"cost":decisionCost,"SalesOrder":internalId})


                    }

                return true;
                })

                log.debug("resultsToBeProcesssed",resultsToBeProcesssed)




                if(resultsToBeProcesssed["Dropship"].length>0){
                    log.debug("Status","Dropship");
                    var taskObj = task.create({
                        taskType        : task.TaskType.SCHEDULED_SCRIPT,
                        scriptId        : "customscript_mb_sc_drpshp_creation_print",
                        deploymentId    : "customdeploy_mb_sc_drpshp_creation_print",
                        params          : {
                            "custscript_dropship_parameters" : resultsToBeProcesssed["Dropship"]
                        }    
                    });
                    
                    var mrTaskId = taskObj.submit();
                    log.debug("mrTaskId",mrTaskId);
               }
                
               if(resultsToBeProcesssed["StockSupplied"].length>0){
                    log.debug("Status","StockSupplied");

                    var taskObj = task.create({
                        taskType        : task.TaskType.SCHEDULED_SCRIPT,
                        scriptId        : "customscript_mb_sc_osc_transaction_flow",
                        deploymentId    : "customdeploy_mb_sc_osc_transaction_flow",
                        params          : {
                            "custscript_osc_parameters" : resultsToBeProcesssed["StockSupplied"]
                        }    
                    });
                    
                    var mrTaskId = taskObj.submit();
                    log.debug("mrTaskId",mrTaskId)

                }
                
            }catch(e){
                log.error("Exception in Orders To Be Reposted",e);
            }
        }
    
    return {
        onRequest
    }

});