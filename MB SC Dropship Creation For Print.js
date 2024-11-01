/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
 const senderId       = 1423;
 const _recipients    = 'lucas@mibar.net';
 var requiredApproval = "";
 
 define(['N/search', 'N/record', 'N/email', 'N/runtime', 'SuiteScripts/Mibar/lib/MB_Taylor_API.js', 'N/email','SuiteScripts/Mibar/lib/MB_Dupli_API.js','SuiteScripts/Mibar/lib/MB_Fineimpressions_API.js'],
     function (search, record, email, runtime, taylorAPI, email,dupliAPI,fineImpressionsAPI) {
         // params - items,sos
         function execute(context) {
             // insert parameters here ;
             try {
                var param = runtime.getCurrentScript().getParameter({name: 'custscript_dropship_parameters'});
                var soDetails = {};
                if(param.length>0){
                    soDetails = JSON.parse(param)
                };

                log.debug("soDetails",soDetails)
                log.debug("soDetails.length",soDetails.length);
  
                if(soDetails.length>0){
                      for(var i=0;i<soDetails.length;i++){
                          var array    = [soDetails[i]];
                          var dsStatus = createDropship2(array);
                          log.debug('dsStatus for ' + i, JSON.stringify(dsStatus));
                      }
                      return;
  
                }
 
                 requiredApproval = runtime.getCurrentScript().getParameter({ name: 'custscript_required_approval_for_posting' });
                 log.debug("requiredApproval", requiredApproval);
 
                 {// Added By Sai.K on 13th Feb 2023. This function is for reposting the orders that have failed.
 
                     var deploymentId = runtime.getCurrentScript().deploymentId;
                     log.debug("deploymentId", deploymentId)
                     if (deploymentId == "customdeploy_mb_scheduled_repost_orders" || deploymentId == "customdeploy_mb_scheduled_repost_ns") {
                        var response = ordersToBeReposted(requiredApproval);
                         log.debug("Response", response);
                         if (response == null) {
                             log.debug("Alert", "There are no orders to be posted.");
                         }
                         return;
                     }
 
 
 
                 }
                 var dsItemSrchId = "customsearch_mb_tra_create_dsv3_3_2";//'14294';//Test search for adding adderlines.
                 var dsItemSrch = search.load({
                     id: dsItemSrchId
                 });
                 var parameterJSON = searchGetResultObjects(dsItemSrch, 0, 200);
                 log.debug('type of parameterJSON', typeof parameterJSON);
                 log.debug('parameterJSON', JSON.stringify(parameterJSON))
                 var soNUArray = parameterJSON.map(function (element, index) {
                     return element.so_internalID
                 });
                 log.debug('soNUArray', soNUArray)
                 var soArray = soNUArray.filter(function (element, index) {
                     if (soNUArray.indexOf(element) === index) {
                         return true
                     } else { return false };
                 });
                 log.debug('soArray', soArray)
 
                 var fireFlag = true;
                 if (fireFlag) {
                     if (parameterJSON.length > 0) {
                         for (var x = 0; x < soArray.length; x++) {
                             var soItems = parameterJSON.filter(function (element, index) {
                                 if (element.so_internalID == soArray[x]) {
                                     return true
                                 }
                                 return false;
                             });
 
                             var dsNUVendors = soItems.map(function (element, index) {
                                 return element.itemPreferredVendor//soItems.indexOf(element.itemPreferredVendor) === index
                             });
 
                             log.debug('dsNUVEndors', JSON.stringify(dsNUVendors));
                             var dsVendors = dsNUVendors.filter(function (element, index) {
                                 if (dsNUVendors.indexOf(element) === index) {
                                     return true;
                                 }
                                 return false;
                             })
 
                             log.debug('dsVendors', JSON.stringify(dsVendors));
                             var dsVendorArray = new Array();
                             for (var x4 = 0; x4 < dsVendors.length; x4++) {
                                 dsVendorArray.push(soItems.filter(function (element1, index1) {
                                     if (element1.itemPreferredVendor == dsVendors[x4]) {
                                         return true
                                     };
                                     return false;
                                 }).map(function (element, index) {
                                     return {
                                         'vendor': element.itemPreferredVendor,
                                         'soId': element.so_internalID,
                                         'item': element.assemblyItem,
                                         'qtyNeeded': element.QtyNeeded,
                                         'rate': element.Item_Rate,
                                         'lineSeqNum': element.lineSeqNum,
                                         "adderVendor": element.adderVendor
                                     }
                                 }));
                                 // ) 
                             }
 
 
                             for (var x3 = 0; x3 < dsVendorArray.length; x3++) {
                                 log.debug('dsVendorArray' + x3, JSON.stringify(dsVendorArray[x3]))
                                 var dsStatus = createDropship2(dsVendorArray[x3]);
                                 log.debug('dsStatus for ' + x3, JSON.stringify(dsStatus));
                                 var scriptObj = runtime.getCurrentScript();
                                 log.debug('Remaining governance units: ' + scriptObj.getRemainingUsage());

                             }
 
                         }
                         /*  } else {
                               log.audit('No preferred vendor for item: '+item,'No dropship Created');
                           }*/
                     } else {
                         log.audit("No POs to be created");
                     }
                 }
             } catch (err) {
                 log.error('error in execute in createdropship', JSON.stringify(err));
             }
         };
 
         // added by MIBAR 9-29-2022
 
         function updateSoLines(_vendor, soRec, flag, dropShipDetails) {
             try {
                 log.debug("dropShipDetails", dropShipDetails)
                 /* for (var ct = 0;ct<array.length;ct++){
                      var lineNumber = -1;
                      var lineSeqNum = array[ct].lineSeqNum;
                      var lineNumber = soRec.findSublistLineWithValue({sublistId: 'item',fieldId : 'lineuniquekey',value:lineSeqNum});
                      log.audit('lineNumber',lineNumber)
                      if(lineNumber!=-1){
                          soRec.setSublistValue({sublistId : 'item',fieldId : 'povendor',value:array[ct].vendor,line:lineNumber});
                          soRec.setSublistValue({sublistId : 'item',fieldId : 'povendor',value:array[ct].vendor,line:lineNumber});
                      } else {
                          log.audit('could not find so line for', JSON.stringify(array[ct]));
                      }
                  };*/
                 if (!flag) {
                    // NEED CHANGES FOR AMZPRINT******
                     soRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_mb_drop_ship_api_memo', value: "No Suitable Vendor has been found to create a PO.", line: 0 });
                     var soId = soRec.save();
                     return "failure"
                 }
 
                 var lineCount = soRec.getLineCount({ sublistId: "item" });
                 log.debug("Updaating SO");
                 for (var ct = 0; ct < lineCount; ct++) {
                     soRec.setSublistValue({ sublistId: 'item', fieldId: 'povendor', value: _vendor, line: ct });
                     /*if (dropShipDetails["Alt Vednor"] != "") {
                         var quantity = soRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: ct });
                         soRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_mb_alt_vendor', value: dropShipDetails["Alt Vednor"], line: ct });
                         var altCost = Number(dropShipDetails["Alt Cost"]) * Number(quantity)
                         soRec.setSublistValue({ sublistId: 'item', fieldId: 'custcol_al_vendor_cost', value: altCost, line: ct });
 
                     }*/
                 }
                 
                 var soId = soRec.save();
                 return 'success';
             } catch (err) {
                 log.error('error updating SO Lines', JSON.stringify(err));
                 return 'failure';
             }
         }
 
         function createDropship2(array) {
             try {
                var poParams = {};
                 var soRec = record.load({
                     type: record.Type.SALES_ORDER,
                     id: array[0].soId,
                     isDynamic: false
                 });
                 var customer = soRec.getValue({ fieldId: 'entity' });
                 var soId     = soRec.id;
 
 
                 var _vendor = array[0].adderVendor;
                 log.debug("_vendor", _vendor);
                 log.debug(" array[0].item", array[0].item);

                 var lineCount = soRec.getLineCount({sublistId:"item"});
                 
                 log.debug("lineCount",lineCount);
                 var itemArray       = [];
                 var itemAndLocation = {}; 

                 itemArray.push(array[0].item)
                 for(var i=1;i<lineCount;i++){
                    var linkedItem = soRec.getSublistValue({sublistId:"item",fieldId:"custcol_mb_item_link",line:i});
                    log.debug("linkedItem",linkedItem)
                    if(linkedItem == array[0].item){
                        itemArray.push(soRec.getSublistValue({sublistId:"item",fieldId:"item",line:i}));
                    }

                    var item      = soRec.getSublistValue({sublistId:"item",fieldId:"item",line:i});
                    var location  = soRec.getSublistValue({sublistId:"item",fieldId:"location",line:i});

                    if(location){
                        itemAndLocation[item] = location;
                    }
                 }
                 
                 log.debug("itemArray",itemArray)
                 log.debug("itemAndLocation",itemAndLocation)

                 var preferredRate = null;
                 var allDetails    = [];

                 if (_vendor.indexOf(",") != -1) {
                    var mainDropShipDetails = vendorCostCalculated(array[0].qtyNeeded,itemArray,null)
                    log.debug("mainDropShipDetails",mainDropShipDetails);
                    array[0].vendor = mainDropShipDetails[0]["Vendor"];;
                    _vendor         = mainDropShipDetails[0]["Vendor"];
                    allDetails      = mainDropShipDetails[2]

                 }else{
                    var _vendorType = "";
                     if (_vendor.indexOf("taylor") != -1 && _vendor.indexOf("navitor") == -1 && _vendor.indexOf("labelworks") == -1) {
                         _vendor = 31885//1068518
                         _vendorType = "taylor"
                     } else if (_vendor.indexOf("admore") != -1) {
                         _vendor = 30990
                         _vendorType = "admore"
                     } else if (_vendor.indexOf("navitor") != -1) {
                         _vendor = 31885//30990
                         _vendorType = "navitor"
                    } else if (_vendor.indexOf("labelworks") != -1) {
                            _vendor = 31885//30990
                            _vendorType = "labelworks"
                     } else if (_vendor.indexOf("fineimpressions") != -1) {	
                        _vendor = 228	
                        _vendorType = "fineimpressions"	
                    } else if (_vendor.indexOf("dupli") != -1) {	
                        _vendor = 31394	
                        _vendorType = "dupli"	
                    }

                     var mainDropShipDetails = vendorCostCalculated(array[0].qtyNeeded, itemArray, _vendor);
                     log.debug("mainDropShipDetails", mainDropShipDetails);
                     _vendor        = mainDropShipDetails[0]["Vendor"];
                     allDetails     = mainDropShipDetails[2]
                    
                 }

                 log.debug("_vendor",_vendor)
                 log.debug("preferredRate",preferredRate)
                 log.debug("allDetails",allDetails)
                 
                 
                 var preferredRate = null;
                 
                 var vendorFound = true;
                 if (_vendor != "") {

                     log.debug("_vendor ", "true")
                     var soUpdate = updateSoLines(_vendor, soRec, true, mainDropShipDetails);
                     log.debug('soUpdateStatus', soUpdate);

                 } else {

                     vendorFound = false;
                     log.debug("_vendor ", "false")
                     var soUpdate = updateSoLines(_vendor, soRec, false, mainDropShipDetails);
                     log.debug('soUpdateStatus', soUpdate);

                     return;
                 }
                

                 var items = array.map(function (element, index) {
                     return element.item
                 });
                 log.debug('items', JSON.stringify(items));

                 var printItem = items[0];
 
 
                 log.debug('vendor', _vendor);
 
                 var poParams = {
                     'recordmode': 'dynamic',
                     'soid': soId,
                     'shipgroup': 1,
                     'poentity': _vendor,
                     'dropship': 'T',
                     'custid': customer,
                     'entity': _vendor
                 };
 
                 var poRec = record.create({
                     type: record.Type.PURCHASE_ORDER,
                     isDynamic: true,
                     defaultValues: poParams
                 });
 
                 log.audit('poRec', JSON.stringify(poRec));
 
                 var poLineCt = poRec.getLineCount({
                     sublistId: 'item'
                 });
 
                 var lineNumber = -1;
                 log.debug('poLineCt', poLineCt);
                 log.debug('poLineItem', poLineItem);
                 log.debug('items', items);
                 log.debug('items', items);
                 var soAltUpdate = {};
                 var alternateTotalCost = 0;
                 // validate item & qty;

                 // Added by Lucas 7-26-2023
                 var daysToAdd = 10
                 var expectedReceiptDate =  new Date(new Date().getTime()+(daysToAdd*24*60*60*1000));
                 // validate item & qty;
                 if (poLineCt > 0) {
                     for (var y = poLineCt - 1; y >= 0; y--) {
                         var poLineItem = poRec.getSublistValue({ sublistId: 'item', line: y, fieldId: 'item' })
                         log.debug("poLineItem",poLineItem)
                         var indexOfPoItem = items.indexOf(poLineItem);
                         log.debug("indexOfPoItem",indexOfPoItem)
                         if (indexOfPoItem == -1) {
                             //log.audit('y',y);
                             var linkedItem = poRec.getSublistValue({ sublistId: 'item', line: y, fieldId: 'custcol_mb_item_link' })
                             log.debug("linkedItem",linkedItem);
                             if(linkedItem == printItem){
                             var lineToRemoveDetails  = {};
                             lineToRemoveDetails.item = poRec.getSublistValue({ sublistId: 'item', fieldId: 'item', line: y });
                             lineToRemoveDetails.qty  = poRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: y });
                             log.debug("lineToRemoveDetails.item",lineToRemoveDetails.item)
                             log.debug("lineToRemoveDetails.qty",lineToRemoveDetails.qty)
                             var rate   = poRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: y });
                             var soLine = soRec.findSublistLineWithValue({
                                sublistId: "item",
                                fieldId: "item",
                                value: lineToRemoveDetails.item
                             })
                             var rateSO = soRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: soLine });
                             log.debug("rate",rate)
                             log.debug("rateSO",rateSO)
                             // review tomorrow
                             var dropShipDetails = allDetails.filter(obj => {return obj.vendor == _vendor && obj.item == lineToRemoveDetails.item  && obj.chargeItem == ""})
                             log.debug("dropShipDetails", dropShipDetails);
                             if(dropShipDetails.length>0){
                                 var adderPreferredRate = dropShipDetails[0]["cost"];
                             }else{
                                var adderPreferredRate = null;
                             }
                             
                             lineToRemoveDetails.line = y;
 
                             if (adderPreferredRate) {
                                 poRec.selectLine({ sublistId: "item", line: y });

                                 var item = poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'item'})
                                 log.debug("item",item);
                                 log.debug("itemAndLocation",itemAndLocation[item]);
                                 var poLocation = itemAndLocation[item];
                                 var costType = dropShipDetails[0].costType;
                                if(costType == '2' && poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'quantity'})!='' && poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'quantity'})!=null && poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'quantity'})!=0){
                                    poRec.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'rate',
                                        value: parseFloat(adderPreferredRate)/parseFloat(poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'quantity'}))
                                    });
                                } else {
                                    poRec.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'rate',
                                        value: parseFloat(adderPreferredRate)
                                    });
                                }
                                 log.debug("mainDropShipDetails[1]['Alt Vendor']",mainDropShipDetails[1]["Alt Vendor"])
                                 poRec.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId  : 'custcol_mb_trx_vc_reference',
                                    value    : dropShipDetails[0]["id"]
                                });

                                 if (mainDropShipDetails[1]["Alt Vendor"] != null) {
                                    // review tomorrow 
                                    var dropShipDetails = allDetails.filter(obj => {return obj.vendor == mainDropShipDetails[1]["Alt Vendor"] && obj.item == lineToRemoveDetails.item && obj.chargeItem == ""})
                                    log.debug("dropShipDetails",dropShipDetails)
                                     if(dropShipDetails.length>0){
                                     alternateTotalCost += parseFloat(dropShipDetails[0]["cost"]) * Number(lineToRemoveDetails.qty)
                                     log.debug("alternateTotalCost",alternateTotalCost)
                                     poRec.setCurrentSublistValue({
                                         sublistId: 'item',
                                         fieldId: 'custcol_mb_alt_vendor',
                                         value: dropShipDetails[0]["vendor"]
                                     });
                                     poRec.setCurrentSublistValue({
                                         sublistId: 'item',
                                         fieldId  : 'custcol_al_vendor_cost',
                                         value    : parseFloat(dropShipDetails[0]["cost"]) * Number(lineToRemoveDetails.qty)
                                     });
                                     poRec.setCurrentSublistValue({
                                         sublistId: 'item',
                                         fieldId  : 'custcol_mb_trx_vc_reference',
                                         value    : dropShipDetails[0]["id"]
                                     });
                                     soAltUpdate[poLineItem]={"vendor":dropShipDetails[0]["vendor"],"cost":parseFloat(dropShipDetails[0]["cost"]) * Number(lineToRemoveDetails.qty)}
                                 }
                                 }

                                 if(poLocation){
                                    poRec.setCurrentSublistValue({sublistId: 'item',fieldId  : 'location',value: poLocation});
                                 }
                                 // added by Lucas 7-26-2023
                                 poRec.setCurrentSublistValue({sublistId : 'item', fieldId : 'expectedreceiptdate', value: expectedReceiptDate})

                                 poRec.commitLine({
                                     sublistId: 'item'
                                 });

                             
                             }else{
                                log.debug("Not Found","True")
                                poRec.selectLine({ sublistId: "item", line: y });
                                log.debug("cal rate",parseFloat(rateSO)*parseFloat(0.6))
                                poRec.setCurrentSublistValue({
                                    sublistId: 'item',
                                    fieldId: 'rate',
                                    value: parseFloat(rateSO)*parseFloat(0.6)
                                });

                                var item = poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'item'})
                                log.debug("item",item);
                                log.debug("itemAndLocation",itemAndLocation[item]);
                                var poLocation = itemAndLocation[item];
                                if(poLocation){
                                    poRec.setCurrentSublistValue({sublistId: 'item',fieldId  : 'location',value: poLocation});
                                }
                                 
                               // added by Lucas 7-26-2023
                                 poRec.setCurrentSublistValue({sublistId : 'item', fieldId : 'expectedreceiptdate', value: expectedReceiptDate})

                                poRec.commitLine({
                                    sublistId: 'item'
                                });
                             }
                            }else{
                             log.audit('removing line: ',JSON.stringify(lineToRemoveDetails));
                             poRec.removeLine({sublistId : 'item',line : y});
                             var poLineCt = poRec.getLineCount({
                                sublistId: 'item'
                            });
                             
                            }
                         } else {
                             if (indexOfPoItem >= 0) {
                                 lineNumber = y;
                                 var poLineQty  = poRec.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: y });
                                 var poLineRate = poRec.getSublistValue({ sublistId: 'item', fieldId: 'rate', line: y });
                                 if(allDetails.length>0){
                                    var preferredRate = allDetails.filter(obj => {	
                                        return obj.vendor == _vendor && obj.item == poLineItem && obj.chargeItem == ""	
                                    })	
                                    log.debug("preferredRate", preferredRate)	
                                    if (preferredRate.length > 0) {	
                                        preferredRate = preferredRate[0]["cost"]	
                                    } else {	
                                        preferredRate = null;	
                                    }	
                                    var vendorCostId = allDetails.filter(obj => {	
                                        return obj.vendor == _vendor && obj.item == poLineItem && obj.chargeItem == ""	
                                    })	
                                    log.debug("vendorCostId", vendorCostId)	
                                    if (vendorCostId.length > 0) {	
                                        vendorCostRefId = vendorCostId[0]["id"]	
                                    } else {	
                                        vendorCostRefId = null;	
                                    }
                                 }else{
                                    var preferredRate = null
                                    var vendorCostRefId  = null
                                 }
                                 log.debug("preferredRate",preferredRate)
                                 log.debug("vendorCostRefId",vendorCostRefId);
                                 log.debug("array", array)
                                 log.debug("poLineRate", poLineRate)
                                 log.debug("poLineQty", poLineQty)
                                if (true/*poLineQty != array[indexOfPoItem].qtyNeeded || poLineRate != array[indexOfPoItem].rate*/) {
                                     poRec.selectLine({ sublistId: "item", line: y });
                                     poRec.setCurrentSublistValue({
                                         sublistId: 'item',
                                         fieldId: 'quantity',
                                         value: array[indexOfPoItem].qtyNeeded  
                                     });
                                     if(vendorCostRefId != null && vendorCostRefId !=''){
                                     poRec.setCurrentSublistValue({
                                        sublistId: 'item',
                                        fieldId: 'custcol_mb_trx_vc_reference',
                                        value: vendorCostRefId
                                    });
                                    }
                                    var rateToSet = preferredRate != null ? parseFloat(preferredRate) : (parseFloat(array[indexOfPoItem].rate)*parseFloat(0.6));
                                     poRec.setCurrentSublistValue({
                                         sublistId: 'item',
                                         fieldId: 'rate',
                                         value: rateToSet
                                     });
                                     log.debug("mainDropShipDetails",mainDropShipDetails)
 
                                     if (mainDropShipDetails[1]["Alt Vendor"] != null) {
                                        var dropShipDetailsMain = allDetails.filter(obj => {return obj.vendor === mainDropShipDetails[1]["Alt Vendor"] && obj.item === poLineItem && obj.chargeItem != "511544"})
                                        if(dropShipDetailsMain.length>0){ 
                                        alternateTotalCost += parseFloat(dropShipDetailsMain[0]["cost"])*Number(poLineQty)
                                         log.debug("dropShipDetailsMain",dropShipDetailsMain)
                                         log.debug("poLineQty",poLineQty)
                                         log.debug("alternateTotalCost",alternateTotalCost)
 
                                         poRec.setCurrentSublistValue({
                                             sublistId: 'item',
                                             fieldId: 'custcol_mb_alt_vendor',
                                             value: dropShipDetailsMain[0]["vendor"]
                                         });
                                         poRec.setCurrentSublistValue({
                                            sublistId: 'item',
                                            fieldId: 'custcol_mb_trx_vc_reference',
                                            value: dropShipDetailsMain[0]["id"]
                                        });
                                         poRec.setCurrentSublistValue({
                                             sublistId: 'item',
                                             fieldId: 'custcol_al_vendor_cost',
                                             value: parseFloat(dropShipDetailsMain[0]["cost"])*Number(poLineQty)
                                         });
                                         soAltUpdate[poLineItem]={"vendor":dropShipDetailsMain[0]["vendor"],"cost":parseFloat(dropShipDetailsMain[0]["cost"])*Number(poLineQty)}
                                     }
                                    }
                                     var item = poRec.getCurrentSublistValue({sublistId: 'item',fieldId: 'item'})
                                     log.debug("item",item);
                                     log.debug("itemAndLocation",itemAndLocation[item]);
                                     var poLocation = itemAndLocation[item];
                                     if(poLocation){
                                        poRec.setCurrentSublistValue({sublistId: 'item',fieldId  : 'location',value: poLocation});
                                     }
                                     // added by Lucas 7-26-2023
                                     poRec.setCurrentSublistValue({sublistId : 'item', fieldId : 'expectedreceiptdate', value: expectedReceiptDate})

                                     poRec.commitLine({
                                         sublistId: 'item'
                                     });
                                 }
                             };
                         };

                         log.audit('lineNumber after going through lines', lineNumber);
                     };
                 }
 
                 log.debug("alternateTotalCost",alternateTotalCost)
                 log.debug("soAltUpdate",soAltUpdate)
 
                 poLineCt = poRec.getLineCount({ sublistId: 'item' });
                 log.debug("poLineCt", poLineCt);
                 var adderFlag = false;
                 var adderVendor = "";
                 {// Added by Sai.k for adders.
 
                     var soLineCount = soRec.getLineCount({ sublistId: "item" });
                     log.debug("soLineCount", soLineCount);
                     for (var i = 0; i < soLineCount; i++) {
                         var item = soRec.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
                         var itemType = soRec.getSublistValue({ sublistId: "item", fieldId: "itemtype", line: i });
                         log.debug("itemType", itemType);
                         if (itemType == "Service" || itemType == "NonInvtPart" && (item != '497200' && item != '540102' && item != '540705')) { // remove admin/tax/discount items; 
                             adderFlag = true;
                             var quantity = soRec.getSublistValue({ sublistId: "item", fieldId: "quantity", line: i });
                             var rate = soRec.getSublistValue({ sublistId: "item", fieldId: "rate", line: i });
                             var des = soRec.getSublistValue({ sublistId: "item", fieldId: "description", line: i });
                             var taxCode = soRec.getSublistValue({ sublistId: "item", fieldId: "taxcode", line: i });
 
                             poRec.selectNewLine({ sublistId: "item" });
                             poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "item", value: item });
                             poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "quantity", value: quantity });
                             poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "rate", value: rate });
                             poRec.setCurrentSublistValue({ sublistId: "item", fieldId: "taxcode", value: taxCode });
                             //  poRec.commitLine({sublistId:"item"});
 
                         }
 
                     }
 
                 }

                 var wholeSaleItemCharge = allDetails.filter(obj => {	
                    return obj.chargeItem != ''	
                })	
                log.debug("Whole Sale Item Found", wholeSaleItemCharge)	
                if (wholeSaleItemCharge.length > 0) {	
                    for (x1 = 0; x1<wholeSaleItemCharge.length;x1++){
                        if(wholeSaleItemCharge[x1].chargeItem != '' && wholeSaleItemCharge[x1].chargeItem!= null){
                            poRec.selectNewLine({	
                                sublistId: "item"	
                            });	
                            poRec.setCurrentSublistValue({	
                                sublistId: "item",	
                                fieldId: "item",	
                                value: wholeSaleItemCharge[x1]["chargeItem"]	
                            });	
                            poRec.setCurrentSublistValue({	
                                sublistId: "item",	
                                fieldId: "rate",	
                                value: wholeSaleItemCharge[x1]["cost"]	
                            });	
                            poRec.setCurrentSublistValue({	
                                sublistId: "item",	
                                fieldId: "quantity",	
                                value: 1	
                            });	
                            poRec.commitLine({	
                                sublistId: "item"	
                            });	
                        }
                    }
                }

                 if (poLineCt > 0 && vendorFound == true) {
                    log.debug("mainDropShipDetails['Alt Vendor']",mainDropShipDetails["Alt Vendor"])
                     poRec.setValue({fieldId:"custbody_mb_alt_vendor",value:mainDropShipDetails[1]["Alt Vendor"]});
                     poRec.setValue({fieldId:"custbody_alt_vendor_cost",value:alternateTotalCost});
                    //  poRec.setValue({fieldId:"custbody_mb_vend_int_approved",value:true});
                     var poId = poRec.save({
                         enableSourcing: true,
                         ignoreMandatoryFields: true
                     });
                     log.audit('poId', poId);
 
                     var channel = soRec.getValue({ fieldId: 'class' });
 
                     {// Updating the sales transactions lines with Cost Estimate type and Cost Estimate Value
                         var soRec = record.load({
                             type: record.Type.SALES_ORDER,
                             id: soId,//array[0].soId,
                             isDynamic: false
                         });

                         soRec.setValue({fieldId:"custbody_mb_alt_vendor",value:mainDropShipDetails[1]["Alt Vendor"]});
                         soRec.setValue({fieldId:"custbody_alt_vendor_cost",value:alternateTotalCost});

 
                         var lineCount = soRec.getLineCount({sublistId:"item"});

                        for (var i = 0; i < lineCount; i++) {
                             var item = soRec.getSublistValue({ sublistId: "item", fieldId: "item", line: i });
                             var costDetails = soAltUpdate[item];
                             log.debug("costDetails",costDetails)


                            if(costDetails != "" && costDetails != null && costDetails !={}){
                             soRec.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_mb_alt_vendor',
                                value: costDetails["vendor"],
                                line:i
                            });
                            soRec.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_al_vendor_cost',
                                value: costDetails["cost"],
                                line:i
                            });
                           }  

                         }
                         soRec.save();
 
                     }
                     log.debug('customer', customer);
                     log.debug('channel', channel);
                     var poTranId = null//getNewTranId(poRec, soRec);
                     if (poTranId != null) {
                         record.submitFields({
                             type: record.Type.PURCHASE_ORDER,
                             id: poId,
                             values: { 'tranid': poTranId/*,"custbody_mb_vend_int_approved":true*/ }
                         });
                     }
                 }
                 log.debug('adderFlag', adderFlag);
                 log.debug('requiredApproval', requiredApproval);
                 log.debug('cond', adderFlag && !requiredApproval);
                 if (adderFlag && !requiredApproval) {
                     //var response    = taylorAPI.submitOrder(poId,_vendorType);
                 }
 
                 return {
                     'poId': poId,
                     'origArray': array
                 };

             } catch (err) {
                 log.error('Error in createDropship', err);
                 log.error('poParams in error', poParams);
                 return {'poId':null,'origArray':null};
             };
 
         };
 
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
                 //	        	log.debug('results',JSON.stringify(results));
 
                 var columns = search.columns;
                 //	        	log.debug('columns',JSON.stringify(columns));
 
                 var arrResults = new Array();
 
                 //	        	log.debug('results.length',results.length);
 
                 for (var k = 0; k < results.length; k++) {
 
                     var tempObj = new Object();
                     var result = results[k];
                     for (i = 0; i < columns.length; i++) {
 
                         if (columns[i].hasOwnProperty('join') == false) {
                             columns[i].join = null;
                         };
                         if (columns[i].hasOwnProperty('summary') == false) {
                             columns[i].summary = null;
                         }
 
                         var propName = columns[i].label.replace(/ /g, "_");
 
                         if (propName == 'itemSub') {
                             var tempName = propName + '_text';
 
                             tempObj[tempName] = result.getText({
                                 name: columns[i].name,
                                 join: columns[i].join,
                                 summary: columns[i].summary
                             });
                         };
 
                         tempObj[propName] = result.getValue(columns[i]);
                     };
 
                     //					tempArray.push(tempObj);
                     arrResults.push(tempObj);
                 };
                 return arrResults;
             } catch (err) {
                 log.error('err in searchGetResultObjects', JSON.stringify(err));
                 email.send({
                     author: '1423',
                     recipients: ['Lucas@mibar.net', 'netsuite@mibar.net', 'support@mibar.net'],
                     subject: 'Error in searchGetResultObjects -  MB_Scheduled_Cleanup_Unprocessed_Invoices.js',
                     body: 'Please see the attached error in the "dataIn" function: \n' + JSON.stringify(err),
                 });
 
             }
         }

         function vendorCostCalculated(quantity,item,vendor){
            try{



                var arrayFilters = [
                    ["custrecord_mb_adder_item", "anyof", item],
                    "AND",
                    //["formulanumeric: case when " + Number(quantity) + " >= {custrecord_mb_adder_quantity_break_min} then 1 else 0 end", "equalto", "1"]
                    [	
                        [	
                            ["formulanumeric: case when " + Number(quantity) + " >= nvl({custrecord_mb_adder_quantity_break_min},0) then 1 else 0 end", "equalto", "1"]	
                        ], "OR", [	
                            ["custrecord_mb_vc_wholesale_item", "is", "T"], "AND", ["formulanumeric: case when " + Number(quantity) + " >= nvl({custrecord_mb_adder_quantity_break_min},0) then 1 else 0 end", "equalto", "1"]	
                        ]	
                    ],	
                    "AND",	
                    ["isinactive", "is", "F"],
                    "AND",
                    ["custrecord_mb_discontinued", "is", "F"],
                    "AND",
                    ["custrecord_mb_stock_supplied_vc", "is", "F"],
                    "AND",
                    ["custrecord_mb_adder_cost_type",'NONEOF','101']
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
                       search.createColumn({name: "custrecord_mb_discontinued", label: "Discontinued"}),
                       search.createColumn({	
                        name: "formulanumeric",	
                        formula: "case when nvl(   {custrecord_mb_adder_cost_type},    'Unit' ) = 'Stock-Supplied' then {custrecord_mb_adder_item.averagecost}+ nvl({custrecord_mb_adder_cost},0) +  nvl(     {custrecord_mb_vc_estimated_freight},      0   ) else (   case when nvl(     {custrecord_mb_vc_wholesale_item},      'F'   ) = 'T' then nvl(     {custrecord_mb_adder_item.averagecost},      0   ) + nvl(     {custrecord_mb_vc_estimated_freight},      0   ) else {custrecord_mb_adder_cost} end ) end",	
                        label: "Wholesale Cost"	
                    })
                    ]
                 });

                 var vendorCostDetails = []
                 customrecord_mb_adder_vendor_costsSearchObj.run().each(function(result){
                    var costRecId = result.getValue({name:"internalid"});
                    var item      = result.getValue({name:"custrecord_mb_adder_item"});
                    var vendor    = result.getValue({name:"custrecord_mb_vendor"});
                    var itemQuantity  = result.getValue({name:"custrecord_mb_adder_quantity_break_min"});
                    var cost      = result.getValue({name:"custrecord_mb_adder_cost"});
                    var costType = result.getValue({name: "custrecord_mb_adder_cost_type", label: "Cost Type"})
                    var chargeItem = result.getValue({	
                        name: "custrecord_mb_vc_charge_item"	
                    });
                    // var costType =
                    log.debug("item",item);
                    log.debug("chargeItem", chargeItem)
                    log.debug("itemQuantity",itemQuantity)
                    log.debug("quantity",quantity)
                    log.debug("itemQuantity >= quantity",itemQuantity >= quantity)

                    var checkChargeIndex = vendorCostDetails.map(function(obj,index){
                        if(obj.chargeItem!=''){
                            return obj.chargeItem
                        };
                    });

                    const checkItem = obj => {	
                        return obj.item === item && obj.vendor === vendor && obj.chargeItem == '';
                    }	

                    // const chargeCheck = obj => {	
                    //     return obj.item === item && obj.vendor === vendor && obj.chargeItem == 511544	
                    // }
                    var tempObj = {"item":item,"vendor":vendor,"quantity":quantity,"cost":cost,"id":costRecId,"id": costRecId,	
                    "chargeItem": chargeItem, 'costType' : costType};

                    var checkItemVal = vendorCostDetails.some(checkItem);
                    log.audit('checkItemVal: '+ item,checkItemVal);
                    var chargeCheckVal = checkChargeIndex.indexOf(chargeItem);
                    log.audit('chargeCheckVal: '+ item,chargeCheckVal);

                    if(vendorCostDetails.length == 0 ){
                        vendorCostDetails.push(tempObj);
                    }else{
                        if((chargeItem =="" && !vendorCostDetails.some(checkItem)) || (chargeItem!='' && checkChargeIndex.indexOf(chargeItem) == -1)){
                             vendorCostDetails.push(tempObj);
                        };
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
                  const groupByVendor = groupBy(vendorCostDetails, 'vendor');

                  log.debug("groupByVendor 2",groupByVendor)

                  var vendorAndTotalCost = []
                  for (var vendor in groupByVendor) {
                    var costs = groupByVendor[vendor];

                    var totalCost = 0
                    for(var i=0;i<costs.length;i++){
                        if (costs[i]["costType"] != '2' && costs[i]["chargeItem"]=='') {	
                            totalCost += Number(costs[i]["quantity"]) * Number(costs[i]["cost"])	
                        } else {	
                            totalCost += Number(costs[i]["cost"])	
                        }
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
 
         function ordersToBeReposted(approval) {
             try {
 
                 var repostSearchObj = search.load({id:"customsearch_mb_approved_order_for_pos_2"});
                 if (approval) {
                    log.debug("Approved", "TRUE")
                    var approvalFilter = search.createFilter({
                        name: 'custbody_mb_vend_int_approved',
                     //   join:'purchaseorder',
                        operator: search.Operator.IS,
                        values:true
                    })

                    repostSearchObj.filters.push(approvalFilter);
                }

                 var searchResultCount = repostSearchObj.runPaged().count;
                 log.debug("Number of Orders to be Reposted", searchResultCount);
                 
                 if (searchResultCount == 0) {
                     return null;
                 }
                 var results = repostSearchObj.run().getRange({
                    start: 0,
                    end: 50
                 });
                 
                for(var l=0;l<results.length;l++) {
                    try{
                        var result = results[l];
                            var poId     = result.getValue({ name: "internalid", summary: "GROUP" });
                            var poVendor = result.getValue({ name: "entity", summary: "GROUP" });

                            log.debug("poId", poId);
                            log.debug("poVendor", poVendor);
                            if( poVendor == "31885"){
                                var vendorType = "taylor"
                            }else if(poVendor == "30990"){
                                var vendorType = "admore"
                            }else if (poVendor == "31394") {	
                                var vendorType = "Dupli"	
                            } else if(poVendor == '228'){ // fine impressions 2024-03-24
                                var vendorType = 'fineImpressions'
                            };
                            log.debug("vendorType", vendorType);
                            
                        if(vendorType != null){
                            if (vendorType == "Dupli") {	
                                var response = dupliAPI.submitOrder(poId, vendorType);	
                            } else if (vendorType == 'fineImpressions'){
                                var response = fineImpressionsAPI.submitOrder(poId)
                            } 
                            else {	
                                var response = taylorAPI.submitOrder(poId, vendorType);	
                            }
                            
                            if (response.code == 202 || response.code == 200) {
                                log.debug("Order PO ID :- " + poId, "The order has been posted.");
                            } else {
                                log.error("Order poId :- " + poId, "The order has not been posted.")
                            } 
                        }
                        continue;
                        //return true;
                    } catch(err){
                        log.error('Error posting order: '+ poId, err);
                        //return true;
                        continue;
                    }
                }
 
             } catch (e) {
                 log.error("Exception in resposting the orders", e);
             }
         }
         return {
             execute: execute
         }
     }
 );
 
 
 {/*
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- Dropship API Memo
 Object Id            :- custcol_mb_drop_ship_api_memo
 Link                 :- https://4668299-sb2.app.netsuite.com/app/common/custom/columncustfield.nl?id=11519&e=T
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- Alt Vendor
 Object Id            :- custcol_mb_alt_vendor
 Link                 :- https://4668299-sb2.app.netsuite.com/app/common/custom/columncustfield.nl?id=11522&e=T
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- Alt-Vendor Cost
 Object Id            :- custcol_al_vendor_cost
 Link                 :- https://4668299-sb2.app.netsuite.com/app/common/custom/columncustfield.nl?id=11523&e=T
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- Alt Vendor
 Object Id            :- custbody_mb_alt_vendor
 Link                 :- https://4668299-sb2.app.netsuite.com/app/common/custom/bodycustfield.nl?id=11524&e=T
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- Alt-Vendor Cost
 Object Id            :- custbody_alt_vendor_cost
 Link                 :- https://4668299-sb2.app.netsuite.com/app/common/custom/bodycustfield.nl?id=11525&e=T
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- 
 Object Id            :- 
 Link                 :- 
 
 Account              :- SB2
 Moved to Production  :- NO
 Created Object       :- 
 Object Id            :- 
 Link                 :- 
 
 */}