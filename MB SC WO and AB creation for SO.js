/**
 * @NApiVersion 2.0
 * @NScriptType ScheduledScript
 */
var fulfilLocationData  = [];
var startDateTime 		= new Date();
define(['N/search','N/record','N/runtime','N/url','N/https','N/task'],
		function(search,record,runtime,url,https,task){
			function execute(scriptContext){
				try {
					{
						var locationSearchObj = search.create({
							type    : "location",
							filters :[search.createFilter({name:'internalid',operator:search.Operator.NONEOF,values:['60']})],
							columns :
								[
								 search.createColumn({name: "internalid", label: "Internal ID"}),
								 search.createColumn({name: "name",sort: search.Sort.ASC,label: "Name"}),
								 search.createColumn({name: "subsidiary", label: "Subsidiary"}),
								 search.createColumn({name: "internalid",join: "CUSTRECORD_MB_SUBS_ID_IN_LOCATION",label: "Internal ID"}),
								 search.createColumn({name: "custrecord_mb_fulfillment_center", label: "Fulfillment Center"}),
								 //search.createColumn({name: "custrecordcustrecord_mb_location_channel", label: "Location channel"}),
								 search.createColumn({name: "custrecord_mb_subs_id_in_location", label: "Subsidiary_ID"}),
								 search.createColumn({name: "isinactive", label: "Inactive"})
								 ]
						});

						var buildLocationData   = [];
						var fulFilmentLocations = [];
						var counter = 0;
						locationSearchObj.run().each(function(result){
							var inactive  		  = result.getValue({name: "isinactive"});
							var internalId        = result.getValue({name: "internalid"});
							var customSub 		  = result.getValue({name: "custrecord_mb_subs_id_in_location"});
							var subInternalId	  = result.getValue({name: "internalid",join: "CUSTRECORD_MB_SUBS_ID_IN_LOCATION"});
							var fulfilmentCenter  = result.getValue({name: "custrecord_mb_fulfillment_center"});

							if(!inactive && customSub.length>0 /* && (internalId != 94 || internalId != "94") */){
								buildLocationData.push({"location_id":internalId,"subsidiary":subInternalId});
							}

							if(fulfilmentCenter  /* && (internalId != 94 || internalId != "94") */){
								fulFilmentLocations.push(internalId)
								fulfilLocationData.push({"location":internalId,"subsidiary":subInternalId})
							}


							return true;
						});

                      log.debug('buildLocationData',buildLocationData);
                      log.debug('fulFilmentLocations',fulFilmentLocations);
                      log.debug('fulfilLocationData',fulfilLocationData);
						//fulfilLocationData.push({"location": "13","subsidiary":"18"}) // Testing purpose SB
					}


					{
						var itemSearchObjBO =  search.load({
                            id: 'customsearchmb_back_ordered_asmbly_items'
                        });
                        /*search.create({
							type: "item",
							filters:
							[
							   ["type","anyof","Assembly"], 
							   "AND", 
							   ["type","anyof","Assembly"], 
							   "AND", 
							   ["subsidiary","anyof","18"], 
							   "AND", 
							   ["quantitybackordered","greaterthan","0"], 
							   "AND", 
							   ["transaction.type","anyof","SalesOrd"], 
							   "AND", 
							   ["transaction.subsidiary","anyof","18"], 
							   "AND", 
							   ["inventorylocation","anyof","11","12"], 
							   "AND", 
							   ["locationquantitybackordered","greaterthan","0"], 
							   "AND", 
							   ["formulanumeric: case when lower({itemid}) like '%kit%' then 1 else 0 end ","equalto","1"]
							],
							columns:
							[
							   search.createColumn({
								  name: "internalid",
								  sort: search.Sort.ASC,
								  label: "Internal ID"
							   }),
							   search.createColumn({name: "itemid", label: "Name"}),
							   search.createColumn({name: "quantitybackordered", label: "Back Ordered"}),
							   search.createColumn({name: "memberitem", label: "Member Item"}),
							   search.createColumn({name: "memberquantity", label: "Member Quantity"}),
							   search.createColumn({
								  name: "custitem_mb_item_attribute_substitute",
								  join: "memberItem",
								  label: "Substitute"
							   }),
							   search.createColumn({
								  name: "totalquantityonhand",
								  join: "memberItem",
								  label: "Total Quantity"
							   }),
							   search.createColumn({name: "locationquantitybackordered", label: "Location Back Ordered"})
							]
						 });
						 var searchResultCount = itemSearchObjBO.runPaged().count;
						 log.debug("itemSearchObj result count",searchResultCount); */
						 
						 
						 

					}
					var assemblyitemSearchObj = search.load({
					    id: 'customsearchmb_back_ordered_asmbly_items'
					});

					var searchResultCount = assemblyitemSearchObj.runPaged().count;
					log.debug("assemblyitemSearchObj result count",searchResultCount);
					
					if(searchResultCount == 0){
						log.debug("<p style='color:red'>Process Terminated</p>","There are no backorder Assembly items to Proces.")
						return;
					}
						
					if(true){
						var columnsArray 	  		 = itemSearchObjBO.columns;
						log.debug("columnsArray",columnsArray)
						
						
						itemSearchObjBO.run().each(function(result){

							var columnsArray 	  		 = itemSearchObjBO.columns;
							var totalBoResults 	  		 = [];
							var memberItemIds			 = []; //Stores all the member items of the Backordered Assembly items including substitute items to be passed on to the Bin search.
							var kitObj					 = {}; //Object to store substitute kit item id as key and quantity backordered as value.
							var memItemBackordered		 = {}; //Array of objects storing member item and its corresponding backordered.(member quantity* Backorderd quantity)
							var memItemAndMemQuantity    = {}; //Array of objects that stores member item as key and member quantity as key.
							var memberAndSubstitute	 	 = {}; //Array of objects storing member item and its substitute if exists.
                            var onlySubstitueMemItems    = [];
							
							var internalId = result.getValue({name:"internalid"});
							log.debug("internalId",internalId);
							
							
						
						var defaultFilters = assemblyitemSearchObj.filters;
						log.debug("remove filter",counter)
						// if(defaultFilters.length>8){
						if(counter > 0){	
							defaultFilters.pop()
						};
						defaultFilters.push(search.createFilter({
							name: 'internalid',
							operator: search.Operator.ANYOF,
							values: internalId
						}));
						
					    assemblyitemSearchObj.filters = defaultFilters;

						var resultSet = assemblyitemSearchObj.run().getRange(0,100);
						log.debug("resultSet",resultSet)
						
						
						assemblyitemSearchObj.run().each(function(result){
							//var result = resultSet[r]
							var resultObj = {};
							
							var assemblyItem	  = result.getValue({name: "memberitem"});
							var memberItem 		  = result.getValue({name: "memberitem"});
							var LocBackOrdered	  = result.getValue({name: "locationquantitybackordered"});
							
							var value = totalBoResults.filter(function(item){return item.Member_Item == memberItem && item.Internal_ID == assemblyItem});
							var index = totalBoResults.indexOf(value[0]);
							columnsArray.forEach(function(element){ 
								return resultObj[element.label.replace(" ","_")] = result.getValue(element); 
							});
							
							if(index != -1){
									totalBoResults[index]["Location_Back Ordered"] = Number(totalBoResults[index]["Location_Back Ordered"])+Number(LocBackOrdered)
							}else{
								totalBoResults.push(resultObj);
							}

							var substituteItem    = result.getValue({name: "custitem_mb_item_attribute_substitute",join: "memberItem"});
							var substituteText    = result.getText({name: "custitem_mb_item_attribute_substitute",join: "memberItem"});
							var memberQuantity    = Number(result.getValue({name: "memberquantity"}));
							var quantBackOrdered  = Number(result.getValue({name: "quantitybackordered"}));

							if(!memItemBackordered.hasOwnProperty(memberItem)){
								memItemBackordered[memberItem] = memberQuantity*quantBackOrdered
								memItemAndMemQuantity[memberItem] = memberQuantity
							}
							if(substituteItem && !memItemBackordered.hasOwnProperty(substituteItem)){
								memItemBackordered[substituteItem] = memberQuantity*quantBackOrdered
								memItemAndMemQuantity[substituteItem] = memberQuantity
							}
                            
							if(memberItemIds.indexOf(memberItem) == -1){
								memberItemIds.push(memberItem)
							}
							if(substituteItem && memberItemIds.indexOf(substituteItem) == -1){
								memberItemIds.push(substituteItem)
								memberAndSubstitute[memberItem]=substituteItem
							}
							
							if(substituteText.toLowerCase().indexOf("kit") != -1 && !kitObj.hasOwnProperty(substituteItem)){
								kitObj[substituteItem] = quantBackOrdered;
							}
							return true;
						});
						log.debug("totalBoResults",totalBoResults);
						log.debug("memItemBackordered",memItemBackordered);
						log.debug("memberItemIds",memberItemIds);
						log.debug("memberAndSubstitute",memberAndSubstitute);
						log.debug("onlySubstitueMemItems",onlySubstitueMemItems);
						log.debug("kitObj",kitObj);
						
						var kitMemberItems = {}; // Array of objects where Kit item id is Key and Its components are values.
						// Search used to get Kit item components if there are any in substitutes.
						if(Object.keys(kitObj).length>0){
							var itemSearchObj = search.create({
								   type: "item",
								   filters:
								   [
								      ["internalid","anyof",Object.keys(kitObj)]
								   ],
								   columns:
								   [
								      search.createColumn({name: "internalid", label: "Internal ID"}),
								      search.createColumn({name: "memberitem", label: "Member Item"}),
								      search.createColumn({name: "memberquantity", label: "Member Quantity"})
								   ]
								});
								itemSearchObj.run().each(function(result){
									var internalId     = result.getValue({name: "internalid"})
									var memberItem 	   = result.getValue({name: "memberitem"});
									var memberQuantity = result.getValue({name: "memberquantity"});

                                    if(memberItem && !onlySubstitueMemItems.hasOwnProperty(memberItem)){
                                        onlySubstitueMemItems.push(memberItem)
                                    }
									
									if(!memItemBackordered.hasOwnProperty(memberItem)){
										memItemBackordered[memberItem] = memberQuantity*Number(kitObj[internalId])
										memItemAndMemQuantity[memberItem] = memberQuantity
									}
									if(memberItemIds.indexOf(memberItem) == -1){
										memberItemIds.push(memberItem)
									}
									if(kitMemberItems.hasOwnProperty(internalId)){
										var existingData = kitMemberItems[internalId];
										existingData.push(memberItem);
										kitMemberItems[internalId] = existingData;
									}else{
										kitMemberItems[internalId] = [memberItem]
									}
								   return true;
								});
						}

						log.debug("memItemBackordered after kit",memItemBackordered);
						log.debug("memItemAndMemQuantity after kit",memItemAndMemQuantity);
						log.debug("kitMemberItems",kitMemberItems);	
						log.debug("memberItemIds after kit",memberItemIds);	
                        log.debug("onlySubstitueMemItems",onlySubstitueMemItems);
						
						var groupedMemItemDtlsByItem = {}; // The backordered results above grouped by Assembly item id.
						var assemblyItemAndMemItms	 = {}; // Objects storing Assembly item as key and for values an object of assembly items member items and member quantity.

						function groupBy1(array, key){
							return array.reduce(function(result, currentValue){
								(result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);

								var assemblyItemId    = currentValue["Internal_ID"];
								var componentItemId   = currentValue["Member_Item"];
								var componentQuantity = currentValue["Member_Quantity"];
								var substituteItem    = currentValue["Substitute"];

								if(assemblyItemAndMemItms.hasOwnProperty(assemblyItemId)){
									var existingIds1 = assemblyItemAndMemItms[assemblyItemId];
									existingIds1[componentItemId] = currentValue["Member_Quantity"];
									if(substituteItem && !existingIds1.hasOwnProperty(substituteItem))
										existingIds1[substituteItem] = currentValue["Member_Quantity"];
									
									assemblyItemAndMemItms[assemblyItemId] = existingIds1
								}else{
									assemblyItemAndMemItms[assemblyItemId]={}
									assemblyItemAndMemItms[assemblyItemId][componentItemId] = componentQuantity
									if(substituteItem)
									assemblyItemAndMemItms[assemblyItemId][substituteItem]  = componentQuantity;
								}

								return result;
							}, {}); 
						};
						var resultsGroupedByItem = groupBy1(totalBoResults, "Internal_ID");
						var assemblyItemIds        = Object.keys(resultsGroupedByItem);
						log.debug("resultsGroupedByItem",resultsGroupedByItem);
						log.debug("Assembly item ids",assemblyItemIds);
						log.debug("assemblyItemAndMemItms",assemblyItemAndMemItms);

						{// 28/01/2023
						
							var itemSearchObj = search.create({
								type: "item",
								filters:
								[
								   ["internalid","anyof",memberItemIds]
								],
								columns:
								[
								   search.createColumn({
									  name: "itemid",
									  sort: search.Sort.ASC,
									  label: "Name"
								   }),
								   search.createColumn({name: "displayname", label: "Display Name"}),
								   search.createColumn({name: "salesdescription", label: "Description"}),
								   search.createColumn({name: "type", label: "Type"}),
								   search.createColumn({name: "baseprice", label: "Base Price"}),
								   search.createColumn({name: "internalid", label: "Internal ID"})
								]
							 });
							 var assemblyItems     = []; 
							 itemSearchObj.run().each(function(result){
								var memberItemId = result.getValue({name: "internalid", label: "Internal ID"});
								var itemType     = result.getValue({name: "type", label: "Type"});
								var displayName  = result.getValue({name: "itemid", label: "Name"}).toLowerCase()
								log.debug("displayName",displayName);
								log.debug("displayName",displayName.indexOf("kit"))
								
								if((itemType == "Assembly"|| itemType == "Assembly/Bill of Materials") && assemblyItems.indexOf(memberItemId) == -1 && displayName.indexOf("kit") == -1)
								assemblyItems.push(memberItemId)
								return true;
							 });
							 
							
						
						}

                          log.debug('Search memberItemIds',memberItemIds);

						//Saved search to get the Bin details of all the member items(Including sub items).
						var itemSearchObj = search.create({
							type: "item",
							filters:
								[
								 //["binonhand.quantityavailable","greaterthan","0"], 
								 //"AND", 
								// ["formulanumeric: case when upper({binonhand.binnumber}) like 'FBA%' then 0 else 1 end","equalto","1"], 
								// "AND", 
								["binonhand.binnumber","noneof","2907","2277"],
								"AND",
								/* updated by lucas 2-8-2024 to accomodate SYR functionality*/
								["formulanumeric: case when {binonhand.location} = 'SYR Warehouse' or {binonhand.location} = 'OLD-SYR Warehouse' then case when {binonhand.binnumber} not like 'B%' and {binonhand.binnumber} not like 'OLD-B%' and {binonhand.binnumber} not like '%MANU%' and {binonhand.binnumber} not like '%REC%' then 1 else 0 end else 1 end","equalto","1"],  
								"AND",
								 ["internalid","anyof",memberItemIds],
								 "AND",
								 ["binOnHand.location","anyof",fulfilLocationData.map(function(element){return element.location})]
								 //,
								 //"AND",
								 //["isinactive","is","F"],
								 //"AND",
								 //["binonhand.quantityavailable","greaterthan","0"]
								],
								 columns:
									 [
									  search.createColumn({name: "itemid",sort: search.Sort.ASC,label: "Name"}),
									  search.createColumn({name: "internalid", label: "Internal ID"}),
									  search.createColumn({name: "binnumber",join: "binOnHand",label: "Bin Number"}),
									  search.createColumn({name: "quantityavailable",join: "binOnHand",sort: search.Sort.DESC,label: "Available"}),
									  search.createColumn({name: "location",join: "binOnHand",sort: search.Sort.ASC,label: "Location"}),
									  search.createColumn({name: "custitem_mb_item_pack_size", label: "Pack size"}),
									  search.createColumn({name: "totalquantityonhand", label: "Total Quantity"}),
									  search.createColumn({name: "type", label: "Type"})
									  ]
						});
						log.debug("Item Search Object",itemSearchObj)
						var columnsArray 	  = itemSearchObj.columns;
						var memberItemDetails = [];
						var locationWiseData  = {}; // Object that stores member itemid as a key and for value and object of locationid and avalability. 
					

						{
							var results      = itemSearchObj.run();
							var resultCount  = 0;
							var resultslice  = '';
							var totalResults = [];

							do {
								resultslice = results.getRange(resultCount, resultCount + 1000);
								if(resultslice.length>0){
									totalResults = totalResults.concat(resultslice);
									resultCount += resultslice.length
								}
							}while (resultslice.length >= 1000);
						}
						log.debug("totalResults",totalResults)
						log.debug("totalResults",totalResults.length)

						for(var it =0 ;it < totalResults.length;it++){
							var result = totalResults[it];
							var resultObj = {};
							columnsArray.forEach(function(element){   return resultObj[element.label.replace(" ","_")] = result.getValue(element);    });


							var memberItemId = result.getValue({name: "internalid", label: "Internal ID"});
							var location     = result.getValue({name: "location",join: "binOnHand",sort: search.Sort.ASC,label: "Location"});
							var available    = result.getValue({name: "quantityavailable",join: "binOnHand",sort: search.Sort.ASC,label: "Available"});
							var itemType     = result.getValue({name: "type", label: "Type"});

							//if(itemType == "Assembly" && assemblyItems.indexOf(memberItemId) == -1)
							//	assemblyItems.push(memberItemId)

								if(available >0 || itemType != "InvtPart"){
									memberItemDetails.push(resultObj);

									if(available>0){
										if(locationWiseData.hasOwnProperty(memberItemId)){
											if(locationWiseData[memberItemId].hasOwnProperty(location)){
												locationWiseData[memberItemId][location]+= Number(available);
											}else{
												locationWiseData[memberItemId][location]= Number(available);
											}
										}else{
											locationWiseData[memberItemId] = {}
											locationWiseData[memberItemId][location] = Number(available);
										}
									}	
								}

						};
						log.debug("Location wise avaliablity",locationWiseData);

						function groupBy(array, key){
							return array.reduce(function(result, currentValue){
								var internalId = currentValue["Internal_ID"];
								var indexOfSub = Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e]}).indexOf(internalId)
								if(indexOfSub != -1){
									internalId = Object.keys(memberAndSubstitute)[indexOfSub]
								}
								(result[internalId] = result[internalId] || []).push(currentValue);
								return result;
							}, {}); 
						};
						var binDetailsGrpdByMemItm = groupBy(memberItemDetails, "Internal_ID");
						log.debug("binDetailsGrpdByMemItm",binDetailsGrpdByMemItm);
						
						
						// The following loop updates each results object that we got from the Backorderd search with bin details.
						for(var asItemId in assemblyItemAndMemItms){
							
							var memDtlsOfAsItmId = Object.keys(assemblyItemAndMemItms[asItemId]);
							log.audit("asItemId",asItemId);
							log.audit(asItemId+" resultsGroupedByItem[asItemId]",resultsGroupedByItem[asItemId]);
							log.audit(asItemId+" memDtlsOfAsItmId",memDtlsOfAsItmId);
							var innerMemberAndSub  = {};
							resultsGroupedByItem[asItemId].forEach(function(obj){
								if(obj.Substitute)
									innerMemberAndSub[obj.Member_Item] = obj.Substitute

							});
							log.audit(asItemId+" innerMemberAndSub",innerMemberAndSub);
							var asmblyMemBinDtls = {};
							for(var mi = 0; mi<memDtlsOfAsItmId.length;mi++){
								var originalMemberItem = memDtlsOfAsItmId[mi];
								if(!originalMemberItem)
									continue;
								log.audit(asItemId+" originalMemberItem",originalMemberItem);
								var substituteIndex = Object.keys(innerMemberAndSub).map(function(e){return innerMemberAndSub[e]}).indexOf(memDtlsOfAsItmId[mi])
								log.audit(asItemId+" substituteIndex",substituteIndex);
								var kitflag = false;
								log.audit(asItemId+" kitflag",kitflag);
								if(substituteIndex != -1){
									var originalMemberItem = Object.keys(innerMemberAndSub)[substituteIndex]
									kitflag = kitObj.hasOwnProperty(memDtlsOfAsItmId[mi])
								}


								var value = resultsGroupedByItem[asItemId].filter(function(item){return item.Member_Item === originalMemberItem});
								var index = resultsGroupedByItem[asItemId].indexOf(value[0]);
								if(!kitflag){
									resultsGroupedByItem[asItemId][index]["components"] = binDetailsGrpdByMemItm[originalMemberItem] 
								}else{
									var kitComponentIds = kitMemberItems[memDtlsOfAsItmId[mi]]
									var existingData    = resultsGroupedByItem[asItemId];

									for(var kit=0;kit<kitComponentIds.length;kit++){
										var kitComponent 			= kitComponentIds[kit];
										var componentObj ={};
										componentObj["Internal_ID"] 	= existingData[index]["Internal_ID"]
										componentObj["Name"] 			= existingData[index]["Name"]
										componentObj["Back_Ordered"] 	= existingData[index]["Back_Ordered"]
										componentObj["Member_Item"] 	= kitComponent;
										componentObj["Member_Quantity"] = existingData[index]["Member_Quantity"]
										componentObj["Substitute"]  	= "";
										componentObj["kitFlag"]  		= "True";
										componentObj["components"]  	= binDetailsGrpdByMemItm[kitComponent];
										existingData = existingData.concat(componentObj) 
									}
									resultsGroupedByItem[asItemId]=existingData
								}
							}
						}
						log.debug("resultsGroupedByItem",resultsGroupedByItem) // Final object that we will iterate through for creating the WO and AB.

						
						var orderDetailsOfBackOrderedItems = {};

						{ // Search to get backordered sales for the assembly items from the above results.
							var assemblyitemSalesOrderSrcObj = search.create({
								type: "assemblyitem",
								filters:
									[
									 ["type","anyof","Assembly"], 
									 "AND", 
									 ["quantitybackordered","greaterthan","0"], 
									 "AND", 
									 ["transaction.type","anyof","SalesOrd"], 
									 "AND", 
									 ["transaction.status","anyof","SalesOrd:D","SalesOrd:B"], 
									 "AND", 
									 ["internalid","anyof",assemblyItemIds], 
									 "AND", 
									 ["formulanumeric: {transaction.quantity}-nvl({transaction.quantitycommitted},0)-nvl({transaction.quantityshiprecv},0)","greaterthan","0"]
									 ],
									 columns:
										 [
										  search.createColumn({name: "internalid", label: "Internal ID"}),
										  search.createColumn({name: "transactionnumber",join: "transaction",label: "Transaction Number"}),
										  search.createColumn({name: "quantity",join: "transaction",label: "Quantity"}),
										  search.createColumn({name: "quantityshiprecv",join: "transaction",label: "Quantity Fulfilled/Received"}),
										  search.createColumn({name: "subsidiary",join: "transaction",label: "Subsidiary"}),
										  search.createColumn({name: "formulanumeric",formula: " {transaction.quantity}-nvl({transaction.quantitycommitted},0)-nvl({transaction.quantityshiprecv},0)",label: "Order Back Ordered"}),
										  search.createColumn({name: "quantitybackordered", label: "Back Ordered"}),
										  search.createColumn({name: "trandate",join: "transaction",sort: search.Sort.ASC,label: "Date"})
										  ]
							});
							var searchResultCount = assemblyitemSalesOrderSrcObj.runPaged().count;
							assemblyitemSalesOrderSrcObj.run().each(function(result){

								var assemblyItemId  = result.getValue({name: "internalid",label: "Internal ID"});
								var transSubsidiary = result.getValue({name: "subsidiary",join: "transaction",label: "Location"});
								var soBackordered	= result.getValue({name: "formulanumeric",formula: " {transaction.quantity}-nvl({transaction.quantitycommitted},0)-nvl({transaction.quantityshiprecv},0)",label:"Formula (Numeric)"							      });
								var itemBackOrdered	= result.getValue({name: "quantitybackordered",label: "Back Ordered"});

								if(orderDetailsOfBackOrderedItems.hasOwnProperty(assemblyItemId)){
									var exisitingDetails = orderDetailsOfBackOrderedItems[assemblyItemId];
									exisitingDetails.push({"Subsidiary":transSubsidiary,"SO Backordered":soBackordered,"Item Back Ordered":itemBackOrdered});
								}else{
									orderDetailsOfBackOrderedItems[assemblyItemId] = [{"Subsidiary":transSubsidiary,"SO Backordered":soBackordered,"Item Back Ordered":itemBackOrdered}]
								}

								return true;
							});
						}
						log.debug("orderDetailsOfBackOrderedItems",orderDetailsOfBackOrderedItems);
						log.debug("resultsGroupedByItem length",resultsGroupedByItem.length);

						
						try{
							for(var itemId in resultsGroupedByItem){

								var assemblyItemId    = itemId;
								var backOrderedQuant  = resultsGroupedByItem[assemblyItemId][0]["Location_Back Ordered"];

								var memberItemDetails  = resultsGroupedByItem[assemblyItemId];
								var memQuantityDetails = memItemAndMemQuantity
								log.debug(assemblyItemId+" memberItemDetails",memberItemDetails);

								var [woLocation,woSubsidiary,woLineDetails,useSubstituteFlag,fullyBuildable] = [0,0,new Array(),false,false];
								var memberItems        = Object.keys(assemblyItemAndMemItms[assemblyItemId])

								const namesToDeleteSet = Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e]});

								var memberItemsUpdated = memberItems.filter(function(name){
									return namesToDeleteSet.indexOf(name) == -1
								}); // To delete substitute items from member items for buildable checking.


								//Function to check if the Backorded quantity of the item is fully Buildable or not.
								var proceed = validationCheckForTotalAvalabilty(locationWiseData,memItemBackordered,memberItemsUpdated,memberAndSubstitute,assemblyItems,kitObj,kitMemberItems,onlySubstitueMemItems);
								var memberItemsUpdated = memberItems.filter(function(name){
									return namesToDeleteSet.indexOf(name) == -1
								});

								if(proceed.status == "Success"){ // If fully buildable.
									fullyBuildable   = true;
									var response 	 = proceed["data"];
									woLocation	  	 = response[Object.keys(response)[0]];
									var itemsToUse   = Object.keys(response)

								}else{ // If Above case fails.
									fullyBuildable   = false;

									var response 	 = groupMemItemsByLoc(locationWiseData,memberItemsUpdated,memberAndSubstitute,memItemBackordered,kitObj,kitMemberItems); // This function is used to get how much is buildable at each location present for the member items.
									var details  	 = response["finalObj"];
									var memberItems  = response["memberItems"];
									log.debug(assemblyItemId+" details",details);

									var buildAbleObj   = {};
									var totalBuildable = 0
									var totalForCheck  = 0;

									for(var o=0;o<orderDetailsOfBackOrderedItems[assemblyItemId].length;o++){ //This loop is calculating the order based buildable by location.
										var backOrderedQuant  = orderDetailsOfBackOrderedItems[assemblyItemId][o]["SO Backordered"];
										var subsidiary		  = orderDetailsOfBackOrderedItems[assemblyItemId][o]["Subsidiary"];
										totalForCheck+=Number(backOrderedQuant)

										for(var loc in details){
											var count = 0
											memberItems.forEach(function(id){
												var reqBackOrdQuant = Number(memQuantityDetails[id])*Number(totalForCheck);

												var memberItemId = details[loc].hasOwnProperty(id) ? id : memberAndSubstitute[id]
												if(details[loc][memberItemId] >= reqBackOrdQuant)
													count++
											});
											if(count == memberItems.length){
												if(buildAbleObj.hasOwnProperty(loc)){
													var existindBuildAble = buildAbleObj[loc];
													existindBuildAble+=Number(backOrderedQuant);
													buildAbleObj[loc] = existindBuildAble
												}else{
													buildAbleObj[loc]=Number(backOrderedQuant)
												}
											}
										}
									}
									log.debug(assemblyItemId+" buildAbleObj",buildAbleObj);
									if(Object.keys(buildAbleObj).length==0){
										log.debug("<p style='color:red'>Process Terminated</p>","On hand quantity not avaliable");
										continue;
									}
									woLocation 		 = Object.keys(buildAbleObj).reduce(function(a, b){return buildAbleObj[a] > buildAbleObj[b] ? a : b}); //We use the location where we can build the most.
									backOrderedQuant = buildAbleObj[woLocation];
									var itemsToUse   = response["itemIds"]

								}
								//woLocation       = woLocation == "Phantom" ? 11 : woLocation
								log.debug("woLocation",woLocation)
								log.debug("itemsToUse",itemsToUse)
								for(var i=0;i<memberItemDetails.length;i++){
									var components		 = memberItemDetails[i]["components"] || [];
									log.debug("components",components);
									var InvenotryDetails =[];
									if(components.length>0)
										var InvenotryDetails = components.filter(function(detail){ return detail.Location == woLocation && itemsToUse.indexOf(detail.Internal_ID) != -1});
									log.debug("InvenotryDetails",InvenotryDetails);

									InvenotryDetails.sort(function(a,b){b.Available-a.Available});
									var totalAval = 0;
									for(var j=0;j<InvenotryDetails.length;j++){
										totalAval+=Number(InvenotryDetails[j]["Available"])
										woLineDetails.push(InvenotryDetails[j]);
										if(totalAval>=backOrderedQuant){
											break;
										}
									}
								}
								log.emergency("woLineDetails",woLineDetails); // Details to used to configure the builds.
								var data ={
										"assemblyItemId"	 : assemblyItemId,
										"backOrderedQuant"   : backOrderedQuant,
										"woLocation"		 : woLocation,
										"woLineDetails"		 : woLineDetails,
										"memQuantityDetails" : memQuantityDetails,
										"memberAndSubstitute": memberAndSubstitute,
										"fulfilLocationData" : fulfilLocationData,
										"fullyBuildable"	 : fullyBuildable,
										"kitDetails"		 : kitMemberItems
								}
								var suitelet = url.resolveScript({
									scriptId : 'customscript_mb_suitelet_wo_and_ab_from',
									deploymentId : 'customdeploy_mb_suitelet_wo_and_ab_from',
									returnExternalUrl : true
								});

								try{
									var request = https.post({url : suitelet, body: JSON.stringify(data)});
									log.audit({
										title: 'Response',
										details: request.body
									});
								}catch(e){
									log.error("Exception in Post Request",e)
								}
								
								if(executionTimesUp()){
									log.debug("Time limit error ","Validation has been rescheduled to avoid a script timeout");
									var taskId = rescheduleCurrentScript();
									return;
								}

							}
						}catch(e){
						 log.error("Exception in looping through items",e);
					 }
						counter++;
					 return true;
					
					});	
						
					}	
					/*var scriptObj = runtime.getCurrentScript();
					log.emergency('Remaining governance units: ' + scriptObj.getRemainingUsage());*/
				} catch (e) {
					log.error("Exception", e);
				}

			}
			

			function validationCheckForTotalAvalabilty(locationWiseData,memItemBackordered,memberItemsUpdated,memberAndSubstitute,assemblyItems,kitObj,kitMemberItems,onlySubstitueMemItems){
				try{
					var foundCommonLocation = false;
					var memberItems         = memberItemsUpdated
					var memberItemsVald     = memberItemsUpdated
					log.debug("START");
					log.debug("memberItems",memberItems);
					var subLocWiseData = {}
					log.debug("assemblyItems",assemblyItems);
                  log.debug('locationWiseData',locationWiseData);
                  log.debug("memItemBackordered",memItemBackordered);
                  log.debug('memberItemsUpdated',memberItemsUpdated);
                    log.debug("memberAndSubstitute",memberAndSubstitute);
                  log.debug('kitObj',kitObj);
                   log.debug('kitMemberItems',kitMemberItems);
					
					var locationBuildableObj = {}
					for(var memberId in locationWiseData){
						log.debug("memberId",memberId)
						log.debug("memberItems.indexOf(memberId)",memberItemsVald.indexOf(memberId))
						log.debug(" Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId)", Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId))
						if(memberItemsVald.indexOf(memberId) == -1 && Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId) != -1)
							continue;

						var memberItemAvalLocs   = locationWiseData[memberId];
						var reqQuantityForMem  	 = memItemBackordered[memberId];
						log.debug("memberItemAvalLocs",memberItemAvalLocs);
						log.debug("reqQuantityForMem",reqQuantityForMem);

						var foundAvalability	 = false;
						for(var locId in memberItemAvalLocs){
                            log.debug("locId",locId);
							if(memberItemAvalLocs[locId]>=reqQuantityForMem){
								subLocWiseData[memberId] = memberItemAvalLocs
								foundAvalability = true;
								var locFound    = false;
                                log.debug("subLocWiseData",subLocWiseData);
								for(var innerMemberId in subLocWiseData){
                                    log.debug("memberItems.indexOf(memberId)",memberItems.indexOf(memberId));
                                    log.debug("Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId)",Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId));
									if(memberItems.indexOf(memberId) == -1 &&  Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId) != -1)
										continue;
									if(Number(locationWiseData[innerMemberId][locId]) >= Number(reqQuantityForMem)){
										locationBuildableObj[innerMemberId] = locId
									}
								}
                                log.debug("locationBuildableObj",locationBuildableObj)
								if(Object.keys(locationBuildableObj).length == memberItems.length ||  Object.keys(locationBuildableObj).length == onlySubstitueMemItems.length){
									foundCommonLocation = true;
									break;
								}
							}
						}
						log.debug("OUTSIDE locationBuildableObj",locationBuildableObj)
						log.debug("foundAvalability",foundAvalability)
						log.debug("foundCommonLocation",foundCommonLocation)
						if(foundAvalability == false){
							var substituteItem   	 = memberAndSubstitute[memberId];
							var memberItemAvalLocs   = locationWiseData[substituteItem];
							var reqQuantityForMem  	 = memItemBackordered[substituteItem];
							delete subLocWiseData[memberId];
							log.debug("assemblyItems.indexOf(substituteItem)",assemblyItems.indexOf(substituteItem));
							log.debug("!memberItemAvalLocs",!memberItemAvalLocs);

							var assemblyFlag = assemblyItems.indexOf(substituteItem)>-1 && !memberItemAvalLocs ? true : false;
							if(assemblyFlag == true){
								locationBuildableObj[substituteItem] = "Phantom"
									foundCommonLocation = true;
								break;
							}
							var kitFlag = Object.keys(kitObj).indexOf(substituteItem) != -1 ? true : false
							
							var locationBuildableObj = {}
							if(kitFlag){
							var deleteIndex = memberItems.indexOf(substituteItem);
							delete memberItems.splice(deleteIndex,1)
							memberItems = memberItems.concat(kitMemberItems[substituteItem])
							for(var kit =0; kit<kitMemberItems[substituteItem];kit++){
								
								var memberItemAvalLocs   = locationWiseData[kitMemberItems[substituteItem][kit]];
								for(var locId in memberItemAvalLocs){
									if(memberItemAvalLocs[locId]>=reqQuantityForMem){
										subLocWiseData[substituteItem] = memberItemAvalLocs;
										var locFound    = false;
										for(var innerMemberId in subLocWiseData){
											if(memberItems.indexOf(memberId) == -1  && Object.keys(memberAndSubstitute).map(function(e){return memberAndSubstitute[e] }).indexOf(memberId) != -1)
												continue;
											if(Number(locationWiseData[innerMemberId][locId]) >= Number(reqQuantityForMem)){
												locationBuildableObj[innerMemberId] = locId
											}
										}
										if(Object.keys(locationBuildableObj).length == memberItems.length ||  Object.keys(locationBuildableObj).length == onlySubstitueMemItems.length){
											foundCommonLocation = true;
											break;
										}
									}
								}
							}
								
							}else{
								for(var locId in memberItemAvalLocs){
									if(memberItemAvalLocs[locId]>=reqQuantityForMem){
										subLocWiseData[substituteItem] = memberItemAvalLocs;
										var locFound    = false;
										for(var innerMemberId in subLocWiseData){
											if(memberItems.indexOf(memberId) == -1)
												continue;
											if(Number(locationWiseData[innerMemberId][locId]) >= Number(reqQuantityForMem)){
												locationBuildableObj[innerMemberId] = locId
											}
										}
										if(Object.keys(locationBuildableObj).length == memberItems.length ||  Object.keys(locationBuildableObj).length == onlySubstitueMemItems.length){
											foundCommonLocation = true;
											break;
										}
									}
								}
							}
						}
						
					}

					log.debug("locationBuildableObj",locationBuildableObj);
					log.debug("memberItems",memberItems);
					if(foundCommonLocation){
						log.debug("Success",locationBuildableObj)
						return {"status":"Success" ,"data":locationBuildableObj,"memberItems":memberItems}
					}else{
						log.error("Exception","Aborted not found common location")
						return {"status":"Failed" ,"data":{}}
					}

				}catch(e){
					log.error("Exception in Find The Bin Detail",e);
				}
			}

			function groupMemItemsByLoc(locationWiseData,memberItems,memberAndSubstitute,memItemBackordered,kitObj,kitMemberItems){
					
				var finalObject   = {};
				var itemsToBeUsed = [];
				for(var memId in locationWiseData){
					if(memberItems.indexOf(memId) != -1){
						var subItem = memberAndSubstitute[memId]
						for(var locId in locationWiseData[memId]){
							var memberItemLocAvalability = locationWiseData[memId][locId]
							log.debug("memberItemLocAvalability",memberItemLocAvalability);
							
							var kitFlag = kitObj.hasOwnProperty(subItem);
							if(kitFlag){
								var deleteIndex = memberItems.indexOf(subItem);
								delete memberItems.splice(deleteIndex,1)
								memberItems = memberItems.concat(kitMemberItems[subItem])
								for(var kit =0; kit<kitMemberItems[subItem];kit++){
									if(subItem && locationWiseData.hasOwnProperty(subItem)){
										var itemId = memberItemLocAvalability < memItemBackordered[memId] && memberItemLocAvalability < locationWiseData[subItem][kit][locId]  ? subItem : memId;
									}else{
										var itemId = memId
									}
									log.debug("itemId",itemId)
									itemsToBeUsed.push(itemId)
									if(finalObject.hasOwnProperty(locId) &&  Number(locationWiseData[itemId][locId])>0){
										var existingData = finalObject[locId];
										existingData[itemId] = locationWiseData[itemId][locId]
										finalObject[locId]  = existingData
									}else{
										finalObject[locId] ={}
										finalObject[locId][itemId] = locationWiseData[itemId][locId]
								}
								}
							}else{
								if(subItem && locationWiseData.hasOwnProperty(subItem)){
									var itemId = memberItemLocAvalability < memItemBackordered[memId] && memberItemLocAvalability < locationWiseData[subItem][locId]  ? subItem : memId;
								}else{
									var itemId = memId
								}
								log.debug("itemId",itemId)
								itemsToBeUsed.push(itemId)
								if(finalObject.hasOwnProperty(locId) &&  Number(locationWiseData[itemId][locId])>0){
									var existingData = finalObject[locId];
									existingData[itemId] = locationWiseData[itemId][locId]
									finalObject[locId]  = existingData
								}else{
									finalObject[locId] ={}
									finalObject[locId][itemId] = locationWiseData[itemId][locId]
								}
							}
						}
					}	
				}
				log.debug("finalObject",finalObject)
				for(var locObj in finalObject){
					if(Object.keys(finalObject[locObj]).length != Number(memberItems.length)){
						delete finalObject[locObj]
					}
				}
				var unqItemsToBeUsed = itemsToBeUsed.filter(function(item,index){return itemsToBeUsed.indexOf(item) === index});
				
				return {"finalObj":finalObject,"itemIds":unqItemsToBeUsed,"memberItems":memberItems};
			}
			
			function executionTimesUp(){
				var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
				var minutesRunning = Math.floor((timeElapsed/1000)/60);
				return (minutesRunning >55);
				
			}
			
			function rescheduleCurrentScript() {
	            var scheduledScriptTask = task.create({
	                taskType: task.TaskType.SCHEDULED_SCRIPT
	            });
	            scheduledScriptTask.scriptId = runtime.getCurrentScript().id;
	            scheduledScriptTask.deploymentId = runtime.getCurrentScript().deploymentId;
	            return scheduledScriptTask.submit();
	        }


			return { execute:execute }

		});