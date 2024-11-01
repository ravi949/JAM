/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/runtime','N/search','N/record'],

		function(runtime,search,record) {

	function getInputData() {
		try{
			var scriptObj = runtime.getCurrentScript();
			var internalIdArray = scriptObj.getParameter({name: 'custscript_tss_internalid_array'});
			internalIdArray = JSON.parse(internalIdArray);
			log.debug('internalIdArray',internalIdArray);
			log.debug('internalIdArray[0]',internalIdArray[0]);
			return search.create({
				type: "transaction",
				filters:
					[
					 ["internalid","anyof",internalIdArray], 
					 "AND", 
					 ["mainline","is","T"]
					 ],
					 columns:
						 [
						  search.createColumn({name: "type", label: "Type"}),
						  search.createColumn({name: "internalid", label: "Internal ID"})
						  ]
			});
			
		}catch(e){
			log.error("error in get data",e)
		}

	}


	function map(context) {
		try{
			log.audit("context.value",context.value);
			var recType = {"SalesOrd":"salesorder","ItemShip":"itemfulfillment","CustInvc":"invoice","CashSale":"cashsale","CustCred":"creditmemo","CashRfnd":"cashrefund"};
			var searchResult = JSON.parse(context.value);
			var recordID          = searchResult.id;
			var transactionType       = searchResult.values.type.value;
			log.debug("transactionType",transactionType)
			var recTypeValue = recType[transactionType];
			if(recordID){
			log.debug('Entered')
			var recID = record.submitFields({
			    type:recTypeValue,
			    id: recordID,
			    values: {
			    	custbody_tss_shipping_confirmation_box: true
			    },
			    options: {
			        enableSourcing: false,
			        ignoreMandatoryFields : true
			    }
			});
			log.debug('recID is',recID)
			
			
			}
			
		}catch(e){
			log.error("error in map data",e)
		}

	}


	function reduce(context) {

	}


	function summarize(summary) {

	}

	return {
		getInputData: getInputData,
		map: map,
		reduce: reduce,
		summarize: summarize
	};

});
