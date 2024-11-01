/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
var feedsObj = [{
	"salesorder": 'customsearch_mb_so_mag_outbound_export'
},
{
	"itemfulfillment": "customsearch_mb_ship_mag_outbound_export"
},
{
	"invoices": "customsearch_mb_inv_skm_outbound_export"
}
];
var endpoint = "https://prod-179.westus.logic.azure.com:443/workflows/b9fc2fb718fb4a2cbb34530f6bf60a20/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Y5PTdA3Sxu0D0gTMIDIZUp2xMCcGKpHmUgBAPzkp1VY";
var firstLastFieldObj = {
		"Billing Attention"  : ["billing_firstname", "billing_lastname"],
		"Shipping Attention" : ["shipping_firstname", "shipping_lastname"]
}
var textFields = ["order_status", "product_name"/*,'website'*/];

define(['N/search', 'N/record', 'N/https','N/task'],

		function(search, record, https,task) {

	/**
	 * Definition of the Scheduled script trigger point.
	 *
	 * @param {Object} scriptContext
	 * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
	 * @Since 2015.2
	 */
	function execute(scriptContext) {
		try {

			log.debug("Feeds report Initiated");
			var firstLastFields = Object.keys(firstLastFieldObj);
			log.emergency("firstLastFields", firstLastFields);

			var processedArrays= [];
			for(var i = 0; i < feedsObj.length; i++) {

				log.debug("Object.keys(feedsObj[i]).length <=0", Object.keys(feedsObj[i]).length);
				if(Object.keys(feedsObj[i]).length <= 0)
					continue;

				var searchId = feedsObj[i][Object.keys(feedsObj[i])];

				var salesFeedSearchObj = search.load({
					id: searchId
				});
				var columns 	 = salesFeedSearchObj.columns;
				var results 	 = salesFeedSearchObj.run();
				var resultCount  = 0;
				var resultslice  = '';
				var totalResults = [];


				do {
					resultslice = results.getRange(resultCount, resultCount + 1000);
					for(var rs in resultslice) {
						totalResults.push(resultslice[rs]);
						resultCount++;
					}
				} while(resultslice.length >= 1000);

				var totalFeedsObj = [];
				log.debug("totalResults length", totalResults.length)

				for(var j = 0; j < totalResults.length; j++) {
					
					var result 		  = totalResults[j];
					log.debug("result",result);
					var itemFieldFlag = false;
					var orderObject   = {};
					var itemObject 	  = {};
					// added by lucas 11/2/2023 to prevent re-posting fulfillment data errantly; 
					if(Object.keys(feedsObj[i])[0]!='itemfulfillment'){
						processedArrays.push(result.getText(columns[0]));
					};

					var object = {};
					for(var k = 0; k < columns.length; k++) {
						var label = columns[k].label;


						if(textFields.indexOf(label) != -1) {
							var value = result.getText(columns[k]);
						} else {
							var value = result.getValue(columns[k]);
							if(label == 'order_date'){
								value = convertDateFormat(value);
							}
						}
						
						





						if(firstLastFields.indexOf(label) != -1) {
							label = label.toLowerCase().split(" ");
							value = value.split(" ");

							orderObject[label[0] + '_firstname'] = value[0];
							orderObject[label[0] + '_lastname'] = value[value.length - 1];

						} else if(label == 'custbody_mb_cc_last4' || label == 'custbody_mb_cc_type'){
							log.audit("label",label);
							object[label == 'custbody_mb_cc_last4' ? 'last4' : 'type']=(value != '' && value != null && value != undefined)  ? value : ' ';
							orderObject['payment_detail'] = object;
							
						}else{
							orderObject[label] = value;
						}

						
					}
					totalFeedsObj.push(orderObject);


				}
				log.debug('totalFeedsObj', totalFeedsObj);


				var _clientResponse = https.post({
					method: https.Method.POST,
					url: endpoint,
					body: JSON.stringify({
						'data': totalFeedsObj,
						'feedName': Object.keys(feedsObj[i])[0]
					})
				});
				log.debug("_clientResponse", _clientResponse)
				log.debug("processedArrays", processedArrays)

				if(_clientResponse && _clientResponse.code == 200){
					log.debug('successfully posted feed '+i)
				}
			}
          // moved to end of feed loop - MIBAR 8-27-22
          	var uniqueArray = processedArrays.filter(function(item, pos) {
              return processedArrays.indexOf(item) == pos;
            });
          log.debug("uniqueArray", uniqueArray)
          if(uniqueArray.length>0){
            var mrTask = task.create({
							taskType: task.TaskType.MAP_REDUCE,
							scriptId: 'customscript_tss_mr_processed_checkbox',
							deploymentId: 'customdeploy_tss_mr_processed_checkbox_2',
							params: {custscript_tss_internalid_array:JSON.stringify(processedArrays)}
						});
						mrTaskId = mrTask.submit();
						log.debug('mr task id',mrTaskId)
          }
          

		} catch (e) {
			log.error("Exception in Execute", e);
		}

	}
	
	function convertDateFormat(dateObj){
		try{
			var dateObject = new Date(dateObj);
			var finalDate  = [];
			
			finalDate.push(dateObject.getFullYear());
			finalDate.push((dateObject.getMonth()+1)<10 ? '0'+(dateObject.getMonth()+1) : (dateObject.getMonth()+1))
			finalDate.push((dateObject.getDate())<10 ? '0'+(dateObject.getDate()) : (dateObject.getDate()))
			var formattedFinalDate = finalDate.join('-');
			
			return formattedFinalDate;
			
		}catch(e){
			log.error("Exception in Date Format",e);
		}
	}

	return {
		execute: execute
	};

});