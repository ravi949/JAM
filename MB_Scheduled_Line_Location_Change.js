/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
var searchId = "customsearch_mb_switch_line_loc_jpcom"
define(['N/search','N/record','N/runtime','N/url','N/https'],
		(search,record,runtime,url,https) => {
			const execute = (scriptContext) => {
				try {
					var salesorderSearchObj = search.load({
					    id: searchId
					});
					var searchResultCount = salesorderSearchObj.runPaged().count;
					log.debug("salesorderSearchObj result count",searchResultCount);
					var arrayOfSODetails = [];
					salesorderSearchObj.run().each(function(result){
						   var internalId     = result.getValue({name: "internalid", label: "soID"});
						   var lineSequeceNum = result.getValue({name: "lineuniquekey", label: "lineSeqNum"});
						   var newLocationId  = result.getValue({
							   name: "formulatext",
							   formula: "case when (case when ({quantity}-nvl({quantitycommitted},0))>0 and {location} = '185 Legrand' then case when {item.inventorylocation} = '179 Legrand' and {item.locationquantityavailable} > {quantity} then 1 else 0 end else 0 end) =  1 then '12' else '11' end",
							   label: "newLocationId"
						   });
						   var soObject = {};
						   soObject["internalId"] 	  = internalId;
						   soObject["lineSequeceNum"] = lineSequeceNum;
						   soObject["newLocationId"]  = newLocationId;
						   arrayOfSODetails.push(soObject)
						   return true;
					});
					
					var groupBy = (array, key) => {
						return array.reduce((result, currentValue) => {
							var internalId = currentValue["internalId"];
							(result[internalId] = result[internalId] || []).push(currentValue);
							return result;
						}, {}); 
					};
					
					var detailsGroupedBySOId =groupBy(arrayOfSODetails, "internalId");
					log.debug("detailsGroupedBySOId",detailsGroupedBySOId);
					for(var soInternalId in detailsGroupedBySOId){
						
						var lineDetails  = detailsGroupedBySOId[soInternalId];

						var recordObj = record.load({
							type:record.Type.SALES_ORDER,
							id:soInternalId,
							isDynamic:true
						});

						for(var j=0;j<lineDetails.length;j++){

							var lineNumber = recordObj.findSublistLineWithValue({
								sublistId :"item",
								fieldId   :"lineuniquekey",
								value     : lineDetails[j]["lineSequeceNum"]
							})

							if(lineNumber == -1)
								continue;

							recordObj.selectLine({
								sublistId:"item",
								line:lineNumber
							})
							recordObj.setCurrentSublistValue({
								sublistId:"item",
								fieldId  :"location",
								value    : lineDetails[j]["newLocationId"]
							});
							recordObj.commitLine({
								sublistId : "item"
							})
						}
						var soInternalId = recordObj.save();
						log.debug("soInternalId",soInternalId);

					}
					
				} catch (e) {
					log.error("Exception", e);
				}

			}
			



			return { execute }

		});
