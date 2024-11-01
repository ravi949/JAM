/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([   	'N/record',
        	'N/runtime',
        	'N/search',
			'N/email',
			'N/task'],
/**
 * @param {error}
 *            error
 * @param {record}
 *            record
 */
function(record,runtime,search,email,task) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {string} scriptContext.type - Trigger type
     * @param {Form} scriptContext.form - Current form
     * @Since 2015.2
    */
  
    function beforeLoad(context) {

    }
     /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(scriptContext) {
    	
    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
	 
    function afterSubmit(scriptContext) {
      	log.debug("ns_ParentItem,  nsId_ItemAttrId in aftersubmit", '##');
      
  	    if (scriptContext.type != scriptContext.UserEventType.DELETE){
            var rec = scriptContext.oldRecord;
            if(!rec) return;
            
      	    var ns_ParentItem = rec.getValue({fieldId : "custrecord_mb_ia_item"});
			var Item_parent = rec.getValue({fieldId : "custrecord_mb_attr_item_parent_calc"});
			var Sku = rec.getValue({fieldId : "custrecord_mb_attr_item_sku"});
			var nsId_ItemAttrId = rec.getValue({fieldId : "id"});
			
      	    log.debug("ns_ParentItem,  nsId_ItemAttrId",ns_ParentItem + '##' +nsId_ItemAttrId  + '##' +Item_parent + '##' +Sku);
			
			if (Item_parent =='' && (Sku.indexOf('-kit')==-1)) //Meaning it is not a "kit", ns_ParentItem 
				{
		
					try {
						const searchId = 'customsearch_mb_attribute_parent_only';

						var arrNsId = new Array();
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
						
					}
					catch(err){
						log.error("error",JSON.stringify(err));
					};
					startRolldown(ns_ParentItem,arrNsId,nsId_ItemAttrId);
				}
				else
				{
					log.debug("ns_ParentItem is blank ",ns_ParentItem);
					
				}
  	    }
    }
	
		// add new functions here
		function startRolldown(nsParent_internalId,arrNsId,nsItemAttr_internalId) //function startRolldown(arrNsId_Parent,arrNsId,arrNsId_ItemAttrId)
		{
			if (nsParent_internalId !='')
			{
				//for (var iPar = 0; arrNsId_Parent.length>iPar;iPar++)
				var ct = 0;
				var fldVal = ''; //(itemAttrRcd.getValue(fieldId));
	      		var itemAttrRcd = record.load({
                    type: 'customrecord_mb_item_attribute',
                    id: nsItemAttr_internalId, //12
                    isDynamic: true
                    });
	      		
				//log.debug('debugging arrNSID step 1',nsParent_internalId);				
				if(itemAttrRcd){
					//log.debug('debugging arrNSID step 2a',nsParent_internalId)
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
								log.debug('debugging fieldvalue ',fldVal);
							}
							arrParent_values.push(fldVal); //always push
						}
					}
				}
				
				/*
				   [
					  ["isinactive","is","F"], 
					  "AND", 
					  ["custrecord_mb_ia_item.parent","anyof",nsParent_internalId]
				   ],
				*/
   
				var search_childLinkedToParent = search.create({
					   type: "customrecord_mb_item_attribute",
					   filters:
					   [
						  [["custrecord_mb_ia_item.parent","anyof",nsParent_internalId],"OR",["custrecord_mb_ia_item.custitem_mb_item_group_assembled","anyof",nsParent_internalId],"OR",["custrecord_mb_ia_item.custitem_mb_inv_item_parent","anyof",nsParent_internalId]], 
						  "AND", 
						  ["isinactive","is","F"]
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
							 name: "formulatext2",
							 formula: "{custrecord_mb_ia_item.custitem_mb_item_group_assembled.id}",
							 label: "Parent_InternalID"
						  }),
						  search.createColumn({
							 name: "formulatext1",
							 formula: "nvl({custrecord_mb_ia_item.parent.id},{custrecord_mb_ia_item.custitem_mb_inv_item_parent.id})",
							 label: "Parent_InternalID"
						  })
					   ]
					});
					var searchResultCount = search_childLinkedToParent.runPaged().count;
					//log.debug("search_childLinkedToParent result count",searchResultCount);
					ct =0;
					var parent_from_SavedSearch = '';
					
					search_childLinkedToParent.run().each(function(result_nsParent){
						ct = ct+1;
						log.debug('result_nsParent: ',ct + ' & nsParent_internalId : '+ '##'+nsParent_internalId +' & child id : ' +result_nsParent.getValue('internalid')
							+ '##'+result_nsParent.getValue('custrecord_mb_ia_item')+ '##'+result_nsParent.getValue('formulatext1')+ '##'+result_nsParent.getValue('formulatext2'));
							parent_from_SavedSearch = result_nsParent.getValue('formulatext1');
							if (parent_from_SavedSearch == '')
								parent_from_SavedSearch = result_nsParent.getValue('formulatext2');
							
						if (parent_from_SavedSearch ==nsParent_internalId)	
							updateChildAttributes(result_nsParent.getValue('internalid'),arrParent_values,arrNsId,nsParent_internalId);
						
						return true;
					});
					if (ct == 0 )
					{
					log.debug('Found no child item attribute records for Parent item : ',nsParent_internalId);
					}
		  			
			}
		} // function startRollDown ends
	
	

		// childAttributeUpdate
		function updateChildAttributes(childItemAttr_Id,arrParent_values,arrNsId,nsActualParent)
		{
      		var childItemAttrRcd = record.load({
                type: 'customrecord_mb_item_attribute',
                id: childItemAttr_Id,
                isDynamic: true
                }
      		);
			//log.debug('debugging arrNSID with childItemAttr_Id ',childItemAttr_Id + '##'+arrParent_values.length);
  			if(childItemAttrRcd)
  			{
					for (var i = 0; arrNsId.length>i;i++){
						var column_Name = arrNsId[i];
						//if (column_Name == 'custrecord_mb_ip_attribute_EnvelopeClsr')
						//{
							log.debug('debugging arrNSID step (child ItemAttr) ',column_Name)
							childItemAttrRcd.setValue({
								fieldId: column_Name.toLowerCase(),
								value: arrParent_values[i]
							});
						//}
					}
              		childItemAttrRcd.setValue({
                      fieldId : 'custrecord_mb_sync_attributes',
                      value : true
                    });
					var childItemSaved_Id = childItemAttrRcd.save(); //uncomment later
					log.debug('Child Item attribute record saved : ',childItemSaved_Id);
  			}
		}    
    
    return {
        //beforeLoad: beforeLoad,
        //beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});