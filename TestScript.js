require([
    'N/format',
    'N/https',
    'N/record',
    'N/runtime',
    'N/search',
    'N/url',
    './lib/MBFormatFunctions.js',
    // './lib/MBHelpers.js'
],
    function (format, https, record, runtime, search, url, mbformat) {


        const callPack = (fulfillmentId) => {
            const forms = [82,295,300,308];        
            try {
                var docRequestStr = JSON.stringify({
                    internalId : fulfillmentId, 
                    formId  : forms[3], 
                    printMode: "PDF"
                }); 
                console.log(docRequestStr); 
                var murl = url.resolveScript({
                    scriptId: 'customscript_mb_sl_renderpack',
                    deploymentId: 'customdeploy_mb_sl_renderpack',
                    returnExternalUrl: true,
                    params: { custparam_mb_docRequest : docRequestStr}
                });
            console.log("created url ",murl); 
            var response = https.request({
                url:murl,
                method: https.Method.GET
            });
            console.log("Response is " + response.body); 
            // if(response){
            //     oResp = JSON.parse(response.body); 
            //     if(!oResp.success) log.error("update error",oResp.response);
            // }
    
            }
            catch (err) { console.log(err) }
             
        }

        const callShip = (fulfillmentId) => {
            const forms = [23,121];        
            try {
                var docRequestStr = JSON.stringify({
                    internalId      : fulfillmentId, 
                    templateId      : forms[0], 
                    printMode: "PDF"
                }); 
                console.log(docRequestStr); 
                var murl = url.resolveScript({
                    scriptId: 'customscript_mb_sl_rendership',
                    deploymentId: 'customdeploy_mb_sl_rendership',
                    returnExternalUrl: true,
                    params: { custparam_mb_docRequest : docRequestStr}
                });
            // console.log("created url ",murl); 
            var response = https.request({
                url:murl,
                method: https.Method.GET
            });
            console.log("Response is " + response.body); 
            // if(response){
            //     oResp = JSON.parse(response.body); 
            //     if(!oResp.success) log.error("update error",oResp.response);
            // }
    
            }
            catch (err) { console.log(err) }
             
        }

        const callCSV = (fulfillmentId) => {
            try {
                var docRequestStr = JSON.stringify({internalId : fulfillmentId,searchId: "customsearch16368"});   // ITF: Search export fields (CODE LINKED SEARCH)
                console.log(docRequestStr); 
                var murl = url.resolveScript({
                    scriptId: 'customscript_mb_sl_searchtocsv',
                    deploymentId: 'customdeploy_mb_sl_searchtocsv',
                    returnExternalUrl: true,
                    params: { custparam_mb_docRequest : docRequestStr}
                });
            // console.log("created url ",murl); 
            var response = https.request({
                url:murl,
                method: https.Method.GET
            });
            console.log("Response is " + response.body); 
            // if(response){
            //     oResp = JSON.parse(response.body); 
            //     if(!oResp.success) log.error("update error",oResp.response);
            // }
    
            }
            catch (err) { console.log(err) }             
        }

		/** gets an order count for a given batch from a search
		 * 
		 *@returns retVal - an int holding the requested count for this batch
		 */
         function getSearchCount(searchId,importBatch){
			log.debug("searchId",searchId);        		
			var searchObj = search.load({id : searchId});
			log.debug("importBatch",importBatch);

			var orderType = importBatch.substring(0,3) == "SQL" ? "CustInvc" : "SalesOrd" ; 			
			var filter = search.createFilter({ name :'type',operator : search.Operator.ANYOF,values : [orderType]});
			searchObj.filters.push(filter);
	
			if (importBatch){
				var filter = search.createFilter({ name :'custbody_mb_import_batch',
					operator : search.Operator.IS,
					values : importBatch});
				searchObj.filters.push(filter);
			};
			var columns = searchObj.columns;
            console.log("search",JSON.stringify(searchObj));
			var retVal = 0; 
			searchObj.run().each(function(result) {
				// console.log(result.getValue(columns[0])); 
				console.log("retVal",result.getValue(columns[0])); 				
				retVal = result.getValue(columns[0])
				return true;
			});
			return retVal; 
		}
        var importBatch  = 'CSV20240110-013039548'; 
        var actualLineCount = getSearchCount("customsearch_mb_batch_items",importBatch);
        console.log(actualLineCount); 

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // var fulfillmentId = 22978298; 
        //callCSV(fulfillmentId); 
        // callShip(fulfillmentId);         
        // console.log(JSON.stringify(getFulfillment(fulfillmentId)));  
    });