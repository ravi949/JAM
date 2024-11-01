/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
 */

const location_details_searchId = 'customsearch_mb_location_details';
const find_fulfilment_locations_searchId = 'customsearch_mb_find_fulfilment_center';

const suiteletId = 'customscript_mb_suitelet_wo_from_so';
const deploymentId = 'customdeploy_mb_suitelet_wo_from_so';



var arr_location_data  = new Array();
var so_fulfil_locations_only  = new Array();	 

var	executionThreshold  = 40;
const MINIMUM_USAGE = 300;
var startDateTime = new Date();

define(['N/search', 'N/record','N/email','N/url','N/runtime','N/https'],
	function (search,record,email,url,runtime,https){
		function execute(context){
			checkSalesOrders()
		};
		
		function checkSalesOrders(){
			try {
				
				var so_dtl_searchId = 'customsearch_mb_so_without_wo_dtl';
				var searchParam = runtime.getCurrentScript().getParameter({name : 'custscript_mb_wo_search_id'});
				if(searchParam!='' && searchParam){
					so_dtl_searchId = searchParam
				};

				var _search = search.load({
					id : so_dtl_searchId
				})

				var getOut = false;

				executionThreshold  = runtime.getCurrentScript().getParameter({name: 'custscript_mb_minutes'});
				var locationParam = runtime.getCurrentScript().getParameter({name : 'custscript_mb_wo_locations'});
				//log.emergency('locationParam',locationParam);
				var locations = new Array();
				var locationFilter = null;

				if(locationParam){
					locations = locationParam.split(',');
					locationFilter = search.createFilter({
						name : 'internalid',
						operator : search.Operator.ANYOF,
						values : locations
					})
				}

				var arr_so_by_item = new Array();
				var bFirst=true;
				var so_item_in_loop = '';
				_search.run().each(function(result){
					
					var so_internalID = result.getValue({
						name : 'internalid' 
					});
					var item = result.getValue({
						name : 'item' 
					});
					var channel = result.getText({
						name : 'class'
					})
					var isBNC = channel.indexOf('BNC') > 0 ? true : false;

					var so_subsidiary = result.getValue({
						name : 'subsidiary'
					});
					
					var item_name = result.getText({
						name : 'item' 
					});
					if (bFirst)
					{
						//log.debug('First time hit  : so_item_in_loop : ',so_item_in_loop);
						so_item_in_loop = item;
						log.debug('First time ',' hit  : so_item_in_loop : '+so_item_in_loop);
						bFirst = false;
						buildLocationData(locationFilter);
						findFulfilmentLocations(locationFilter);
					}
					if (so_item_in_loop != item)
					{
						log.debug('NOT lastRow  : ','calling suitelet with array length ' +arr_so_by_item.length);
						callSuitelet(arr_so_by_item);
						arr_so_by_item = new Array();						
					}
					
					var so_line_linked_wo = result.getValue({
						name : 'custcol_mb_soline_linked_to_wo' 
					});
					
					var so_tranID = result.getValue({
						name : 'tranid' 
					});

					var so_lineId = result.getValue({
						name : 'line'
					});
					
					var so_line_linked_build  = result.getValue({
						name : 'custcol_mb_soline_linked_to_build' 
					});

					var so_item_qty_avail = result.getValue({
						name : 'quantityavailable',         join: "item"
					});
					
					var item_packsize = result.getValue({
						name : 'custitem_mb_item_pack_size',join: "item"
					});
					
					var itemParent = result.getValue({
						name : 'custitem_mb_inv_item_parent',join: "item" 
					});
					
					var qty_ord = result.getValue({
						name : 'quantity'
					});
					
					var qty_fulfil = result.getValue({
						name : 'quantityshiprecv'
					});
					
					//Note : Do we need qtyPicked, QtyPacked here? currently qty is still ordQty, unless it is not fulfilled
					
					var qty_needed =qty_ord-qty_fulfil;
					log.debug('details : ',so_internalID+ '##'+item + '##'+itemParent + '##'+qty_ord + '##'+qty_fulfil + '##'+qty_needed + '##'+so_item_qty_avail  + '##'+so_line_linked_wo  + '##'+so_line_linked_build);
					//										
				
					var item_for_wo = {
						so_internalID : so_internalID,
						so_tranID : so_tranID,
						so_lineId : so_lineId,
						so_subsidiary : so_subsidiary,
						so_isbnc : isBNC,
					    IsSuccess : "Y",
						assemblyItem : item, //actualitem : item,
						assemblyItemName : item_name,
						assemblyItem_PackSize : item_packsize,
						assemblyItem_QtyAvail :so_item_qty_avail, //actualItemQty :so_item_qty_avail,
						assemblyItem_Parent : itemParent,
						QtyOrdered  : qty_ord,
						QtyFulfilled  : qty_fulfil,
						QtyNeeded : qty_needed,
						so_line_location : 0,
						so_line_wo : 0,
						so_line_linked_build  : 0	
					};
					arr_so_by_item.push(item_for_wo);
					so_item_in_loop = item;
	
					//
					if(executionTimesUp()){
						log.debug("Time limit error ","Validation has been rescheduled to avoid a script timeout");
						getOut = true; //break;
					}
					var scriptObj = runtime.getCurrentScript();
					log.debug("Remaining governance units: " + scriptObj.getRemainingUsage());

					if(scriptObj.getRemainingUsage() < MINIMUM_USAGE){
						log.debug("Rescheduled","Validation has been rescheduled to avoid a script usage error");
						getOut = true; //break;
					}
					
					//
					return true;	
				});
				if (arr_so_by_item.length!=0){
					log.debug('hit lastRow : ','calling suitelet with array length ' +arr_so_by_item.length);
					callSuitelet(arr_so_by_item);
					
					// loop through solines and find the match by Item internalId and tehn stamp from suitlet response (fields such as linkedwo, linkedassembly).
				}

			} catch(err){
				log.error("error",JSON.stringify(err));
			};
		}
		
		function findFulfilmentLocations(locationFilter)
		{
			try {				
				so_fulfil_locations_only  = new Array();
				
				var _search_locations = search.load({
					id : find_fulfilment_locations_searchId  
					//filters : filter					
				});

				if(locationFilter){
					_search_locations.filters.push(locationFilter)
				}

				_search_locations.run().each(function(result)
				{								
					var fulfil_location  = result.getValue({
						name : 'internalid' 
					});
					var fulfil_subsidiary  = result.getValue({
						name : 'internalid', 
						join : "CUSTRECORD_MB_SUBS_ID_IN_LOCATION"
					});
	  
					var fulfil_details = {
						location : fulfil_location,
						subsidiary : fulfil_subsidiary
					};
					so_fulfil_locations_only.push(fulfil_details);
					return true;
				});
				log.debug('findFulfilmentLocations list  : ',JSON.stringify(so_fulfil_locations_only));
				
			} catch(err){
				log.error('Error in Suitelet-findFulfilmentLocations',JSON.stringify(err));
			}
		}
		
		function buildLocationData(locationFilter)
		{
			try {
				var _search_locations = search.load({
					id : location_details_searchId  
					//filters : filter					
				});

				if(locationFilter){
					_search_locations.filters.push(locationFilter)
				}
				
				_search_locations.run().each(function(result)
				{						
					var location_internal  = result.getValue({
						name : 'internalid' 
					});
																 
					var subsidiary_Id  = result.getValue({
						name : 'internalid',
						join : 'CUSTRECORD_MB_SUBS_ID_IN_LOCATION'
					});
					
					var locn_subs = {
						location_id : location_internal,
						subsidiary : subsidiary_Id
					};

					arr_location_data.push(locn_subs);
					return true;
				});
				log.debug('buildLocationData list  : ',JSON.stringify(arr_location_data));
			} catch(err){
				log.error('Error in Suitelet-buildLocationData',JSON.stringify(err));
			}
		}	
		
		function executionTimesUp(){
			var timeElapsed = Math.abs((new Date()).getTime()-startDateTime.getTime());
			var minutesRunning = Math.floor((timeElapsed/1000)/60);
			return (minutesRunning >executionThreshold);
			
		}

        function convertArrayIntoChunks(inputArray, chunkSize) {
            var outputArray = [];
            var inputArraylength = inputArray.length;
            var index = 0; 
            while (inputArraylength > 0) {
                outputArray.push(inputArray.slice(index, index+chunkSize));
                inputArraylength -=chunkSize; 
                index +=chunkSize; 
            }
            return outputArray;
        }
    
		function callSuitelet(arr_so_by_item)
		{
			try {

                log.debug('suitelet', 'Called with array length '+arr_so_by_item.length ); //suitelet

				var arr_so_item_w_location = new Array();
				arr_so_item_w_location.push(arr_location_data);
				arr_so_item_w_location.push(so_fulfil_locations_only);
				log.debug('SO Location ',JSON.stringify(arr_so_item_w_location[0]));
				log.debug('SO fulfil location ',JSON.stringify(arr_so_item_w_location[1]));

				var parameters = {'object':JSON.stringify(arr_so_item_w_location)}
				var suitelet = url.resolveScript({
					scriptId : suiteletId,//'customscript_mb_suitelet_wo_from_so',
					deploymentId : deploymentId,//'customdeploy_mb_suitelet_wo_from_so',
					params : parameters,
					returnExternalUrl : true
				});

                var itemDataChunk = convertArrayIntoChunks(arr_so_by_item, 10)
                log.debug("itemDataChunk",JSON.stringify(itemDataChunk));
                
                for (var int = 0; int < itemDataChunk.length; int++) {
                    var itemDataOut = itemDataChunk[int];          
                    var body =  {arr_so_by_item : itemDataOut };                    
                    // var request = https.get({url : suitelet});
                    var request = https.post({url : suitelet, body: JSON.stringify(body)});                    
                    //TODO: handle failures.....................
                    log.debug('resp',(request.body)); //.ClientResponse.body));
                }
			} catch(err){
				log.error("error in SuiteLet call ",JSON.stringify(err));
			};			
		}

		return {
			execute:execute
		}
	}
);
