/**
 * Module Description
 *
 * Version    Date            Author           Remarks
 * 1.00       05 Dec 2017     rcm
 *
 */


/**
 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
 * @appliedtorecord recordType
 *
 * @param {String} type Operation types: create, edit, delete, xedit
 *                      approve, reject, cancel (SO, ER, Time Bill, PO & RMA only)
 *                      pack, ship (IF)
 *                      markcomplete (Call, Task)
 *                      reassign (Case)
 *                      editforecast (Opp, Estimate)
 * @returns {Void}
 */
function mbUserEventBeforeSubmit(type){
	try
	{
    	var defaultBins = nlapiGetContext().getSetting("SCRIPT","custscript_mb_default_bins");
    	nlapiLogExecution("debug","defaultbins",defaultBins);
    	if(!defaultBins) return;
    	var arDefaultBins  = defaultBins.split(",");
    	var binSubList = "binnumber";
    	var lineCount = nlapiGetLineItemCount(binSubList);
    	var addFirst = true; var add2nd = true ;
    
    	for (var i = 1; i <= lineCount; ++i)
    	{
    		if(arDefaultBins[0] == nlapiGetLineItemValue(binSubList, "binnumber", i)){
        		nlapiSelectLineItem(binSubList,i);
    			nlapiSetCurrentLineItemValue(binSubList, 'preferredbin',"T");
        		nlapiCommitLineItem(binSubList);
    			addFirst = false;
    		}
    		if(arDefaultBins[1] == nlapiGetLineItemValue(binSubList, "binnumber", i)){
    			add2nd = false;
    		}
    		nlapiLogExecution("debug","bin pref ",nlapiGetLineItemText(binSubList, "preferredbin", i));
    		nlapiLogExecution("debug","bin location",nlapiGetLineItemValue(binSubList, "location", i));
    	}
		nlapiLogExecution("debug","First",arDefaultBins[0]);
    	if(addFirst && arDefaultBins[0]){
    		nlapiSelectNewLineItem(binSubList);
    		nlapiSetCurrentLineItemValue(binSubList, 'preferredbin',"T");
    		nlapiSetCurrentLineItemValue(binSubList, 'location',DEFAULT_LOCATION);
    		nlapiSetCurrentLineItemValue(binSubList, 'locationactive',"Yes");
    		nlapiSetCurrentLineItemValue(binSubList, 'binnumber',arDefaultBins[0]);
    		nlapiCommitLineItem(binSubList);
    	}
    	if(add2nd && arDefaultBins[1]){
    		nlapiLogExecution("debug","@nd",arDefaultBins[1]);
    		// add2nd
            nlapiSelectNewLineItem(binSubList);
    		nlapiSetCurrentLineItemValue(binSubList, 'preferredbin',"T");
    		nlapiSetCurrentLineItemValue(binSubList, 'location',DEFAULT_LOCATION);
    		nlapiSetCurrentLineItemValue(binSubList, 'locationactive',"Yes");
    		nlapiSetCurrentLineItemValue(binSubList, 'binnumber',arDefaultBins[1]);
    		nlapiCommitLineItem(binSubList);
    	}
	}
	catch (e) {
		 nlapiLogExecution("error","error mbUEBS .",e);
	}

}

/**
 * The recordType (internal id) corresponds to the "Applied To" record in your script deployment.
 * @appliedtorecord recordType
 *
 * @param {String} type Operation types: create, edit, delete, xedit,
 *                      approve, cancel, reject (SO, ER, Time Bill, PO & RMA only)
 *                      pack, ship (IF only)
 *                      dropship, specialorder, orderitems (PO only)
 *                      paybills (vendor payments)
 * @returns {Void}
 */


const DEFAULT_LOCATION = "22"; 			// DropShip
function mbUserEventAfterSubmit(type){

	nlapiLogExecution("debug","parent",nlapiGetFieldValue("parent"));
	if(type=="edit")
	{
		try
		{
			nlapiLogExecution("debug","parent",nlapiGetFieldValue("parent"));
			nlapiLogExecution("debug","Rolldown",nlapiGetFieldValue("custitem_mb_item_upd_child_bins"));
			// update bins flag is not tripped.
			if(nlapiGetFieldValue("custitem_mb_item_upd_child_bins") == 'F' || nlapiGetFieldValue("custitem_mb_item_upd_child_bins")== null) return;
			
			// get out if its a child item
			if(nlapiGetFieldValue("parent")!= null && nlapiGetFieldValue("parent")!= "") return;

			// get the fields to roll down
			var fieldsToRoll = nlapiGetContext().getSetting("SCRIPT","custscript_mb_fields_to_rolldown");

			nlapiLogExecution("debug","rolldown field",fieldsToRoll);
			var fieldList  = fieldsToRoll.split(",");

			nlapiLogExecution("debug","before edit",type);

			var binSubList = "binnumber";
			var binList = new Array();
			var lineCount = nlapiGetLineItemCount(binSubList);
			for (var i = 1; i <= lineCount; ++i)
			{
                var binItem = {
        		locationactive : 	nlapiGetLineItemValue(binSubList, "locationactive ", i),
        		onhand : 	nlapiGetLineItemValue(binSubList, "onhand ", i),
        		onhandavail	 : nlapiGetLineItemValue(binSubList, "onhandavail", i),
        		preferredbin	 :nlapiGetLineItemValue(binSubList, "preferredbin", i),
        		binnumber  : nlapiGetLineItemValue(binSubList, "binnumber", i),
        		location : nlapiGetLineItemValue(binSubList, "location", i)
                }
                binList.push(binItem);
       			nlapiLogExecution("debug","bin pref ",nlapiGetLineItemText(binSubList, "preferredbin", i));
//        		nlapiLogExecution("debug","bin location",nlapiGetLineItemValue(binSubList, "location", i));
			}

			var filters = [ new nlobjSearchFilter('parent',null, 'is', nlapiGetRecordId())];
			var columns = []
			var searchResult = nlapiSearchRecord('inventoryitem', null, filters, columns);
			if(searchResult){
			        for (var j = 0; j < searchResult.length; j++) {
				        nlapiLogExecution("debug", "sub record id ", searchResult[j].getId());
				        var rcdItem = nlapiLoadRecord("inventoryitem",searchResult[j].getId());
				        if(rcdItem !=null){
				        	// set header field here.
				        	// remove old lines
/*
				        	var bincount = rcdItem.getLineItemCount(binSubList);
		        			nlapiLogExecution("debug","bin count",bincount);
				        	for(var i = bincount; i >= 1; i--) {
				        		rcdItem.removeLineItem(binSubList, i);
				        	}
		        			nlapiLogExecution("debug","bin count after ",rcdItem.getLineItemCount(binSubList));
*/
			        		// update header fields
				        	for (var k = 0 ;k< fieldList.length;k++){
			        			nlapiLogExecution("debug",fieldList[k],nlapiGetFieldValue(fieldList[k]));
			        			if(fieldList[k]){
			        				if(fieldList[k]!="cost"){
			        					rcdItem.setFieldValue(fieldList[k],nlapiGetFieldValue(fieldList[k]));
			        				}
			        				else{		// cost
			        					var pack = parseIntOrZero(rcdItem.getFieldValue("custitem_mb_item_pack_size"));
			        					pack  = pack == 0 ? 1 : pack;
			        					var cost = parseFloatOrZero(nlapiGetFieldValue(fieldList[k]));
			        					var exCost = roundVal((cost * pack),5);
			        					rcdItem.setFieldValue(fieldList[k],exCost);
			        				}
			        			}
				        	}

				        // update bins
						for (var int = 0; int < binList.length; int++) {
				                var binItem = binList[int];
				                nlapiLogExecution("debug","bin number",binItem.binnumber);
		                        rcdItem.selectNewLineItem(binSubList);
		                        rcdItem.setCurrentLineItemValue(binSubList, 'location',binItem.location);
		        				rcdItem.setCurrentLineItemValue(binSubList, 'locationactive',binItem.locationactive);
		        				rcdItem.setCurrentLineItemValue(binSubList, 'binnumber',binItem.binnumber);
		        				rcdItem.setCurrentLineItemValue(binSubList, 'preferredbin',binItem.preferredbin);
		        				rcdItem.commitLineItem(binSubList);

						}
						nlapiSubmitRecord(rcdItem,false);
				        }
			        }
			}

		}
		catch (e) {
			 nlapiLogExecution("error","error mbUEAS .",e);
		}

	} else if (type == 'create'){
		try {
			nlapiLogExecution('debug','in after submit');
          var recType = nlapiGetRecordType();
          if(recType == 'noninventoryresaleitem'){recType = 'noninventoryitem'}
			var rec = nlapiLoadRecord(recType,nlapiGetRecordId());
			var type = nlapiGetRecordType();
			var emptyAttr = createEmptyAttrRec(rec);
			// var emptyInvRec = createEmptyInvRec(rec);
			if(emptyAttr =='success' /*& emptyInvRec == 'success'*/){
				var submit = nlapiSubmitRecord(rec);
			} else {
				nlapiLogExecution('error','err',JSON.stringify(err));
			}
			nlapiLogExecution('debug','status',emptyAttr);
		} catch(err){
			nlapiLogExecution('error','err',JSON.stringify(err));
		}
	}

}

function parseIntOrZero(val){

 	return isNaN(parseInt(val)) ? 0 : parseInt(val);
 }

function parseFloatOrZero(val){

	return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
	}

function roundVal(val) {
    var dec = 2;
    var result = Math.round(val * Math.pow(10, dec)) / Math.pow(10, dec);
    return result;
}
function emptyIfNull(val) { return val == null ? "" : val; }

function createEmptyAttrRec(rec){
	try {
		if (rec){
			//nlapiLogExecution('debug','rec & id',id+', '+type);
			//var rec = nlapiLoadRecord(type,id);
			nlapiLogExecution('debug',rec.getId());
			var newAttrId = attrRec.insertRecord(rec.getId());
			if (newAttrId!=null){
				rec.setFieldValue('custitem_mb_linked_item_attribute',newAttrId);
				//var submit = nlapiSubmitRecord(rec);
				return 'success';
			} else {
				return 'failure';
			}
		} else {
			nlapiLogExecution('debug','failure');
			return 'failure';
		}
	} catch (err){
		nlapiLogExecution('error','Error creating empty attr rec', JSON.stringify(err));
		return 'failure';
	}
	
}

var attrRec = {
	insertRecord : function(id){
		try {
			if (id){
				nlapiLogExecution('debug','submit',submit);
				var rec = nlapiCreateRecord('customrecord_mb_item_attribute');
				rec.setFieldValue('custrecord_mb_ia_item',id);
				var submit = nlapiSubmitRecord(rec);
				nlapiLogExecution('debug','submit',submit);
				return submit;
			} else {
				return null;
			}
		} catch(Err){
			nlapiLogExecution('error','Error inserting arr record',JSON.stringify(Err));
			return null
		}

	}	
}

function createEmptyInvRec(rec){
	try {
		if (rec){
			//nlapiLogExecution('debug','rec & id',id+', '+type);
			//var rec = nlapiLoadRecord(type,id);
			nlapiLogExecution('debug',rec.getId());
			var itemName = rec.getFieldValue('itemid');
			var newInvRecId = invRec.insertRecord(rec.getId(),itemName);
			if (newInvRecId!=null){
				rec.setFieldValue('custitem_mb_inventory_record',newInvRecId);
				//var submit = nlapiSubmitRecord(rec);
				return 'success';
			} else {
				return 'failure';
			}
		} else {
			nlapiLogExecution('debug','failure');
			return 'failure';
		}
	} catch (err){
		nlapiLogExecution('error','Error creating empty attr rec', JSON.stringify(err));
		return 'failure';
	}
	
}

var invRec = {
	insertRecord : function(id,itemName){
		try{
			if(id){
				nlapiLogExecution('debug','submit',submit);
				var rec = nlapiCreateRecord('customrecord_mb_item_inventory');
				rec.setFieldValue('custrecord_mb_item_inventory_rec',id);
				rec.setFieldValue('name',itemName)
				var submit = nlapiSubmitRecord(rec);
				nlapiLogExecution('debug','submit',submit);
				return submit;
			} else {
				return null;
			}
		}catch(err){
			nlapiLogExecution('error','Error Inserting Inv Record',JSON.stringify(err));
			return null;
		}
	}
}

