/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record','N/search'],
		/**
		 * @param{record} record
		 */
		(record,search) => {
			/**
			 * Defines the function definition that is executed before record is loaded.
			 * @param {Object} scriptContext
			 * @param {Record} scriptContext.newRecord - New record
			 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
			 * @param {Form} scriptContext.form - Current form
			 * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
			 * @since 2015.2
			 */
			const beforeLoad = (scriptContext) => {

			}

			/**
			 * Defines the function definition that is executed before record is submitted.
			 * @param {Object} scriptContext
			 * @param {Record} scriptContext.newRecord - New record
			 * @param {Record} scriptContext.oldRecord - Old record
			 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
			 * @since 2015.2
			 */
			const beforeSubmit = (scriptContext) => {


			}

			/**
			 * Defines the function definition that is executed after record is submitted.
			 * @param {Object} scriptContext
			 * @param {Record} scriptContext.newRecord - New record
			 * @param {Record} scriptContext.oldRecord - Old record
			 * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
			 * @since 2015.2
			 */
			const afterSubmit = (scriptContext) => {
				try{
					vendorRollDown(scriptContext);
					//UPCRollup(scriptContext)

				}catch(e){
					log.debug("Exeception in After Submit",e);
				}
			}

			const vendorRollDown = (scriptContext) => {
				try{

					var newRecordObj 			= scriptContext.newRecord;
					var oldRecordObj 			= scriptContext.oldRecord;

					var oldPreferredVendorIndex = oldRecordObj.findSublistLineWithValue({sublistId:'itemvendor',fieldId:'preferredvendor',value:true});
					var newPreferredVendorIndex = newRecordObj.findSublistLineWithValue({sublistId:'itemvendor',fieldId:'preferredvendor',value:true});
					log.audit("old and new indexes",`${oldPreferredVendorIndex} and ${newPreferredVendorIndex}`)

					var vendorCheck 			= false;
					if(newPreferredVendorIndex == -1){
						vendorCheck = false;
						newVendor   = null;
					}else if(oldPreferredVendorIndex != newPreferredVendorIndex){
						vendorCheck = true;
						var newVendor = newRecordObj.getSublistValue({sublistId:'itemvendor',fieldId:'vendor',line:newPreferredVendorIndex});
					}else{
						var oldVendor = oldRecordObj.getSublistValue({sublistId:'itemvendor',fieldId:'vendor',line:newPreferredVendorIndex});
						var newVendor = newRecordObj.getSublistValue({sublistId:'itemvendor',fieldId:'vendor',line:newPreferredVendorIndex});

						vendorCheck = oldVendor != newVendor ? true : false;
						log.audit("old and new vendor",`${oldVendor} and ${newVendor}`)
					}

					log.audit("vendorCheck",vendorCheck);
					if(!vendorCheck)
						return;

					var updatedPreferredVendor  = newVendor;

					var itemSearchObj = search.create({
						type	: "item",
						filters : [
                          		   [["custitem_mb_inv_item_parent","anyof",newRecordObj.id], 
     							   "OR",
						           ["parent","anyof",newRecordObj.id]], 
						           "AND", 
						           ["isinactive","is","F"]
						           ],
						           columns:[
						                    search.createColumn({ name: "itemid",sort: search.Sort.ASC,label: "Name"}),
						                    search.createColumn({name:'internalid',label:'Internal Id'})
						                    ]
					});

					var childId = [];
					itemSearchObj.run().each(function(result){
						log.audit("Result",result);
						var childItemObj = record.load({
							type	  : result.recordType,
							id		  : result.id,
							isDynamic : true
						});
						log.audit("childItemObj",childItemObj);
						if(updatedPreferredVendor != null){
							var childPrefVendorIndex =  childItemObj.findSublistLineWithValue({sublistId:'itemvendor',fieldId:'vendor',value:updatedPreferredVendor});
							log.audit("childPrefVendorIndex",childPrefVendorIndex);

							var lineCount        = childItemObj.getLineCount({sublistId:'itemvendor'});
							log.audit("lineCount",lineCount);

							childPrefVendorIndex ==-1 ? childItemObj.selectNewLine({ sublistId : 'itemvendor'}) : childItemObj.selectLine({ sublistId : 'itemvendor',line:childPrefVendorIndex});
							childPrefVendorIndex ==-1 ? childItemObj.setCurrentSublistValue({ sublistId : 'itemvendor',fieldId:'vendor',value: updatedPreferredVendor}) : '';
							childPrefVendorIndex ==-1 ? childItemObj.setCurrentSublistValue({ sublistId : 'itemvendor',fieldId:'subsidiary',value: newRecordObj.getSublistValue({sublistId:'itemvendor',fieldId:'subsidiary',line:newPreferredVendorIndex})}) : '';
							childPrefVendorIndex ==-1 ? childItemObj.setCurrentSublistValue({ sublistId : 'itemvendor',fieldId:'vendorcode',value: newRecordObj.getSublistValue({sublistId:'itemvendor',fieldId:'vendorcode',line:newPreferredVendorIndex})}) : '';
							childPrefVendorIndex ==-1 ? childItemObj.setCurrentSublistValue({ sublistId : 'itemvendor',fieldId:'purchaseprice',value: newRecordObj.getSublistValue({sublistId:'itemvendor',fieldId:'purchaseprice',line:newPreferredVendorIndex})}) : '';
							childItemObj.setCurrentSublistValue({ sublistId : 'itemvendor',fieldId:'preferredvendor',value: true});
							childItemObj.commitLine({sublistId:'itemvendor'});

						}else{
							var childPrefVendorIndex =  childItemObj.findSublistLineWithValue({sublistId:'itemvendor',fieldId:'preferredvendor',value:true});
							childItemObj.selectLine({ sublistId : 'itemvendor',line:childPrefVendorIndex});
							childItemObj.setCurrentSublistValue({ sublistId : 'itemvendor',fieldId:'preferredvendor',value: false});
							childItemObj.commitLine({sublistId:'itemvendor'});
						}

						childItemObj.save()
						return true;
					});





				}catch(e){
					log.debug("Exception in Vendor Roll Down",e);
				}
			}

			const UPCRollup = (scriptContext) => {
				try{
					/*if (scriptContext.type !== scriptContext.UserEventType.CREATE)
						return;
*/
					var newRecordObj  = scriptContext.newRecord;
					var itemInternaid = newRecordObj.id;
					var itemName	    = newRecordObj.getValue({fieldId:'itemid'});
					var subItemOf     = newRecordObj.getValue({fieldId:'parent'});
					var upcCode       = newRecordObj.getValue({fieldId:'upccode'});
					log.debug("Parent Item",subItemOf)
					if(!subItemOf){
						log.debug("UPC Rollup Terminated",`${itemName} (id:${itemInternaid}) is a parent item.`);
						return;
					}
					
					if(!upcCode){
						log.debug("UPC Rollup Terminated",`${itemName}(id:${itemInternaid}) has no UPC code.`);
						return;
					}

					var rfsMultiupcSearchObj = search.create({
						type	   : "customrecord_rfs_multiupc",
						filters : [
						           ["custrecord_rfs_multiupc_item","anyof",subItemOf],
						           'AND',
						           ["custrecord_rfs_multiupc_upc","is",upcCode]
						           ],
					    columns : [
						           search.createColumn({name: "custrecord_rfs_multiupc_upc", label: "UPC"}),
						           search.createColumn({name: "custrecord_rfs_multiupc_unit", label: "Unit"}),
						           search.createColumn({name: "custrecord_rfs_multiupc_pickingunit", label: "Picking Unit"})
						          ]
					});
					var searchResultCount = rfsMultiupcSearchObj.runPaged().count;
					if(searchResultCount>0)
						return;

					var rfsUpcRecordObj = record.create({type:'customrecord_rfs_multiupc',isDynamic:true});

					rfsUpcRecordObj.setValue({fieldId:"custrecord_rfs_multiupc_upc",value:upcCode})
					rfsUpcRecordObj.setValue({fieldId:"custrecord_rfs_multiupc_item",value:subItemOf})

					var rfsUpcRecordId = rfsUpcRecordObj.save();
					log.debug("rfsUpcRecordId",rfsUpcRecordId);


				}catch(e){
					log.error("Exception in UPC Rollup.",e);
				}
			}

			return {beforeLoad, beforeSubmit, afterSubmit}

		});
