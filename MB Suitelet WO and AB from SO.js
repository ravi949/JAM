    /**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define(['N/search','N/runtime','N/record',],(search,runtime,record) => {

	/**
	 * Defines the Suitelet script trigger point.
	 * @param {Object} scriptContext
	 * @param {ServerRequest} scriptContext.request - Incoming request
	 * @param {ServerResponse} scriptContext.response - Suitelet response
	 * @since 2015.2
	 */
	const onRequest = (scriptContext) => {
		try{
			log.debug("scriptContext.request.parameters",scriptContext.request.body)
			var data = JSON.parse(scriptContext.request.body)
			var bodyInventoryBin = 0;
            var phantomFlag = false;
			var { assemblyItemId,backOrderedQuant,woLocation,woLineDetails,memQuantityDetails,memberAndSubstitute,fulfilLocationData,fullyBuildable,kitDetails} = data ;
			log.debug("woLocation",woLocation)
            /* if(woLocation == 94 || woLocation == "94"){
              return;
            } */
			
			if(woLocation == "Phantom"){//This condition occurs when an a member item has no avalability and the substitute item is an assembly than has no on hand.
				var response = findPrefferedBinByLocation(assemblyItemId) // A small function to decide which location and bin to use.
                phantomFlag      = true
				woLocation       = response["location"];
				bodyInventoryBin = response["binNumber"];
			}
			var salesOrderIDs = salesOrdersToBeUpdated(assemblyItemId,backOrderedQuant)
			
			try{
				var subsidiaryDetail = fulfilLocationData.filter(detail => detail.location == woLocation);
				log.debug("subsidiaryDetail",subsidiaryDetail);

				var workOrder = record.create({ type: record.Type.WORK_ORDER,isDynamic: true}); 
				
				//workOrder.setValue({fieldId: 'memo'      				  ,value : "sk refactor test" });
                workOrder.setValue({fieldId: 'custbody_mb_new_work_order_script',value : true });
				workOrder.setValue({fieldId: 'quantity'  				  ,value : backOrderedQuant});
				workOrder.setValue({fieldId: 'subsidiary'				  ,value : subsidiaryDetail[0]["subsidiary"] });
				workOrder.setValue({fieldId : 'custbody_mb_wo_bulk_api_wo',value : true});
				log.debug("woLocation",woLocation)
				workOrder.setValue({fieldId: 'location'					  ,value : woLocation});
			var loc =	workOrder.getValue({fieldId: 'location'});
			log.debug("loc",loc)
				workOrder.setValue({fieldId: 'assemblyitem'				  ,value : assemblyItemId});

				var woLineCt = workOrder.getLineCount({sublistId : 'item'});
				log.debug('woLineCt within workOrder : ',woLineCt);
				var hasSub = false;
				var hasKit = false;
				
				for(wl =0;wl<woLineCt;wl++){
					var itemId 			 =	workOrder.getSublistValue({ sublistId: 'item',fieldId  : 'item',line : wl });
					var memberQuantity   = memQuantityDetails[itemId]
					log.debug("itemId",itemId);
					var index = woLineDetails.findIndex(item => item.Internal_ID === itemId );
					if(index == -1){
						hasSub = true;
						index  = woLineDetails.findIndex(item => item.Internal_ID === memberAndSubstitute[itemId] && item.Available > 0);
						itemId = memberAndSubstitute[itemId];
					}
					if(index == -1){
						if(Object.keys(kitDetails).indexOf(itemId) != -1){
							hasKit = true;
						}
					}
					log.debug("hasSub",hasSub);
					log.debug("index",index);
					log.debug("hasKit",hasKit);

					if(hasKit && !phantomFlag){
						workOrder.removeLine({sublistId: 'item',line: wl});
						var kitItem = kitDetails[itemId];
                        log.debug("kitItem",kitItem)

						for(var i=0;i<kitItem.length;i++){
							workOrder.selectNewLine({sublistId : 'item',line : i});
							var index = woLineDetails.findIndex(item => item.Internal_ID === kitItem[i] && item.Available > 0);
                            log.debug("index",index)
							if(index != -1){
								workOrder.setCurrentSublistValue({sublistId : 'item',fieldId   : 'item',value	  : kitItem[i]});
								workOrder.setCurrentSublistValue({sublistId: 'item',fieldId: 'quantity',value: Number(backOrderedQuant) * Number(memQuantityDetails[kitItem[i]])});
								workOrder.setCurrentSublistValue({ sublistId: 'item',fieldId: 'custcol_mb_wo_line_is_substituted',value: true});
							} else {
								var response ={"Status":"Failure","Item":assemblyItemId,"Reason": "Err: One or more components does not have inventory."}
								scriptContext.response.write(JSON.stringify(response));
								return;
							}
							workOrder.commitLine({ sublistId : 'item' });
						}

                        log.debug("Commited","true")

					}else{

						workOrder.selectLine({sublistId : 'item',line : wl});

                      workOrder.setCurrentSublistValue({sublistId: 'item',fieldId: 'item',value: itemId});
						workOrder.setCurrentSublistValue({sublistId: 'item',fieldId: 'quantity',value: Number(backOrderedQuant) * Number(memberQuantity)});
						if(hasSub){
							workOrder.setCurrentSublistValue({ sublistId: 'item',fieldId: 'custcol_mb_wo_line_is_substituted',value: true});
							if(index == -1){
                                log.debug("Phantom")
								workOrder.setCurrentSublistText({ sublistId: 'item',fieldId: 'itemsource',text:"Phantom",ignoreFieldChange:false,forceSyncSourcing:false}); // setting to phantom
								workOrder.setCurrentSublistValue({ sublistId: 'item',fieldId: 'commitinventory',value: 3,ignoreFieldChange:true,forceSyncSourcing:true});
							}
						}
						workOrder.commitLine({sublistId : 'item'});
					}

				}
				workOrder.setValue({ fieldId : 'custbody_mb_used_sub_item',value : hasSub });
				var woId = workOrder.save();
				record.submitFields({type : record.Type.WORK_ORDER, id : woId, values : {"location":woLocation}});
				log.emergency({ title: 'woId created : ', details: woId });
				
				if(woId){
					var assembly_build_record = record.transform({
						fromType: record.Type.WORK_ORDER,
						fromId: woId,
						toType: record.Type.ASSEMBLY_BUILD ,
						isDynamic: true
					});


					assembly_build_record.setValue({fieldId: 'quantity',value : backOrderedQuant});

					var assembly_header_location = assembly_build_record.getValue({ fieldId : 'location' });
					var componentLineCt			 = assembly_build_record.getLineCount({ sublistId : 'component'});
					
					log.debug('componentLineCt',componentLineCt);

					for(var i=0; i < componentLineCt; i++ ) {

						assembly_build_record.selectLine({sublistId: 'component',line: i});

						var item_component = assembly_build_record.getSublistValue({sublistId : 'component',fieldId   : 'item',line      : i});
						log.debug('item_component and i is ',item_component+'##'+i);
						log.debug('woLineDetails',woLineDetails);
						
						var inventoryConfiDetails = woLineDetails.filter(detail => detail.Internal_ID == item_component && detail.Available>0);
                        log.debug('inventoryConfiDetails ',inventoryConfiDetails);
                        {// Remvoing duplicates
                            var jsonObject = inventoryConfiDetails.map(JSON.stringify);
                            var uniqueSet = new Set(jsonObject);
                            var uniqueArray = Array.from(uniqueSet).map(JSON.parse);
                            log.debug("uniqueArray",uniqueArray);
                            inventoryConfiDetails = uniqueArray
                        }

						if(inventoryConfiDetails.length== 0)
							continue;
						
						var componentQty = assembly_build_record.getSublistValue({sublistId : 'component',fieldId : 'quantity',line : i});
						log.debug('componentQty is ',componentQty);

						var invDetail = assembly_build_record.getCurrentSublistSubrecord({sublistId : 'component',fieldId : 'componentinventorydetail'});
						invDetail.setValue({ fieldId : 'quantity',value : componentQty });
						
						var subIndex = Object.values(memberAndSubstitute).indexOf(item_component);
                        log.debug('subIndex ',subIndex);
						if(subIndex != -1){
							hasSub = true;
							item_component = Object.keys(memberAndSubstitute)[subIndex];
						}
                        log.debug('item_component ',item_component);
						var inventBackordered =Number(backOrderedQuant)*Number(memQuantityDetails[item_component]); 
                        log.debug('inventBackordered ',inventBackordered);
						for (x=0;x<inventoryConfiDetails.length;x++){
							var inventoryDetails  = inventoryConfiDetails[x];
							var available 		  = inventoryDetails["Available"];
							var binNumber		  = inventoryDetails["Bin_Number"];
                            log.debug('available && binNumber  ',available +"&&"+binNumber );
							if(i == 0 && x == 0){
								bodyInventoryBin = binNumber
							}
							if(Number(inventBackordered)>Number(available)){
								var binQuantiy    = Number(available);
								inventBackordered = Number(inventBackordered)- Number(available);
							}else{
								var binQuantiy = Number(inventBackordered);
							}
                            log.debug('binQuantiy  ',binQuantiy );

							if(x==0){
								invDetail.selectLine({ sublistId : 'inventoryassignment', line : x });
							}else{
								invDetail.selectNewLine({ sublistId : 'inventoryassignment' });
							}

							invDetail.setCurrentSublistValue({ sublistId : 'inventoryassignment',fieldId : 'binnumber',value : binNumber  });
							invDetail.setCurrentSublistValue({ sublistId : 'inventoryassignment',fieldId : 'quantity' ,value : binQuantiy });
							
							invDetail.commitLine({ sublistId : 'inventoryassignment' });
						}
						if(inventoryConfiDetails.length>0)
						assembly_build_record.commitLine({ sublistId : 'component' });					
					}

					try{
						var subrec_header = assembly_build_record.getSubrecord({ fieldId: 'inventorydetail' });
						
						subrec_header.selectNewLine({ sublistId: 'inventoryassignment' });
						log.debug("bodyInventoryBin",bodyInventoryBin)
						subrec_header.setCurrentSublistValue({ sublistId : 'inventoryassignment',fieldId  : 'quantity' ,value  : backOrderedQuant  });
						subrec_header.setCurrentSublistValue({ sublistId: 'inventoryassignment' ,fieldId  : 'binnumber',value  :   bodyInventoryBin});
						
						subrec_header.commitLine({sublistId: 'inventoryassignment'});

					} catch(err){
						log.error('Error in Suitelet-transformAssemblyBuild-add HeaderBin',err);
					}

					assembly_build_record.setValue({ fieldId : 'quantity', value : backOrderedQuant });
					var assembly_build_Id = assembly_build_record.save();
					log.emergency({ title: 'assembly_build_Id', details: assembly_build_Id });			
				}
				
				if(salesOrderIDs.length>0){
					for(var i=0;i<salesOrderIDs.length;i++){
						try{
							var recSO = record.load({ type: 'salesorder',id:salesOrderIDs[i],isDynamic: false});
							log.debug("salesOrderIDs[i]",salesOrderIDs[i])
							var lineNum = recSO.findSublistLineWithValue({ sublistId: 'item',fieldId: 'item',value:assemblyItemId });
							if (lineNum >=0){
								recSO.setSublistValue({sublistId: 'item',fieldId: 'custcol_mb_soline_linked_to_wo'       ,line: lineNum,value:woId});
								recSO.setSublistValue({sublistId: 'item',fieldId: 'custcol_mb_soline_linked_to_build'    ,line: lineNum,value:assembly_build_Id});
								recSO.setSublistValue({sublistId: 'item',fieldId: 'location'						     ,line: lineNum,value:woLocation});
								recSO.setSublistValue({sublistId: 'item',fieldId: 'custcol_mb_txn_line_assembly_location',line: lineNum,value:woLocation});

								var lineCount = recSO.getLineCount('item');

								for (var j = 0; j < lineCount; j++){
									if (j != lineNum){
										var so_assembly_locn  = recSO.getSublistValue({sublistId: 'item',fieldId: 'custcol_mb_txn_line_assembly_location',line:j});
										
										if (so_assembly_locn)
											recSO.setSublistValue({sublistId: 'item',fieldId: 'location',line: j,value: so_assembly_locn});	
									}
								}				
								recSO.save();
							}
						} catch(err){
							log.error('Error in Suitelet-updateSOLines',err);
							var response = {"Status":"Failure","Item":assemblyItemId,"Reason":err}
						}
					}	
				}
				var response ={"Status":"Success","Item BackOrdered":assemblyItemId,"SOs Updated":salesOrderIDs}
			}catch(e){
				log.error("Exceptiono in creation of work order",e);
				var response ={"Status":"Failure","Item":assemblyItemId,"Reason":e}
			}
		
		}catch(e){
			log.error("Exception in ON REQUEST",e);
			var response ={"Status":"Failure","Item":assemblyItemId,"Reason":e}
		}
		scriptContext.response.write(JSON.stringify(response));
	}
	const salesOrdersToBeUpdated = (assemblyItemId,backOrderedQuant) => {
		try{
			 
			// Search to get Back Ordered sales for the assembly items from the above results.
			var assemblyitemSearchObj = search.create({
				type    : "assemblyitem",
				filters : [
				          ["type","anyof","Assembly"], 
				          "AND", 
				          ["quantitybackordered","greaterthan","0"], 
				          "AND", 
				          ["transaction.type","anyof","SalesOrd"], 
				          "AND", 
				          ["transaction.status","anyof","SalesOrd:D","SalesOrd:B"], 
				          "AND", 
				          ["internalid","anyof",assemblyItemId], 
				          "AND", 
				          ["formulanumeric: {transaction.quantity}-nvl({transaction.quantitycommitted},0)-nvl({transaction.quantityshiprecv},0)","greaterthan","0"]
				          ],
				columns :
						 [
						  search.createColumn({name: "internalid"          ,label: "Internal ID"}),
						  search.createColumn({name: "transactionnumber"   ,join: "transaction",label: "Transaction Number"}),
						  search.createColumn({name: "quantity"            ,join: "transaction",label: "Quantity"}),
						  search.createColumn({name: "quantityshiprecv"    ,join: "transaction",label: "Quantity Fulfilled/Received"}),
						  search.createColumn({name: "subsidiary"          ,join: "transaction",label: "Subsidiary"}),
						  search.createColumn({name: "formulanumeric"      ,formula: " {transaction.quantity}-nvl({transaction.quantitycommitted},0)-nvl({transaction.quantityshiprecv},0)",label: "Order Back Ordered"}),
						  search.createColumn({name: "quantitybackordered" ,label: "Back Ordered"}),
						  search.createColumn({name: "trandate"            ,join: "transaction",sort: search.Sort.ASC,label: "Date"}),
					      search.createColumn({name: "internalid"          ,join: "transaction",label: "Internal ID"})
						  ]
			});
			var searchResultCount = assemblyitemSearchObj.runPaged().count;
			log.debug("assemblyitemSearchObj result count",searchResultCount);
			
			var [totalBackOrderedSos,totalInternalIds] = [0,new Array()];
			assemblyitemSearchObj.run().each(function(result){
				log.debug("result",result);
				var assemblyItemId  = result.getValue({name: "internalid",label: "Internal ID"});
				var transSubsidiary = result.getValue({name: "subsidiary",join: "transaction",label: "Location"});
				var soBackordered	= result.getValue({name: "formulanumeric",formula: " {transaction.quantity}-nvl({transaction.quantitycommitted},0)-nvl({transaction.quantityshiprecv},0)",label:"Formula (Numeric)" });
				var itemBackOrdered	= result.getValue({name: "quantitybackordered",label: "Back Ordered"});
				var soInternalId	= result.getValue({name: "internalid",join: "transaction",label: "Internal ID"});
				log.debug("itemBackOrdered",itemBackOrdered);
				log.debug("soInternalId",soInternalId);
				log.debug("totalBackOrderedSos",totalBackOrderedSos);
				totalBackOrderedSos += Number(soBackordered);
				if(totalBackOrderedSos<=backOrderedQuant){
					totalInternalIds.push(soInternalId)
				}
				return true;
			});
			
			return totalInternalIds;
		}catch(e){
			log.error("Exception in Sales Order to Be Updated Search",e);
		}
	}
	
	 const findPrefferedBinByLocation = (memberItems,location) =>{
		 try{
			 
			 var itemSearchObj = search.create({
				   type: "item",
				   filters:
				   [
				      ["internalid","anyof",memberItems], 
				      "AND",
				      ["formulanumeric: case when upper({binonhand.binnumber}) like 'FBA%' then 0 else 1 end","equalto","1"], 
					  "AND", 
					  ["binonhand.binnumber","noneof","2907","2277"],
					  "AND",
					  ["binnumber.location","anyof","12","11"]
				   ],
				   columns:
				   [
				      search.createColumn({name: "binnumber", label: "Bin Number"}),
				      search.createColumn({name: "location",join: "binNumber",label: "Location"}),
				      search.createColumn({name: "preferredbin", label: "Preferred Bin"}),
				      search.createColumn({name: "internalid",join: "binNumber",label: "Internal ID"})
				   ]
				});
				var searchResultCount = itemSearchObj.runPaged().count;
				var prefferedDetails = {};
				
				itemSearchObj.run().each(function(result){
					var binNumber   =  result.getValue({name: "internalid",join: "binNumber",label: "Internal ID"});
					var preffered   =  result.getValue({name: "preferredbin", label: "Preffered Bin"});
					var location    =  result.getValue({name: "location",join: "binNumber",label: "Location"});
					if(preffered == true || preffered == "True"){
						prefferedDetails["binNumber"] = binNumber;
						prefferedDetails["location"]  = location;
					}else{
						prefferedDetails["binNumber"] = binNumber;
						prefferedDetails["location"]  = location;
						  return true;
					}
				});
			 return prefferedDetails;
		 }catch(e){
			 log.error("Exception in finding Preffered Bin",e);
		 }
	 }
	
	return {onRequest}

});