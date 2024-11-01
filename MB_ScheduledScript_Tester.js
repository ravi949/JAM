/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
*/

/*
 var customrecord_mb_attribute_metadataSearchObj = search.create({
   type: "customrecord_mb_attribute_metadata",
   filters:
   [
      ["custrecord_mb_is_parent_attribute","is","T"], 
      "AND", 
      ["isinactive","is","F"]
   ],
   columns:
   [
      search.createColumn({
         name: "name",
         sort: search.Sort.ASC,
         label: "Name"
      }),
      search.createColumn({name: "created", label: "Date Created"}),
      search.createColumn({name: "lastmodified", label: "Last Modified"})
   ]
});
var searchResultCount = customrecord_mb_attribute_metadataSearchObj.runPaged().count;
log.debug("customrecord_mb_attribute_metadataSearchObj result count",searchResultCount);
customrecord_mb_attribute_metadataSearchObj.run().each(function(result){
   // .run().each has a limit of 4,000 results
   return true;
});


2nd

var customrecord_mb_item_attributeSearchObj = search.create({
   type: "customrecord_mb_item_attribute",
   filters:
   [
      ["lastmodified","notwithin","today"], 
      "AND", 
      ["formulanumeric: case when nvl(LENGTH({custrecord_mb_ia_item.parent}),0) =0 then 1 else 0 end","equalto","1"], 
      "AND", 
      ["isinactive","is","F"]
   ],
   columns:
   [
      search.createColumn({name: "internalid", label: "Internal ID"}),
      search.createColumn({name: "custrecord_mb_ia_item", label: "Item"}),
      search.createColumn({
         name: "formulatext",
         formula: "{custrecord_mb_ia_item.parent}",
         label: "Formula (Text)"
      })
   ]
});
var searchResultCount = customrecord_mb_item_attributeSearchObj.runPaged().count;
log.debug("customrecord_mb_item_attributeSearchObj result count",searchResultCount);
customrecord_mb_item_attributeSearchObj.run().each(function(result){
   // .run().each has a limit of 4,000 results
   return true;
});

3rd
var customrecord_mb_item_attributeSearchObj = search.create({
   type: "customrecord_mb_item_attribute",
   filters:
   [
      ["isinactive","is","F"], 
      "AND", 
      ["formulanumeric: case when {custrecord_mb_ia_item.parent} = '0830Q309-PAR' then 1 else 0 end","equalto","1"]
   ],
   columns:
   [
      search.createColumn({name: "internalid", label: "Internal ID"}),
      search.createColumn({name: "custrecord_mb_ia_item", label: "Item"}),
      search.createColumn({
         name: "formulatext",
         formula: "{custrecord_mb_ia_item.parent}",
         label: "Formula (Text)"
      })
   ]
});
var searchResultCount = customrecord_mb_item_attributeSearchObj.runPaged().count;
log.debug("customrecord_mb_item_attributeSearchObj result count",searchResultCount);
customrecord_mb_item_attributeSearchObj.run().each(function(result){
   // .run().each has a limit of 4,000 results
   return true;
});

examples,
 [
        ["formulanumeric: case when {transaction.serialnumbers} ='AA' then 1 else 0 end","equalto","1"],
        "AND",
        ["formulanumeric: case when {transaction.serialnumbers} ='A0' then 1 else 0 end","equalto","1"]
 ]

*/

define
(['N/search', 'N/record','N/email']
,
	function (search,record,email){
		function execute(context){
			
			rollDownParentAttributes();
		};
		
		function rollDownParentAttributes(){
			try {
				const searchId = 'customsearch_mb_attribute_parent_only';
				//var arrNsId = new Array();
				var arrNsId = new Array();
				var arrNsId_Parent = new Array();
				var arrNsId_ItemAttrId = new Array();
				var _search = search.load({
					id : searchId
				})
				
				_search.run().each(function(result){
					var resultId = result.getValue({
						name : 'internalid'
					});
					
					var nsId = result.getValue({
						name : 'custrecord_mb_attribute_internal_id'
					});
					arrNsId.push(nsId);
					//var arrTemp = [label,nsId,sqlName];
					//log.debug('Vals',arrTemp);
					//log.debug('Vals : ',nsId);
					
					return true;
				});
				
				if (arrNsId.length==0)
				{
					log.debug('arrNsId length is ',arrNsId.length);
					var subj = "Attribute Metadata has no Parent attributes.";
					var msg = "Please check Attribute Metadata custom record.  \n \n";
					var recips = ["Pramod@mibar.net"];
					log.debug('msg is : ',msg);
					var sender = '1423';
					
					email.send({
						author : sender,
						recipients : recips,
						subject : subj,
						body : msg
					});
					return true;
				}
				
				if (arrNsId.length!=0)
				{
					log.debug('debugging arrNSID (length) ',arrNsId.length);
					searchId = 'customsearch_mb_item_attr_modified_today';
					//var arrNsId_Parent = new Array();
					
					var _search = search.load({
						id : 'customsearch_mb_item_attr_modified_today', ///searchId
							type : 'customrecord_mb_item_attribute'
							
					})
					
					_search.run().each(function(result){
						var resultId = result.getValue({
							name : 'internalid'
						});
						
						var nsId_Parent = result.getValue({
							name : 'custrecord_mb_ia_item' //'custrecord_mb_attribute_internal_id'
						});
						//log.debug('nsId_Parent and internal id : ',nsId_Parent + '##' +resultId);
						arrNsId_Parent.push(nsId_Parent);
						arrNsId_ItemAttrId.push(resultId);
						return true;
						
						//var arrTemp = [label,nsId,sqlName];
						//log.debug('Vals',arrTemp);
						
					});
						 
					
//					var arrIds = arrError.map(function(item,index){
//						var id = item.recId;
//						return id;
//					});
//					
//					var filter = search.createFilter({
//						name : 'internalid',
//						operator : search.Operator.ANYOF,
//						values : arrIds
//					});
//					
//					var search2 = search.load({
//						id : searchId,
//						type : 'customrecord_mb_attribute_metadata',
//						filters : filter
//					});
//					
//					var ct = 0;
//					
//					search2.run().each(function(result){
//						ct = ct+1
//						log.debug('result: '+ct,JSON.stringify(result));
//						dupInternalIds.push(result.getValue('internalid'));
//					});
				};
				
			} catch(err){
				log.error("error",JSON.stringify(err));
			};
			
			if (arrNsId_Parent.length!=0)
				{
					startRolldown(arrNsId_Parent,arrNsId,arrNsId_ItemAttrId);
				}
			else
				{
					log.debug('Total count of Parent items modified today : ',arrNsId_Parent.length);
				}
		}
		
		return {
			execute:execute
		} 
		
		// childAttributeUpdate
		function updateChildAttributes(childItemAttr_Id,arrParent_values,arrNsId,nsActualParent)
		{
      		var childItemAttrRcd = record.load({
                type: 'customrecord_mb_item_attribute',
                id: childItemAttr_Id,
                isDynamic: true
                }
      		);
			log.debug('debugging arrNSID with childItemAttr_Id ',childItemAttr_Id + '##'+arrParent_values.length);
  			if(childItemAttrRcd)
  			{
  				/*
			    var fldVal_child = childItemAttrRcd.getValue({
				    fieldId: 'custrecord_mb_ia_item.parent'
				    });
			    
				log.debug('fldVal_child and nsActualParent',fldVal_child + '##'+  nsActualParent);
  				
			    //if (fldVal_child == nsActualParent)
			    */
			    	{
						for (var i = 0; arrNsId.length>i;i++){
							var column_Name = arrNsId[i];
							//if (column_Name == 'custrecord_mb_ip_attribute_EnvelopeClsr')
							{
								//log.debug('debugging arrNSID step (child ItemAttr) ',column_Name)
								childItemAttrRcd.setValue({
									fieldId: column_Name.toLowerCase(),
									value: arrParent_values[i]
								});
							}
						}
						var childItemSaved_Id = childItemAttrRcd.save(); //uncomment later
						log.debug('Child Item attribute record saved : ',childItemSaved_Id);
			    	}
			    //else
			    //	{
			    //		log.debug('skipping child record as parent is ',fldVal_child + ' and it is not equal to actual parent '+  nsActualParent);
			    //	}
  			}
		}

		// add new functions here
		function startRolldown(arrNsId_Parent,arrNsId,arrNsId_ItemAttrId)
		{
			log.debug('we are here  : ',arrNsId_Parent.length + '**'+arrNsId.length);
			// loop for every arrnsId_parent and find the childrens in itemAttribute. If found, read from arrnsId_parent (index) 
			//and then get value for each arrnsid(index) 
			if (arrNsId_Parent.length!=0)
			{
				for (var iPar = 0; arrNsId_Parent.length>iPar;iPar++)
				{
				var ct = 0;
				var fldVal = ''; //(itemAttrRcd.getValue(fieldId));
				var nsItemAttr_internalId = arrNsId_ItemAttrId[iPar];
				var nsParent_internalId = arrNsId_Parent[iPar];
				log.debug('debugging arrNSID ',arrNsId_Parent.length + '##'+nsItemAttr_internalId+'##'+nsParent_internalId);
				//var arrNsId_Parent_fields = new Array();
	      		var itemAttrRcd = record.load({
                    type: 'customrecord_mb_item_attribute',
                    id: nsItemAttr_internalId, //12 //depositId
                    isDynamic: true
                    });
	      		
					log.debug('debugging arrNSID step 1',arrNsId_Parent.length);				
		  			if(itemAttrRcd){
						log.debug('debugging arrNSID step 2a',arrNsId_Parent.length)				
		  				var arrParent_values = new Array();
		  				//
						for (var i = 0; arrNsId.length>i;i++){
							var column_Name = arrNsId[i];
							//if (column_Name == 'custrecord_mb_ip_attribute_EnvelopeClsr')
							{
								//log.debug('debugging arrNSID step 2b',column_Name)				
							    var fldVal = itemAttrRcd.getValue({
							    fieldId: column_Name.toLowerCase() // 'custrecord_mb_ip_attribute_EnvelopeClsr'
							    	//'custrecord_mb_ip_attribute_envelopeclsr' // column_Name //'custrecord_mb_ia_item' //column_Name 
							    });
			
								//fldVal = (itemAttrRcd.getValue(fieldId));
								if (fldVal == null || fldVal == "")
								{
									// either log or email if the fldval linked to fieldID is blank/null.
								}
								else
								{
									//log.debug('debugging fieldvalue ',fldVal);
								}
								arrParent_values.push(fldVal); //always push
								/*
                                  var arrIds =  arrNsId_Parent.map(function(item,index){
                                                var id = item;
                                                return id;
                                    	}); 
                                    	arrIds contains array of parentItems (Example : ["100", "101"]
                                    	Note : you can pass arrIds to below filter  ["custrecord_mb_ia_item.parent","anyof",nsParent_internalId]
                                    	But to do above,  arrParent_values should have nsParent,parent_val
								*/
							}
						}
		  			}
		  			/*
		  			var search_filter = search.createFilter({
						name : 'custrecord_mb_ia_item.parent',
						operator : search.Operator.ANYOF,
						values : nsParent_internalId 
					});
					*/
		  			/*
					var search_filter = search.createFilter({
						name : 'formulanumeric', //parent //custrecord_mb_ia_item.parent
						formula : 'case when {custrecord_mb_ia_item.parent} = '+nsParent_internalId+' then 1 else 0 end',
						//join : 'custrecord_mb_ia_item',
						//operator : search.Operator.IS,
						operator : search.Operator.EQUALTO, //search.Operator.ANYOF,
						values : 1
					});
					*/
					/*
					var filter = search.createFilter({
						name : 'parent',
						join : 'custrecord_mb_ia_item',
						operator : search.Operator.IS,
						values: nsParent_internalId
						//values: ["30026"]
					});
					*/
					
					/*
					var formulaSearch = search.create({
			            type: 'item',
			            columns: ['itemid', 'displayname'],
			            filters: [
			                ["formulanumeric: case when {transaction.serialnumbers} ='AA' then 1 else 0 end","equalto","1"],
			                "OR",
			                ["formulanumeric: case when {transaction.serialnumbers} ='A0' then 1 else 0 end","equalto","1"]
			            ]
			        });
					*/
		  			/*
					var search_childLinkedToParent = search.load({
						id : 'customsearch_mb_item_attr_child_items',
						type : 'customrecord_mb_item_attribute',
						filters : search_filter 
					});
					ct =0;
					var parent_from_SavedSearch = '';
					search_childLinkedToParent.run().each(function(result_nsParent)
						{
							ct = ct+1;
							log.debug('result_nsParent: ',ct + ' & nsParent_internalId : '+ '##'+nsParent_internalId +' & child id : ' +result_nsParent.getValue('internalid')
								+ '##'+result_nsParent.getValue('custrecord_mb_ia_item')+ '##'+result_nsParent.getValue('formulatext'));
 								parent_from_SavedSearch = result_nsParent.getValue('formulatext');
								
							// + '##'+JSON.stringify(result_nsParent));
							
							//log.debug('result_nsParent: ',ct + ' & nsParent_internalId : '+ '##'+nsParent_internalId +' & child id : ' 
							//		+result_nsParent.getValue([0]) + '##'+result_nsParent.getValue([1])+ '##'+result_nsParent.getValue([2])+ '##'+result_nsParent.getValue([3]));

							if (parent_from_SavedSearch ==nsParent_internalId)	
								updateChildAttributes(result_nsParent.getValue('internalid'),arrParent_values,arrNsId,nsParent_internalId);
							
							return true;
							if (ct == 0 )
								{
								log.debug('Found no child item attribute records for Parent item : ',nsParent_internalId);
								}
						});
					*/
		  			var search_childLinkedToParent = search.create({
			  			   type: "customrecord_mb_item_attribute",
			  			   filters:
			  			   [
			  			      ["isinactive","is","F"], 
			  			      "AND", 
			  			      ["custrecord_mb_ia_item.parent","anyof",nsParent_internalId]
			  			   ],
			  			   columns:
			  			   [
			  			      search.createColumn({name: "internalid", label: "Internal ID"}),
			  			      search.createColumn({name: "custrecord_mb_ia_item", label: "Item"}),
			  			      search.createColumn({
			  			         name: "parent",
			  			         join: "CUSTRECORD_MB_IA_ITEM",
			  			         label: "Parent"
			  			      }),
			  			      search.createColumn({
			  			         name: "formulatext",
			  			         formula: "{custrecord_mb_ia_item.parent.id}",
			  			         label: "Parent_InternalID"
			  			      })
			  			   ]
			  			});
			  			var searchResultCount = search_childLinkedToParent.runPaged().count;
			  			log.debug("search_childLinkedToParent result count",searchResultCount);
						ct =0;
						var parent_from_SavedSearch = '';
			  			
			  			search_childLinkedToParent.run().each(function(result_nsParent){
							ct = ct+1;
							log.debug('result_nsParent: ',ct + ' & nsParent_internalId : '+ '##'+nsParent_internalId +' & child id : ' +result_nsParent.getValue('internalid')
								+ '##'+result_nsParent.getValue('custrecord_mb_ia_item')+ '##'+result_nsParent.getValue('formulatext'));
 								parent_from_SavedSearch = result_nsParent.getValue('formulatext');
								
							// + '##'+JSON.stringify(result_nsParent));
							
							//log.debug('result_nsParent: ',ct + ' & nsParent_internalId : '+ '##'+nsParent_internalId +' & child id : ' 
							//		+result_nsParent.getValue([0]) + '##'+result_nsParent.getValue([1])+ '##'+result_nsParent.getValue([2])+ '##'+result_nsParent.getValue([3]));

							if (parent_from_SavedSearch ==nsParent_internalId)	
								updateChildAttributes(result_nsParent.getValue('internalid'),arrParent_values,arrNsId,nsParent_internalId);
							
							return true;
			  			});
						if (ct == 0 )
						{
						log.debug('Found no child item attribute records for Parent item : ',nsParent_internalId);
						}
		  			
				}
			}
		} // function startRollDown ends
	}
);