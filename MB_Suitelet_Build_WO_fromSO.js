/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
*/

const lookup_assemblyItm_components ='customsearch_mb_itm_assmbly_components';
const lookup_nonfba_bin_available  = 'customsearch_lookup_bin_available_nonfba';
const lookup_item_preferred_bin  = 'customsearch_mb_preferbin_by_item';
//const find_fulfilment_locations = 'customsearch_mb_find_fulfilment_center'; //moved to scheduled script
//const location_details = 'customsearch_mb_location_details'; //moved to scheduled script

var bAbort = false;
var so_fulfil_locations_only = new Array();

var so_itm_members_only = new Array();
var arr_itm_members = new Array();
var arr_locn_qty= new Array();
var arr_bin_consumed= new Array();
var arr_so_processed=new Array();
var arr_subsidiary=new Array();
var arr_location_data =new Array();
var arr_item_preferred_bins= new Array();

const bncChannels = ["69","65","64","62","63","70","67","71","61","82","60","66","57","58"];
const jamDefLocation = '11';
const bncDefLocation = '94';
const bncOldDefLocation = '60';

define(['N/http','N/email','N/search','N/runtime','N/record','N/format'],
	function(http,email,search,runtime,record,format){
	
	function onRequest(context){
		try {
			
			//log.debug('suitelet is hit');
			var request = context.request;
			
			//context.response.write('hit suitelet');

			//var objectSO  = JSON.parse(request.parameters.object);
			var objectSO  = JSON.parse(request.parameters.object);
			// var objSO_Items = objectSO[0];
          //JSON.parse(request.parameters.object);
			arr_location_data =objectSO[0];
			var arr_all_fulfil_locations = objectSO[1];

            var body = JSON.parse(request.body);
            var objSO_Items = body.arr_so_by_item; 			
			// log.debug('objSO_Items',JSON.stringify(objSO_Items));
			
			var arr_bin_map_so_line = new Array();
			var assemblyItem = '';
			var assemblyItemName = '';
			var parItem ='';
			var assemblyItem_QtyAvail = 0;
			var qtyToFulfil_total = 0;
			var arr_member_bins= new Array();
			//buildLocationData();
			//findSubsidiaries(objSO_Items); // find how many subsidiaries exist in objSO_Items (comes from Scheduled script)
			findFulfilmentLocations(findSubsidiaries(objSO_Items),arr_all_fulfil_locations);   
			//(source subsidiary within in scheduled script object)

			if (so_fulfil_locations_only.length <=0)
			{
				var arr_so_line_failed = returnToScriptWithFailure(objSO_Items,'',"Subsidiary list : " +JSON.stringify(arr_subsidiary)+" has no fulfilment locations enabled. Aborting " );
				log.debug('Warning : Subsidiary list : '+JSON.stringify(arr_subsidiary)+' has no fulfilment locations enabled. Aborting',JSON.stringify(arr_so_line_failed));
				return;	
			}
			var totalQtyNeeded = 0 
			for (var i = 0; objSO_Items.length>i;i++){
				var obj_Inner = objSO_Items[i];
				
				if (i ==0) // Find ordered Item, related Parent and "Ordered Item Available Qty" (usually childItem).
				{
					assemblyItem = obj_Inner.assemblyItem;
					assemblyItemName = obj_Inner.assemblyItemName;
					parItem =obj_Inner.assemblyItem_Parent;
					assemblyItem_QtyAvail = obj_Inner.assemblyItem_QtyAvail;
				}
				qtyToFulfil_total =qtyToFulfil_total+parseInt(obj_Inner.QtyNeeded); //Find total Qty to fulfil for this item.
				totalQtyNeeded = totalQtyNeeded+(parseInt(obj_Inner.assemblyItem_PackSize)*parseInt(obj_Inner.QtyNeeded));
			}
			log.debug('assemblyItem, parItem ,actualItem_qty,qtyToFulfil_total ',assemblyItem  + '##'+parItem  + '##'+assemblyItem_QtyAvail  + '##'+qtyToFulfil_total);

			var arr_bin_available = findItemQtyByBin(assemblyItem,totalQtyNeeded,so_fulfil_locations_only); //parItem //fetch onHand Bins linked to the component of the actual item. //RELATED_PARENT
			if (so_itm_members_only.length <=0)
			{
				var arr_so_line_failed = returnToScriptWithFailure(objSO_Items,'',"Assembly Item : " + assemblyItemName + " has no components setup. Please check the setup");
				log.debug('Warning : returning to sch_script : arr_so_line_failed ',JSON.stringify(arr_so_line_failed));
				return;				
			}
						
			if (arr_bin_available.length <=0)
			{
				var arr_so_line_failed = returnToScriptWithFailure(objSO_Items,'',"Assembly Item : " + assemblyItemName + " has NO stock available to fulfil sales order");
				log.debug('Warning : returning to sch_script : Assembly Item has NO stock available to fulfil ',JSON.stringify(arr_so_line_failed));
				return;				
			}
			findItemPreferredBin(); //for each SO LineItem find the preferred bin.
			log.debug('arr_bin_availablle is ',JSON.stringify(arr_bin_available));
			if (verifyComponentQty(arr_bin_available) == false)
			{
				var arr_so_line_failed = returnToScriptWithFailure(objSO_Items,'',"Not all components of Assembly Item : " + assemblyItemName + " have sufficient stock to fulful");
				log.debug('Warning : returning to sch_script : arr_so_line_failed -insufficient stock ',JSON.stringify(arr_so_line_failed));
				return; //return arr_so_line_failed; //return to scheduled script. //uncomment later
			}
			
			var arr_item_bins_refreshed = new Array();
			var arr_so_line_w_bins =new Array();
			//var arr_member_Picked_details =new Array();		//moved down
			
			
			// Ready to process the Sales order lineItems received from Scheduled script.
			for (var k = 0; objSO_Items.length>k;k++)
			{ // loop through each SO Line Item to see if we can find qty to create WO/AssemblyBuild.
				var obj_so_Inner = objSO_Items[k];
				var so_qty_required =obj_so_Inner.QtyNeeded;
				var probable_so_line_location = 0;
				var arr_member_Picked_details =new Array();
				var bFirstValidationLocation = true;
				var bFirstLocationFound =0;
				for (var j = 0; arr_itm_members.length>j;j++)
				{	
					arr_member_bins= new Array();
					var obj_member_Inner = arr_itm_members[j];
					so_qty_required = obj_so_Inner.QtyNeeded * obj_member_Inner.actual_member_pksize;
					// find which location has so_qty_required and get that location (single location allowed. multi location not allowed currently)
					log.debug('obj_member_Inner is ',obj_member_Inner.member + '##'+so_qty_required+ '##'+obj_so_Inner.so_tranID);
					var locn_having_stock = findLocationStockForEachMember(obj_member_Inner.member,so_qty_required,obj_so_Inner.so_subsidiary);
					if (bFirstValidationLocation)
					{
						bFirstValidationLocation = false;
						bFirstLocationFound =locn_having_stock;
					}
					
					if (bFirstLocationFound !=locn_having_stock && locn_having_stock!=0)
					{
						objSO_Items[k].IsSuccess = "N";
						obj_so_Inner.IsSuccess = "N";
						objSO_Items[k].so_line_location = "0";						
						obj_so_Inner.so_line_location = "0";
						var arr_so_line_failed = returnToScriptWithFailure(objSO_Items,obj_so_Inner,"Member item internalID : " + obj_member_Inner.member + 
						" has stock at a location different than other members. please consider location transfer (Reference: for SO TranID: " +
						obj_so_Inner.so_tranID + " and line Item : " + obj_so_Inner.assemblyItemName);
						log.debug('Warning : returning to sch_script : ','member item has stock at a location that is different than other members ' + JSON.stringify(arr_so_line_failed));
						//return; ///continue to process other SOs if they meet stock demand. That's why return is commented to scheduled.	
					}
					
					if (locn_having_stock == 0)
					{
						objSO_Items[k].IsSuccess = "N";						
						obj_so_Inner.IsSuccess = "N";
						objSO_Items[k].so_line_location = "0";						
						obj_so_Inner.so_line_location = "0";
						
						var arr_so_line_failed = returnToScriptWithFailure(objSO_Items,obj_so_Inner,"Member item internalID : " + obj_member_Inner.member + 
						" did not meet required qty of " +so_qty_required + " for SO TranID: " +
						obj_so_Inner.so_tranID + " and line Item : " + obj_so_Inner.assemblyItemName);
						log.debug('Warning : returning to sch_script : member item has insufficient qty ',JSON.stringify(arr_so_line_failed));
						//return; ///continue to process other SOs if they meet stock demand. That's why return is commented to scheduled.	
					}
					else
					{ // now get specific bin for that location.
						var qtyRemaining = parseInt(so_qty_required);
						var qtyToPick = 0;
						log.debug('qtyRemaining is ',qtyRemaining);
						for (var m = 0; arr_bin_available.length>m;m++)
						{
							var bin_Inner = arr_bin_available[m];
							var binQtyFound = parseInt(bin_Inner.bin_available);
							var binLoc = bin_Inner.bin_location;
							var binItem = bin_Inner.item;
							if (locn_having_stock == binLoc && binItem == obj_member_Inner.member &&  binQtyFound > 0)
							{
								qtyToPick = qtyRemaining >= parseInt(binQtyFound) ? parseInt(binQtyFound) : qtyRemaining;
								log.debug('binQtyFound is ',qtyToPick+'##'+locn_having_stock+'##'+binQtyFound + '##'+binLoc+'##'+binItem +'##'+obj_member_Inner.member);
								if (qtyToPick > 0)
								{
									var binPicked_details = build_binPicked(bin_Inner,qtyToPick);
									log.debug('binPicked_details is ',JSON.stringify(binPicked_details));
									qtyRemaining = qtyRemaining- qtyToPick;
									arr_member_bins.push(binPicked_details);
									log.debug('arr_member_bins is ',JSON.stringify(arr_member_bins));
								}
								if (qtyRemaining <=0)
								{
									break;
								}								
							}
						}
					}
					// create or update member array.
					var member_Picked_details = build_memberPicked(arr_member_bins,obj_member_Inner.member,so_qty_required,locn_having_stock);
					log.debug('member_Picked_details is ',JSON.stringify(member_Picked_details));
					//arr_member_Picked_details = build_PickedMembers(member_Picked_details);
					arr_member_Picked_details.push(member_Picked_details);
					log.debug('arr_member_Picked_details is ',JSON.stringify(arr_member_Picked_details));
					
					// now find if the bins linked to member item have stock or not.					
					 probable_so_line_location = locn_having_stock;
				}
				var arr_item_bins_refreshed = UpdateData_BasedOnBinsConsumed(arr_bin_available);
				arr_bin_available = arr_item_bins_refreshed;
				
				arr_bin_consumed = new Array();
				arr_item_bins_refreshed	= new Array();	
				//arr_so_line_w_bins = build_SoItem_w_bins(obj_so_Inner,arr_member_Picked_details,probable_so_line_location);
				//log.debug('arr_so_line_w_bins BEFORE is ',JSON.stringify(arr_so_line_w_bins));
				arr_so_line_w_bins.push(build_SoItem_w_bins(obj_so_Inner,arr_member_Picked_details,probable_so_line_location));
				log.debug('arr_so_line_w_bins AFTER is ',JSON.stringify(arr_so_line_w_bins));
			}
			handleWO_Builds(arr_so_line_w_bins);
			log.debug('arr_so_processed (before returning to scheduled script) is ',JSON.stringify(arr_so_processed));
			//context.response.write(JSON.stringify(arr_so_processed));			
		} catch(err){
			log.error('Error in onRequest : Suitelet',JSON.stringify(err));
		}
	}

	function updateSOLines(so_line_item_to_update)
	{
		try{
			log.debug('updateSOLines Entered : ',JSON.stringify(so_line_item_to_update));
			var recSO = record.load({
				type: 'salesorder',
				id: so_line_item_to_update.so_internalID,
				isDynamic: false
			});
			
			//looking for  line with assemblyItem
			var lineNum = recSO.findSublistLineWithValue({
				sublistId: 'item',
				fieldId: 'line', // 'item', 
				value: so_line_item_to_update.so_lineId //so_line_item_to_update.assemblyItem
			});
			//update line with new value
			log.debug('SO lineNum is  : ',lineNum);
			if (lineNum >=0)
			{
				recSO.setSublistValue({
					sublistId: 'item',
					fieldId: 'custcol_mb_soline_linked_to_wo',
					line: lineNum,
					value: so_line_item_to_update.so_line_wo
				});
				
				recSO.setSublistValue({
					sublistId: 'item',
					fieldId: 'custcol_mb_soline_linked_to_build',
					line: lineNum,
					value: so_line_item_to_update.so_line_linked_build
				});
				log.debug('so_line_location is : ', so_line_item_to_update.so_line_location);					
				if(so_line_item_to_update.so_line_location!='' &&so_line_item_to_update.so_line_location!=null ) // != '' && so_line_item_to_update.so_line_location !=null)
				{
                    recSO.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: lineNum,
                        value: so_line_item_to_update.so_line_location
                    });
                
                    recSO.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_mb_txn_line_assembly_location',
                        line: lineNum,
                        value: so_line_item_to_update.so_line_location
                    });
                } else {
                  if(recSO.getValue({fieldId:'subsidiary'}) == '32'){
					recSO.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: lineNum,
                        value: bncOldDefLocation//'60'//so_line_item_to_update.so_line_location
                    }); 
                  } else if( bncChannels.indexOf(recSO.getValue({fieldId : 'class'}))>-1 ){
					recSO.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: lineNum,
                        value: bncDefLocation//'11'//so_line_item_to_update.so_line_location
                    }); 
				  } else {
                     recSO.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: lineNum,
                        value: jamDefLocation//'11'//so_line_item_to_update.so_line_location
                    }); 
                  }

                }
				
				//else 
				//{log.audit('so_line_location null for: '&so_line_item_to_update.so_lineId)
				//}

				recSO.setSublistValue({
					sublistId: 'item',
					fieldId: 'custcol_mb_memo_build_wo',
					line: lineNum,
					value: so_line_item_to_update.so_line_memo
				});
				
				//  new loop added Jun 15,2022
				var lineCount = recSO.getLineCount('item');
				log.debug("SO Linecount",lineCount);
			   
				for (var j = 0; j < lineCount; j++)
				{
					if (j != lineNum) {
						var so_assembly_locn  = recSO.getSublistValue({
							sublistId: 'item',
							fieldId: 'custcol_mb_txn_line_assembly_location',
							line:j
						});
						var so_qtyCommitted = recSO.getSublistValue({
							sublistId : 'item',
							fieldId : 'quantitycommitted',
							line : j
						});
						var so_qty = recSO.getSublistValue({
							sublistId : 'item',
							fieldId : 'quantity',
							line : j
						});
						var so_qtyFulfilled = recSO.getSublistValue({
							sublistId : 'item',
							fieldId : 'quantityfulfilled',
							line : j
						});

						if(so_qtyFulfilled == so_qty){
							log.audit('quantity fulfilled for '+j, 'skipping - qty fulfilled: '+so_qtyFulfilled);
							continue;
						};

						log.audit('so_qty_committed',so_qtyCommitted);

						if(so_qtycommitted = so_qty){
							var lineLocation = recSO.getSublistValue({
								sublistId : 'item',
								fieldId : 'location',
								line : j
							});

							if(lineLocation!=so_assembly_locn){
								log.debug(so_line_item_to_update.so_internalID+' setting so_assembly_locn to location value for j ',j+'##'+lineLocation);
								so_assembly_locn = lineLocation
							};
						}

						log.audit(so_line_item_to_update.so_internalID+ ' so_assembly_locn checked  for J valule: ', j +'##'+so_assembly_locn);			
						if (so_assembly_locn!='' && so_assembly_locn!=null)
						{
							recSO.setSublistValue({
								sublistId: 'item',
								fieldId: 'location',
								line: j,
								value: so_assembly_locn
							});	
							log.debug('so_assembly_locn updated for J valule: ', j +'##'+so_assembly_locn);					
						} else {
							if(recSO.getValue({fieldId:'subsidiary'}) == '32'){
								recSO.setSublistValue({
									sublistId: 'item',
									fieldId: 'location',
									line: lineNum,
									value: bncOldDefLocation//'60'//so_line_item_to_update.so_line_location
								}); 
							  } else if(bncChannels.indexOf(recSO.getValue({fieldId : 'class'}))>-1){
								log.debug('lineclass',recSO.getValue({fieldId : 'class'}));
								recSO.setSublistValue({
									sublistId: 'item',
									fieldId: 'location',
									line: lineNum,
									value: bncDefLocation//'11'//so_line_item_to_update.so_line_location
								}); 
							  } else {
								 recSO.setSublistValue({
									sublistId: 'item',
									fieldId: 'location',
									line: lineNum,
									value: jamDefLocation//'11'//so_line_item_to_update.so_line_location
								}); 
							  }
                        }					
					}
				}				
				//  end new loop.

				recSO.save();
				//log.debug('recSO is saved : ',recSO);
			}
		} catch(err){
			log.error('Error in Suitelet-updateSOLines',JSON.stringify(err));
		}
	}
	
	function createWO(totWOqty, wo_location, wo_subsidiary, assemblyItem, packSize)
	{
		try{
		log.debug('arr_itm_members within CreateWO is ',JSON.stringify(arr_itm_members));

		var workOrder = record.create({
				type: record.Type.WORK_ORDER,
				isDynamic: true //,
				//defaultValues: {assemblyitem: item}
			}); //firmed, orderstatus

			workOrder.setValue({
				fieldId: 'quantity',
				value: totWOqty 
			});
			workOrder.setValue({
				fieldId: 'subsidiary',
				value: wo_subsidiary //hudson_nj_sub 
			});
            workOrder.setValue({
              fieldId : 'custbody_mb_wo_bulk_api_wo',
              value : true
            });
			workOrder.setValue({
				fieldId: 'location',
				value: wo_location //11 // why is this not getting set.
			});
			workOrder.setValue({
				fieldId: 'assemblyitem',
				value: assemblyItem //'201271' //objSO_Items.actualitem
			});
					
			var woLineCt = workOrder.getLineCount({
				sublistId : 'item'
			});
			log.debug('woLineCt within workOrder : ',woLineCt);
			var hasSub = false;
			for (var k = 0; arr_itm_members.length>k;k++)
			{
				var memberPkSize = parseInt(arr_itm_members[k].actual_member_pksize);
				workOrder.selectLine({
					sublistId : 'item',
					line : k
				});
				
				workOrder.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'quantity',
					value: totWOqty *  memberPkSize 
				});

				workOrder.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'item',
					value: arr_itm_members[k].member
				});
				
				// added July 6th as per Lucas (pramod)
				workOrder.setCurrentSublistValue({
					sublistId: 'item',
					fieldId: 'custcol_mb_wo_line_is_substituted',
					value: arr_itm_members[k].substituted
				});
				if(arr_itm_members[k].substituted == true || arr_itm_members[k].substituted == 'T'){
					var hasSub = true;
				}
				
				workOrder.commitLine({
					sublistId : 'item'
				});
			};
          //added by lucas 7-20
			workOrder.setValue({
				fieldId : 'custbody_mb_used_sub_item',
				value : hasSub
			});
			var woId = workOrder.save();
			record.submitFields({type : record.Type.WORK_ORDER, id : woId, values : {location:wo_location}});
			log.debug({ title: 'woId created : ', details: woId });
			return woId;
		
		} catch(err){
			log.error('Error in Suitelet-createWO',JSON.stringify(err));
		}
	}

	function validateBinQtyBeforeWO(so_item_bins_for_wo)
	{
		try{
			log.debug('so_item_bins_for_wo soInternalID is ',JSON.stringify(so_item_bins_for_wo.so_internalID));
			var components_in_so_item = so_item_bins_for_wo.components;
			log.debug('components_in_so_item is ',JSON.stringify(components_in_so_item));
			for (var k = 0; components_in_so_item.length>k;k++)
			{
				var bins_in_components_in_so_item = components_in_so_item[k].actualbin;
				log.debug('bins_in_components_in_so_item is ',JSON.stringify(bins_in_components_in_so_item));		
			}				

			//var bins_in_components_in_so_item = components_in_so_item.actualbin;
			//log.debug('bins_in_components_in_so_item is ',JSON.stringify(bins_in_components_in_so_item));		
		} catch(err){
			log.error('Error in validateBinQtyBeforeWO : Suitelet',JSON.stringify(err));
		}
	}
		
	function handleWO_Builds(arr_so_item_bins_for_wo)
	{
		try{		
			var arr_wo_locations=prepWOLocations(arr_so_item_bins_for_wo);
			log.debug('arr_wo_locations after prepWoLocation is ', JSON.stringify(arr_wo_locations));
			
			for (var k = 0; arr_wo_locations.length>k;k++)
			{ 
				if (arr_wo_locations[k] != "skip")
				{
					var total_wo_qty =0;
					var total_wo_assembly_lines=0;
					
					for (var i = 0; arr_so_item_bins_for_wo.length>i;i++){
						if (arr_so_item_bins_for_wo[i].so_line_location == arr_wo_locations[k])
						{
							log.debug('arr_so_item_bins_for_wo[i] after prepWoLocation is ', JSON.stringify(arr_so_item_bins_for_wo[i]));
							validateBinQtyBeforeWO(arr_so_item_bins_for_wo[i]);
							//total_wo_qty=total_wo_qty+(parseInt(arr_so_item_bins_for_wo[i].so_line_bin_pick_qty)/arr_so_item_bins_for_wo[i].assemblyItem_PackSize); //packSize
							var qtyNeeded_from_so = arr_so_item_bins_for_wo[i].QtyNeeded;
							if (qtyNeeded_from_so > 0 && arr_so_item_bins_for_wo[i].so_line_location != '0' && arr_so_item_bins_for_wo[i].IsSuccess == "Y")
							{
								total_wo_assembly_lines++;
								total_wo_qty=total_wo_qty+(parseInt(qtyNeeded_from_so));
							}
						} //arr_so_item_bins_for_wo[i].IsSuccess
						log.debug('arr_so_item for TRANID has IsSuccess flag of : ',arr_so_item_bins_for_wo[i].so_tranID + '##'+arr_so_item_bins_for_wo[i].IsSuccess);
					}
					log.debug({ title: ' total_wo_qty is ', details:  total_wo_qty +'##'+total_wo_assembly_lines});			
					var bFirstWO=true;
					var woID = 0;
					var soInternalValue=0;
					// loop again this time to create WO.
					for (var i = 0; arr_so_item_bins_for_wo.length>i;i++){
						var so_itemBin_for_wo = arr_so_item_bins_for_wo[i];
						if (so_itemBin_for_wo.so_line_location == arr_wo_locations[k] && so_itemBin_for_wo.IsSuccess == "Y") 
						{
							if (bFirstWO)
							{
								bFirstWO=false;
								log.debug({ title: ' going to createWO : arr_so_item_bins_for_wo[i] ', details:  total_wo_qty  });			
								woID = createWO(total_wo_qty, so_itemBin_for_wo.so_line_location, so_itemBin_for_wo.so_subsidiary, so_itemBin_for_wo.assemblyItem, so_itemBin_for_wo.assemblyItem_PackSize);
								log.debug({ title: 'woID in handleWO_Builds', details: woID });			
								
								if (woID !=null || woID != '')
								{
									log.debug({ title: ' bFirstWO is true : going to transform : arr_so_item_bins_for_wo[i] ', details:  so_itemBin_for_wo });			
									var buildId = transformAssemblyBuild(woID,so_itemBin_for_wo);
									log.debug({ title: ' Build ID is  ', details:  buildId});			
									if (buildId)
										returnToScriptWithSuccess(so_itemBin_for_wo,woID,buildId);
								}
							}
							else
							{
								if (woID!=0 || woID != '')
								{
									log.debug({ title: ' bFirstWO is false : going to transform : arr_so_item_bins_for_wo[i] ', details:  so_itemBin_for_wo });			
									var buildId = transformAssemblyBuild(woID,so_itemBin_for_wo);
									log.debug({ title: ' Build ID is  ', details:  buildId});			
									if (buildId)
										returnToScriptWithSuccess(so_itemBin_for_wo,woID,buildId);
								}
							}
						}
					}
				}
			}
		} catch(err){
			log.error('Error in handleWO_Builds : Suitelet',JSON.stringify(err));
		}
	}
		
	function transformAssemblyBuild(woId,aBuildRec)
	{				
		try{
			//log.debug('Inside transformAssemblyBuild : aBuildRec',JSON.stringify(aBuildRec));
			var assembly_build_record = record.transform({
				  fromType: record.Type.WORK_ORDER,
				  fromId: woId,
				  toType: record.Type.ASSEMBLY_BUILD ,
				  isDynamic: true
				});

			assembly_build_record.setValue({
				fieldId: 'custbody_mb_build_linked_to_so',
				value: aBuildRec.so_internalID
			});

			assembly_build_record.setValue({
				fieldId: 'quantity',
				value : aBuildRec.QtyNeeded
			});

			var assembly_header_location = assembly_build_record.getValue({
				fieldId : 'location'
			});
			log.debug('assemblyBuildRec Location',assembly_header_location);
				
			var componentLineCt = assembly_build_record.getLineCount({
				sublistId : 'component'
			});
			log.debug('componentLineCt and transformAssemblyBuild',componentLineCt + '##'+JSON.stringify(aBuildRec));

			var bins_in_components_in_so_item;
			
			for(var i=0; i < componentLineCt; i++ ) {
											
				assembly_build_record.selectLine({
				 sublistId: 'component',
				 line: i
				 });
				log.debug('componentLineCt and I is ',componentLineCt + '##'+ i);
					
				var item_component = assembly_build_record.getSublistValue({
					sublistId : 'component',
					fieldId : 'item',
					line : i
				});
				log.debug('item_component and i is ',item_component+'##'+i);

				var componentQty = assembly_build_record.getSublistValue({
					sublistId : 'component',
					fieldId : 'quantity',
					line : i
				});
				log.debug('componentQty is ',componentQty);

				var invDetail = assembly_build_record.getCurrentSublistSubrecord({
					sublistId : 'component',
					fieldId : 'componentinventorydetail'
				});
				
				//log.debug('indetailObject','isDynamic: '+invDetail.isDynamic+', record: '+JSON.stringify(invDetail));
				//log.debug('sublistFields',invDetail.getSublistFields('inventoryassignment'));

				invDetail.setValue({
					fieldId : 'quantity',
					value : componentQty
				})
				//log.debug('invDetail',' here6');

				//log.debug('invDetail is ',JSON.stringify(invDetail));

				///
				var components_in_so_item = aBuildRec.components;
				log.debug('components_in_so_item is ',JSON.stringify(components_in_so_item));
				for (var k = 0; components_in_so_item.length>k;k++)
				{
					if (item_component == components_in_so_item[k].item)
					{
						bins_in_components_in_so_item = components_in_so_item[k].actualbin;
						log.debug('bins_in_components_in_so_item is ',JSON.stringify(bins_in_components_in_so_item));		
						break;
					}
				}
				
				var invdtl_bin_sum_qty=0;
				for (x=0;x<bins_in_components_in_so_item.length;x++){
					log.debug('x and bins_in_components_in_so_item',x + '##'+JSON.stringify(bins_in_components_in_so_item[x])+'##'+bins_in_components_in_so_item[x].actualbin.toString()+
					'##'+bins_in_components_in_so_item[x].qty_picked);
					log.debug('bins_in_components_in_so_item[x] IN transformAssemblyBuild',JSON.stringify(bins_in_components_in_so_item[x]));
					
					if(x==0)
					{
						invDetail.selectLine({
							sublistId : 'inventoryassignment',
							line : x
						});
					} 
					else
					{
						invDetail.selectNewLine({
							sublistId : 'inventoryassignment'
						});
					}
					
					invDetail.setCurrentSublistValue({
						sublistId : 'inventoryassignment',
						fieldId : 'binnumber',
						value : bins_in_components_in_so_item[x].actualbin.toString()
					});
					
					invDetail.setCurrentSublistValue({
						sublistId : 'inventoryassignment',
						fieldId : 'quantity',
						value : parseInt(bins_in_components_in_so_item[x].qty_picked)
					});
					invDetail.commitLine({
						sublistId : 'inventoryassignment'
					});
					invdtl_bin_sum_qty+=parseInt(bins_in_components_in_so_item[x].qty_picked);							
					log.debug('invDetail',' here5 '+'##'+invdtl_bin_sum_qty);
				}
						
				assembly_build_record.setCurrentSublistValue({
					sublistId : 'component',
					fieldId : 'quantity',
					line : i,
					value : invdtl_bin_sum_qty //aBuildRec.so_line_bin_pick_qty
				});
				//log.debug('invDetail',' here7');
				
				assembly_build_record.commitLine({
					sublistId : 'component'
				});					
			}
			//log.debug('invDetail',' here8');
			
			try{
				var subrec_header = assembly_build_record.getSubrecord({
						//sublistId: 'item',
						fieldId: 'inventorydetail'
					});
				//log.debug({ title: 'subrec_header', details: JSON.stringify(subrec_header) });
				subrec_header.selectNewLine({
					sublistId: 'inventoryassignment'
				});

				subrec_header.setCurrentSublistValue({
					sublistId: 'inventoryassignment',
					fieldId: 'quantity',
					value: aBuildRec.QtyNeeded
				});
						
				subrec_header.setCurrentSublistValue({
					sublistId: 'inventoryassignment',
					fieldId: 'binnumber',
					value:  fetchPreferredBinByItem(bins_in_components_in_so_item[0],assembly_header_location) //  bins_in_components_in_so_item[0].actualbin.toString() // aBuildRec.so_line_bin_internal
				});

				subrec_header.commitLine({
						sublistId: 'inventoryassignment'
				});
				
			} catch(err){
				log.error('Error in Suitelet-transformAssemblyBuild-add HeaderBin',JSON.stringify(err));
			}
								
			assembly_build_record.setValue({
				fieldId: 'quantity',
				value: aBuildRec.QtyNeeded
			});
			var assembly_build_Id = assembly_build_record.save();
			//log.debug({ title: 'assembly_build_Id', details: assembly_build_Id });			

			return assembly_build_Id;			
		} catch(err){
			log.error('Error in Suitelet-transformAssemblyBuild',JSON.stringify(err));
		}				
	}
	
	function fetchPreferredBinByItem(whichItem, whichLocation)
	{
		try
		{
			var whichBin = whichItem.actualbin;
			for (var i = 0; arr_item_preferred_bins.length>i;i++)
			{
				var item_preferred_bin = arr_item_preferred_bins[i];
				if (item_preferred_bin.item == whichItem.item && item_preferred_bin.bin_location == whichLocation && item_preferred_bin.is_preferred == true )
				{
					log.debug('whichBin replaced with prefBin : fetchPreferredBinByItem  ',item_preferred_bin.is_preferred);	
					whichBin = item_preferred_bin.preferred_bin;				
				}				
			}
			log.debug('whichBin within fetchPreferredBinByItem  ',whichBin);	
			return whichBin.toString();		
		} catch(err){
			log.error('Error in Suitelet-fetchPreferredBinByItem',JSON.stringify(err));
		}		
	}
	
	function prepWOLocations(arr_so_item_bins_for_wo)
	{		
		// find how many locations.. loop for each unique location.
		try{
			var wo_locations='';
			for (var i = 0; arr_so_item_bins_for_wo.length>i;i++){
				var so_line_loc =arr_so_item_bins_for_wo[i].so_line_location;
				 
				wo_locations = wo_locations.replace(so_line_loc, "");
				wo_locations=wo_locations+arr_so_item_bins_for_wo[i].so_line_location+"#";					
			}	
			log.debug('wo_locations 1st ',wo_locations);	
			wo_locations= wo_locations.replace("##", "#");
			log.debug('wo_locations 2nd  ',wo_locations);	
				
			var arr_wo_locations = wo_locations.split("#");
			log.debug('arr_wo_locations length 3rd  ',arr_wo_locations.length);

			for (var k = 0; arr_wo_locations.length>k;k++)
			{ 
				if (arr_wo_locations[k] == "" || arr_wo_locations[k] == "0")
					arr_wo_locations[k] = "skip";
			}
			return arr_wo_locations;
		} catch(err){
			log.error('Error in Suitelet-prepWOLocations',JSON.stringify(err));
		}		
	}
	
	function build_SoItem_w_bins(so_obj_Inner,arr_member_w_bins,so_line_location_probable)
	{
		try {

			var so_line_w_bins = {
				//add another element to indicate if substitue was used.
				so_internalID : so_obj_Inner.so_internalID,
				so_tranID : so_obj_Inner.so_tranID,
				so_lineId :  so_obj_Inner.so_lineId,
				so_subsidiary : so_obj_Inner.so_subsidiary,				
				IsSuccess : so_obj_Inner.IsSuccess,				
				assemblyItem : so_obj_Inner.assemblyItem,
				assemblyItemName : so_obj_Inner.assemblyItemName,
				assemblyItem_QtyAvail :so_obj_Inner.assemblyItem_QtyAvail,
				assemblyItem_PackSize : so_obj_Inner.assemblyItem_PackSize,
				assemblyItem_Parent : so_obj_Inner.assemblyItem_Parent, // this should update ItemParent on SoLine and if it is a substitue, it should be used here as ItemParent.
				QtyOrdered  : so_obj_Inner.QtyOrdered,
				QtyFulfilled  : so_obj_Inner.QtyFulfilled,
				QtyNeeded : so_obj_Inner.QtyNeeded,
				so_line_wo : 0,
				so_line_linked_build  : 0,
				so_line_location : so_line_location_probable,  
				components : arr_member_w_bins,
				components_count : arr_member_w_bins.length
			};
			return so_line_w_bins;	
		} catch(err){
			log.error('Error in Suitelet-build_SoItem_w_bins',JSON.stringify(err));
		}
	}
	
	function build_PickedMembers(a_member_Picked_details)
	{
		try {						 
			var picked_member_data = {
				members : a_member_Picked_details
			};
			return picked_member_data;	
		} catch(err){
			log.error('Error in Suitelet-build_PickedMembers',JSON.stringify(err));
		}
	}

	function build_memberPicked(a_bin_details,itemMember,so_qty_required,locn_having_stock)
	{
		try {						 
			var memberPicked_data = {
				item : itemMember,
				qtyPicked : so_qty_required,
				qtyLocation : locn_having_stock,
				actualbin : a_bin_details
			};
			return memberPicked_data;	
		} catch(err){
			log.error('Error in Suitelet-build_memberPicked',JSON.stringify(err));
		}
	}

	function build_binPicked(bin_details,qtyToPick)
	{
		try {						 
			var binPicked_data = {
				item : bin_details.item,
				qty_picked : qtyToPick,
				bin_location : bin_details.bin_location,
				actualbin : bin_details.actualbin
			};
			arr_bin_consumed.push(binPicked_data);
			return binPicked_data;	
		} catch(err){
			log.error('Error in Suitelet-build_binPicked',JSON.stringify(err));
		}
	}

	function UpdateData_BasedOnBinsConsumed(arr_bin_available)
	{
		try {
			log.debug('UpdateData_BasedOnBinsConsumed Begin ', JSON.stringify(arr_bin_available) );
			var newLocnQty = 0;
			var new_arr_itm_locn = new Array();
			var new_arr_itm_bin_locn = new Array();
			for (var k = 0; arr_locn_qty.length>k;k++)
			{	
				var obj_item_locn_data  = arr_locn_qty[k];
				newLocnQty = obj_item_locn_data.locn_available;	
				for (var j = 0; arr_bin_consumed.length>j;j++)
				{					
					var obj_bin_consumed  = arr_bin_consumed[j];
					if (obj_bin_consumed.item == obj_item_locn_data.item && obj_bin_consumed.bin_location == obj_item_locn_data.location_id)
					{
						newLocnQty= newLocnQty - obj_bin_consumed.qty_picked;
					}
				}
				var item_locn_wise = {
					item : obj_item_locn_data.item,
					locn_available : newLocnQty,
					location_id : obj_item_locn_data.location_id,
					loc_subsidiary_id : obj_item_locn_data.loc_subsidiary_id
				};
				new_arr_itm_locn.push(item_locn_wise);			
			}
			arr_locn_qty = new_arr_itm_locn;

			for (var k = 0; arr_bin_available.length>k;k++)
			{	
				var obj_item_bin_data  = arr_bin_available[k];
				newBinQty = obj_item_bin_data.bin_available;	
				for (var j = 0; arr_bin_consumed.length>j;j++)
				{					
					var obj_bin_consumed  = arr_bin_consumed[j];
					if (obj_bin_consumed.actualbin == obj_item_bin_data.actualbin && obj_bin_consumed.item == obj_item_bin_data.item && obj_bin_consumed.bin_location == obj_item_bin_data.bin_location)
					{
						newBinQty= newBinQty - obj_bin_consumed.qty_picked;
					}
				}
				var item_bin_wise = {		
					item : obj_item_bin_data.item,
					actualbin : obj_item_bin_data.actualbin,
					bin_available : newBinQty,
					bin_location : obj_item_bin_data.bin_location
				};
				new_arr_itm_bin_locn.push(item_bin_wise);			
			}
			log.debug('UpdateData_BasedOnBinsConsumed new_arr_itm_bin_locn ', JSON.stringify(new_arr_itm_bin_locn) );
			
			return new_arr_itm_bin_locn;
		} catch(err){
			log.error('Error in Suitelet-UpdateData_BasedOnBinsConsumed',JSON.stringify(err));
		}
	}
	
	function findLocationStockForEachMember(itemToCheck, qtyToCheck, subsidiaryToCheck)
	{
		try {
			var locationHavingStock =0;
			log.debug('findLocationStockForEachMember  ', itemToCheck + '##'+ qtyToCheck + '##'+ subsidiaryToCheck );
			for (var k = 0; arr_locn_qty.length>k;k++)
				{ //here in this loop you can sum for every location and if the sum is greater than required, email to Jam team asking for transfer. scope change.
					var obj_item_locn = arr_locn_qty[k];
					log.debug('findLocationStockForEachMember  obj_item_locn ', obj_item_locn.item + '##'+ obj_item_locn.locn_available+'##'+ obj_item_locn.loc_subsidiary_id+'##'+ obj_item_locn.location_id);
					if (obj_item_locn.item == itemToCheck && subsidiaryToCheck == obj_item_locn.loc_subsidiary_id)
					{
						if (obj_item_locn.locn_available >= qtyToCheck)
						{
							locationHavingStock = obj_item_locn.location_id;
							break;
						}
					}			
			}
			return locationHavingStock;		
		} catch(err){
			log.error('Error in Suitelet-findLocationStockForEachMember',JSON.stringify(err));
		}
	}
	
	function returnToScriptWithFailure(objSO_Items,objSO_Inner,failedMessage)
	{
		try {
			var arr_so_line_updated  = new Array();
			var bCheck_all_so_lines = false;

			var	bProceed = false;
			if (objSO_Inner == '')
				bCheck_all_so_lines = true;

			for (var i = 0; objSO_Items.length>i;i++){
				var obj_Inner = objSO_Items[i];
				bProceed = false;

				if (bCheck_all_so_lines ==false)
				{
					if (objSO_Inner == obj_Inner)
						bProceed = true;
				}
				else
				{
					bProceed = true;
				}

				if (bProceed == true)
				{
					var so_line_updated = {
						so_internalID : obj_Inner.so_internalID,
						so_tranID : obj_Inner.so_tranID,
						so_lineId : obj_Inner.so_lineId,
						so_subsidiary : obj_Inner.so_subsidiary,						
						IsSuccess : obj_Inner.IsSuccess,
						assemblyItem : obj_Inner.assemblyItem,
						assemblyItemName : obj_Inner.assemblyItemName,
						assemblyItem_QtyAvail :obj_Inner.assemblyItem_QtyAvail,
						assemblyItem_PackSize : obj_Inner.assemblyItem_PackSize,
						assemblyItem_Parent : obj_Inner.assemblyItem_Parent,
						QtyOrdered  : obj_Inner.QtyOrdered,
						QtyFulfilled  : obj_Inner.QtyFulfilled,
						QtyNeeded : obj_Inner.QtyNeeded,
						//so_line_wo : "0",
						//so_line_linked_build  : "0",
						//so_line_location : "0",
						so_line_memo : failedMessage
					};
					arr_so_line_updated.push(so_line_updated);
					updateSOLines(so_line_updated);
				}
			}
			arr_so_processed.push(so_line_updated);
			return arr_so_line_updated;
		} catch(err){
			log.error('Error in Suitelet-returnToScriptWithFailure',JSON.stringify(err));
		}		
	}	

	function returnToScriptWithSuccess(objSO_Inner,recWo, recBuild)
	{
		try {
			var msg = recWo > 0 ? "WoID created. " : "WoID not created";
			msg = msg +  (recBuild > 0 ? "Linked BuildRec created. " : "Linked BuildRec not created");
			var so_line_updated = {
				so_internalID : objSO_Inner.so_internalID,
				so_tranID : objSO_Inner.so_tranID,		
				so_lineId : objSO_Inner.so_lineId,		
				so_subsidiary : objSO_Inner.so_subsidiary,						 			
				IsSuccess : objSO_Inner.IsSuccess,			
				assemblyItem : objSO_Inner.assemblyItem,
				assemblyItemName : objSO_Inner.assemblyItemName,
				assemblyItem_QtyAvail :objSO_Inner.assemblyItem_QtyAvail,
				assemblyItem_PackSize : objSO_Inner.assemblyItem_PackSize,
				assemblyItem_Parent : objSO_Inner.assemblyItem_Parent,
				QtyOrdered  : objSO_Inner.QtyOrdered,
				QtyFulfilled  : objSO_Inner.QtyFulfilled,
				QtyNeeded : objSO_Inner.QtyNeeded,
				so_line_wo : recWo,
				so_line_linked_build  : recBuild,
				so_line_location : objSO_Inner.so_line_location,
				so_line_memo : msg
			};
			arr_so_processed.push(so_line_updated);
			updateSOLines(so_line_updated);
			
		} catch(err){
			log.error('Error in Suitelet-returnToScriptWithSuccess',JSON.stringify(err));
		}		
	}	
		
	function verifyComponentQty(arr_bin_stock)
	{
		try {
			var componentsCount = arr_itm_members.length;
			var componentFoundInBins =0;
			var bCountMatched=false;
			for (var i = 0; arr_itm_members.length>i;i++)
			{
				for (var k = 0; arr_bin_stock.length>k;k++)
				{
					if (arr_bin_stock[k].item == arr_itm_members[i].member)
					{
						componentFoundInBins++;
						break;
					}					
				}		
			}
			log.debug('verifyComponentQty : ',componentsCount + '##'+componentFoundInBins);
			
			if (componentsCount == componentFoundInBins)
				bCountMatched=true;
			
			return bCountMatched;
		} catch(err){
			log.error('Error in Suitelet-verifyComponentQty',JSON.stringify(err));
		}
	}

	function findSoItemComponents(itemToFind,qtyNeeded,locationIds)
	{
		try {
			log.emergency('params', itemToFind+"%"+qtyNeeded+"%"+locationIds)
			var filter = search.createFilter({
				name : 'internalid',
				operator : search.Operator.ANYOF,
				values : itemToFind
			});

			log.debug('locationIds',locationIds);

			var filter2 = search.createFilter({
				name : 'inventorylocation',
				join : 'memberitem',
				operator : search.Operator.ANYOF,
				values : locationIds
			});

			//log.debug('findSoItemComponents BEFORE ',itemToFind);
			
			var so_itm_members = '';
			so_itm_members_only  = new Array();
			arr_itm_members = new Array();
			
			var _search_itmCmp = search.load({
				id : lookup_assemblyItm_components  //,
				//filters : filter					
			});
			
			_search_itmCmp.filters.push(filter);			
			_search_itmCmp.filters.push(filter2);

			_search_itmCmp.run().each(function(result)
			{						
				log.audit('result',JSON.stringify(result))		
				var so_itm_member  = result.getValue({
					name : 'internalid',
					join : 'memberitem',
					 summary : search.Summary.GROUP
				});
				
				var so_itm_member_name  = result.getText({
					name : 'memberitem',
					summary : search.Summary.GROUP
				});
				
				var so_itm_member_substitute  = result.getValue({
					name : 'custitem_mb_item_attribute_substitute',
					join: "memberitem",
					 summary : search.Summary.GROUP
				});
			
				var so_itm_member_qtyavail  = result.getValue({
					name: "locationquantityavailable",
					join : 'memberitem',
					summary : search.Summary.SUM
				});

				var so_itm_member_pksize = result.getValue({
					name: 'memberquantity',
					summary : search.Summary.GROUP
				});

				so_itm_member_qtyavail = so_itm_member_qtyavail == null ? '0' :so_itm_member_qtyavail;
				so_itm_member_qtyavail = so_itm_member_qtyavail == '' ? '0' :so_itm_member_qtyavail;

				log.audit('so_itm_member_substitute and so_itm_member_qtyavail',so_itm_member_substitute +'##'+so_itm_member_qtyavail);
				var IsSubstituted = parseInt(so_itm_member_qtyavail.toString()) <= qtyNeeded ? true : false;
					IsSubstituted = ((so_itm_member_substitute != '- None -' && so_itm_member_substitute != '') && (IsSubstituted == 'Y' || IsSubstituted == true)) ? true : false;
				// change made by lucas 7-20	
				if (IsSubstituted == 'Y'){
					log.audit('substitute',so_itm_member_substitute);
					var subSrch = search.create({
						type : search.Type.ITEM,
						filters : [
							search.createFilter({
								name : 'itemid',
								operator : search.Operator.IS,
								values : so_itm_member_substitute
							}),
							search.createFilter({
								name : 'isinactive',
								operator : search.Operator.ANYOF,
								values : ['F',false]
							})
						],
						columns : ['internalid']
					});
					var results = subSrch.run().getRange({start:0,end:1});
					if(results.length == 1){
						so_itm_member_substitute = results.getValue({
							name : 'internalid'
						})
					} else {
						IsSubstituted = 'N';
					}
				}
				var newMemberItem = ((IsSubstituted == 'Y' || IsSubstituted == true) ? so_itm_member_substitute :   so_itm_member);
				
				so_itm_members = so_itm_members+newMemberItem;
				
				var item_member = {
					member : newMemberItem,
					substituted : IsSubstituted,
					//member_substitute : so_itm_member_substitute,
					actual_member : so_itm_member,
					actual_member_pksize : so_itm_member_pksize, //packSize used in Assembly called as MemberQty
					actual_member_available : so_itm_member_qtyavail
				};
				arr_itm_members.push(item_member);
				so_itm_members_only.push(newMemberItem);
				so_itm_members+=',';
				log.debug('findSoItemComponents so_itm_members is ',so_itm_members);
				return true;
			});
			so_itm_members = so_itm_members.substring(0, so_itm_members.length - 1);
			return arr_itm_members;
		} catch(err){
			log.error('Error in Suitelet-findItemComponents',JSON.stringify(err));
		}
	}
	
	function findSoItemComponents_old(itemToFind,qtyNeeded)
	{
		try {
			var filter = search.createFilter({
				name : 'internalid',
				operator : search.Operator.ANYOF,
				values : itemToFind
			});
			//log.debug('findSoItemComponents BEFORE ',itemToFind);
			
			var so_itm_members = '';
			so_itm_members_only  = new Array();
			arr_itm_members = new Array();
			
			var _search_itmCmp = search.load({
				id : lookup_assemblyItm_components  //,
				//filters : filter					
			});
			
			_search_itmCmp.filters.push(filter);			

			_search_itmCmp.run().each(function(result)
			{								
				var so_itm_member  = result.getValue({
					name : 'memberitem' 
				});
				
				var so_itm_member_name  = result.getText({
					name : 'memberitem' 
				});
				
				var so_itm_member_substitute  = result.getValue({
					name: "custitem_mb_item_attribute_substitute",
					join: "memberItem" 
				});
			
				var so_itm_member_qtyavail  = result.getValue({
					name: "quantityavailable",
					join: "memberItem" 
				});

				var so_itm_member_pksize = result.getValue({
					name: 'memberquantity'
				});
				so_itm_member_qtyavail = so_itm_member_qtyavail == null ? '0' :so_itm_member_qtyavail;
				so_itm_member_qtyavail = so_itm_member_qtyavail == '' ? '0' :so_itm_member_qtyavail;

				log.audit('so_itm_member_substitute and so_itm_member_qtyavail',so_itm_member_substitute +'##'+so_itm_member_qtyavail);
				var IsSubstituted = parseInt(so_itm_member_qtyavail.toString()) <= qtyNeeded ? true : false;
					IsSubstituted = (so_itm_member_substitute.length  > 0 && (IsSubstituted == 'Y' || IsSubstituted == true)) ? true : false;
				// change made by lucas 7-20	
				var newMemberItem = ((IsSubstituted == 'Y' || IsSubstituted == true) ? so_itm_member_substitute :   so_itm_member);
				so_itm_members	=so_itm_members+newMemberItem;
				
				var item_member = {
					member : newMemberItem,
					substituted : IsSubstituted,
					//member_substitute : so_itm_member_substitute,
					actual_member : so_itm_member,
					actual_member_pksize : so_itm_member_pksize, //packSize used in Assembly called as MemberQty
					actual_member_available : so_itm_member_qtyavail
				};
				arr_itm_members.push(item_member);
				so_itm_members_only.push(newMemberItem);
				so_itm_members+=',';
				log.debug('findSoItemComponents so_itm_members is ',so_itm_members);
				return true;
			});
			so_itm_members = so_itm_members.substring(0, so_itm_members.length - 1);
			return arr_itm_members;
		} catch(err){
			log.error('Error in Suitelet-findItemComponents',JSON.stringify(err));
		}
	}
			
	function findSubsidiaries(arr_so_item_bins_for_wo)
	{
		try{
			var so_subsidiary_list='';
			log.debug('findSubsidiaries  arr_so_item_bins_for_wo is ',JSON.stringify(arr_so_item_bins_for_wo));			
			for (var i = 0; arr_so_item_bins_for_wo.length>i;i++)
			{
				var so_line_subsidiary =arr_so_item_bins_for_wo[i].so_subsidiary;
				log.debug('findSubsidiaries  so_line_subsidiary is ',so_line_subsidiary + '##'+so_subsidiary_list.toLowerCase().indexOf(so_line_subsidiary+'#'));
				if (so_subsidiary_list.toLowerCase().indexOf(so_line_subsidiary+'#') < 0)
				{
					log.debug('findSubsidiaries so_line_subsidiary inside ',so_line_subsidiary + '##'+so_subsidiary_list.toLowerCase().indexOf(so_line_subsidiary+'#'));
					so_subsidiary_list=so_subsidiary_list+so_line_subsidiary+"#";
					arr_subsidiary.push(so_line_subsidiary);
				}
			}
			log.debug('findSubsidiaries arr_subsidiary ',JSON.stringify(arr_subsidiary) +'##'+so_subsidiary_list);			
			return so_subsidiary_list;
		}
		catch(err){
			log.error('Error in Suitelet-findSubsidiaries',JSON.stringify(err));
		}	
	}
	
	function fetchSubsidiary(whichLocation)
	{
		try{
			var subs_id = '';
			for (var i = 0; arr_location_data.length>i;i++){
				if (arr_location_data[i].location_id == whichLocation)
				{
					subs_id = arr_location_data[i].subsidiary;
					break;
				}
			}			
			return subs_id;		
		}
		catch(err){
			log.error('Error in Suitelet-fetchSubsidiary',JSON.stringify(err));
		}			
	}
		
	function findFulfilmentLocations(whichSubsidiary, arr_all_fulfil_locations)
	{
		try{
			log.debug('findFulfilmentLocations  ',JSON.stringify(arr_all_fulfil_locations)+ '##'+whichSubsidiary);	
			for (var i = 0; arr_all_fulfil_locations.length>i;i++){
				log.debug('findFulfilmentLocations  index ',whichSubsidiary.toLowerCase().indexOf(arr_all_fulfil_locations[i].subsidiary+'#'));	
				if (whichSubsidiary.toLowerCase().indexOf(arr_all_fulfil_locations[i].subsidiary+'#') >= 0)
				{
					so_fulfil_locations_only.push(arr_all_fulfil_locations[i].location);					
				}
			}
			log.debug('findFulfilmentLocations  so_fulfil_locations_only ',JSON.stringify(so_fulfil_locations_only));	
		}
		catch(err){
			log.error('Error in Suitelet-findFulfilmentLocations',JSON.stringify(err));
		}	
	}

	function findItemPreferredBin(itemToFind)
	{
		try {
			
			log.debug('findItemPreferredBin : so_itm_members_only: ',JSON.stringify(so_itm_members_only));
			
			var filter = search.createFilter({
				name : 'internalid',
				operator : search.Operator.ANYOF,
				values : so_itm_members_only
			});

			var _search_preferredBin = search.load({
				id : lookup_item_preferred_bin //,
				//filters : filter					
			});
			
			_search_preferredBin.filters.push(filter);
			
			filter = search.createFilter({
				name : 'location',	
				join: "binnumber",
				operator : search.Operator.ANYOF,
				values : so_fulfil_locations_only
			});		
			_search_preferredBin.filters.push(filter);			
			//
			
			_search_preferredBin.run().each(function(result)
			{					
				var item_linked_to_bin  = result.getValue({
					name: 'internalid' 
				});

				var bin_internalid = result.getValue({
					name: 'internalid',
					join: "binNumber"
				});
								
				var is_preferred  = result.getValue({
					name: 'preferredbin'
				});

				var bin_location  = result.getValue({
					name: 'location',
					join: "binNumber"
				});
				var item_bin_preferred = {
					item : item_linked_to_bin,
					preferred_bin : bin_internalid,
					is_preferred : is_preferred,
					bin_location : bin_location
				};
				arr_item_preferred_bins.push(item_bin_preferred);
				return true;
			});
			log.debug('findItemPreferredBin : arr_item_preferred_bins : ',JSON.stringify(arr_item_preferred_bins));
			
		} catch(err){
			log.error('Error in Suitelet-findItemPreferredBin',JSON.stringify(err));
		}
	}

	function findItemQtyByBin(itemToFind,qtyNeeded,locationIds)
	{
		try {
			var arr_item_bins= new Array();
			
			//var arr_locn_qty= new Array();
			arr_locn_qty= new Array();
			var arr_item_components = findSoItemComponents(itemToFind,qtyNeeded,locationIds);
			if (arr_item_components.length <= 0)
			{
				//send error email indicating that the SO Item has "no assembly components defined"
				log.debug('WARNING : arr_item_components length is zero.  so_itm_members is ','no assembly components defined');
				bAbort = true;
				return arr_item_bins;
			}				
			log.debug('findItemQtyByBin : arr_item_components: ',JSON.stringify(arr_item_components));
			log.debug('findItemQtyByBin : so_itm_members_only: ',JSON.stringify(so_itm_members_only));
			
			var locn_item = '';
			var locn_qty = 0;
			var locn_id = '';
			
			var bFirst = true;	
			var filter = search.createFilter({
				name : 'internalid',
				operator : search.Operator.ANYOF,
				values : so_itm_members_only // itemToFind
			});

			var _search_bQOH = search.load({
				id : lookup_nonfba_bin_available //,
				//filters : filter					
			});
			
			_search_bQOH.filters.push(filter);

			// fulfilment location added to filters. Comment this if we need to allow all locations within subsidiary to be searched for inventory.
			
			filter = search.createFilter({
				name : 'location',
				join: "binOnHand",
				operator : search.Operator.ANYOF,
				values : so_fulfil_locations_only
			});		
			_search_bQOH.filters.push(filter);			
			//
			
			_search_bQOH.run().each(function(result)
			{					
				var item_linked_to_bin  = result.getValue({
					name: 'internalid' 
				});

				var bin_internalid = result.getValue({
					name: 'binnumber',
					join: "binOnHand"
				});
								
				var bin_available  = result.getValue({
					name: 'quantityavailable',
					join: "binOnHand"
				});

				var bin_location  = result.getValue({
					name: 'location',
					join: "binOnHand"
				});
				
				if (bFirst == true)
				{
					bFirst = false;
					locn_id = bin_location;
					locn_item =item_linked_to_bin;
				}
				
				if (locn_item !=item_linked_to_bin || bin_location !=locn_id)
				{
					var locn_wise = {
						item : locn_item,
						locn_available : locn_qty,
						location_id : locn_id,
						loc_subsidiary_id : fetchSubsidiary(locn_id)
					};
					arr_locn_qty.push(locn_wise);
					locn_id = bin_location;
					locn_item =item_linked_to_bin;
					locn_qty = 0;					
				}
				locn_qty += parseInt(bin_available);

				{
					var item_bins = {
						item : item_linked_to_bin,
						actualbin : bin_internalid,
						bin_available : bin_available,
						bin_location : bin_location
					};
					arr_item_bins.push(item_bins);
				}
				return true;
			});
			// last pass after exit from above loop
			if (locn_id != "")
			{
				var locn_wise = {
					item : locn_item,
					locn_available : locn_qty,
					location_id : locn_id,
					loc_subsidiary_id : fetchSubsidiary(locn_id)
					
				};
				arr_locn_qty.push(locn_wise);
			}
			// last pass ends
			log.debug('findItemQtyByBin : arr_item_bins : ',JSON.stringify(arr_item_bins));
			log.debug('findItemQtyByBin : arr_locn_qty : ',JSON.stringify(arr_locn_qty));
			
			//if (arr_item_bins.length != so_itm_members_only.length)
			//{
			//	//send error email indicating that the SO Item has insufficient qty across one or more component items linked to SO Item (assembly)"
			//	log.debug('WARNING : arr_item_bins.length != so_itm_members_only.length ','SO Item has insufficient qty across one or more component items linked to SO Item (assembly)');
			//	bAbort = true;
			//	//return arr_item_bins;
			//}				
			
			return arr_item_bins;
			
		} catch(err){
			log.error('Error in Suitelet-findItemQtyBin',JSON.stringify(err));
		}
	}

	//function OLDfindFulfilmentLocations(arrWhichSubsidiary)
	//{
	//	try {
	//		var filter = search.createFilter({
	//			name : 'subsidiary',
	//			operator : search.Operator.ANYOF,
	//			values :  arrWhichSubsidiary
	//		});
	//		log.debug('checking findFulfilmentLocations for Subsidiary values : ',JSON.stringify(arrWhichSubsidiary));
			
	//		so_fulfil_locations_only  = new Array();
			
	//		var _search_locations = search.load({
	//			id : find_fulfilment_locations  
	//			//filters : filter					
	//		});
			
	//		_search_locations.filters.push(filter);	
	//		_search_locations.run().each(function(result)
	//		{								
	//			var fulfil_location  = result.getValue({
	//				name : 'internalid' 
	//			});
													
	//			so_fulfil_locations_only.push(fulfil_location);
	//			return true;
	//		});
	//		log.debug('findFulfilmentLocations list  : ',JSON.stringify(so_fulfil_locations_only));
			
	//	} catch(err){
	//		log.error('Error in Suitelet-findFulfilmentLocations',JSON.stringify(err));
	//	}
	//}

	//function buildLocationData()
	//{
	//	try {
	//		
	//		arr_location_data  = new Array();
	//		
	//		var _search_locations = search.load({
	//			id : location_details  
	//			//filters : filter					
	//		});
			
	//		_search_locations.run().each(function(result)
	//		{						
	//			var location_internal  = result.getValue({
	//				name : 'internalid' 
	//			});
															 
	//			var subsidiary_Id  = result.getValue({
	//				name : 'internalid',
	//				join : 'CUSTRECORD_MB_SUBS_ID_IN_LOCATION'
	//			});
	//			var locn_subs = {
	//				location_id : location_internal,
	//				subsidiary : subsidiary_Id
	//			};

	//			arr_location_data.push(locn_subs);
	//			return true;
	//		});
	//		log.debug('buildLocationData list  : ',JSON.stringify(arr_location_data));
			
	//	} catch(err){
	//		log.error('Error in Suitelet-buildLocationData',JSON.stringify(err));
	//	}
	//}
			
	return {
		onRequest : onRequest
	};
	
});