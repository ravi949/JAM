/**
 *@NApiVersion 2.0
 *@NScriptType ClientScript

 define(['N/ui/dialog', 'N/search'], function(
		dialog, search) {
 */

define(['N/ui/dialog', 'N/error','N/search'], function(
		dialog, error,search) {
		const searchId = 'customsearch_mb_attribute_parent_only';

        function initPage(context) {
			
			log.debug('Mode is ' + context.mode );
            if (context.mode == 'create' || context.mode == 'copy')
			{
				log.debug('Mode is ' + context.mode + ' and is not allowed');
				var options = {
					title: 'Item Attribute Creation',
					message: 'You can not create Item attribute record directly. It will be automatically created when new item / kit is added. Please close this window.'
					 };
					 
					dialog.alert(options);
				return;
			}
			
            var currentRecord = context.currentRecord;
			var ns_Item = currentRecord.getValue({fieldId : "custrecord_mb_ia_item"});
			var Item_parent = currentRecord.getValue({fieldId : "custrecord_mb_attr_item_parent_calc"});
			var Sku = currentRecord.getValue({fieldId : "custrecord_mb_attr_item_sku"});
			var nsId_ItemAttrId = currentRecord.getValue({fieldId : "id"});
			
			log.debug("ns_Item,  nsId_ItemAttrId",ns_Item + '##' +nsId_ItemAttrId  + '##' +Item_parent + '##' +Sku);
			var isChild = false;
			
			if (Item_parent !='')
				isChild = true;

			if (Item_parent == '' && (Sku.indexOf('-kit')!=-1))
				isChild = true;
			
			if (isChild==false) // this script only caters to itemAttributes that are only ChildItem (or kit)
			{
				log.debug('Returning back and isChild is '+isChild);
				return;
			}

			try {

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
				//DisableParentFields(ns_Item,arrNsId,nsId_ItemAttrId);
				for (var i = 0; arrNsId.length>i;i++){
					var column_Name = arrNsId[i];
					var field = currentRecord.getField({
									fieldId: column_Name
								});
					field.isDisabled = true;
				}
			}
			catch(err){
				log.error("error",JSON.stringify(err));
			};
        }
	/*	
function check_saveRecord(scriptContext)
	{
		if (scriptContext.mode == 'create')
		{
			log.debug('Mode is ' + context.mode + ' and is not allowed');
			var options = {
				title: 'Item Attribute Creation',
				message: 'You can not create Item attribute record directly. It will be automatically created when new item / kit is added. Please close this window.'
				 };
				 
				dialog.alert(options);
			return false;
		}
		
	}*/		

    return {
		//saveRecord : check_saveRecord,
        pageInit: initPage
    };
});
