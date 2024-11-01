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
 define(['N/record','N/search','N/format'],function(record,search,format) {
	 
	function doPost(requestBody) {
		try{

			var receivedJson = requestBody;
			log.debug('received Data: ',JSON.stringify(receivedJson));
			if(receivedJson != null && receivedJson != ''){
				var salesorderId  = receivedJson.orderInternalId || '';
				if(salesorderId!='' && salesorderId!=null && salesorderId!= undefined){
					log.debug('salesorderId',salesorderId);
					var fulfillmentDateValue  = receivedJson.fulfillmentDate || '';
//					var trackNumber     = receivedJson.trackingNumber || '';
//					var packageDes      = receivedJson.packageDescription || '';
//					var shippingRecName = receivedJson.shippingCode || '';
//	              	var sscidCode = receivedJson.SCCIdCode || '';
	              	// add logic for different locations here 
					if(fulfillmentDateValue!='' && fulfillmentDateValue!=null && fulfillmentDateValue!= undefined ){
						log.debug('fulfillmentDateValue ',fulfillmentDateValue);
						var itemsJson = receivedJson.items || '';
						log.debug('itemsJson',itemsJson);
						if(itemsJson && itemsJson.length>0){
							var itemInternalIdCheck = 'F';
							/*for(var s=0;s<itemsJson.length;s++){
								if(!itemsJson[s].itemInternalId){
									itemInternalIdCheck = 'T';
								}
							}*/
							
							// insert logic to split fulfillment objects here;
							
							log.debug('itemInternalIdCheck',itemInternalIdCheck);
							if(itemInternalIdCheck == 'F'){
								/*
								 * 	    		var nondistinctSoIds = soSrchResults.map(function(element,index){
									    			return element.orderInternalId
									    		});
									    		
									    		var soIds = nondistinctSoIds.filter(function(element,index){
									    			return nondistinctSoIds.indexOf(element)===index
									    		});
								 */
								var ndLocationArray = itemsJson.map(function(element,index){
									return element.location
								})
								var locationArray = ndLocationArray.filter(function(element,index){
									return ndLocationArray.indexOf(element) === index
								});
								log.debug('locationArray',locationArray);
								//if(locationArray.length>1){
								var msgsString = '';
								var idsString = '';
								var successString = '';
								for(var i = 0;i<locationArray.length;i++){
									var responseObj = processFulfillment(receivedJson,locationArray[i]);
									if(i!=locationArray.length){
										successString += responseObj.success + '|';
										msgsString+=responseObj.msg+'|';
										idsString+=responseObj.fulfillId+'|';
									} else {
										successString += responseObj.success;
										msgsString+=responseObj.msg;
										idsString+=responseObj.fulfillId;
									}
									
								}; 
								if(successString.indexOf('false')==-1){
									return returnresponse(msgsString,idsString);
								} else {
									return returnrePartialFailsponse(msgsString,idsString);
								};
							//	}
							// here is the break	
							}else{
								log.debug('Items are missing');
								var msg = 'Item details required. Order Internal id ' + salesorderId ;
								return returnresponse(msg);
							}
						}else{
							log.debug('Items JSON missing');
							var msg = 'Item JSON required. Order Internal id ' + salesorderId ;
							return returnresponse(msg);
						}

					}else{
						log.debug('Date is missing');
						var msg = 'Item fulfillment date is required. Order Internal id ' + salesorderId ;
							return returnresponse(msg);
					}
				}else{
					log.debug('Sales order id is missing');
					var msg = 'Internal ID of sales order is required. Order Internal id ' + salesorderId ;
						return returnresponse(msg)
				}
			}else{
				log.debug('Input JSON is empty');
				var msg = 'Required details are missing. Order Internal id ' + salesorderId ;
					return returnresponse(msg);
			}
		}catch(e){
			log.error('Error is :',JSON.stringify(e));
			return returnresponse(e.message);
		}
	}
	
	function processFulfillment(receivedJson,location){
		try{
//			var binSearch = 'customsearch_mb_get_bin_location'; // Bin - Get Bin Location
			var salesorderId  = receivedJson.orderInternalId || '';
			var fulfillmentDateValue  = receivedJson.fulfillmentDate || '';
			var trackNumber = receivedJson.trackingNumber || '';
			var packageDes = receivedJson.packageDescription || '';
			var shippingRecName = receivedJson.shippingCode || '';
          	var sscidCol = formatSSCIDCol(receivedJson.SCCIdCode);
          	var sscidCode = sscidCol.sscidCode || '';
          	var cartonId = sscidCol.cartonId || '';
          	var reservedPckgFld1 = sscidCol.reservedPckgFld1 || '';
          	var itemsJson = receivedJson.items.filter(function(element,index){
          		if(element.location == location){
          			return true
          		} 
          		return false;
          	});
          /*	if (location==null || location =='null'){
          		s
          	}*/
			log.debug('itemsJson',itemsJson);
			var objRecordIf = record.transform({fromType: record.Type.SALES_ORDER,fromId: salesorderId,toType: record.Type.ITEM_FULFILLMENT});	
			objRecordIf.setValue({fieldId: 'shipstatus',value: 'C'});
			var recDate = getDateValue(fulfillmentDateValue);
			if (recDate) {
				objRecordIf.setValue({fieldId: 'trandate',value: recDate});
			}
          	if (sscidCode){
               objRecordIf.setValue({fieldId : 'custbody_mb_sscid_code',value: sscidCode});
            }
          	if (cartonId){
                objRecordIf.setValue({fieldId : 'custbody_mb_carton_id',value: cartonId});

          	};
          	if(reservedPckgFld1){
                objRecordIf.setValue({fieldId : 'custbody_mb_reserved_package_1',value: reservedPckgFld1});
          	}
			var if_item_lines = objRecordIf.getLineCount({sublistId: 'item'});
			log.debug('if_item_lines',if_item_lines);
			if(if_item_lines>0){
				for(var b=0; b < if_item_lines; b++ ) {
					objRecordIf.setSublistValue({sublistId: "item", fieldId: "itemreceive", value: false, line : b});
				}
			}
			for(var k=0 ; k<itemsJson.length ; k++){
				var itemid = itemsJson[k].itemInternalId
				// added for kit logic in interim
				/*
				if(itemsJson[k].binNumber.length>1){
					var itemBinQtys = itemsJson[k].binNumber.map(function(item,index){
						return item.quantity;
					})
					var itemQty = itemBinQtys.reduce(function(total,item){
						return total + item
					},0); 
					if(itemQty>itemsJson[k].quantityFulfilled){
						isKit = isKitItem(itemid);
						if (isKit==true){
							var newBin = {id: itemsJson[k].binNumber[0].id,quantity:itemsJson[k].quantityFulfilled};
							itemsJson[k].binNumber= [newBin];
						}
					};
				}
				*/
				log.debug('itemid',itemid);
              if(itemsJson[k].hasOwnProperty("merchantLineItemNumber")){
                  if(itemsJson[k].merchantLineItemNumber !="0"){
					var lineNumber = objRecordIf.findSublistLineWithValue({sublistId: 'item',fieldId: 'custcol_mb_merchant_line_item_number',value:itemsJson[k].merchantLineItemNumber });
				  } else {
					var lineNumber = objRecordIf.findSublistLineWithValue({sublistId: 'item',fieldId: 'item',value:itemsJson[k].itemInternalId });
				  }
              } else {
                var lineNumber = objRecordIf.findSublistLineWithValue({sublistId: 'item',fieldId: 'item',value:itemsJson[k].itemInternalId });
              };
				log.audit('lineNumber',lineNumber);
				if(lineNumber != -1){
					var isDropship = objRecordIf.getSublistValue({sublistId : 'item',fieldId: 'isdropshipline',line : lineNumber})
					log.audit('isDropshipLine',isDropship)
					if((isDropship==false || isDropship=='F' || isDropship=='false') && itemsJson[k].location!='' && itemsJson[k].location!=null && itemsJson[k].location!=0 && itemsJson[k].itemInternalId!='338650'){					
						//var binJson = itemsJson[k].binNumber;
						var binCheck = checkBins(itemsJson[k].itemInternalId,itemsJson[k].location,itemsJson[k].quantityFulfilled);
						log.audit('binCheck',binCheck);
						objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'itemreceive',value: false ,line : lineNumber});
						if(binCheck.markPd!=null){
							var soId = record.submitFields({
								type : record.Type.SALES_ORDER,
								id : salesorderId,
								values : {
									'custbody_mb_needs_ff_review':binCheck.markPd
								}
							});
							//objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'itemreceive',value: false ,line : lineNumber});
						} else if (binCheck.error!=null){
							throw binCheck.error;
						} else {
							objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'itemreceive',value: true ,line : lineNumber});
							// added by lucas 9-30 for AMZ dropship logic. 
							if(itemsJson[k].location != 0){
								objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'location',value: itemsJson[k].location ,line : lineNumber});
							};
							objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'quantity',value: itemsJson[k].quantityFulfilled ,line : lineNumber });
							var objSubRecord  = objRecordIf.getSublistSubrecord({sublistId: 'item',fieldId: 'inventorydetail' ,line: lineNumber});
							var binJson = binCheck.locationData//itemsJson[k].binNumber;
							//if(binJson.error!=)
							log.audit('binJson',binJson);
							// add logic for kits here 
							for(var s=0;s<binJson.length;s++){
								// added by lucas to handle AMZ dropship logic on 9-30-2022
								if(binJson[s].binOnHandAvail!=0){
									objSubRecord.setSublistValue({sublistId: 'inventoryassignment',fieldId: 'binnumber',line: s,value: binJson[s].binInternalId});
									objSubRecord.setSublistValue({sublistId: 'inventoryassignment',fieldId: 'quantity',line: s,value: binJson[s].binOnHandAvail});
								}
							}
						}
					} else {
						objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'itemreceive',value: true ,line : lineNumber});
						/*if ((isDropship==false || isDropship=='F' || isDropship=='false')){
							log.audit('dropship false - non inv item');
							if (objRecordIf.getValue({fieldId : 'subsidiary'}) == '32'){
								log.audit('setting location for non inv item');
								objRecordIf.setSublistValue({sublistId: 'item',fieldId: 'location',value: '60' ,line : lineNumber});
							}
						}
						objRecordIf.setSublistValue({sublistId : 'item', fieldId : 'quantity',value : itemsJson[k].quantityfulfilled, line : lineNumber});
						*/
					}

					//var itemIdRef = lookupItemId(itemid);
					//log.debug('itemIdRef',itemIdRef);
					//	if (itemIdRef && itemIdRef.islotitem == true) {

                    
					//	}
				}
			}
			try {

				if(shippingRecName != null && shippingRecName != ''){
					var ship_method = '';
					if(objRecordIf.getValue({fieldId : 'subsidiary'}) == '32'){
						shippingRecName = 'BNC_'+shippingRecName;
						var mb_shipping_codesSearchObj = search.create({type: "customrecord_mb_shipping_codes",
							filters:[["name","is",shippingRecName],"AND",["isinactive","is","F"],"AND",["custrecord_mb_is_bnc",'is','T']],
							columns:[search.createColumn({name: "name",sort: search.Sort.ASC}),search.createColumn({name: "custrecord_mb_shipping_method"})]
						});
						var searchResultCount = mb_shipping_codesSearchObj.run().getRange({start: 0,end: 10});
						log.debug("customrecord_mb_shipping_codesSearchObj result count",searchResultCount);
						if(searchResultCount !='' && searchResultCount != null && searchResultCount != undefined){
							ship_method = searchResultCount[0].getValue('custrecord_mb_shipping_method');
							log.debug('ship_method',ship_method);
						}
					} else {
						var mb_shipping_codesSearchObj = search.create({type: "customrecord_mb_shipping_codes",
							filters:[["name","is",shippingRecName],"AND",["isinactive","is","F"],"AND",["custrecord_mb_is_bnc",'is','F']],
							columns:[search.createColumn({name: "name",sort: search.Sort.ASC}),search.createColumn({name: "custrecord_mb_shipping_method"})]
						});
						var searchResultCount = mb_shipping_codesSearchObj.run().getRange({start: 0,end: 10});
						log.debug("customrecord_mb_shipping_codesSearchObj result count",searchResultCount);
						if(searchResultCount !='' && searchResultCount != null && searchResultCount != undefined){
							ship_method = searchResultCount[0].getValue('custrecord_mb_shipping_method');
							log.debug('ship_method',ship_method);
						}
					}
					

				}
				if(ship_method != null && ship_method != ''){
					objRecordIf.setValue({fieldId: 'shipcarrier',value: 'nonups'});
					objRecordIf.setValue({fieldId: 'shipmethod',value: ship_method});
				}
              // added by MIBAR on 4/13/22
				objRecordIf.setValue({fieldId : 'custbody_tss_shipping_confirmation_box',value: false});
				var recId = objRecordIf.save();
				log.debug('Record created successfully', recId);
				if(recId != null & recId != ''){
					if(trackNumber != null && trackNumber != ''){
						var fulfillRecord = record.load({type:'itemfulfillment',id:recId});
						fulfillRecord.setSublistValue({sublistId:'package',fieldId: 'packagedescr',line: 0,value: packageDes});
						fulfillRecord.setSublistValue({sublistId:'package',fieldId: 'packagetrackingnumber',line: 0,value: trackNumber});										
						var fulfillId = fulfillRecord.save();
						log.debug('Tracking Details updated successfully', fulfillId);
					}
					if(fulfillId != '' && fulfillId != ''){
						var msg = 'The item fulfillment record has been created.'
							return {"success" : "true","msg" : msg,'fulfillId' : fulfillId};
							//returnresponse(msg,fulfillId);
					}else{
						var msg = 'Item fulfillment has been created. But, failed to update Package details'
							return {"success":"false","msg" : msg, 'fulfullId' : salesorderId};
							//returnrePartialFailsponse(msg,recId);
					}
				}

			} catch (e) {
				log.error('Failed to create Record',e);
				return {"success": "false", "msg" : e.message,"fulfillId": salesorderId}//returnresponse(e.message);" +
			}

		}catch(e){
			log.error('Error in processFulfillment is :',JSON.stringify(e));
			return {"success": "false", "msg" : e.message,"fulfillId": salesorderId}//returnresponse(e.message);
		}

		
	}

	function lookupItemId(itemid) {
		var searchObj = search.create({
			type : "item",
			filters : [ "internalid", "is", itemid ],
			columns : [ "internalid"]//, "islotitem"]
		});

		var searchResult = {};
		searchObj.run().each(function(result) {
			searchResult = {internalid : result.getValue(result.columns[0])/*, islotitem: result.getValue(result.columns[1])*/};
			return true;
		});

		if (searchResult.internalid) {
			log.debug('lookupItemId', 'Found['+ itemid +']:=' + searchResult.internalid /*+ ':lot:' + searchResult.islotitem*/);
			return searchResult;
		} else {
			log.debug('lookupItemId', 'Not Found['+ itemid +']');
			return;
		}
	}

	function  returnresponse(msg,recordId)
	{
		var response;
		if(recordId!='' && recordId!=null && recordId!= undefined)
		{
			response={
					"Status"    :"Success",
					"Message"   :msg,
					"RecordId"  :recordId
			}
			log.audit("response",response)
			return response;
		}
		else{
			var response;
			response={
					"Status":"Fail",
					"Message":msg,
			}
			log.audit("response",response)
			return response;
		}
	}

	function  returnrePartialFailsponse(msg,recordId)
	{
		var response;
		if(recordId!='' && recordId!=null && recordId!= undefined)
		{
			response={
					"Status"    :"Partial Fail",
					"Message"   :msg,
					"RecordId":recordId,
			}
			log.audit("response",response)
			return response;
		}
		else{
			var response;
			response={
					"Status":"Fail",
					"Message":msg,
			}
			log.audit("response",response)
			return response;
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
	};

    function checkBins(itemId,location,quantity){
		try{
			const invSrchId = '14195';
			var binSrch = search.load({
				id : invSrchId,
				type : 'inventorybalance'
			});
			binSrch.filters.push(search.createFilter({
				name : 'internalid',
				join : 'item',
				operator : search.Operator.ANYOF,
				values : itemId
			}));
			binSrch.filters.push(search.createFilter({
				name : 'location',
				operator : search.Operator.ANYOF,
				values : location
			}));

			binSrch.filters.push(search.createFilter({
				name : 'locationquantityonhand',
				join : 'item',
				operator : search.Operator.GREATERTHANOREQUALTO,
				values : quantity//,
				//summary : search.Summary.SUM
			}))

			var itemBinData = searchGetResultObjects(binSrch);
			
			log.audit('itemBinData',JSON.stringify(itemBinData));
			log.audit('itemBinData length', itemBinData.length);
			var binSuccess = false;
			var locationArray = new Array();
			if(itemBinData.length>0){
				if(parseInt(itemBinData[0].binOnHandAvail)>=parseInt(quantity)){
					itemBinData[0].binOnHandAvail = quantity;
                    log.audit('itemBinQtyAvail',itemBinData[0].binOnHandAvail)
					locationArray.push(itemBinData[0]);
					binSuccess = true;
				} else {
					var binQty = 0;
					for(var m=0;m<itemBinData.length;m++){
						if(binQty<parseInt(quantity) && itemBinData[m].binOnHandAvail>0){
							var qtyToSet = (binQty+parseInt(itemBinData[m].binOnHandAvail))>=parseInt(quantity) ? parseInt(quantity)-binQty : itemBinData[m].binOnHandAvail;												
							itemBinData[m].binOnHandAvail = qtyToSet;
							locationArray.push(itemBinData[m]);
							binQty= binQty + itemBinData[m].binOnHandAvail;
						} else {
							binSuccess = true;
							return {locationData : locationArray,markPd:null,error : null};
							//break;
						}
					}
					if(binQty<parseInt(quantity)){
						return {
							locationData : null, 
							markPd : 'Insufficient Quantity in NS - Needs Review',
							error : null
						};
					} else {
						binSuccess = true;
					}	
				}
			} else {
				return {
					locationData : null, 
					markPd : 'Insufficient Quantity in NS - Needs Review',
					error : null
				};
			}
			if (binSuccess){
				return {locationData : locationArray,markPd:null,error : null};
			}

			
		}catch(err){
			log.error('ERROR IN CHECKING BINS',JSON.stringify(err));
			return {locationData : null, markPd: false,error : JSON.stringify(err)};
		}
	}
	
	function isKitItem(itemId){
		var srch = search.load({
			id : 'customsearch_mb_kit_items' // Kit Items (Code Linked Do not Edit)
		});
		var filter = search.createFilter({
			name : 'internalid',
			operator : search.Operator.ANYOF,
			values : itemId
		});
		srch.filters.push(filter);
		var results = srch.run().getRange({start : 0,end:1});
		if(results.length>0){
			return true
		} else {
			return false
		};
	}
	
	function formatSSCIDCol(string){
		log.debug('formatSSCIDCol string', string);
	    if(string.indexOf('|')!=-1 && string.split('|').length == 2){
	        return {
	            'sscidCode':'',
	            'cartonId' : string.split('|')[0],
	            'reservedPckgFld1' : string.split('|')[1]
	        }
	    } else {
	        return {
	            'sscidCode' : string.split('|')[0],
	            'cartonId' : '',
	            'reservedPckgFld1' : ''
	        }
	    }
	};

	function searchGetResultObjects(search,_start,_end){
		try{
			var results;
			if (_start!=null && _end!=null){
				results = search.run()//.getRange({
				results = results.getRange({
					start : _start,
					end : _end
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
			
			for (var k=0;k<results.length;k++){
				
				  var tempObj = new Object();				
				  var _result = results[k];
				  for (i=0;i<columns.length;i++){
					  
					  if (columns[i].hasOwnProperty('join')==false){
						  columns[i].join=null;
					  };
					  if (columns[i].hasOwnProperty('summary')==false){
						  columns[i].summary = null;
					  }
					  
					  var propName = columns[i].label.replace(/ /g,"_");
					  
					  tempObj[propName] = _result.getValue(columns[i]);
					  
					  var textName = propName+'_text';
					  
					  tempObj[textName] = _result.getText({
						  name : columns[i].name,
						  join : columns[i].join,
						  summary : columns[i].summary
					  });
				  };
				  
//    				tempArray.push(tempObj);
				arrResults.push(tempObj);
			};
			return arrResults;
		} catch(err){
			//errorHandler(err,'SearchGetResultObjects','MB_scheduled_stage_trx_data',false,null)
			log.error('error is searchgetresultobjects',JSON.stringify(err))
		}

	}
	  
	function searchGetAllResult(option){
		var result = [];
		if(option.isLimitedResult == true){
			var rs = option.run();
			result = rs.getRange(0,1000);
			
			return result;
		}
		
		var rp = option.runPaged();
		rp.pageRanges.forEach(function(pageRange){
			var myPage = rp.fetch({index: pageRange.index});
			result = result.concat(myPage.data);
		});
		
		return result;
	};

	return {
		post: doPost
	};

});